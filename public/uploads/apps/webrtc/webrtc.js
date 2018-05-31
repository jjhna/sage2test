// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2016

//
// SAGE2 application: webrtc
// by: Luc Renambot <renambot@gmail.com>
//
// Copyright (c) 2016
//

"use strict";

/* global SimplePeer */


var webrtc = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("video", data);
		// Set the background to black
		this.element.style.backgroundColor = 'black';

		// move and resize callbacks
		this.resizeEvents = "continuous";
		this.moveEvents   = "continuous";

		// SAGE2 Application Settings
		//
		// Control the frame rate for an animation application
		this.maxFPS = 0.5;

		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		// Ok, let's build with WebRTC communication channels
		var _this = this;
		this.ready = false;
		if (isMaster) {
			// if we are the master, we are the initiator of the group
			peer = new SimplePeer({initiator: false,
				trickle: false});
			console.log('Peer> master', peer);
		} else {
			peer = new SimplePeer({initiator: false,
				trickle: false});
			console.log('Peer> slave', peer);
		}
		peer.on('error', function (err) {
			console.log('Peer> error', err);
		});
		// Handler for the signaling
		peer.on('signal', function (wdata) {
			console.log('Peer> got signal', wdata.id);
			// We need to send our info to all the other clients
			_this.broadcast("WebRTCSignal", {id: clientID, webrtc: wdata});
		});
		// Connection handler
		peer.on('connect', function () {
			console.log('Peer> CONNECT');
			if (isMaster) {
				// Send some data for kicks
				// console.log('Peer> master sending data');
				//this.send('whatever1 ' + Math.random());
			}
		});
		peer.on('stream', function (stream) {
			console.log('Peer> Got Stream');
			// got video stream
			// _this.element.src = window.URL.createObjectURL(stream);
			_this.element.srcObject = stream;
			_this.element.play();
		});
		// Data handle (i.e. the other side of send)
		peer.on('data', function (wdata) {
			// console.log('Peer> data: ' + wdata);
			if (!isMaster) {
				// send ACK
			//	this.send('roger');
			}
		});
	},

	WebRTCSignal: function(data) {
		console.log('WebRTCSignal app', data.id, data);
		// if it's not our own message
		if (data.id !== clientID) {
			// Got the data to connect to the peer group
			peer.signal(data.webrtc);
		}
	},

	load: function(date) {
		this.refresh(date);
	},

	draw: function(date) {
		if (isMaster) {
			// Just send some stuff
			if (peer.connected) {
				// peer.send('whatever from' + clientID + ': ' + Math.random());
			}
		}
	},

	resize: function(date) {
		this.refresh(date);
	},
	move: function(date) {
		this.refresh(date);
	},

	quit: function() {
		// Clean up the channels
		peer.destroy();
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// pass
		} else if (eventType === "pointerMove" && this.dragging) {
			// pass
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// pass
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// pass
		} else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.refresh(date);
			}
		}
	}

});
