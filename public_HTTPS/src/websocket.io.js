// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

function websocketIO(protocol, host, port) {
	this.ws = null;
	this.protocol = protocol == "https:" ? "wss" : "ws";
	this.host = host;
	this.port = port;
	this.messages = {};
	
	this.open = function(callback) {
		var _this = this;
		
		//console.log(this.protocol + "://" + this.host + ":" + this.port);
		console.log(this.protocol + "://" + window.location.host + "/" + window.location.pathname.split("/")[1]);
		//this.ws = new WebSocket(this.protocol + "://" + this.host + ":" + this.port);
		this.ws = new WebSocket(this.protocol + "://" + window.location.host + "/" + window.location.pathname.split("/")[1]);

		this.ws.binaryType = "arraybuffer";
		this.ws.onopen = callback;
		
		this.ws.onmessage = function(msg) {
			if(typeof msg.data === "string"){
				var message = JSON.parse(msg.data);
				if(message.func in _this.messages){
					_this.messages[message.func](message.data);
				}
			}
			else{
				console.log("Error: message is not a binary string");
			}
		};
		// triggered by unexpected close event
		this.ws.onclose = function(evt) {
			console.log("wsio closed");
			if('close' in _this.messages)
				_this.messages['close'](evt);
		};
	};
	
	this.on = function(name, callback) {
		this.messages[name] = callback;
	};
	
	this.emit = function(name, data) {
		var message = {func: name, data: data};
		this.ws.send(JSON.stringify(message));
	};

	// deliberate close function
	this.close = function() {
	    this.ws.onclose = function () {}; // disable onclose handler first
    	this.ws.close();
    };

}
