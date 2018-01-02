// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-17

"use strict";

/* global  SAGE2Connection*/

/*
File has parts:
	1. Any actions needed to run before connecting to server.
	2. Connect to server
	3. Functions that the app expects to call
	4. Functions for usage in the page

*/

/* ------------------------------------------------------------------------------------------------------------------
// 1
// ------------------------------------------------------------------------------------------------------------------
Finalize the page
*/

var global = {
	debug: true,
	mobile: false,
	convertTouchEvents: false,
	drawColor: "black",
	thickness: 4,
	currentCanvasColor: undefined,
	currentColorBlock: null,
	currentThickBlock: null,
	currentCanvasBlock: null,
	thickProperties: {
		margin: "0px",
		display: "inline-block",
		width: "57px",
		height: "57px",
		borderDefault: "1px solid black",
		borderMouseEnter: "1px solid white",
		borderSelected: "3px solid black",
		sizes: [4, 8, 16, 32, 40]
	},
	colorPalletProperties: {
		rowSize: 12,
		margin: "0px",
		display: "inline-block",
		width: "25px",
		height: "25px",
		borderDefault: "1px solid black",
		borderMouseEnter: "1px solid white",
		borderSelected: "3px solid white",
	},
	imageUrlString: []
}

setupMobileSpecific();
updateCanvasStyleAndPositioning(100, 100);
updateThickBlocks();
makeColorPallet("colorpallet");
makeColorPallet("colorpalletForCanvas", true);
setCanvasTransparentButton();
enableControlPanelDrag();
enableResolutionResize();
addDrawEvents();
startTouchConversion();





/* ------------------------------------------------------------------------------------------------------------------
// 2
// ------------------------------------------------------------------------------------------------------------------
Connect to the server
*/

// first describe any reaction after connecting
SAGE2Connection.afterSAGE2Connection = addThisClientAsEditor;

// This this is part of app code, it will use the current window values to connect.
// But if the page was hosted elsewhere, parameters would be required.
SAGE2Connection.initS2Connection();

/* ------------------------------------------------------------------------------------------------------------------
// 3
// ------------------------------------------------------------------------------------------------------------------
The following functions are for communication handling.
*/

// After establishing connection, call this function to let app know this page is acting as editor.
function addThisClientAsEditor() {
	// callFunctionOnApp: function(functionName, parameterObject) { // autofilled id by server
	SAGE2Connection.callFunctionOnApp("addClientIdAsEditor", {});
}

// Has the initial state on connection
// HAVE to use this name for compliance with UI version
function uiDrawSetCurrentStateAndShow(data) {
	dbugprint("Got current state data");
	// Set canvas backgrond
	var canvas = getCanvas();
	setCanvasBackgroundColor(data.canvasBackground);
	updateCanvasStyleAndPositioning(data.imageWidth, data.imageHeight);
	canvas.clientDest = data.clientDest;
	// Load current image using image helper
	dbugprint("Loading current image");
	canvas.imageToDraw.src = data.canvasImage;
	// Delayed drawing until after load completes
	canvas.imageToDraw.parentCtx = canvas.getContext('2d');
	canvas.imageToDraw.onload    = function() {
		this.parentCtx.drawImage(this, 0, 0);
		dbugprint("Loaded current image on app");
	};
}

/**
 * Naming is required to maintain compatibility with UI.
 *
 * @method uiDrawMakeLine
 * @param {Object} data - Information from application
 * @param {Array} data.params - Array containing information about the line to draw
 * @param {Number} data.params[0] - Point1 x
 * @param {Number} data.params[1] - Point1 y
 * @param {Number} data.params[2] - Point2 x
 * @param {Number} data.params[3] - Point2 y
 * @param {Number} data.params[4] - Line width
 * @param {String} data.params[5] - Color for fill
 * @param {String} data.params[6] - Color for stroke
 */
