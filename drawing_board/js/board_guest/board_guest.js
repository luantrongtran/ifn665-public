/**
 * Created by lua on 16/04/2016.
 */

//These variables are used for clients who want to join the board of another user.
var peerConnection, dataChannel;

/**
 * Contains users connecting to the using board. This doesn't include the board's owner
 * @type {Array}
 */
//var connectingUsers = [];

/**
 * Sends the request to join a created board
 */
function sendRequestToJoinABoard() {
    if(page2_board_id.value.length == 0) {
        return;
    }

    //Setup the dataChannel object for the invitee
    //setupDataChannelForInvitee();

    sendToWebSocketServer({
        type: "requestToJoinABoard",
        board_id: page2_board_id.value
    });

}

/**
 * handles the response from the server to check if the request to join a board is successfully delivered to the
 * board's owner or not. This doesn't imply if the board's owner accept or deny the request.
 * @param data
 */
function onRequestToJoinABoard(data) {
    if(data.success) {
        //request is successfully sent to the board's owner
        alert("Please wait for the owner's response");
    } else {
        //failed to sendToWebSocketServer the request
        page2_displayErrorMsg(data.message);
    }
}

/**
 * Receives the response from the board's owner that he/she denied the request to join his/her board.
 */
function onRequestDenied() {
    console.log("The board's owner denied the request");
    page2_displayErrorMsg("The board owner denied your request");
}

/**
 * The client's browser receives WebRTC offer from the owner. This means the board's owner has accepted the
 * request to join the board of the guest user.
 */
function onOfferReceived(data) {
    console.log("Receive WebRTC offer from the board owner: " + data.board_owner);

    goToPage3();//go to drawing board.

    boardOwnerUsername = data.board_owner;

    preparePeerConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    //addJoiner(data.sender); //add the username of the sender

    //creates answer and reply to the board's owner
    peerConnection.createAnswer(function (answer) {
        console.log("WebRTC Answer the offer of the board's owner " + data.board_owner);
        peerConnection.setLocalDescription(answer);
        sendToWebSocketServer({
            type: "webRTCAnswer",
            //success: true,
            answer: answer,
            board_owner: data.board_owner
        });
    }, function (error) {
        console.log("error in reply to the sender who sent the request to join the board");
    });
}

/**
 * When a user successfully creates a new board, the user needs to be ready for peer connection.
 * This function makes the peer connection ready, so that another user can connect to it.
 */
function preparePeerConnection() {

    if (hasRTCPeerConnection()) {
        console.log("Setting up peer connection");
        var configuration = {
            "iceServers": [{ "url": WebRTCIceUrl }]
        };
        peerConnection = new RTCPeerConnection(WebRTCPeerConfiguration, WebRTCPeerConnectionOptions);

        // Setup ice handling
        peerConnection.onicecandidate = function (event) {
            console.log("trading candidate");
            if (event.candidate) {
                sendToWebSocketServer({
                    type: "candidate",
                    candidate: event.candidate,
                    connected_user: boardOwnerUsername
                });
            }
        };

        console.log("Setup data channel");
        peerConnection.ondatachannel = function (event) {
            dataChannel = event.channel;
            dataChannel.onopen = onDataChannelWithBoardOwnerOpenedCallBack;

            dataChannel.onclose = onDataChannelWithBoardOwnerClosedCallBack;

            dataChannel.onerror = function() {
                console.log("Data Channel error");
            };
            dataChannel.onmessage = onMessageReceivedFromBoardOwnerCallBack;
        };

    } else {
        alert("Sorry, your browser does not support WebRTC.");
    }

}

function onDataChannelWithBoardOwnerOpenedCallBack() {
    console.log("Data channel opened");
    var connectedMsg = formatMessageColor("(" + currentUsername + " has been connected)", 'green');
    sendChatMessageToServer(connectedMsg, false, false);
}

/**
 * callback method triggered when receives message from server
 * @param event
 */
