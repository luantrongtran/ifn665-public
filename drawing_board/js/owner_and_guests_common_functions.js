/**
 * Created by lua on 16/04/2016.
 */
/**
 * sends log in request to server
 */
function login() {
    if(page1_username.value.length == 0) {
        return;
    }
    var data = {
        type: "login",
        username: page1_username.value
    };
    console.log("sending login request", data);
    sendToWebSocketServer(data);
}

/**
 * receive login response
 * @param data
 */
function onLogin(data) {
    if(data.success) {
        console.log("logged successfully");
        //preparePeerConnection();

        currentUsername = page1_username.value;
        goToPage2();
    } else {
        alert("the username is already being used");
    }
}

/**
 * Receives ICE candidate information
 * @param data
 */
function onCandidate(data) {
    if(isBoardOwner) {
        var targetPeerConnection = peerConnectionList[data.sender];
        if(targetPeerConnection) {
            targetPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } else {
        console.log("adding candidate", data.candidate);
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}


/**
 * Send data to websocket server for setting up the peer connection
 * @param message
 */
function sendToWebSocketServer(message){
    connection.send(JSON.stringify(message));
}

/**
 * Wrap the data sent to other peers. Since the data can be a simple text message or can be a complex data of a canvas's
 * object. Also, add the username of the sender
 * @param data
 * @param dataType
 * @return {{type: *, content: *, sender: (currentUsername|*)}}
 */
function wrapData(data, dataType) {
    return {
        type: dataType,
        content: data,
        sender: currentUsername
    };
}

var selectedTextColor = 'black';
/**
 * format the chat message. Since a chat message includes 2 parts which are sender's name and the text message
 */
function formatChatMessage(username, message) {
    var formattedStr = "<b style='margin-right: 5px;'>"
        + username + ":</b>" + formatMessageColor(message, selectedTextColor);
    return formattedStr;
}

/**
 * Format color for the given message
 * @param msg
 * @param color
 * @return {string}
 */
function formatMessageColor(msg, color) {
    return "<span style='color: " + color + ";'>" + msg + "</span>";
}