function uiDrawMakeLine(data) {
	// Get canvas
	var ctx = getCanvas().getContext('2d');
	var lineWidth	= data.params[4];
	ctx.fillStyle	= data.params[5];
	ctx.strokeStyle	= data.params[6];
	// if the line width is greater than 1. At 1 the fill + circle border will expand beyond the line causing bumps in the line.
	if (lineWidth > 2) {
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(data.params[2], data.params[3], lineWidth / 2, 0, Math.PI * 2, false);
		ctx.fill();
	}
	ctx.beginPath();
	ctx.lineWidth = lineWidth;
	ctx.moveTo(data.params[2], data.params[3]);
	ctx.lineTo(data.params[0], data.params[1]);
	ctx.stroke();
}

/**
 * When a user tries to draw on the doodle canavs, the events are converted to locations of where to place
 * the line data. Previous location to current location.
 * The client doesn't actually cause their canvas to update. The app sends a confirmation back which
 * causes the canvas to update.
 *
 * @method sendDrawLine
 * @param {Number} xDest - location on canvas for next point.
 * @param {Number} yDest - location on canvas for next point.
 * @param {Number} xPrev - previous location on canvas.
 * @param {Number} yPrev - previous location on canvas.
 */
function sendDrawLine(xDest, yDest, xPrev, yPrev) {
	var dataForApp  = {};
	var modifier = 1; // Placeholder
	dataForApp.app  = SAGE2Connection.appId;
	dataForApp.func = "drawLine";
	dataForApp.data = [
		xDest * modifier, yDest * modifier,
		xPrev * modifier, yPrev * modifier,
		global.thickness,
		global.drawColor, global.drawColor,
		getCanvas().clientDest
	];
	dataForApp.clientDest = "allDisplays";
	// Have to use this because of weird design structure.
	SAGE2Connection.wsio.emit("sendDataToClient", dataForApp);
}

// To server
function sendCanvasColorChange() {
	// Func name, param object
	SAGE2Connection.callFunctionOnApp("changeCanvasColor", {color: global.currentCanvasColor});
}

// From server
function changeCanvasColor(data) {
	getCanvas().style.background = data.color;
	global.currentCanvasColor = data.color;
}

// To server
function sendResolutionChange(w, h) {
	// Func name, param object
	SAGE2Connection.callFunctionOnApp("changeResolution", {width: w, height: h});
}

// From server
function recvResolutionChange(data) {
	updateCanvasStyleAndPositioning(data.width, data.height);
}















/* ------------------------------------------------------------------------------------------------------------------
// 4
// ------------------------------------------------------------------------------------------------------------------
Functions for usage in the page
*/





function setupMobileSpecific() {
	if (!navigator.userAgent.includes("Mobi")) {
		return;
	}
	global.mobile = true;
	document.getElementById("assistWithMobileViewDiv").style.display = "block";
	document.getElementById("toggleTouchInteraction").addEventListener("touchstart", toggleTouchConversion);
}
function toggleTouchConversion() {
	// Swapped because didn't toggle yet.
	if (global.convertTouchEvents) {
		// Going to be view mode, make button say enable drawing
		document.getElementById("toggleTouchInteraction").textContent = "Enable Drawing";
		document.ontouchmove = null;
	} else {
		// Going to be drawing mode, make button say enable view
		document.getElementById("toggleTouchInteraction").textContent = "Enable View Change";
		// Disable mobile's automatic touch scrolling
		document.ontouchmove = function(event){
			event.preventDefault();
		}
	}
	global.convertTouchEvents = !global.convertTouchEvents;
}









function updateCanvasStyleAndPositioning(width, height) {
	var workingDiv = getCanvas();

	// Add an image element to assist with data passed from application.
	// Not added to document view.
	if (!canvas.imageToDraw) {
		canvas.imageToDraw = new Image();
	}

	// If no width and height are given, use what is already here.
	if (!width) {
		width = parseInt(workingDiv.width);
	}
	if (!height) {
		height = parseInt(workingDiv.height);
	}
	// Visually how big is it
	workingDiv.style.width = width + "px";
	workingDiv.style.height = height + "px";
	// How many pixels the canvas supports
	workingDiv.width = width;
	workingDiv.height = height;

	if (width < window.innerWidth) {
		workingDiv.style.left = (window.innerWidth - width) / 2 + "px";
	} else {
		workingDiv.style.left = "5px"; // margin
	}
	if (height < window.innerHeight) {
		workingDiv.style.top = (window.innerHeight - height) / 2 + "px";
	} else {
		workingDiv.style.top = "5px"; // margin
	}

	document.getElementById("widthInput").value = width;
	document.getElementById("heightInput").value = height;
	dbugprint("Done updating canvas sizing and position");
}


