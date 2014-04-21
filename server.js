// node mode
/* jslint node: true */

// how to deal with spaces and tabs
/* jshint smarttabs: false */

// Don't make functions within a loop
/* jshint -W083 */

// JSLint options
/*globals loadConfiguration, showPointer, pointerPress, pointerMove, deleteElement, pointerScroll, moveAppToFront, pointerPosition, findAppUnderPointer, pointerRelease, getItemPositionSizeType, initializeExistingSagePointers, initializeMediaStreams, initializeRemoteServerInfo, initializeExistingAppsPositionSizeTypeOnly, initializeExistingApps, initializeSavedFilesList, createSagePointer, setupDisplayBackground, findRemosetupDisplayBackground, sendConfig, uploadForm, setupHttpsOptions, closeWebSocketClient, wsAddClient, findRemoteSiteByConnection, broadcast, hidePointer, removeElement, initializeWSClient, wsStartSagePointer, wsStopSagePointer, wsPointerPress, wsPointerRelease, wsPointerDblClick, wsPointerPosition, wsPointerMove, wsPointerScrollStart, wsPointerScroll, wsKeyDown, wsKeyUp, wsKeyPress, wsStartNewMediaStream, wsUpdateMediaStreamFrame, wsUpdateMediaStreamChunk, wsStopMediaStream, wsReceivedMediaStreamFrame, wsReceivedRemoteMediaStreamFrame, wsRequestStoredFiles, wsAddNewElementFromStoredFiles, wsAddNewWebElement, wsUpdateVideoTime, wsAddNewElementFromRemoteServer, wsRequestNextRemoteFrame, wsUpdateRemoteMediaStreamFrame */
/*jslint node: true, ass: false, plusplus: true, vars: true, white: true, newcap: true, unparam: true, eqeq: true */

// require variables to be declared
"use strict";

// Importing modules (from node_modules directory)

// npm registry: built-in or defined in package.json
var crypto      = require('crypto');              // https encryption
var fs          = require('fs');                  // filesystem access
var gm          = require('gm');                  // graphicsmagick
var http        = require('http');                // http server
var https       = require('https');               // https server
var imageinfo   = require('imageinfo');           // gets width, height for images
var json5       = require('json5');               // JSON format that allows comments
var multiparty  = require('multiparty');          // parses POST forms
var os          = require('os');                  // operating system access
var path        = require('path');                // file path extraction and creation
var request     = require('request');             // external http requests

// custom node modules
var httpserver  = require('node-httpserver');     // creates web server
var websocketIO = require('node-websocket.io');   // creates WebSocket server and clients
var loader      = require('node-itemloader');     // handles sage item creation
var interaction = require('node-interaction');    // handles sage interaction (move, resize, etc.)
var sagepointer = require('node-sagepointer');    // handles sage pointers (creation, location, etc.)


// load config file - looks for user defined file, then file that matches hostname, then uses default
var config = loadConfiguration();
console.log(config);


// global variables for various paths
var public_https = "public_HTTPS"; // directory where HTTPS content is stored
var hostOrigin = "https://"+config.host+":"+config.port.toString()+"/"; // base URL for this server
var uploadsFolder = path.join(public_https, "uploads"); // directory where files are uploaded

// global variables to manage items
var itemCount = 0;

// global variables to manage clients
var clients = [];
var webBrowserClient;
var sagePointers = {};
var remoteInteraction = {};
var mediaStreams = {};


var appLoader = new loader(public_https, hostOrigin);
var applications = [];
var appAnimations = {};

// arrays of files on the server (used for media browser)
var savedFiles = initializeSavedFilesList();


// sets up the background for the display clients (image or color)
setupDisplayBackground();


// create HTTP server for index page (Table of Contents)
var httpServerIndex = new httpserver("public_HTTP");
httpServerIndex.httpGET('/config', sendConfig); // send config object to client using http request


// create HTTPS server for all SAGE content
var httpsServerApp = new httpserver("public_HTTPS");
httpsServerApp.httpPOST('/upload', uploadForm); // receive newly uploaded files from SAGE Pointer / SAGE UI


// create HTTPS options - sets up security keys
var options = setupHttpsOptions();


// initializes HTTP and HTTPS servers
var index = http.createServer(httpServerIndex.onrequest);
var server = https.createServer(options, httpsServerApp.onrequest);


// creates a WebSocket server - 2 way communication between server and all browser clients
var wsioServer = new websocketIO.Server({server: server});

wsioServer.onconnection(function(wsio) {
	wsio.onclose(closeWebSocketClient);
	wsio.on('addClient', wsAddClient);
});

function closeWebSocketClient(wsio) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	console.log("Closed Connection: " + uniqueID + " (" + wsio.clientType + ")");
	
	var remote = findRemoteSiteByConnection(wsio);
	if(remote !== null){
		console.log("Remote site \"" + remote.name + "\" now offline");
		remote.connected = false;
		var site = {name: remote.name, connected: remote.connected};
		broadcast('connectedToRemoteSite', site, 'receivesRemoteServerInfo');
	}
	if(wsio.messages.sendsPointerData){
		hidePointer(uniqueID);
		delete sagePointers[uniqueID];
		delete remoteInteraction[uniqueID];
	}
	if(wsio.messages.requiresFullApps){
		var key;
		for(key in mediaStreams) {
			if (mediaStreams.hasOwnProperty(key)) {
				delete mediaStreams[key].clients[uniqueID];
			}
		}
		for(key in appAnimations) {
			if (appAnimations.hasOwnProperty(key)) {
				delete appAnimations[key].clients[uniqueID];
			}
		}
	}
	
	removeElement(clients, wsio);
}

function wsAddClient(wsio, data) {
	// overwrite host and port if defined
	if(data.host !== undefined) {
		wsio.remoteAddress.address = data.host;
	}
	if(data.port !== undefined) {
		wsio.remoteAddress.port = data.port;
	}
	
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	wsio.clientType = data.clientType;
	wsio.messages = {};
	
	// types of data sent/received to server from client through WebSockets
	wsio.messages.sendsPointerData                  = data.sendsPointerData                 || false;
	wsio.messages.sendsMediaStreamFrames            = data.sendsMediaStreamFrames           || false;
	wsio.messages.requestsServerFiles               = data.requestsServerFiles              || false;
	wsio.messages.sendsWebContentToLoad             = data.sendsWebContentToLoad            || false;
	wsio.messages.launchesWebBrowser                = data.launchesWebBrowser               || false;
	wsio.messages.sendsVideoSynchonization          = data.sendsVideoSynchonization         || false;
	wsio.messages.sharesContentWithRemoteServer     = data.sharesContentWithRemoteServer    || false;
	wsio.messages.receivesDisplayConfiguration      = data.receivesDisplayConfiguration     || false;
	wsio.messages.receivesClockTime                 = data.receivesClockTime                || false;
	wsio.messages.requiresFullApps                  = data.requiresFullApps                 || false;
	wsio.messages.requiresAppPositionSizeTypeOnly   = data.requiresAppPositionSizeTypeOnly  || false;
	wsio.messages.receivesMediaStreamFrames         = data.receivesMediaStreamFrames        || false;
	wsio.messages.receivesWindowModification        = data.receivesWindowModification       || false;
	wsio.messages.receivesPointerData               = data.receivesPointerData              || false;
	wsio.messages.receivesInputEvents               = data.receivesInputEvents              || false;
	wsio.messages.receivesRemoteServerInfo          = data.receivesRemoteServerInfo         || false;
	
	initializeWSClient(wsio);
	
	clients.push(wsio);
	console.log("New Connection: " + uniqueID + " (" + wsio.clientType + ")");
}

