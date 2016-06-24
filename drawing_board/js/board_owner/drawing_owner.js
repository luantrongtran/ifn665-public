/**
 * Created by lua on 23/04/2016.
 */

/**
 * Send the drawing object which is being drawn by the board's owner to other peers
 * @param drawingObj an fabric object such as , fabric.Rect, fabric.Circle
 */
function sendDrawingObjectToOtherPeers (drawingObj) {
    var canvasData = {
        command: DrawingCommands.DRAWING,
        canvasData: drawingObj,
        nameRenderingPosition: nameRenderingOptions
    };

    broadcastCanvasData(canvasData);
}

/**
 * Sends a canvas object such as rectangle, circles, ...
 * @param clientUsername
 * @param canvasData example data: {command: //see the DrawingCommand, canvasData: object}
 */
function sendCanvasDataToAClient(clientUsername, canvasData) {
    sendDataToAClient(clientUsername, wrapData(canvasData, DataTransferType.CANVAS_DATA));
}

/**
 * Broadcast the data of an canvas's object to all users.
 * @param data an object {}
 * @param exceptionUsername the username of the user that won't receive the message
 */
function broadcastCanvasData(data, exceptionUsername) {
    for(var i = 0; i < usernameList.length; i++) {
        if(usernameList[i] == exceptionUsername){
            // if an exception user
            continue;
        }

        sendCanvasDataToAClient(usernameList[i], data);
    }
}

function finishDrawing_Owner() {
    var canvasData = {
        command: DrawingCommands.FINISH_DRAWING
    };

    broadcastCanvasData(canvasData);
}

/**
 * invoked in mousemoveevent of the canvas
 */
function onMouseMoveExtraEventForOwner() {
    if(selectedTool != TOOL.PENCIL) {
        //If the object is not being drawn using TOOL.PENCIL
        sendDrawingObjectToOtherPeers(drawingObject);
    } else {
        var data = {
            type: TOOL.PENCIL,
            pointArray: pencilDrawingPoints,
            options: {
                lineWidth: selectedStrokeWidth,
                strokeStyle: selectedColor
            }
        };
        sendDrawingObjectToOtherPeers(data);
    }
}

/**
 * invoked in mouseUpevent of the canvas
 */
function onMouseUpExtraEventForOwner() {
    if(selectedTool != TOOL.NONE) {
        finishDrawing_Owner();
    }
}