function getCanvas() {
	return document.getElementById("canvas");
}

function updateThickBlocks() {
	var properties = global.thickProperties;
	var sizes = properties.sizes;
	var example, block;
	for (let i = 0; i < sizes.length; i++) {
		// Circle size
		example = document.getElementById("thickSizeExample" + (i + 1)); // 1 - 5
		example.style.background = global.drawColor;
		example.style.borderRadius = "50%";
		example.style.width = sizes[i] + "px";
		example.style.height = sizes[i] + "px";
		// Position in center
		example.style.position = "relative";
		example.style.left = parseInt(properties.width) / 2 - sizes[i] / 2 + "px";
		example.style.top = parseInt(properties.height) / 2 - sizes[i] / 2 + "px";

		block = document.getElementById("thickBlock" + (i + 1)); // 1 - 5
		if (block.selected) {
			// this is based on the three border
			example.style.left = parseInt(properties.width) / 2 - sizes[i] / 2 - 2 + "px";
			example.style.top = parseInt(properties.height) / 2 - sizes[i] / 2 - 2 + "px";
		}
		// Add events
		if (properties.addedEvents) {
			continue; // don't add events if they were already added
		}
		block.mEnter = thickMouseEnter;
		block.mLeave = thickMouseLeave;
		block.mDown = thickMouseDown;
		block.addEventListener("mouseenter", block.mEnter);
		block.addEventListener("mouseleave", block.mLeave);
		block.addEventListener("mousedown", block.mDown);
		block.thickness = sizes[i];
	}
	properties.addedEvents = true;
}

function thickMouseEnter() {
	this.originalBorder = this.style.border;
	this.style.border = global.thickProperties.borderMouseEnter;
}

function thickMouseLeave() {
	if (!this.originalBorder) {
		this.originalBorder = global.thickProperties.borderDefault;
	}
	this.style.border = this.originalBorder;
}

function thickMouseDown() {
	// Reset the previous color block
	if (global.currentThickBlock) {
		var ccb = global.currentThickBlock;
		ccb.originalBorder = global.thickProperties.borderDefault;
		ccb.style.border = global.thickProperties.borderDefault;
		ccb.style.width = global.thickProperties.width;
		ccb.style.height = global.thickProperties.height;
	}
	// Set the current color block
	global.currentThickBlock = this;
	this.style.border = global.thickProperties.borderSelected;
	this.style.width = parseInt(global.thickProperties.width) - (2 * 2) + "px"; // 2 because 1 to 3, 2 because two sides
	this.style.height = parseInt(global.thickProperties.height) - (2 * 2) + "px";
	this.originalBorder = global.thickProperties.borderSelected;
	for (let i = 0; i < global.thickProperties.sizes.length; i++) {
		let block = document.getElementById("thickBlock" + (i + 1)); // 1 - 5
		block.selected = false;
	}
	this.selected = true;
	global.thickness = this.thickness;
	dbugprint("Thickness selected: " + global.thickness);
	updateThickBlocks();

	sizeReference.style.width = global.thickness + "px";
	sizeReference.style.height = global.thickness + "px";
}

function makeColorPallet(id, canvasOverride) {
	var palletDiv = document.getElementById(id);
	var cprop = global.colorPalletProperties;
	var rowSize = cprop.rowSize; // based on login pallet
	var colors = retrievePalletValues();
	var rows = colors.length / rowSize;
	var rdiv, cdiv;

	for (let r = 0; r < rows; r++) {
		rdiv = document.createElement("div");
		rdiv.style.margin = "0px";
		rdiv.style.marginBottom = "-4px";
		// For each color block
		for (let c = 0; c < rowSize; c++) {
			cdiv = makeColorBlock(cprop, colors[r * rowSize + c], canvasOverride);
			rdiv.appendChild(cdiv);
		}
		palletDiv.appendChild(rdiv);
	}

	// After adding get calculated size and set it permanently to avoid page edge squish
	var cs = window.getComputedStyle(palletDiv);
	palletDiv.style.width = cs.width;
	palletDiv.style.height = cs.height;
}