function initializeWSClient(wsio) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	wsio.emit('initialize', {UID: uniqueID, time: new Date()});
	
	// set up listeners based on what the client sends
	if(wsio.messages.sendsPointerData){
		wsio.on('startSagePointer',          wsStartSagePointer);
		wsio.on('stopSagePointer',           wsStopSagePointer);
		wsio.on('pointerPress',              wsPointerPress);
		wsio.on('pointerRelease',            wsPointerRelease);
		wsio.on('pointerDblClick',           wsPointerDblClick);
		wsio.on('pointerPosition',           wsPointerPosition);
		wsio.on('pointerMove',               wsPointerMove);
		wsio.on('pointerScrollStart',        wsPointerScrollStart);
		wsio.on('pointerScroll',             wsPointerScroll);
		wsio.on('keyDown',                   wsKeyDown);
		wsio.on('keyUp',                     wsKeyUp);
		wsio.on('keyPress',                  wsKeyPress);
	}
	if(wsio.messages.sendsMediaStreamFrames){
		wsio.on('startNewMediaStream',       wsStartNewMediaStream);
		wsio.on('updateMediaStreamFrame',    wsUpdateMediaStreamFrame);
		wsio.on('updateMediaStreamChunk',    wsUpdateMediaStreamChunk);
		wsio.on('stopMediaStream',           wsStopMediaStream);
	}
	if(wsio.messages.receivesMediaStreamFrames){
		wsio.on('receivedMediaStreamFrame',  wsReceivedMediaStreamFrame);
		wsio.on('receivedRemoteMediaStreamFrame',  wsReceivedRemoteMediaStreamFrame);
	}
	if(wsio.messages.requiresFullApps){
		wsio.on('finishedRenderingAppFrame', wsFinishedRenderingAppFrame);
	}
	if(wsio.messages.requestsServerFiles){
		wsio.on('requestStoredFiles', wsRequestStoredFiles);
		wsio.on('addNewElementFromStoredFiles', wsAddNewElementFromStoredFiles);
	}
	if(wsio.messages.sendsWebContentToLoad){
		wsio.on('addNewWebElement', wsAddNewWebElement);
	}
	if(wsio.messages.launchesWebBrowser){
		wsio.on('openNewWebpage', wsOpenNewWebpage);
	}
	if(wsio.messages.sendsVideoSynchonization){
		wsio.on('updateVideoTime', wsUpdateVideoTime);
	}
	if(wsio.messages.sharesContentWithRemoteServer){
		wsio.on('addNewElementFromRemoteServer', wsAddNewElementFromRemoteServer);
		wsio.on('requestNextRemoteFrame', wsRequestNextRemoteFrame);
		wsio.on('updateRemoteMediaStreamFrame', wsUpdateRemoteMediaStreamFrame);
		wsio.on('stopMediaStream', wsStopMediaStream);
	}
	
	
	if(wsio.messages.sendsPointerData)                 createSagePointer(uniqueID);
	if(wsio.messages.receivesDisplayConfiguration)     wsio.emit('setupDisplayConfiguration', config);
	if(wsio.messages.receivesClockTime)                wsio.emit('setSystemTime', {date: new Date()});
	if(wsio.messages.receivesPointerData)              initializeExistingSagePointers(wsio);
	if(wsio.messages.requiresFullApps)                 initializeExistingApps(wsio);
	if(wsio.messages.requiresAppPositionSizeTypeOnly)  initializeExistingAppsPositionSizeTypeOnly(wsio);
	if(wsio.messages.receivesRemoteServerInfo)         initializeRemoteServerInfo(wsio);
	if(wsio.messages.receivesMediaStreamFrames)        initializeMediaStreams(uniqueID);
	
	var remote = findRemoteSiteByConnection(wsio);
	if(remote !== null){
		remote.wsio = wsio;
		remote.connected = true;
		var site = {name: remote.name, connected: remote.connected};
		broadcast('connectedToRemoteSite', site, 'receivesRemoteServerInfo');
	}
	
	if(wsio.clientType == "webBrowser") webBrowserClient = wsio;
}

function initializeExistingSagePointers(wsio) {
	for(var key in sagePointers){
		if (sagePointers.hasOwnProperty(key)) {
			wsio.emit('createSagePointer', sagePointers[key]);
		}
	}
}

function initializeExistingApps(wsio) {
	var i;
	var key;
	
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	for(i=0; i<applications.length; i++){
		wsio.emit('createAppWindow', applications[i]);
	}
	for(key in appAnimations){
		if (appAnimations.hasOwnProperty(key)) {
			appAnimations[key].clients[uniqueID] = false;
		}
	}
}

function initializeExistingAppsPositionSizeTypeOnly(wsio) {
	var i;
	for(i=0; i<applications.length; i++){
		wsio.emit('createAppWindowPositionSizeOnly', applications[i]);
	}
}

function initializeRemoteServerInfo(wsio) {
	for(var i=0; i<remoteSites.length; i++){
		var site = {name: remoteSites[i].name, connected: remoteSites[i].connected, width: remoteSites[i].width, height: remoteSites[i].height, pos: remoteSites[i].pos};
		wsio.emit('addRemoteSite', site);
	}
}

function initializeMediaStreams(uniqueID) {
	var key;
	
	for(key in mediaStreams){
		if (mediaStreams.hasOwnProperty(key)) {
			mediaStreams[key].clients[uniqueID] = false;
		}
	}
}

/***************** Sage Pointer Functions *****************/
function wsStartSagePointer(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	showPointer(uniqueID, data);
}

function wsStopSagePointer(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	hidePointer(uniqueID);
	
	//return to window interaction mode after stopping pointer
	if(remoteInteraction[uniqueID].appInteractionMode()){
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode } , 'receivesPointerData');
	}
}

function wsPointerPress(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;

	pointerPress(uniqueID, pointerX, pointerY);
}

function wsPointerRelease(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;

	pointerRelease(uniqueID, pointerX, pointerY);
}

function wsPointerDblClick(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;
	var elem     = findAppUnderPointer(pointerX, pointerY);
	var updatedItem;

	if (elem !== null) {
		if (!elem.isMaximized || elem.isMaximized === 0) {
			// need to maximize the item
			updatedItem = remoteInteraction[uniqueID].maximizeSelectedItem(elem, config);
			if (updatedItem !== null) {
				broadcast('setItemPositionAndSize', updatedItem, 'receivesWindowModification');
				// the PDF files need an extra redraw
				broadcast('finishedResize', {id: updatedItem.elemId, elemWidth: updatedItem.elemWidth, elemHeight: updatedItem.elemHeight, date: new Date()}, 'receivesWindowModification');
			}
		} else {
			// already maximized, need to restore the item size
			updatedItem = remoteInteraction[uniqueID].restoreSelectedItem(elem);
			if (updatedItem !== null) {
				broadcast('setItemPositionAndSize', updatedItem, 'receivesWindowModification');
				// the PDF files need an extra redraw
				broadcast('finishedResize', {id: updatedItem.elemId, elemWidth: updatedItem.elemWidth, elemHeight: updatedItem.elemHeight, date: new Date()}, 'receivesWindowModification');
			}
		}
	}
}

function wsPointerPosition(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	pointerPosition(uniqueID, data);
}

function wsPointerMove(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	pointerMove(uniqueID, data);
}

function wsPointerScrollStart(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;
	var elem = findAppUnderPointer(pointerX, pointerY);

	if(elem !== null){
		remoteInteraction[uniqueID].selectScrollItem(elem);
		var newOrder = moveAppToFront(elem.id);
		broadcast('updateItemOrder', {idList: newOrder}, 'receivesWindowModification');
	}
}

function wsPointerScroll(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	pointerScroll(uniqueID, data);
}

