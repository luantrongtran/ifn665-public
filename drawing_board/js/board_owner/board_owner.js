/**
 * Created by lua on 16/04/2016.
 */
/**
 * These variables are used for the board's owner. these 2 lists are synchronized, for example, the first
 * WebRTCDataChannel in dataChannelList is created by the first WebRTCPeerConnection in peerConnectionList.
 */
var peerConnectionList = {};// stores the WebRTCPeerConnection instances between the board's owner and other guests/clients
var dataChannelList = {}; //stores the WebRTCDataChannel
var usernameList = []; // stores all the usernames of guests

/**
 * Sends request to create a new board
 */
function createNewBoard() {
    if(page2_board_id.value.length == 0) {
        return;
    }

    var data = {
        type: "createNewBoard",
        username: page1_username.value, // the username of the guest user
        board_id: page2_board_id.value //board id to which the guest user wants to connect
    };

    console.log("Create new board: ", data);

    //Send the request to the server.
    sendToWebSocketServer(data);
}

/**
 * Receives the result of creating new board from server.
 * @param data data.success is true if the board is successfully created, otherwise, data.success is false
 */
function onNewBoardCreated (data) {
    console.log("received data for creating board: ", data);
    if (data.success) {
        //board created successfully
        isBoardOwner = true; //isBoardOwner is declared in initialising.js
        goToPage3();
    } else {
        page2_displayErrorMsg("Failed to create new board! Please choose a different id.");
    }
}

/**
 * When the board's owner receives a request to join the board from another one.
 * @param data
 */
function onReceiveRequestToJoinTheBoard(data) {
    var result = confirm(data.client_username + " wants to join the board");

    if (result) {
        //accept the request to join the board
        //Creates peer2peer connection offer and sends to the board's owner
        addNewUser(data.client_username);
    } else {
        //deny the request
        console.log("deny request to join the board from ", data.client_username);
        var repliedData = {
            type: "denyRequest",
            client_username: data.client_username,
            sender: currentUsername
        };
        sendToWebSocketServer(repliedData);
    }
}

/**
 * Receives WebRTC answer from the client
 */
function onWebRTCAnswer(data) {
    console.log("Receives WebRTC Answer from the client: ", data);

    var targetPeerCon = peerConnectionList[data.clientUsername];
    targetPeerCon.setRemoteDescription(new RTCSessionDescription(data.answer));
}

/**
 * Accept a new user to join the board after he/she had requested to join
 * @param clientUsername the username of the new client
 */
function addNewUser(clientUsername) {
    var newPeerConnection = preparePeerConnectionForANewClient(clientUsername);
    if (newPeerConnection) {
        //if new peer connection is created successfully
        usernameList.push(clientUsername);
        newPeerConnection.createOffer(function (offer) {
            console.log("Owner creates webRTC offer and send to the client " + clientUsername);
            newPeerConnection.setLocalDescription(offer);
            var data_ = {
                type: "offer",
                //board_id: page2_board_id.value,
                offer: offer,
                client_username: clientUsername
            };
            sendToWebSocketServer(data_);
        }, function (error) {
            console.log("Failed to create offer", error);
        });
    }
}

/**
 * setup a new peer connection for a new user who wants to join the board
 * @param clientUsername the username of the new client
 * @return returns the a WebRTCPeerConnection object created for the new client
 */
function preparePeerConnectionForANewClient(clientUsername) {
    var newPeerConnection;

    if (hasRTCPeerConnection()) {
        console.log("Setting up a new peer connection for " + clientUsername);
        newPeerConnection = new RTCPeerConnection(WebRTCPeerConfiguration, WebRTCPeerConnectionOptions);

        // Setup ice handling
        newPeerConnection.onicecandidate = function (event) {
            if (event.candidate) {
                sendToWebSocketServer({
                    type: "candidate",
                    candidate: event.candidate,
                    connected_user: clientUsername
                });
            }
        };

        peerConnectionList[clientUsername] = newPeerConnection;

        //create a new data channel for the new user
        var newDataChannel = newPeerConnection.createDataChannel("data_channel_" + clientUsername, WebRTCDataChannelConfiguration);
        newDataChannel.name = clientUsername;

        newDataChannel.onopen = function () {
            console.log("Data channel opened with " + clientUsername);

            //Send welcome message to the new user
            sendChatMessageToAClient(clientUsername, "Welcome on board, " + clientUsername, false);

            //Synchronising data with the new user
            sendSyncDataToAnUser(clientUsername);

            //refresh the UI which is a div containing the username of connecting users
            refreshConnectingUserList();
        };

        newDataChannel.onclose = function () {
            console.log("Data channel closed");
            handleGuestConnectionDisconnectedUnexpectedly(this);

            refreshConnectingUserList();
        };
        newDataChannel.onerror = function() {
            console.log("Data Channel error");
        };
        newDataChannel.onmessage = onMessageReceivedFromAClientCallback;

        dataChannelList[clientUsername] = newDataChannel;

    } else {
        alert("Sorry, your browser does not support WebRTC.");
    }

    return newPeerConnection;
}