function makeColorBlock(cprop, blockColor, canvasOverride) {
	// Visuals
	var cdiv = document.createElement("div");
	cdiv.style.margin = cprop.margin;
	cdiv.style.display = cprop.display;
	cdiv.style.width = cprop.width;
	cdiv.style.height = cprop.height;
	cdiv.style.background = blockColor;
	cdiv.style.border = cprop.borderDefault;

	// Mouse effects
	cdiv.mEnter = colorMouseEnter;
	cdiv.mLeave = colorMouseLeave;
	cdiv.mDown = colorMouseDown;
	cdiv.addEventListener("mouseenter", cdiv.mEnter);
	cdiv.addEventListener("mouseleave", cdiv.mLeave);
	cdiv.addEventListener("mousedown", cdiv.mDown);

	// Additional properties for later	
	cdiv.borderDefault = global.colorPalletProperties.borderDefault;
	cdiv.borderSelected = global.colorPalletProperties.borderSelected;
	cdiv.originalWidth = global.colorPalletProperties.width;
	cdiv.originalHeight = global.colorPalletProperties.height;
	if (canvasOverride) {
		cdiv.canvasOverride = true;
	}

	return cdiv;
}

function colorMouseEnter() {
	this.originalBorder = this.style.border;
	this.style.border = global.colorPalletProperties.borderMouseEnter;
}

function colorMouseLeave() {
	if (!this.originalBorder) {
		this.originalBorder = global.colorPalletProperties.borderDefault;
	}
	this.style.border = this.originalBorder;
}

function colorMouseDown() {
	// Reset the previous color block
	var ccb;
	// If this is color for pallet or canvas
	if (this.canvasOverride) {
		ccb = global.currentCanvasBlock;
		global.currentCanvasBlock = this;
	} else {
		ccb = global.currentColorBlock;
		global.currentColorBlock = this;
	}
	// If a selection was already
	if (ccb) {
		ccb.originalBorder = ccb.borderDefault;
		ccb.style.border = ccb.borderDefault;
		ccb.style.width = ccb.originalWidth;
		ccb.style.height = ccb.originalHeight;
	}
	// Set the current color block
	this.style.border = this.borderSelected;
	this.style.width = parseInt(this.originalWidth) - (2 * 2) + "px";
	this.style.height = parseInt(this.originalHeight) - (2 * 2) + "px";
	this.originalBorder = this.borderSelected;
	this.selected = true;

	// adding functionality for canvas background changing
	if (this.canvasOverride) {
		setCanvasBackgroundColor(this);
	} else {
		setDrawColor(this.style.background);
	}
}

function setDrawColor(color) {
	global.drawColor = color;
	dbugprint("Color pallet selected: " + global.drawColor);
	updateThickBlocks();
}

function setCanvasBackgroundColor(colorNode, fromServer = false) {
	// If a string, probably came from server update. Hex color.
	if (typeof colorNode === "string") {
		global.currentCanvasColor = colorNode;
		getCanvas().style.background = colorNode;
	} else { // Else it was a local update
		if (colorNode.textContent.includes("ransparent")) {
			global.currentCanvasColor = "#00000000";
		} else {
			global.currentCanvasColor = colorNode.style.background;
		}
		dbugprint("Canvas background selected: " + global.currentCanvasColor);
		// if (global.debug) {
		// 	document.getElementById("canvas").style.background = global.currentCanvasColor;
		// }
		sendCanvasColorChange();
	}
}