function wsKeyDown(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	if(data.code == 16){ // shift
		remoteInteraction[uniqueID].SHIFT = true;
	}
	else if(data.code == 17){ // ctrl
		remoteInteraction[uniqueID].CTRL = true;
	}
	else if(data.code == 18) { // alt
		remoteInteraction[uniqueID].ALT = true;
	}
	else if(data.code == 20) { // caps lock
		remoteInteraction[uniqueID].CAPS = true;
	}
	else if(data.code == 91 || data.code == 92 || data.code == 93){ // command
		remoteInteraction[uniqueID].CMD = true;
	}

	//SEND SPECIAL KEY EVENT only will come here
	if(remoteInteraction[uniqueID].appInteractionMode()){
		var pointerX = sagePointers[uniqueID].left;
		var pointerY = sagePointers[uniqueID].top;

		var elem = findAppUnderPointer(pointerX, pointerY);

		if(elem !== null){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			var event = { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[uniqueID].id, user_label: sagePointers[uniqueID].label, user_color: sagePointers[uniqueID].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "down" }, date: now };
			broadcast('eventInItem', event, 'receivesInputEvents');
		}
	}
}

function wsKeyUp(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;
	var elem = findAppUnderPointer(pointerX, pointerY);

	if(data.code == 16){ // shift
		remoteInteraction[uniqueID].SHIFT = false;
	}
	else if(data.code == 17){ // ctrl
		remoteInteraction[uniqueID].CTRL = false;
	}
	else if(data.code == 18) { // alt
		remoteInteraction[uniqueID].ALT = false;
	}
	else if(data.code == 20) { // caps lock
		remoteInteraction[uniqueID].CAPS = false;
	}
	else if(data.code == 91 || data.code == 92 || data.code == 93){ // command
		remoteInteraction[uniqueID].CMD = false;
	}

	if(elem !== null){
		if(remoteInteraction[uniqueID].windowManagementMode()){
			if(data.code == "8" || data.code == "46"){ // backspace or delete
				deleteApplication(elem);
			}
		}
		else if(remoteInteraction[uniqueID].appInteractionMode()) {	//only send special keys
			pointerX = sagePointers[uniqueID].left;
			pointerY = sagePointers[uniqueID].top;

			elem = findAppUnderPointer(pointerX, pointerY);

			if( elem !== null ){
				var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				var event = { eventType: "specialKey", elemId: elem.id, user_id: sagePointers[uniqueID].id, user_label: sagePointers[uniqueID].label, user_color: sagePointers[uniqueID].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: data.code, state: "up" }, date: now };
				broadcast('eventInItem', event, 'receivesInputEvents');
			}
		}
	}
}

function wsKeyPress(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	if(data.code == 9 && remoteInteraction[uniqueID].SHIFT && sagePointers[uniqueID].visible){ // shift + tab
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode}, 'receivesPointerData');
	}

	else if ( remoteInteraction[uniqueID].appInteractionMode() ) {
		var pointerX = sagePointers[uniqueID].left;
		var pointerY = sagePointers[uniqueID].top;

		var elem = findAppUnderPointer(pointerX, pointerY);

		if( elem !== null ){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			var event = { eventType: "keyboard", elemId: elem.id, user_id: sagePointers[uniqueID].id, user_label: sagePointers[uniqueID].label, user_color: sagePointers[uniqueID].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {code: parseInt(data.code,10), state: "down" }, date: now };
			broadcast('eventInItem', event, 'receivesInputEvents');
		}
	}

}

/***************** Media Stream Functions *****************/
function wsStartNewMediaStream(wsio, data) {
	console.log("received new stream: " + data.id);
	mediaStreams[data.id] = {ready: true, chunks: [], clients: {}};
	for(var i=0; i<clients.length; i++){
		if(clients[i].messages.receivesMediaStreamFrames){
			var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
			mediaStreams[data.id].clients[clientAddress] = false;
		}
	}

	appLoader.createMediaStream(data.src, data.type, data.encoding, data.title, data.width, data.height, function(appInstance) {
		appInstance.id = data.id;
		broadcast('createAppWindow', appInstance, 'requiresFullApps');
		broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance), 'requiresAppPositionSizeTypeOnly');
			
		applications.push(appInstance);
	});
}

function wsUpdateMediaStreamFrame(wsio, data) {
	mediaStreams[data.id].ready = true;
	for(var key in mediaStreams[data.id].clients){
		mediaStreams[data.id].clients[key] = false;
	}
	
	var stream = findAppById(data.id);
	if(stream !== null) stream.state = data.state;

	broadcast('updateMediaStreamFrame', data, 'receivesMediaStreamFrames');
}

function wsUpdateMediaStreamChunk(wsio, data) {
	if(mediaStreams[data.id].chunks.length === 0) mediaStreams[data.id].chunks = initializeArray(data.total, "");
	mediaStreams[data.id].chunks[data.piece] = data.state.src;
	if(allNonBlank(mediaStreams[data.id].chunks)){
		wsUpdateMediaStreamFrame(wsio, {id: data.id, state: {src: mediaStreams[data.id].chunks.join(""), type: data.state.type, encoding: data.state.encoding}});
		mediaStreams[data.id].chunks = [];
	}
}

function wsStopMediaStream(wsio, data) {
	var elem = findAppById(data.id);

	if(elem !== null) deleteApplication( elem );
}


function wsReceivedMediaStreamFrame(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	var i;
	mediaStreams[data.id].clients[uniqueID] = true;
	if(allTrueDict(mediaStreams[data.id].clients) && mediaStreams[data.id].ready){
		mediaStreams[data.id].ready = false;
		var broadcastWS = null;
		var mediaStreamData = data.id.split("|");
		if(mediaStreamData.length === 2){ // local stream --> client | stream_id
			var broadcastAddress = mediaStreamData[0];
			var broadcastID = parseInt(mediaStreamData[1]);
			for(var i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == broadcastAddress) broadcastWS = clients[i];
			}
			if(broadcastWS !== null) broadcastWS.emit('requestNextFrame', {streamId: broadcastID});
		}
		else if(mediaStreamData.length === 3){ // remote stream --> remote_server | client | stream_id
			var serverAddress = mediaStreamData[0];
			var broadcastAddress = mediaStreamData[1];
			var broadcastID = mediaStreamData[2];
			
			console.log("request remote stream: " + serverAddress + ", " + broadcastAddress + ", " + broadcastID);
		
			for(i=0; i<clients.length; i++){
				var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
				if(clientAddress == serverAddress) { broadcastWS = clients[i]; break; }
			}
		
			if(broadcastWS !== null) broadcastWS.emit('requestNextRemoteFrame', {id: broadcastAddress + "|" + broadcastID});
		}
	}
}

/******************** Application Animation Functions ********************/
function wsFinishedRenderingAppFrame(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	appAnimations[data.id].clients[uniqueID] = true;
	if(allTrueDict(appAnimations[data.id].clients)){
		var key;
		for(key in appAnimations[data.id].clients){
			appAnimations[data.id].clients[key] = false;
		}
		
		// animate max 60 fps
		var now = new Date();
		var elapsed = now.getTime() - appAnimations[data.id].date.getTime();
		if(elapsed > 16){
			appAnimations[data.id].date = new Date();
			broadcast('animateCanvas', {id: data.id, date: new Date()}, 'requiresFullApps');
		}
		else{
			setTimeout(function() {
				appAnimations[data.id].date = new Date();
				broadcast('animateCanvas', {id: data.id, date: new Date()}, 'requiresFullApps');
			}, 16-elapsed);
		}
	}
}

/******************** Server File Functions ********************/
function wsRequestStoredFiles(wsio, data) {
	wsio.emit('storedFileList', savedFiles);
}

function wsAddNewElementFromStoredFiles(wsio, data) {
	appLoader.loadFileFromLocalStorage(data, function(appInstance) {
		appInstance.id = getUniqueAppId();
		
		if(appInstance.animation){
			var i;
			appAnimations[appInstance.id] = {clients: {}, date: new Date()};
			for(i=0; i<clients.length; i++){
				if(clients[i].messages.requiresFullApps){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					appAnimations[appInstance.id].clients[clientAddress] = false;
				}
			}
		}
		
		broadcast('createAppWindow', appInstance, 'requiresFullApps');
		broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance), 'requiresAppPositionSizeTypeOnly');
		
		applications.push(appInstance);
	});
}