function onMessageReceivedFromBoardOwnerCallBack(event) {
    console.log("data channel message from board's owner: ", event.data);

    var data = JSON.parse(event.data);
    if (data.type == DataTransferType.CHAT_MESSAGE) {
        //if the data is a chat message
        addMessageToChatScreen(data.content);//add the msg into the chat screen
    } else if (data.type == DataTransferType.CANVAS_DATA) {
        var canvasData = data.content;
        if (canvasData.command == DrawingCommands.DRAWING) {
            //if the command is drawing
            var canvasObj = canvasData.canvasData;
            updateDrawingObjectOfAPeer(data.sender, canvasObj, canvasData.nameRenderingPosition);

        } else if (canvasData.command == DrawingCommands.FINISH_DRAWING) {
            //finish drawing command sent when the other peers finish what they were drawing
            //console.log("Finish drawing : " , data.sender);
            if(arrDrawingObject[data.sender].type == TOOL.PENCIL) {
                finishPencilDrawing(arrDrawingObject[data.sender].pointArray, arrDrawingObject[data.sender].options);
            }
            delete arrDrawingObject[data.sender];

            arrNameRenderingPosition[data.sender].remove();
            delete arrNameRenderingPosition[data.sender];
        }
    } else if (data.type == DataTransferType.SYNC) {
        var syncData = data.content;

        if(syncData.canvasData) {
            //Handle canvas data
            syncCanvasDataFromServer(syncData.canvasData);
        }

        if (syncData.userList) {
            refreshUserListFromServer(syncData.userList);
        }

        if (syncData.canvasSize) {
            updateCanvasSize(syncData.canvasSize.width, syncData.canvasSize.height);
        }
    }
}

function onDataChannelWithBoardOwnerClosedCallBack() {
    console.log("Data channel closed");
    handleServerConnectionDisconnected();
}

/**
 * The message sent to server will be broadcast to all users in the same board by the board's owner
 * @param message a string
 * @param addToScreenChat a boolean indicating if the message should be added into the screen chat. Default value is
 * true which means the message will be added into the chat screen.
 * @param wrapMessageWithUsername indicates if the message should be wrap with the sender's username. For example:
 * "sender_username: hello world!" if true or "hello world!" if false
 */
function sendChatMessageToServer(message, addToScreenChat, wrapMessageWithUsername) {
    addToScreenChat = (typeof addToScreenChat !== 'undefined') ? addToScreenChat : true;
    wrapMessageWithUsername = (typeof wrapMessageWithUsername !== 'undefined') ? wrapMessageWithUsername : true;

    console.log("send chat message to server: ", message);

    if(wrapMessageWithUsername) {
        message = formatChatMessage(currentUsername, message);
    }

    if(addToScreenChat) {
        //add the msg into the current chat screen of the current user
        addMessageToChatScreen(message);
    }

    sendDataToAPeer(dataChannel, wrapData(message, DataTransferType.CHAT_MESSAGE));
}

/**
 * happens when the connection with server is disconnected.
 * This function is invoked in onclose event of datachannel and in sendTo() function which sends data to the board's
 * owner
 */
function handleServerConnectionDisconnected() {
    var disMessage = formatMessageColor("(Server disconnected)", "red");
    addMessageToChatScreen(disMessage);
}

/**
 * Handle syn data sent from server. The data contains drawing objects have been added since the board was crated.
 */
function syncCanvasDataFromServer (syncData) {
    console.log("Synchronising  canvas data: " + syncData.length);
    for (var i = 0; i < syncData.length; i++) {
        var drawnObj = syncData[i];

        var convertedObj = castToFabricObject(drawnObj);

        if(convertedObj) {
            canvas.add(convertedObj);
        }
    }
}

/**
 * Refresh the list of users connecting to the using board
 * @param newUserList an array containing the username of the users connecting to the using board
 */
function refreshUserListFromServer(newUserList) {
    page3_user_list.innerHTML = "<span>" + boardOwnerUsername + "</span><br>";

    for(var i = 0; i < newUserList.length; i++) {
        page3_user_list.innerHTML += "<span>" + newUserList[i] + "</span><br>";
    }
}

/**
 * Want to send sync data to server. Guest user can only sync screen size with the server.
 */
function sendSyncDataToServer() {
    var syncData = {};
    syncData.canvasSize = {
        width: canvas_width,
        height: canvas_height
    };
    sendDataToAPeer(dataChannel, wrapData(syncData, DataTransferType.SYNC));
}