function setCanvasTransparentButton() {
	var workingDiv = document.getElementById("colorpalletForCanvasTransparent");
	var cprop = global.colorPalletProperties;
	// Text
	workingDiv.textContent = "Transparent";
	workingDiv.style.textAlign = "center";
	workingDiv.style.verticalAlign = "middle";
	workingDiv.style.fontSize = "20";
	// Visual
	workingDiv.style.border = cprop.borderDefault;
	workingDiv.style.background = "white";
	workingDiv.style.width = cprop.rowSize * parseInt(cprop.width) + "px";
	workingDiv.style.height = parseInt(cprop.height) - 5 + "px";
	workingDiv.style.marginLeft   = "5px";
	workingDiv.style.marginRight  = "5px";
	workingDiv.style.marginTop    = "5px";
	workingDiv.style.marginBottom = "5px";
	// Events
	workingDiv.mEnter = colorMouseEnter;
	workingDiv.mLeave = colorMouseLeave;
	workingDiv.mDown = colorMouseDown;
	workingDiv.addEventListener("mouseenter", workingDiv.mEnter);
	workingDiv.addEventListener("mouseleave", workingDiv.mLeave);
	workingDiv.addEventListener("mousedown", workingDiv.mDown);

	// Additional properties for later	
	workingDiv.borderDefault = global.colorPalletProperties.borderDefault;
	workingDiv.borderSelected = "3px solid black";
	workingDiv.originalWidth = workingDiv.style.width;
	workingDiv.originalHeight = workingDiv.style.height;
	workingDiv.canvasOverride = true;
}












function enableControlPanelDrag() {
	var panel = document.getElementById("controlPanel");
	panel.style.position = "absolute";
	// Events
	panel.addEventListener("mousedown", panelDragStart.bind(panel)); // Bind sets reference of keyword this
	panel.addEventListener("mousemove", panelDrag.bind(panel));
	document.addEventListener("mousemove", panelDrag.bind(panel)); // Add to document in case mouse movement is faster than update
	panel.addEventListener("mouseup", panelDragStop.bind(panel));
	document.addEventListener("mouseup", panelDragStop.bind(panel)); // Add to document in case mouse movement is faster than update
	// Touch for ipad
	// panel.addEventListener('touchstart', panelDragTouchStart.bind(panel));
	// panel.addEventListener('touchmove',  panelDragTouchMove.bind(panel));
	// document.addEventListener('touchmove',  panelDragTouchMove.bind(panel)); // Add to document in case mouse movement is faster than update
	// panel.addEventListener('touchend',   panelDragTouchEnd.bind(panel));
	// document.addEventListener('touchend',   panelDragTouchEnd.bind(panel));
}

function panelDragStart(e) {
	dbugprint("Panel Drag Start");
	this.dragMouseStartX = e.pageX;
	this.dragMouseStartY = e.pageY;
	if (!this.style.left) {
		this.dragPositionStartX = parseInt(window.getComputedStyle(this).left);
		this.dragPositionStartY = parseInt(window.getComputedStyle(this).top);
	} else {
		this.dragPositionStartX = parseInt(this.style.left);
		this.dragPositionStartY = parseInt(this.style.top);
	}
	this.dragging = true;
}

function panelDrag(e) {
	if (this.dragging) {
		dbugprint("Panel Drag");
		this.style.left = this.dragPositionStartX + (e.pageX - this.dragMouseStartX) + "px";
		this.style.top = this.dragPositionStartY + (e.pageY - this.dragMouseStartY) + "px";
	}
}

function panelDragStop(e) {
	if (this.dragging) {
		dbugprint("Panel Drag End");
		this.dragging = false;
	}
}

function panelDragTouchStart(event) {
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		this.dragMouseStartX = touches[i].pageX;
		this.dragMouseStartY = touches[i].pageY;
	}
	if (!this.style.left) {
		this.dragPositionStartX = parseInt(window.getComputedStyle(this).left);
		this.dragPositionStartY = parseInt(window.getComputedStyle(this).top);
	} else {
		this.dragPositionStartX = parseInt(this.style.left);
		this.dragPositionStartY = parseInt(this.style.top);
	}
	this.dragging = true;
}

function panelDragTouchMove(event) {
	if (!this.dragging) {
		return;
	}
	var touches = event.changedTouches;
	var touchId;
	for (var i = 0; i < touches.length; i++) {
		this.style.left = this.dragPositionStartX + (touches[i].pageX - this.dragMouseStartX) + "px";
		this.style.top = this.dragPositionStartY + (touches[i].pageY - this.dragMouseStartY) + "px";
	}
}

function panelDragTouchEnd(event) {
	if (this.dragging) {
		this.dragging = false;
	}
}
