/******************** Adding Web Content (URL) ********************/
function wsAddNewWebElement(wsio, data) {
	appLoader.loadFileFromWebURL(data, function(appInstance) {
		appInstance.id = getUniqueAppId();
		broadcast('createAppWindow', appInstance, 'requiresFullApps');
		broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance), 'requiresAppPositionSizeTypeOnly');
		
		applications.push(appInstance);
		
		if(appInstance.animation){
			var i;
			appAnimations[appInstance.id] = {clients: {}, date: new Date()};
			for(i=0; i<clients.length; i++){
				if(clients[i].messages.requiresFullApps){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					appAnimations[appInstance.id].clients[clientAddress] = false;
				}
			}
		}
	});
}

/*********************** Launching Web Browser ************************/
function wsOpenNewWebpage(wsio, data) {
	webBrowserClient.emit('openWebBrowser', {url: data.url});
}

/******************** Video / Audio Synchonization *********************/
function wsUpdateVideoTime(wsio, data) {
	broadcast('updateVideoItemTime', data, 'requiresFullApps');
}

/******************** Remote Server Content ****************************/
function wsAddNewElementFromRemoteServer(wsio, data) {
	console.log("add element from remote server");
	appLoader.loadApplicationFromRemoteServer(data, function(appInstance) {
		console.log("Remote App: " + appInstance.application);
		if(appInstance.application === "media_stream"){
			appInstance.id = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port + "|" + appInstance.id;
			mediaStreams[appInstance.id] = {ready: true, chunks: [], clients: {}};
			for(var i=0; i<clients.length; i++){
				if(clients[i].messages.receivesMediaStreamFrames){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					mediaStreams[appInstance.id].clients[clientAddress] = false;
				}
			}
		}
		else {
			appInstance.id = getUniqueAppId();
		}
		
		broadcast('createAppWindow', appInstance, 'requiresFullApps');
		broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance), 'requiresAppPositionSizeTypeOnly');
	
		applications.push(appInstance);
	
		if(appInstance.animation){
			var i;
			appAnimations[appInstance.id] = {clients: {}, date: new Date()};
			for(i=0; i<clients.length; i++){
				if(clients[i].messages.requiresFullApps){
					var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
					appAnimations[appInstance.id].clients[clientAddress] = false;
				}
			}
		}
	});
}

function wsRequestNextRemoteFrame(wsio, data) {
	var stream = findAppById(data.id);
	var remote_id = config.host + ":" + config.port + "|" + data.id;

	if(stream !== null) wsio.emit('updateRemoteMediaStreamFrame', {id: remote_id, state: stream.data});
	else wsio.emit('stopMediaStream', {id: remote_id});
}

function wsUpdateRemoteMediaStreamFrame(wsio, data) {
	var key;
	mediaStreams[data.id].ready = true;
	for(key in mediaStreams[data.id].clients){
		mediaStreams[data.id].clients[key] = false;
	}
	var stream = findAppById(data.id);
	if(stream !== null) stream.data = data.data;
	
	//broadcast('updateRemoteMediaStreamFrame', data, 'receivesMediaStreamFrames');
	broadcast('updateMediaStreamFrame', data, 'receivesMediaStreamFrames');
}

function wsReceivedRemoteMediaStreamFrame(wsio, data) {
	var uniqueID = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port;
	
	mediaStreams[data.id].clients[uniqueID] = true;
	if(allTrueDict(mediaStreams[data.id].clients) && mediaStreams[data.id].ready){
		mediaStreams[data.id].ready = false;

		var broadcastWS = null;
		var serverAddress = data.id.substring(6).split("|")[0];
		var broadcastAddress = data.id.substring(6).split("|")[1];
		
		for(var i=0; i<clients.length; i++){
			var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
			if(clientAddress == serverAddress) { broadcastWS = clients[i]; break; }
		}
		
		if(broadcastWS !== null) broadcastWS.emit('requestNextRemoteFrame', {id: broadcastAddress});
	}
}


function loadConfiguration() {
	var configFile = null;
	
	// Read config.txt - if exists and specifies a user defined config, then use it
	if(fs.existsSync("config.txt")){
		var lines = fs.readFileSync("config.txt", 'utf8').split("\n");
		for(var i =0; i<lines.length; i++){
			var text = "";
			var comment = lines[i].indexOf("//");
			if(comment >= 0) text = lines[i].substring(0,comment).trim();
			else text = lines[i].trim();
		
			if(text !== ""){
				configFile = text;
				console.log("Found configuration file: " + configFile);
				break;
			}
		}
	}
	
	// If config.txt does not exist or does not specify any files, look for a config with the hostname
	if(configFile === null){
		var hn = os.hostname();
		var dot = hn.indexOf(".");
		if(dot >= 0) hn = hn.substring(0, dot);
		configFile = path.join("config", hn + "-cfg.json");
		if(fs.existsSync(configFile)){
			console.log("Found configuration file: " + configFile);
		}
		else{
			configFile = path.join("config", "desktop-cfg.json");
			console.log("Using default configuration file: " + configFile);
		}
	}
	
	var json_str = fs.readFileSync(configFile, 'utf8');
	var userConfig = json5.parse(json_str);
	// compute extra dependent parameters
	userConfig.totalWidth     = userConfig.resolution.width  * userConfig.layout.columns;
	userConfig.totalHeight    = userConfig.resolution.height * userConfig.layout.rows;
	userConfig.titleBarHeight = Math.round(0.025 * userConfig.totalHeight);
	userConfig.titleTextSize  = Math.round(0.015 * userConfig.totalHeight);
	userConfig.pointerWidth   = Math.round(0.200 * userConfig.totalHeight);
	userConfig.pointerHeight  = Math.round(0.050 * userConfig.totalHeight);
	
	return userConfig;
}

function getUniqueAppId() {
	var id = "application_"+itemCount.toString();
	itemCount++;
	
	return id;	
}

function initializeSavedFilesList() {
	var list = {image: [], video: [], pdf: [], app: []};
	var uploadedImages = fs.readdirSync(path.join(uploadsFolder, "images"));
	var uploadedVideos = fs.readdirSync(path.join(uploadsFolder, "videos"));
	var uploadedPdfs   = fs.readdirSync(path.join(uploadsFolder, "pdfs"));
	var uploadedApps   = fs.readdirSync(path.join(uploadsFolder, "apps"));
	var i;
	for(i=0; i<uploadedImages.length; i++) list.image.push(uploadedImages[i]);
	for(i=0; i<uploadedVideos.length; i++) list.video.push(uploadedVideos[i]);
	for(i=0; i<uploadedPdfs.length; i++)   list.pdf.push(uploadedPdfs[i]);
	for(i=0; i<uploadedApps.length; i++)   list.app.push(uploadedApps[i]);
	
	return list;
}

