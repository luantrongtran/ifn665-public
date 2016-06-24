/**
 * Created by lua on 3/04/2016.
 */
var WebSocketServer = require('ws').Server;
var http = require("http");
var express = require("express");
var app = express();
var port = process.env.PORT || 8081;

app.use(express.static(__dirname + "/"));

var server = http.createServer(app)
server.listen(port);

console.log("http server listening on %d", port);

var wss = new WebSocketServer({server: server});

/**
 * value-pair map, the key is the username, the value is the connection of corresponding user.
 * @type {{}}
 */
var users = {};

/**
 * value-pair map, the key is the board id and the value is the username of the board's owner
 * @type {{}}
 */
var boards = {};

/**
 * value-pari map, the key is the username of board's owners, value is the board id owner by the corresponding owner
 * @type {{}}
 */
var board_owners = {};

/**
 * indicates how often the server checks the connections to see if they are alive or not
 */
var heartBeatCheckingInterval = 5000;//5s

setInterval(function(){
    //console.log("heart beat checking invoked");
    checkHeartBeat();
}, heartBeatCheckingInterval);

wss.on('connection', function (connection) {
   console.log("User connected");

    connection.on('message', function (message) {
        var data;

        try {
            data = JSON.parse(message);
        } catch (expception) {
            console.log("data is not in JSON format");
        }

        switch (data.type) {
            case "login":
                //the request of logging in.
                handleLoginRequest(connection, data);
                break;
            case "createNewBoard":
                //the request of creating new board.
                handleCreateNewBoard(connection, data);
                break;
            case "requestToJoinABoard":
                //The request to join a board of a guest user
                handleRequestToJoinABoard(connection, data);
                break;
            case "denyRequest":
                //this request is sent by a board's owner when he/she denied a request to join his/her board from another user
                onDenyRequestReceived(connection, data);
                break;

            //Handlers for setting up WebRTC
            case "offer":
                //After accept the request to join the board, the owner sends WebRTC offer to the client
                onOffer(connection, data);
                break;
            case "webRTCAnswer":
                //The client sendToWebSocketServer the WebRTC answer to the board's owner
                onWebRTCAnswer(connection, data);
                break;
            case "candidate":
                onCandidate(connection, data);
                break;
            default :
        }
    });
});

function onCandidate(con, data) {
    var targetConnection = users[data.connected_user];
    sendTo(targetConnection, {
        type: "candidate",
        candidate: data.candidate,
        sender: con.name //the username of one sending the info of candidate
    });

    console.log(con.name + " sends webrtc candidate to " + data.connected_user);
}

/**
 * The client sends the webRTC answer to the board's owner
 * @param con
 * @param data
 */
function onWebRTCAnswer(con, data) {
    var targetConnection = users[data.board_owner];

    sendTo(targetConnection, {
        type: "webRTCAnswer",
        answer: data.answer,
        clientUsername: con.name
    });

    console.log(con.name + " sends webrtc answer to " + data.sender);
}

/**
 * Board's owner sends WebRTC offer to the client
 * @param con
 * @param data
 */
function onOffer(con, data) {
    console.log(con.name + " (board's owner) sends webrtc offer to " + data.client_username + " (client)");

    var targetConnection = users[data.client_username];//the connection to the board's owner

    sendTo(targetConnection, {
        type: "offer",
        offer: data.offer,
        board_owner: con.name
    });
}

/**
 * Handle the board owners' request denying a request to join their board
 * @param connection
 * @param data
 */
function onDenyRequestReceived (connection, data) {
    var sender = data.client_username;//This is the username of the the guest user sending the request to join an existing board
    var guestUserCon = users[sender];

    sendTo(guestUserCon, {
        type: "requestDenied",
        board_owner: connection.name
    });
    return;
}

/**
 * Client sends request to gain permission to join a board
 * @param con the connection to the server
 * @param data contains
 *          type: "requestToJoinABoard"
 *          offer: the info, used for setting up peer-to-peer, of the sender
 *          board_id: the id of the board the sender wants to join
 */
function handleRequestToJoinABoard(con, data) {
    var boardId = data.board_id;
    var username = getBoardOwner(boardId);
    if(username == "") {
        //there is no board with the given board id
        //Reply the sender with an error message
        var errMsg = "There is no board named " + boardId;
        sendTo(con, {
            type: "requestToJoinABoard",
            success: false,
            message: errMsg
        });
    } else {
        // if there is a board with the given id, and the owner's username is returned
        // forward the request to the receiver
        var targetConnection = users[username];
        sendTo(targetConnection, {
            type: "receiveRequestToJoinTheBoard",
            //offer: data.offer,
            client_username: con.name
        });

        //reply to the sender, that the offer has been successfully sent to the board owner
        sendTo(con, {
            type: "requestToJoinABoard",
            success: true
        })
    }
}

/**
 * invoked when receives request of logging in from an user
 * @param connection
 * @param data is a JSON string has 2 attributes
 *          type: indicating type of request
 *          username: the name of the user
 * . Ex: {type: "login", username: "user1"}.
 */
function handleLoginRequest(connection, data) {
    if(users[data.username]) {
        console.log("An user used an existing username: " + data.username);
        //if the username is being used by another person
        sendTo(connection, {
            type: "login",
            success: false
        });
    } else {
        //if no one has used the name
        console.log("A new user logged: " + data.username);

        connection.name = data.username;
        users[data.username] = connection;
        sendTo(connection, {
            type: "login",
            success: "true"
        });
    }
}

/**
 * invoked when receives an request of creating a new board
 * @param con
 * @param data
 */
function handleCreateNewBoard(con, data) {
    if(boards[data.board_id]) {
        //if the board id has been used
        sendTo(con, {
            type: "createNewBoard",
            success: false
        });
    } else {
        //IF the board id has not been used
        boards[data.board_id] = data.username;
        board_owners[data.username] = data.board_id;

        sendTo(con, {
            type: "createNewBoard",
            success: true
        });
    }
}

function sendTo(con, message) {
    try {
        if (con) {
            console.log("send data to: " + con.name + ": " , message);
            con.send(JSON.stringify(message));
        }
    } catch (e) {
        if (con.readyState == 2/*closing*/ || con.readyState == 3/*closed*/) {
            //if connection has been closed then remove the user.
            removeAnUser(con.name);
        }
    }
}

/**
 * Gets the username of the board owner using the given board id
 * @param boardId the board id
 * @return returns the username of the board owner. if there is no board with the given id returns empty string
 */
function getBoardOwner(boardId) {
    if(boards[boardId]) {
        return boards[boardId];
    } else {
        return "";
    }
}

/**
 * Using heart beat to detect connection lost
 */
function checkHeartBeat() {
    for (var username in users) {
        sendHeartBeatToAnUser(username);
    }
}

function sendHeartBeatToAnUser(username) {
    console.log ("Send heart beat to " + username);

    var targetConnection = users[username];

    sendTo(targetConnection, {
        type: "heartBeat"
    });

}

/**
 * Remove a user's setting when he/she disconnects from the server.
 */
function removeAnUser(username) {
    console.log ("remove user: " + username);
    delete users[username];

    //Delete the board if the user is a board's owner
    delete boards[board_owners[username]];
    delete board_owners[username];
}