/**
 * When receives a message through peer-to-peer data channel.
 * @param event
 */
function onMessageReceivedFromAClientCallback(event) {
    console.log("data channel receives msg: ", event.data);
    var data = JSON.parse(event.data);

    if (data.type == DataTransferType.CHAT_MESSAGE) {
        //if the data is a chat message

        //add the msg into the chat screen
        addMessageToChatScreen(data.content);

        //broadcast the chat message to other users
        //broadcastChatMessage(data.content, data.sender);
        forwardDataToAllUsers(data);
    } else if (data.type == DataTransferType.CANVAS_DATA) {
        var canvasData = data.content;
        if (canvasData.command == DrawingCommands.DRAWING) {
            //if the command is drawing
            var canvasObj = canvasData.canvasData;
            updateDrawingObjectOfAPeer(data.sender, canvasObj, canvasData.nameRenderingPosition);
        } else if (canvasData.command == DrawingCommands.FINISH_DRAWING) {
            if(arrDrawingObject[data.sender].type == TOOL.PENCIL) {
                finishPencilDrawing(arrDrawingObject[data.sender].pointArray, arrDrawingObject[data.sender].options);
            }
            delete arrDrawingObject[data.sender];

            arrNameRenderingPosition[data.sender].remove();
            delete arrNameRenderingPosition[data.sender];
        }

        //forwardCanvasData(canvasData, data.sender);
        forwardDataToAllUsers(data);
    } else if (data.type == DataTransferType.SYNC) {
        var syncData = data.content;

        if (syncData.canvasSize) {
            updateAndSyncCanvasSize(syncData.canvasSize.width, syncData.canvasSize.height);
        }
    }
}

/**
 * Sends a simple text to the receivers. The difference with the forwardChatMessageToAClient is that this method
 * send the chat message to all users.
 * @param message a string
 * @param addToScreenChat a boolean indicating if the message should be added into the screen chat. Default value is
 * true which means the message will be added into the chat screen.
 */
function sendChatMessageToClients(message, addToScreenChat) {

    addToScreenChat = (typeof addToScreenChat !== 'undefined') ? addToScreenChat : true;

    console.log("Sends text msg to other peers");
    message = formatChatMessage(currentUsername, message);

    if (addToScreenChat) {
        addMessageToChatScreen(message);//adds the chat message into the current screen chat of the owner
    }

    broadcastChatMessage(message); //Sends the message to all other peers.
}

/**
 * broadcast a chat message input by the board's owner to all users in the board.
 * @param message a string
 * @param exceptionUsername the username of the user that won't receive the message
 */
function broadcastChatMessage(message, exceptionUsername) {
    var broadcastList = "";//use for console.log
    var data = wrapData(message, DataTransferType.CHAT_MESSAGE);

    for (var i = 0; i < usernameList.length; i++) {
        if (usernameList[i] == exceptionUsername) {
            continue;
        }
        sendDataToAClient(usernameList[i], data);
        broadcastList += usernameList[i] + "    ";
    }

    console.log("Broadcast chat message to all users: " + broadcastList);
}

/**
 * Sends a text message input by board's owner to another user
 * @param clientUsername the username of the user to who the message will be delivered
 * @param message
 * @param addToScreenChat
 */