function setupDisplayBackground() {
	var tmpImg, imgExt;

	// background image
	if(config.background.image !== undefined && config.background.image !== null){
		var bg_file = path.join(public_https, config.background.image);
		var bg_info = imageinfo(fs.readFileSync(bg_file));
	
		if(config.background.style == "fit"){
			if(bg_info.width == config.totalWidth && bg_info.height == config.totalHeight){
				sliceBackgroundImage(bg_file, bg_file);
			}
			else{
				tmpImg = path.join(public_https, "images", "background", "tmp_background.png");
				var out_res  = config.totalWidth.toString() + "x" + config.totalHeight.toString();
		
				gm(bg_file).command("convert").in("-gravity", "center").in("-background", "rgba(255,255,255,255)").in("-extent", out_res).write(tmpImg, function(err) {
					if(err) throw err;
			
					sliceBackgroundImage(tmpImg, bg_file);
				});
			}
		}
		else if(config.background.style == "stretch"){
			imgExt = path.extname(bg_file);
			tmpImg = path.join(public_https, "images", "background", "tmp_background" + imgExt);
		
			gm(bg_file).resize(config.totalWidth, config.totalHeight, "!").write(tmpImg, function(err) {
				if(err) throw err;
			
				sliceBackgroundImage(tmpImg, bg_file);
			});
		}
		else if(config.background.style == "tile"){
			imgExt = path.extname(bg_file);
			tmpImg = path.join(public_https, "images", "background", "tmp_background" + imgExt);
		
			var cols = Math.ceil(config.totalWidth / bg_info.width);
			var rows = Math.ceil(config.totalHeight / bg_info.height);
			var tile = cols.toString() + "x" + rows.toString();
			var in_res  = bg_info.width.toString() + "x" + bg_info.height.toString();
		
			var gmTile = gm().command("montage").in("-geometry", in_res).in("-tile", tile);
			for(var i=0; i<rows*cols; i++) gmTile = gmTile.in(bg_file);
		
			gmTile.write(tmpImg, function(err) {
				if(err) throw err;
			
				sliceBackgroundImage(tmpImg, bg_file);
			});
		}
	}
}

function sliceBackgroundImage(fileName, outputBaseName) {
	for(var i=0; i<config.displays.length; i++){
		var x = config.displays[i].column * config.resolution.width;
		var y = config.displays[i].row * config.resolution.height;
		var output_dir = path.dirname(outputBaseName);
		var input_ext = path.extname(outputBaseName);
		var output_ext = path.extname(fileName);
		var output_base = path.basename(outputBaseName, input_ext);
		var output = path.join(output_dir, output_base + "_"+i.toString() + output_ext);
		console.log(output);
		gm(fileName).crop(config.resolution.width, config.resolution.height, x, y).write(output, function(err) {
			if(err) throw err;
		});
	}
}

function setupHttpsOptions() {
	// build a list of certs to support multi-homed computers
	var certs = {};
	// add the default cert from the hostname specified in the config file
	try {
		certs[config.host] = crypto.createCredentials({
			key:  fs.readFileSync(path.join("keys", config.host + "-server.key")),
			cert: fs.readFileSync(path.join("keys", config.host + "-server.crt")),
			ca:   fs.readFileSync(path.join("keys", config.host + "-ca.crt")),
		}).context;
	}
	catch (e) {
		console.log("\n");
		console.log(e);
		console.log("\n----------");
		console.log("Cannot open certificate for default host: ", config.host);
		console.log(" --> Please generate the appropriate certificate in the 'keys' folder");
		console.log("----------\n\n");
		process.exit(1);
	}

	for(var h in config.alternate_hosts){
		try {
			var alth = config.alternate_hosts[h];
			certs[ alth ] = crypto.createCredentials({
				key:  fs.readFileSync(path.join("keys", alth + "-server.key")),
				cert: fs.readFileSync(path.join("keys", alth + "-server.crt")),
				ca:   fs.readFileSync(path.join("keys", alth + "-ca.crt")),
			}).context;
		}
		catch (e) {
			console.log("\n");
			console.log(e);
			console.log("\n----------");
			console.log("Cannot open certificate for the alternate host: ", config.alternate_hosts[h]);
			console.log(" --> Please generate the appropriate certificates in the 'keys' folder");
			console.log("----------\n\n");
			process.exit(1);
		}
	}

	var httpsOptions = {
		// server default keys
		key:  fs.readFileSync(path.join("keys", config.host + "-server.key")),
		cert: fs.readFileSync(path.join("keys", config.host + "-server.crt")),
		ca:   fs.readFileSync(path.join("keys", config.host + "-ca.crt")),
		requestCert: true,
		rejectUnauthorized: false,
		// callback to handle multi-homed machines
		SNICallback: function(servername){
			if(certs.hasOwnProperty(servername)){
				return certs[servername];
			}
			else{
				console.log("Unknown host, cannot find a certificate for ", servername);
				return null;
			}
		}
	};
	
	return httpsOptions;
}

function sendConfig(req, res) {
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.write(JSON.stringify(config));
	res.end();
}

function uploadForm(req, res) {
	var form = new multiparty.Form();
	form.parse(req, function(err, fields, files) {
		if(err){
			res.writeHead(500, {"Content-Type": "text/plain"});
			res.write(err + "\n\n");
			res.end();
		}
		
		// saves files in appropriate directory and broadcasts the items to the displays
		manageUploadedFiles(files);

		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write("received upload:\n\n");
		res.end();
	});
}

function manageUploadedFiles(files) {
	var url, external_url, localPath, ext;

    var fileKeys = Object.keys(files);
	fileKeys.forEach(function(key) {
		var file = files[key][0];
		
		appLoader.manageAndLoadUploadedFile(file, function(appInstance) {
			appInstance.id = getUniqueAppId();
			broadcast('createAppWindow', appInstance, 'requiresFullApps');
			broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance), 'requiresAppPositionSizeTypeOnly');
			
			applications.push(appInstance);
			
			if(appInstance.animation){
				var i;
				appAnimations[appInstance.id] = {clients: {}, date: new Date()};
				for(i=0; i<clients.length; i++){
					if(clients[i].messages.requiresFullApps){
						var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
						appAnimations[appInstance.id].clients[clientAddress] = false;
					}
				}
			}
		});
	});
}



/******** Remote Site Collaboration ******************************************************/
var remoteSites = new Array(config.remote_sites.length);
config.remote_sites.forEach(function(element, index, array) {
	var wsURL = "wss://" + element.host + ":" + element.port.toString();

	var remote = createRemoteConnection(wsURL, element, index);

	var rWidth = Math.min((0.5*config.totalWidth)/remoteSites.length, config.titleBarHeight*6) - 2;
	var rHeight = config.titleBarHeight - 4;
	var rPos = (0.5*config.totalWidth) + ((rWidth+2)*(index-(remoteSites.length/2))) + 1;
	remoteSites[index] = {name: element.name, wsio: remote, connected: false, width: rWidth, height: rHeight, pos: rPos};

	// attempt to connect every 15 seconds, if connection failed
	setInterval(function() {
		if(!remoteSites[index].connected){
			var remote = createRemoteConnection(wsURL, element, index);
			remoteSites[index].wsio = remote;
		}
	}, 15000);
});

function createRemoteConnection(wsURL, element, index) {
	var remote = new websocketIO(wsURL, false, function() {
		console.log("connected to " + element.name);
		remote.remoteAddress.address = element.host;
		remote.remoteAddress.port = element.port;
		var clientDescription = {
			clientType: "remoteServer",
			host: config.host,
			port: config.port,
			sendsPointerData: false,
			sendsMediaStreamFrames: false,
			requestsServerFiles: false,
			sendsWebContentToLoad: false,
			sendsVideoSynchonization: false,
			sharesContentWithRemoteServer: true,
			receivesDisplayConfiguration: false,
			receivesClockTime: false,
			requiresFullApps: false,
			requiresAppPositionSizeTypeOnly: false,
			receivesMediaStreamFrames: false,
			receivesWindowModification: false,
			receivesPointerData: false,
			receivesInputEvents: false,
			receivesRemoteServerInfo: false
		};
		remote.emit('addClient', clientDescription);
		remoteSites[index].connected = true;
		var site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', site, 'receivesRemoteServerInfo');
		clients.push(remote);
	});

	remote.clientType = "remoteServer";

	remote.onclose(function() {
		console.log("Remote site \"" + config.remote_sites[index].name + "\" now offline");
		remoteSites[index].connected = false;
		var site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', site, 'receivesRemoteServerInfo');
		removeElement(clients, remote);
	});
	
	remote.on('addNewElementFromRemoteServer', wsAddNewElementFromRemoteServer);
	remote.on('requestNextRemoteFrame', wsRequestNextRemoteFrame);
	remote.on('updateRemoteMediaStreamFrame', wsUpdateRemoteMediaStreamFrame);
	remote.on('stopMediaStream', wsStopMediaStream);

	return remote;
}

