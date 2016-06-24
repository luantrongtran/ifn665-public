/**
 * Created by lua on 2/04/2016.
 */


connection.onopen = function() {
    console.log("opened");
};

connection.onmessage = function (message) {
    //console.log("recieved message: ", message);
    var data = JSON.parse(message.data);

    switch (data.type) {
        case "login":
            //receives login response from server
            onLogin(data);
            break;
        case "createNewBoard":
            //receives message for creating new board
            onNewBoardCreated(data);
            break;
        case "requestToJoinABoard":
            //receives the result of sending request to join a board
            onRequestToJoinABoard(data);
            break;
        case "receiveRequestToJoinTheBoard":
            //Receives the request to join the board
            onReceiveRequestToJoinTheBoard(data);
            break;
        case "requestDenied":
            //The board's owner denied the request to join the board of a guest user
            onRequestDenied();
            break;

        ///////From now on is the handler of WebRTC
        case "offer":
            //client receives offer from the board's owner.
            onOfferReceived(data);
            break;
        case "webRTCAnswer":
            //Board's owner receives answer from a client
            onWebRTCAnswer(data);
            break;
        case "candidate":
            onCandidate(data);
            break;
        default:
    }
};