// Enable resolution event checking
function enableResolutionResize() {
	var wInput = document.getElementById("widthInput");
	var hInput = document.getElementById("heightInput");
	var rButton = document.getElementById("submitResButton");
	rButton.isButton = true;

	wInput.addEventListener("keydown", resInputSend.bind(wInput));
	hInput.addEventListener("keydown", resInputSend.bind(hInput));
	rButton.addEventListener("keydown", resInputSend.bind(rButton));

}
function resInputSend(e) {
	if (!this.isButton && e.code !== "Enter" && e.code !== "NumpadEnter") {
		return;
	}
	var wInput = document.getElementById("widthInput");
	var hInput = document.getElementById("heightInput");
	var wValue = parseInt(wInput.value);
	var hValue = parseInt(hInput.value);

	// Only if both are valid numbers
	if (!isNaN(wValue) && !isNaN(hValue)) {
		// At resolution is at least greater than 1
		if (wValue > 1 && hValue > 1) {
			sendResolutionChange(wValue, hValue);
		} else {
			alert("Please enter a positive number");
		}
	} else {
		alert("Please enter numbers for width and height");
	}
}










// Drawing functions

function addDrawEvents() {
	var canvas = getCanvas();
	canvas.addEventListener("mousedown", drawHandlerStart.bind(canvas)); // bind sets reference for keyword this
	canvas.addEventListener("mouseup", function() { this.doDraw = false; }.bind(canvas));
	canvas.addEventListener("mousemove", drawHandlerMove.bind(canvas));
	// canvas.addEventListener('touchstart', drawTouchStart.bind(canvas));
	// canvas.addEventListener('touchmove',  drawTouchMove.bind(canvas));
	// canvas.addEventListener('touchend',   drawTouchEnd.bind(canvas));
}

function drawHandlerStart(event) {
	this.doDraw	= true;
	this.pmx	= event.offsetX;
	this.pmy	= event.offsetY;
}

function drawHandlerMove(event) {
	if (this.doDraw) {
		// xDest, yDest, xPrev, yPrev
		sendDrawLine(event.offsetX, event.offsetY, this.pmx, this.pmy);
		this.pmx = event.offsetX;
		this.pmy = event.offsetY;
	}
	var workingDiv = document.getElementById('sizeReference');
	workingDiv.style.left = (event.pageX - parseInt(workingDiv.style.width)  / 2) + "px";
	workingDiv.style.top  = (event.pageY - parseInt(workingDiv.style.height) / 2) + "px";
}

/**
Enables drawing with touch devices.
Start will record the initial points, it isn't until move where a canvas change occurs.
*/
function drawTouchStart(event) {
	var workingDiv = getCanvas();
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		workingDiv.ongoingTouches.push(drawMakeTouchData(touches[i]));
	}
}

/**
Support for touch devices.
This is when the new line is added.
*/
function drawTouchMove(event) {
	var workingDiv = getCanvas();
	var touches = event.changedTouches;
	var touchId;
	var cbb = workingDiv.getBoundingClientRect(); // canvas bounding box: cbb
	for (var i = 0; i < touches.length; i++) {
		touchId = drawGetTouchId(touches[i].identifier);
		// only if it is a known touch continuation
		if (touchId !== -1) {
			// xDest, yDest, xPrev, yPrev
			sendDrawLine(
				touches[i].pageX - cbb.left,
				touches[i].pageY - cbb.top,
				workingDiv.ongoingTouches[touchId].x - cbb.left,
				workingDiv.ongoingTouches[touchId].y - cbb.top
			);
			workingDiv.ongoingTouches[touchId].x = touches[i].pageX;
			workingDiv.ongoingTouches[touchId].y = touches[i].pageY;
		}
	}
	workingDiv = document.getElementById('sizeReference');
	workingDiv.style.left = (touches[0].pageX - parseInt(workingDiv.style.width) / 2)  + "px";
	workingDiv.style.top  = (touches[0].pageY - parseInt(workingDiv.style.height) / 2) + "px";
}