/******** System Time - Updated Every Minute *********************************************/
var cDate = new Date();
setTimeout(function() {
	setInterval(function() {
		broadcast('setSystemTime', {date: new Date()}, 'receivesClockTime');
	}, 60000);

	broadcast('setSystemTime', {date: new Date()}, 'receivesClockTime');
}, (61-cDate.getSeconds())*1000);



/******** Omicron section ****************************************************************/
var net = require('net');
var util = require('util');
var dgram = require('dgram');

var udp;

var trackerIP = config.omicronServerIP;
var msgPort = config.omicronMsgPort;
var dataPort = config.omicronDataPort;

if( config.omicronServerIP )
{
	if( msgPort === undefined )
	{
		msgPort = 28000;
		console.log('Omicron: msgPort undefined. Using default: ', msgPort);
	}
	if( dataPort === undefined )
	{
		dataPort = 9123;
		console.log('Omicron: dataPort undefined. Using default: ', dataPort);
	}

	console.log('Connecting to Omicron server: ', trackerIP, msgPort);

	var client = net.connect(msgPort, trackerIP,  function()
	{ //'connect' listener
		console.log('Connected to Omicron server. Requesting data on port ', dataPort);

		var sendbuf = util.format("omicron_data_on,%d", dataPort);
		//console.log("Omicron> Sending handshake: ", sendbuf);
		client.write(sendbuf);

		udp = dgram.createSocket("udp4");
		var dstart = Date.now();
		var emit = 0;

		// array to hold all the button values (1 - down, 0 = up)
		var buttons = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		var mouse   = [0, 0, 0];
		var mousexy = [0.0, 0.0];
		var colorpt = [0.0, 0.0, 0.0];
		var mousez  = 0;

		udp.on("message", function (msg, rinfo)
		{
			//console.log("UDP> got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
			// var out = util.format("UDP> msg from [%s:%d] %d bytes", rinfo.address,rinfo.port,msg.length);
			// console.log(out);

			if ((Date.now() - dstart) > 100)
			{
				var offset = 0;
				var e = {};
				if (offset < msg.length) e.timestamp = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.sourceId = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceId = msg.readInt32LE(offset); offset += 4;
				if (offset < msg.length) e.serviceType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.type = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.flags = msg.readUInt32LE(offset); offset += 4;

				if (offset < msg.length) e.posx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posy = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.posz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orw = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orx = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.ory = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.orz = msg.readFloatLE(offset); offset += 4;
				if (offset < msg.length) e.extraDataType = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataItems = msg.readUInt32LE(offset); offset += 4;
				if (offset < msg.length) e.extraDataMask = msg.readUInt32LE(offset); offset += 4;

				// Extra data types:
				//    0 ExtraDataNull,
				//    1 ExtraDataFloatArray,
				//    2 ExtraDataIntArray,
				//    3 ExtraDataVector3Array,
				//    4 ExtraDataString,
				//    5 ExtraDataKinectSpeech

				var r_roll  = Math.asin(2.0*e.orx*e.ory + 2.0*e.orz*e.orw);
				var r_yaw   = Math.atan2(2.0*e.ory*e.orw-2.0*e.orx*e.orz , 1.0 - 2.0*e.ory*e.ory - 2.0*e.orz*e.orz);
				var r_pitch = Math.atan2(2.0*e.orx*e.orw-2.0*e.ory*e.orz , 1.0 - 2.0*e.orx*e.orx - 2.0*e.orz*e.orz);

				var posX = e.posx * config.totalWidth;
				var posY = e.posy*config.totalHeight;
				var sourceID = e.sourceId;

				// serviceID: 0 = touch, 1 = SAGEPointer (note this depends on the order the services are specified on the server)
				var serviceID = e.serviceId;

				var touchWidth = 0;
				var touchHeight = 0;
				if( serviceID === 0 &&  e.extraDataItems >= 2)
				{
					touchWidth = msg.readFloatLE(offset); offset += 4;
					touchHeight = msg.readFloatLE(offset); offset += 4;
					//console.log("Touch size: " + touchWidth + "," + touchHeight);
				}

				// Appending sourceID to pointer address ID
				var address = trackerIP+":"+sourceID;

				// ServiceTypePointer //////////////////////////////////////////////////
				if (e.serviceType === 0)
				{
					//console.log("pointer ID "+ sourceID +" event! type: " + e.type  );
					//console.log("pointer event! type: " + e.type  );
					//console.log("ServiceTypePointer> source ", e.sourceId);
					//console.log("ServiceTypePointer> serviceID ", e.serviceId);

					// TouchGestureManager Flags:
					// 1 << 17 = User flag start (as of 12/20/13)
					// User << 1 = Unprocessed
					// User << 2 = Single touch
					// User << 3 = Big touch
					// User << 4 = 5-finger hold
					// User << 5 = 5-finger swipe
					// User << 6 = 3-finger hold
					var User = 1 << 17;

					var FLAG_SINGLE_TOUCH = User << 2;
					var FLAG_BIG_TOUCH = User << 3;
					var FLAG_FIVE_FINGER_HOLD = User << 4;
					var FLAG_FIVE_FINGER_SWIPE = User << 5;
					var FLAG_THREE_FINGER_HOLD = User << 6;
					var FLAG_SINGLE_CLICK = User << 7;
					var FLAG_DOUBLE_CLICK = User << 8;

					//console.log( e.flags );
					if (e.type == 3)
					{ // update (Used only by classic SAGE pointer)
						/* if( e.sourceId in ptrs )
							return;
						colorpt = [Math.floor(e.posx*255.0), Math.floor(e.posy*255.0), Math.floor(e.posz*255.0)];
						if (offset < msg.length)
						{
							if (e.extraDataType == 4 && e.extraDataItems > 0)
							{
								console.log("create touch pointer");
								e.extraString = msg.toString("utf-8", offset, offset+e.extraDataItems);
								ptrinfo = e.extraString.split(" ");
								offset += e.extraDataItems;
								ptrs[e.sourceId] = {id:e.sourceId, label:ptrinfo[0], ip:ptrinfo[1], mouse:[0,0,0], color:colorpt, zoom:0, position:[0,0], mode:0};
								sio.sockets.emit('createPointer', {type: 'ptr', id: e.sourceId, label: ptrinfo[0], color: colorpt, zoom:0, position:[0,0], src: "resources/mouse-pointer-hi.png" });
							}
						}*/
					}
					else if (e.type == 4)
					{ // move
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							pointerPosition( address, { pointerX: posX, pointerY: posY } );

						}
					}
					else if (e.type == 15)
					{ // zoom
						console.log("Touch zoom");

						/*
						Omicron zoom event extra data:
						0 = touchWidth (parsed above)
						1 = touchHeight (parsed above)
						2  = zoom delta
						3 = event second type ( 1 = Down, 2 = Move, 3 = Up )
						*/
						// extraDataType 1 = float
						if (e.extraDataType == 1 && e.extraDataItems >= 4)
						{

							var zoomDelta = msg.readFloatLE(offset); offset += 4;
							var eventType = msg.readFloatLE(offset);  offset += 4;
							console.log( zoomDelta );

							if( eventType == 1 ) // Zoom start/down
							{
								pointerScrollStart( address, posX, posY );
							}
							else // Zoom move
							{
								pointerScroll( address, { scale: 1+zoomDelta } );
							}
						}

					}
					else if (e.type == 5) { // button down
						//console.log("\t down , flags ", e.flags);

						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							console.log("starting pointer: " + address);
							// Create pointer
							if(address in sagePointers){
								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );
							}else{
								createSagePointer(address);

								showPointer( address, { label:  "Touch: " + sourceID, color: "rgba(255, 255, 255, 1.0)" } );

								pointerPress( address, posX, posY );
							}
						}
						else if( e.flags == FLAG_FIVE_FINGER_HOLD )
						{
							console.log("Touch gesture: Five finger hold");

							var elem = findAppUnderPointer(posX, posY);

							// Remove element
							if( elem !== null )
							{
								deleteApplication( elem );
							}
						}
						else if( e.flags == FLAG_THREE_FINGER_HOLD )
						{
							console.log("Touch gesture: Three finger hold");
						}
						else if( e.flags == FLAG_SINGLE_CLICK )
						{
							console.log("Touch gesture: Click");
						}
						else if( e.flags == FLAG_DOUBLE_CLICK )
						{
							console.log("Touch gesture: Double Click");
						}
					}
					else if (e.type == 6)
					{ // button up
						if( e.flags == FLAG_SINGLE_TOUCH )
						{
							// Hide pointer
							hidePointer(address);

							// Release event
							pointerRelease(address, posX, posY);

							console.log("Touch release");
						}
					}
					else
					{
					console.log("\t UNKNOWN event type ", e.type);
					}

					if (emit>2) { dstart = Date.now(); emit = 0; }
				}// ServiceTypePointer ends ///////////////////////////////////////////
			}
		});

		udp.on("listening", function () {
			var address = udp.address();
			console.log("UDP> listening " + address.address + ":" + address.port);
		});

		udp.bind(dataPort);

	});
}
/***************************************************************************************/

