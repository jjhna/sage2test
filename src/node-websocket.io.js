// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/**
 @module WebSocket
 */


var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

function websocketIOServer(data) {
	if(data.server !== undefined)    this.wss = new WebSocketServer({server: data.server});
	else if(data.port !== undefined) this.wss = new WebSocketServer({port: data.port});
}

websocketIOServer.prototype.onconnection = function(callback) {
	this.wss.on('connection', function(ws) {
		ws.binaryType = "arraybuffer";
		
		var wsio = new websocketIO(ws);
		callback(wsio);
	});
};


function websocketIO(ws, strictSSL, openCallback) {
	if(typeof ws === "string") this.ws = new WebSocket(ws, null, {rejectUnauthorized: strictSSL});
	else this.ws = ws;
	
	var _this = this;
	this.messages = {};
	if(this.ws.readyState == 1) this.remoteAddress = {address: this.ws._socket.remoteAddress, port: this.ws._socket.remotePort};
	
	this.ws.on('error', function(err) {
		if(err.errno == "ECONNREFUSED") /*do nothing*/;
	});
	this.ws.on('open', function() {
		_this.ws.binaryType = "arraybuffer";
		_this.remoteAddress = {address: _this.ws._socket.remoteAddress, port: _this.ws._socket.remotePort};
		if(openCallback !== null) openCallback();
	});
	this.ws.on('message', function(message) {
		if(typeof message === "string"){
			var msg = JSON.parse(message);
			if(msg.func in _this.messages){
				_this.messages[msg.func](_this, msg.data);
			}
		}
		else{
			console.log("Error: message is not a binary string");
		}
	});
}

websocketIO.prototype.onclose = function(callback) {
	var _this = this;
	this.ws.on('close', function(){
		callback(_this);
	});
};

websocketIO.prototype.on = function(name, callback) {
	this.messages[name] = callback;
};

websocketIO.prototype.emit = function(name, data) {
	if(name === null || name === ""){
		console.log("Error: no message name specified");
		return;
	}
	
	var message = {func: name, data: data};
	
	// double error handling
	try {
		var msgString = JSON.stringify(message);
		this.ws.send(msgString, function(err){
			if(err){
				console.log("---ERROR (ws.send)---");
				console.log(err);
				console.log("---VALUES---");
				console.log(name);
				console.log(typeof message);
			}
			// else success
		});
	}
	catch(e) {
		console.log("---ERROR (try-catch)---");
		console.log(e);
		console.log("---VALUES---");
		console.log(name);
		console.log(typeof message);
	}
};


module.exports = websocketIO;
module.exports.Server = websocketIOServer;


/*var WebSocketServer = require('ws').Server;

function websocketIOServer(port) {
	this.wss = new WebSocketServer({port: port});
}

websocketIOServer.prototype.onconnection = function(callback) {
	this.wss.on('connection', function(ws) {
		ws.binaryType = "arraybuffer";
		
		var wsio = new websocketIO(ws);
		callback(wsio);
	});
};

function websocketIO(ws) {
	this.ws = ws;
	this.messages = {};
	this.remoteAddress = {address: ws._socket.remoteAddress, port: ws._socket.remotePort};
	
	var _this = this;
	this.ws.on('message', function(message) {
		if(typeof message === "string"){
			var msg = JSON.parse(message);
			if(msg.func in _this.messages){
				_this.messages[msg.func](msg.data);
			}
		}
		else{
			console.log("Error: message is not a binary string");
		}
	});
}

websocketIO.prototype.onclose = function(callback) {
	this.ws.on('close', function(){
		callback();
	});
};

websocketIO.prototype.on = function(name, callback) {
	this.messages[name] = callback;
};

websocketIO.prototype.emit = function(name, data) {
	if(name == null || name == ""){
		console.log("Error: no message name specified");
		return;
	}
	
	var message = {callbackName: name, data: data};
	
	// double error handling
	try {
		var msgString = JSON.stringify(message);
		this.ws.send(msgString, function(err){
			if(err){
				console.log("---ERROR (ws.send)---");
				console.log(err);
				console.log("---VALUES---");
				console.log(name);
				console.log(typeof message);
			}
			// else success
		});
	}
	catch(e) {
		console.log("---ERROR (try-catch)---");
		console.log(e);
		console.log("---VALUES---");
		console.log(name);
		console.log(typeof message);
	}
};


module.exports = websocketIOServer;
*/