/**
Support for touch devices.
When touch ends, need to clear out the tracking values to prevent weird auto connections.
*/
function drawTouchEnd(event) {
	var workingDiv = getCanvas();
	var touches = event.changedTouches;
	var touchId;
	for (var i = 0; i < touches.length; i++) {
		touchId = drawGetTouchId(touches[i].identifier);
		if (touchId !== -1) {
			workingDiv.ongoingTouches.splice(touchId, 1);
		}
	}
	workingDiv = document.getElementById('sizeReference');
	workingDiv.style.left = "-100px";
	workingDiv.style.top  = "-100px";
}

/**
Makes the data used to track touches.
*/
function drawMakeTouchData(touch) {
	var nt = {};
	nt.id	= touch.identifier;
	nt.x	= touch.pageX;
	nt.y	= touch.pageY;
	return nt;
}

/**
Given a touch identifier(id) will return the index of the touch tracking object.
*/
function drawGetTouchId(id) {
	var workingDiv  = getCanvas();
	for (var i = 0; i < workingDiv.ongoingTouches.length; i++) {
		if (workingDiv.ongoingTouches[i].id === id) {
			return i;
		}
	}
	return -1;
}












function touchHandler(event, shouldPreventDefault)
{
	// If not converting touch events, immediately return
	if (!global.convertTouchEvents) {
		return;
	}
    var touches = event.changedTouches,
        first = touches[0],
        type = "";
    switch(event.type)
    {
        case "touchstart": type = "mousedown"; break;
        case "touchmove":  type = "mousemove"; break;        
        case "touchend":   type = "mouseup";   break;
        default:           return;
    }

	// Parameters
    // initMouseEvent(type, canBubble, cancelable, view, clickCount, 
    //                screenX, screenY, clientX, clientY, ctrlKey, 
    //                altKey, shiftKey, metaKey, button, relatedTarget);

    var simulatedEvent = document.createEvent("MouseEvent");
    simulatedEvent.initMouseEvent(type, true, true, window, 1, 
                                  first.screenX, first.screenY, 
                                  first.clientX, first.clientY, false, 
                                  false, false, false, 0/*left*/, null);

	first.target.dispatchEvent(simulatedEvent);
	
	if (shouldPreventDefault) {
		if (hasInteractionAncestor(event.target)) {
			event.preventDefault();
		}
	}
}

// Check if ancestor contains control panel or canvas
function hasInteractionAncestor(node) {
	if (node.id === "controlPanel" || node.id === "canvas") {
		return true;
	} else if (node.parentNode === null) {
		return false;
	} else {
		return hasInteractionAncestor(node.parentNode);
	}
}


function startTouchConversion() 
{
    document.addEventListener("touchstart", 	(e) => { touchHandler(e); }, true);
    document.addEventListener("touchmove", 		(e) => { touchHandler(e, "prevent"); }, true);
    document.addEventListener("touchend", 		(e) => { touchHandler(e); }, true);
    document.addEventListener("touchcancel", 	(e) => { touchHandler(e); }, true);    
}


function retrievePalletValues() {
	return ["#FFFFFF", "#EAEAEA", "#D5D5D5", "#C0C0C0", "#ABABAB", "#969696", "#818181", "#6C6C6C", "#575757", "#424242", "#2D2D2D", "#000000",
		"#990000", "#994C00", "#999900", "#4C9900", "#009900", "#00994C", "#009998", "#004C99", "#000099", "#4C0099", "#990099", "#99004C",
		"#E50000", "#E57200", "#E5E500", "#72E500", "#00E500", "#00E572", "#00E5E5", "#0072E5", "#0000E5", "#7200E5", "#E500E5", "#E50072",
		"#FF3333", "#FF9933", "#FFFF33", "#99FF33", "#33FF33", "#33FF99", "#33FFFE", "#3399FF", "#3333FF", "#9833FF", "#FF33FF", "#FF3398",
		"#FE7F7F", "#FEBF7F", "#FEFE7F", "#BFFE7F", "#7FFE7F", "#7FFEBF", "#7FFEFE", "#7FBFFE", "#7F7FFE", "#BF7FFE", "#FE7FFE", "#FE7FBF"];
}

function dbugprint(s) {
	if (global.debug) console.log(s);
}