function sendChatMessageToAClient(clientUsername, message, addToScreenChat) {
    addToScreenChat = (typeof addToScreenChat !== 'undefined') ? addToScreenChat : true;
    console.log("Sends text msg to " + clientUsername);

    message = formatChatMessage(currentUsername, message);

    if(addToScreenChat) {
        addMessageToChatScreen(message);//adds the chat message into the current screen chat of the owner
    }

    sendDataToAClient(clientUsername, wrapData(message, DataTransferType.CHAT_MESSAGE));
}

/**
 * Sends data to a specific user
 * @param clientUsername
 * @param data
 */
function sendDataToAClient(clientUsername, data) {
    var targetDataChannel = dataChannelList[clientUsername];
    if (targetDataChannel) {
        sendDataToAPeer(targetDataChannel, data);
    } else {
        console.log("Cannot find data channel for username: " + clientUsername);
    }
}

/**
 * This function forwards the data sent by a guest user to the rest of guest users except the data's owner which is
 * also a guest user. This doesn't change the original structure of the data
 */
function forwardDataToAllUsers(data) {
    for(var i = 0; i < usernameList.length; i++) {
        if(usernameList[i] == data.sender){
            // if an exception user
            continue;
        }

        var targetDataChannel = dataChannelList[usernameList[i]];
        sendDataToAPeer(targetDataChannel, data);
    }
}

/**
 * Handle the exception when there is an user disconnect unexpectedly
 */
function handleGuestConnectionDisconnectedUnexpectedly(datachannel) {
    //remove disconnected user and his/her datachannel
    var user = datachannel.name;
    delete peerConnectionList[user];
    delete dataChannelList[user];

    //remove the username from usernameList
    for(var i = 0; i < usernameList.length; i++) {
        if (usernameList[i] == user) {
            usernameList.splice(i, 1);
        }
    }

    var disMsg = formatMessageColor("(" + datachannel.name + " has been disconnected)", "red");
    broadcastChatMessage(disMsg);
    addMessageToChatScreen(disMsg);

    refreshConnectingUserList();
}

/**
 * Synchronising data with the new user
 * @param username the username of the user receiving the sync data
 * @param syncCanvasData indicating if the canvas data should be synced
 * @param syncUserList indicating if the user list should be synced
 * @param syncCanvasSize indicating if the canvas size should be synced
 */
function sendSyncDataToAnUser(username, syncCanvasData, syncUserList, syncCanvasSize) {
    syncCanvasData = (typeof syncCanvasData !== 'undefined') ? syncCanvasData : true;
    syncUserList = (typeof syncUserList !== 'undefined') ? syncUserList : true;
    syncCanvasSize = (typeof syncCanvasSize !== 'undefined') ? syncCanvasSize : true;

    var syncData = {};

    if(syncCanvasData) {
        syncData.canvasData = canvas.getObjects();
    }

    if(syncUserList) {
        syncData.userList = usernameList; //username of users using the board, not including board's owner
    }

    if (syncCanvasSize) {
        syncData.canvasSize = {
            width: canvas_width,
            height: canvas_height
        };
    }

    sendDataToAClient(username, wrapData(syncData, DataTransferType.SYNC));
}

/**
 * Synchronising data with all users
 * @param syncCanvasData
 * @param syncUserList
 */
function sendSyncDataToAllUsers(syncCanvasData, syncUserList, syncCanvasSize) {
    syncCanvasData = (typeof syncCanvasData !== 'undefined') ? syncCanvasData : true;
    syncUserList = (typeof syncUserList !== 'undefined') ? syncUserList : true;
    syncCanvasSize = (typeof syncCanvasSize !== 'undefined') ? syncCanvasSize : true;

    for (var i = 0; i < usernameList.length; i++) {
        sendSyncDataToAnUser(usernameList[i],syncCanvasData, syncUserList, syncCanvasSize);
    }
}

/**
 * Refresh the list of users connecting to the board
 */
function refreshConnectingUserList() {
    page3_user_list.innerHTML = "<span>" + currentUsername + "</span><br>";

    for(var i = 0; i < usernameList.length; i++) {
        page3_user_list.innerHTML += "<span>" + usernameList[i] + "</span><br>";
    }

    //notify all users to sync the new list of username as well
    sendSyncDataToAllUsers(false, true, false);
}