/**
 * Created by lua on 23/04/2016.
 */
/**
 * Send the data of a canva's object to server
 * @param data
 */
function sendCanvasDataToServer(data) {
    sendDataToAPeer(dataChannel, wrapData(data, DataTransferType.CANVAS_DATA));
}

/**
 * This is used to send the data of the drawing object which is being drawn by the current user to the board's owner.
 * @param drawingObject
 */
function sendDrawingObjectToServer(drawingObject) {
    var canvasData;
    if(selectedTool != TOOL.PENCIL) {
        //if the drawing object is not being drawn by TOOL.PENCIL
        canvasData = {
            command: DrawingCommands.DRAWING,
            canvasData: drawingObject, //a fabricjs object
            nameRenderingPosition: nameRenderingOptions // where the name should be rendered
        };
    } else {
        //if the drawing object is being drawn by TOOL.PENCIL
        canvasData = {
            command: DrawingCommands.DRAWING,
            canvasData: {
                type: TOOL.PENCIL,
                pointArray: pencilDrawingPoints,
                options: {
                    lineWidth: selectedStrokeWidth,
                    strokeStyle: selectedColor
                }
            },
            nameRenderingPosition: nameRenderingOptions
        };
    }
    sendCanvasDataToServer(canvasData);
}

/**
 * This notifies the board's owner that the current user has finished drawing an object.
 */
function finishDrawing_Guest() {
    var canvasData = {
        command: DrawingCommands.FINISH_DRAWING
    };

    sendCanvasDataToServer(canvasData);
}

/**
 * This function will be added into the function of onMouseMoveCanvas in initialising.js
 */
function onMouseMoveExtraEventForGuest() {
    //sending the drawing object to board's owner
    console.log("drawing object sent to server: " + JSON.stringify(drawingObject));
    sendDrawingObjectToServer(drawingObject);
}

/**
 * This function will be added into the function of onMouseUpCanvas in initialising.js
 */
function onMouseUpExtraEventForGuest() {
    if(selectedTool != TOOL.NONE) {
        finishDrawing_Guest();
    }
}