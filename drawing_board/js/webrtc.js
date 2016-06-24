/**
 * Created by lua on 3/04/2016.
 */

var WebRTCIceUrl = "stun:stun.1.google.com:19302";
var WebRTCPeerConfiguration = {
    "iceServers": [{ "url": WebRTCIceUrl }]
};
var WebRTCPeerConnectionOptions = {optional: [{RtpDataChannels: false}]};
var WebRTCDataChannelConfiguration = {
    reliable: false
};

/**
 * Using https://service.xirsys.com/ice to setup the peer connection of WebRTC.
 * Particularly the ICE component. Using public STUN stun:stun.1.google.com:19302 may
 * not work between users using different networks.
 */
$.ajax({
    url: "https://service.xirsys.com/ice",
    data: {
        ident: "",
        secret: "",
        domain: "",
        application: "",
        room: "",
        secure: 1
    },
    success: function (data, status) {
        //Successfully retrieve the ICE list from xirsys
        // data.d is where the iceServers object lives
        WebRTCPeerConfiguration = data.d;
        console.log(WebRTCPeerConfiguration);
    },
    error: function () {
        //Failed to retrieve the ICE list from xirsys.
        // public STUN server stun:stun.1.google.com:19302 will be used.
        // However, This may makes the web failed to establish WebRTCPeerConnection when the users are using
        //different networks
        console.warn("Failed to retrieve ICE servers from xirsys.");
        console.warn("Please make sure you entered the credentials correctly in the request of obtaining ICE servers");
        console.info("If you have not configured xirsys please go to https://service.xirsys.com");
        console.info("public STUN server stun:stun.1.google.com:19302 will be used");
    }
});

var DataTransferType = {
    CHAT_MESSAGE: "chat_message",
    CANVAS_DATA: "canvas_data",
    SYNC: "sync_all_data_with_a_the_user" //except for canvas data
};

var DrawingCommands = {
    DRAWING: "drawing",
    FINISH_DRAWING: "finish_drawing",
    DELETE: "delete_object",
    SYNC: "synchronising_drawing_objects" //synchronising canvas data with a new user
};

/**
 * Checking if users' browser support RTCPeerConnection
 * @returns {*}
 */
function hasRTCPeerConnection () {
    window.RTCPeerConnection = window.RTCPeerConnection ||
    window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    return window.RTCPeerConnection;
}

/**
 * Check the user's medias such as video and audio devices.
 * @return {boolean}
 */
function hasUserMedia() {
    return !! (navigator.getUserMedia || navigator.webkitGetUserMedia
    || navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

/**
 * This is the common function used to send data between 2 peers
 * @param datachannel the WebRTCDataChannel object used between the 2 peers.
 * @param data the data needs to be sent. for ex: {type: '', content: ''}
 */
function sendDataToAPeer(datachannel, data) {

    if(isBoardOwner) {
        var connState = peerConnectionList[datachannel.name].iceConnectionState;
        if(connState == "failed" || connState == "disconnected") {
            handleGuestConnectionDisconnectedUnexpectedly(datachannel);
            console.log("failed to send data to " + datachannel.name);

            return;
        }
    } else {
        var connState = peerConnection.iceConnectionState;
        if(connState == "failed" || connState == "disconnected") {
            console.log("failed to send data to server");
            handleServerConnectionDisconnected();
        }
    }
    console.log("send data to " + datachannel.name + " " + data);
    try {
        datachannel.send(JSON.stringify(data));
    } catch(e) {
        if(isBoardOwner) {
            handleGuestConnectionDisconnectedUnexpectedly(datachannel);
            console.log("failed to send data to " + datachannel.name);
        } else {
            console.log("failed to send data to server");
            handleServerConnectionDisconnected();
        }
    }
}