// Start the https server
index.listen(config.index_port);
server.listen(config.port);

console.log('Now serving the app at https://localhost:' + config.port);



/***************************************************************************************/

function broadcast(func, data, type) {
	for(var i=0; i<clients.length; i++){
		if(clients[i].messages[type]) clients[i].emit(func, data);
	}
}

function findRemoteSiteByConnection(wsio) {
	var remoteIdx = -1;
	for(var i=0; i<config.remote_sites.length; i++){
		if(wsio.remoteAddress.address == config.remote_sites[i].host && wsio.remoteAddress.port == config.remote_sites[i].port)
			remoteIdx = i;
	}
	if(remoteIdx >= 0) return remoteSites[remoteIdx];
	else               return null;
}

function findAppUnderPointer(pointerX, pointerY) {
	var i;
	for(i=applications.length-1; i>=0; i--){
		if(pointerX >= applications[i].left && pointerX <= (applications[i].left+applications[i].width) && pointerY >= applications[i].top && pointerY <= (applications[i].top+applications[i].height+config.titleBarHeight)){
			return applications[i];
		}
	}
	return null;
}

function findAppById(id) {
	var i;
	for(i=0; i<applications.length; i++){
		if(applications[i].id === id) return applications[i];
	}
	return null;
}

function moveAppToFront(id) {
	var selectedIndex;
	var selectedApp;
	var appIds = [];
	var i;

	for(i=0; i<applications.length; i++){
		if(applications[i].id === id){
			selectedIndex = i;
			selectedApp = applications[selectedIndex];
			break;
		}
		appIds.push(applications[i].id);
	}
	for(i=selectedIndex; i<applications.length-1; i++){
		applications[i] = applications[i+1];
		appIds.push(applications[i].id);
	}
	applications[applications.length-1] = selectedApp;
	appIds.push(id);

	return appIds;
}

function initializeArray(size, val) {
	var arr = new Array(size);
	for(var i=0; i<size; i++){
		arr[i] = val;
	}
	return arr;
}

function allNonBlank(arr) {
	for(var i=0; i<arr.length; i++){
		if(arr[i] === "") return false;
	}
	return true;
}

function allTrueDict(dict) {
	var key;
	for(key in dict){
		if(dict[key] === false) return false;
	}
	return true;
}

function removeElement(list, elem) {
	if(list.indexOf(elem) >= 0){
		moveElementToEnd(list, elem);
		list.pop();
	}
}

function moveElementToEnd(list, elem) {
	var i;
	var pos = list.indexOf(elem);
	if(pos < 0) return;
	for(i=pos; i<list.length-1; i++){
		list[i] = list[i+1];
	}
	list[list.length-1] = elem;
}

function getItemPositionSizeType(item) {
	return {type: item.type, id: item.id, left: item.left, top: item.top, width: item.width, height: item.height, aspect: item.aspect};
}

function getAppPositionSize(appInstance) {
	return {id: appInstance.id, application: appInstance.application, left: appInstance.left, top: appInstance.top, width: appInstance.width, height: appInstance.height};
}

/**** Pointer Functions ********************************************************************/

function createSagePointer( address ) {
	// From addClient type == sageUI
	sagePointers[address] = new sagepointer(address+"_pointer");
	remoteInteraction[address] = new interaction();

	broadcast('createSagePointer', sagePointers[address], 'receivesPointerData');
}

function showPointer( address, data ) {
	if( sagePointers[address] === undefined )
		return;
	// From startSagePointer
	console.log("starting pointer: " + address);

	sagePointers[address].start(data.label, data.color);
	broadcast('showSagePointer', sagePointers[address], 'receivesPointerData');
}

function hidePointer( address ) {
	if( sagePointers[address] === undefined )
		return;

	// From stopSagePointer
	sagePointers[address].stop();
	broadcast('hideSagePointer', sagePointers[address], 'receivesPointerData');
}

function pointerMove(uniqueID, data) {
	var pointerX, pointerY, elem;

	sagePointers[uniqueID].left += data.deltaX;
	sagePointers[uniqueID].top += data.deltaY;
	if(sagePointers[uniqueID].left < 0)                 sagePointers[uniqueID].left = 0;
	if(sagePointers[uniqueID].left > config.totalWidth) sagePointers[uniqueID].left = config.totalWidth;
	if(sagePointers[uniqueID].top < 0)                  sagePointers[uniqueID].top = 0;
	if(sagePointers[uniqueID].top > config.totalHeight) sagePointers[uniqueID].top = config.totalHeight;

	broadcast('updateSagePointerPosition', sagePointers[uniqueID], 'receivesPointerData');

	if(remoteInteraction[uniqueID].windowManagementMode()){
		pointerX = sagePointers[uniqueID].left;
		pointerY = sagePointers[uniqueID].top;

		var updatedMoveItem = remoteInteraction[uniqueID].moveSelectedItem(pointerX, pointerY);
		var updatedResizeItem = remoteInteraction[uniqueID].resizeSelectedItem(pointerX, pointerY);
		if(updatedMoveItem !== null){
			broadcast('setItemPosition', updatedMoveItem, 'receivesWindowModification');
		}
		else if(updatedResizeItem !== null){
			broadcast('setItemPositionAndSize', updatedResizeItem, 'receivesWindowModification');
		}
		else{
			elem = findAppUnderPointer(pointerX, pointerY);
			if(elem !== null){
				var localX = pointerX - elem.left;
				var localY = pointerY - (elem.top+config.titleBarHeight);
				var cornerSize = Math.min(elem.width, elem.height) / 5;
				// bottom right corner - select for drag resize
				if(localX >= elem.width-cornerSize && localY >= elem.height-cornerSize){
					if(remoteInteraction[uniqueID].hoverCornerItem !== null){
						broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, 'requiresFullApps');
					}
					remoteInteraction[uniqueID].setHoverCornerItem(elem);
					broadcast('hoverOverItemCorner', {elemId: elem.id, flag: true}, 'requiresFullApps');
				}
				else if(remoteInteraction[uniqueID].hoverCornerItem !== null){
					broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, 'requiresFullApps');
					remoteInteraction[uniqueID].setHoverCornerItem(null);
				}
			}
			else if(remoteInteraction[uniqueID].hoverCornerItem !== null){
				broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, 'requiresFullApps');
				remoteInteraction[uniqueID].setHoverCornerItem(null);
			}
		}
	}
	else if(remoteInteraction[uniqueID].appInteractionMode()){
		pointerX = sagePointers[uniqueID].left;
		pointerY = sagePointers[uniqueID].top;

		elem = findAppUnderPointer(pointerX, pointerY);

		if(elem !== null){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			broadcast('eventInItem', {eventType: "pointerMove", elemId: elem.id, user_id: sagePointers[uniqueID].id, user_label: sagePointers[uniqueID].label, user_color: sagePointers[uniqueID].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {}, date: now }, 'receivesInputEvents');
		}
	}
}

function pointerPress( address, pointerX, pointerY ) {
	if( sagePointers[address] === undefined ) return;

	var elem = findAppUnderPointer(pointerX, pointerY);
		if(elem !== null){
			if( remoteInteraction[address].windowManagementMode() ){
				var localX = pointerX - elem.left;
				var localY = pointerY - (elem.top+config.titleBarHeight);
				var cornerSize = Math.min(elem.width, elem.height) / 5;
				// bottom right corner - select for drag resize
				if(localX >= elem.width-cornerSize && localY >= elem.height-cornerSize){
					remoteInteraction[address].selectResizeItem(elem, pointerX, pointerY);
				}
				// otherwise - select for move
				else{
					remoteInteraction[address].selectMoveItem(elem, pointerX, pointerY); //will only go through if window management mode
				}
			}
			else if ( remoteInteraction[address].appInteractionMode() ) {
				var itemRelX = pointerX - elem.left;
				var itemRelY = pointerY - elem.top - config.titleBarHeight;
				var now = new Date();
				broadcast('eventInItem', {eventType: "pointerPress", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, 'receivesInputEvents');
			}

			var newOrder = moveAppToFront(elem.id);
			broadcast('updateItemOrder', {idList: newOrder}, 'receivesWindowModification');
		}
}

// Copied from pointerPress. Eventually a touch gesture will use this to toggle modes
function togglePointerMode(address) {
	if( sagePointers[address] === undefined )
		return;

	remoteInteraction[address].toggleModes();
	broadcast('changeSagePointerMode', {id: sagePointers[address].id, mode: remoteInteraction[address].interactionMode } , 'receivesPointerData' );
}

function pointerRelease(address, pointerX, pointerY) {
	if( sagePointers[address] === undefined )
		return;

	// From pointerRelease
	if( remoteInteraction[address].windowManagementMode() ){
		if(remoteInteraction[address].selectedResizeItem !== null){
			broadcast('finishedResize', {id: remoteInteraction[address].selectedResizeItem.id, elemWidth: remoteInteraction[address].selectedResizeItem.width, elemHeight: remoteInteraction[address].selectedResizeItem.height, date: new Date()}, 'receivesWindowModification');
			remoteInteraction[address].releaseItem(true);
		}
		if(remoteInteraction[address].selectedMoveItem !== null){
			var remoteIdx = -1;
			for(var i=0; i<remoteSites.length; i++){
				if(sagePointers[address].left >= remoteSites[i].pos && sagePointers[address].left <= remoteSites[i].pos+remoteSites[i].width &&
					sagePointers[address].top >= 2 && sagePointers[address].top <= remoteSites[i].height) {
					remoteIdx = i;
					break;
				}
			}
			if(remoteIdx < 0){
				remoteInteraction[address].releaseItem(true);
			}
			else{
				var app = findAppById(remoteInteraction[address].selectedMoveItem.id);
				remoteSites[remoteIdx].wsio.emit('addNewElementFromRemoteServer', app);
				var updatedItem = remoteInteraction[address].releaseItem(false);
				if(updatedItem !== null) broadcast('setItemPosition', updatedItem, 'receivesWindowModification');
			}
		}
	}
	else if ( remoteInteraction[address].appInteractionMode() ) {
		var elem = findAppUnderPointer(pointerX, pointerY);

		if( elem !== null ){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			broadcast('eventInItem', {eventType: "pointerRelease", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {button: "left"}, date: now }, 'receivesInputEvents');
		}
	}
}

function pointerPosition( address, data ) {
	if( sagePointers[address] === undefined )
		return;

	sagePointers[address].left = data.pointerX;
	sagePointers[address].top = data.pointerY;
	if(sagePointers[address].left < 0) sagePointers[address].left = 0;
	if(sagePointers[address].left > config.totalWidth) sagePointers[address].left = config.totalWidth;
	if(sagePointers[address].top < 0) sagePointers[address].top = 0;
	if(sagePointers[address].top > config.totalHeight) sagePointers[address].top = config.totalHeight;

	broadcast('updateSagePointerPosition', sagePointers[address], 'receivesPointerData');

	var updatedItem = remoteInteraction[address].moveSelectedItem(sagePointers[address].left, sagePointers[address].top);
	if(updatedItem !== null) broadcast('setItemPosition', updatedItem, 'receivesWindowModification');
}

function pointerScrollStart( address, pointerX, pointerY ) {
	if( sagePointers[address] === undefined )
		return;

	var elem = findAppUnderPointer(pointerX, pointerY);

	if(elem !== null){
		remoteInteraction[address].selectScrollItem(elem, pointerX, pointerY);
		var newOrder = moveAppToFront(elem.id);
		broadcast('updateItemOrder', newOrder, 'receivesWindowModification');
	}
}


function pointerScroll( address, data ) {
	if( sagePointers[address] === undefined )
		return;
	
	if( remoteInteraction[address].windowManagementMode() ){
		var updatedItem = remoteInteraction[address].scrollSelectedItem(data.scale);
		if(updatedItem !== null){
			broadcast('setItemPositionAndSize', updatedItem, 'receivesWindowModification');

			if(updatedItem.elemId in remoteInteraction[address].selectTimeId){
				clearTimeout(remoteInteraction[address].selectTimeId[updatedItem.elemId]);
			}

			remoteInteraction[address].selectTimeId[updatedItem.elemId] = setTimeout(function() {
				broadcast('finishedResize', {id: updatedItem.elemId, elemWidth: updatedItem.elemWidth, elemHeight: updatedItem.elemHeight, date: new Date()}, 'receivesWindowModification');
				remoteInteraction[address].selectedScrollItem = null;
			}, 500);
		}
	}
	else if ( remoteInteraction[address].appInteractionMode() ) {
		var pointerX = sagePointers[address].left;
		var pointerY = sagePointers[address].top;
		var elem = findAppUnderPointer(pointerX, pointerY);

		if( elem !== null ){
			var itemRelX = pointerX - elem.left;
			var itemRelY = pointerY - elem.top - config.titleBarHeight;
			var now = new Date();
			
			var delta = data.scale >= 1.0 ? data.scale : 1.0/data.scale;
			delta = (delta-1.0) * 512;
			if(data.scale >= 1.0) delta = -1 * delta;
			
			broadcast('eventInItem', {eventType: "pointerScroll", elemId: elem.id, user_id: sagePointers[address].id, user_label: sagePointers[address].label, user_color: sagePointers[address].color, itemRelativeX: itemRelX, itemRelativeY: itemRelY, data: {wheelDelta: delta}, date: now }, 'receivesInputEvents');
		}
	}
}

function deleteApplication( elem ) {
	broadcast('deleteElement', {elemId: elem.id}, 'requiresFullApps');
	broadcast('deleteElement', {elemId: elem.id}, 'requiresAppPositionSizeTypeOnly');
	if(elem.application === "media_stream"){
		var broadcastWS = null;
		var mediaStreamData = elem.id.split("|");
		var broadcastAddress = mediaStreamData[0];
		var broadcastID = parseInt(mediaStreamData[1]);
		for(var i=0; i<clients.length; i++){
			var clientAddress = clients[i].remoteAddress.address + ":" + clients[i].remoteAddress.port;
			if(clientAddress == broadcastAddress) broadcastWS = clients[i];
		}

		if(broadcastWS !== null) broadcastWS.emit('stopMediaCapture', {streamId: broadcastID});
	}
	removeElement(applications, elem);
}
