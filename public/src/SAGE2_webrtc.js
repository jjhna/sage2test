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

var SAGE2_webrtc_ui_tracker = {
	debug: true,

	enabled: true,
	stream: null,
	allPeers: [],
	streamSuccess: function(stream) {
		SAGE2_webrtc_ui_tracker.debugprint("Success Got stream");
		SAGE2_webrtc_ui_tracker.stream = stream;
	},
	streamFail: function() {
		SAGE2_webrtc_ui_tracker.debugprint("Failed to get stream");
	},

	makePeer: function(dataFromDisplay) {
		this.allPeers.push(
			new SAGE2WebrtcPeerConnection(
				dataFromDisplay.appId, // Which app this is for
				interactor.uniqueID, // UI id for identifying streamerid
				dataFromDisplay.sourceId, // Goto specific display
				SAGE2_webrtc_ui_tracker.stream, // UI will send stream
				null) // No stream element on UI
		);
	},


	debugprint: function(message) {
		if (SAGE2_webrtc_ui_tracker.debug)
			console.log("SAGE2_webrtc> DEBUG> " + message);
	},
};







// While written in the public/src folder, this can be accessed by media_stream (screen share app)
class SAGE2WebrtcPeerConnection {
	constructor(appId, streamerId, displayId, stream = null, streamElement = null) {
		// Enable debug printing
		this.debug = true;

		// Setup properties of the connection
		this.setupProperties(appId, streamerId, displayId);

		// Create handlers. Stream means UI, no stream is display
		if (stream) {
			this.setupUIHandlers(stream);
		} else {
			this.setupDisplayHandlers(streamElement);
		}
	}

	debugprint(message) {
		if (this.debug)
			console.log("SAGE2_webrtc> DEBUG> " + message);
	}

	setupProperties(appId, streamerId, displayId) {
		// For identification of clients
		this.appId = appId // Actually id of sage2 app
		this.streamerId = streamerId; // unique clientId
		this.displayId = displayId; // unique displayId, identified by offer because SAGE2 doesn't distinguish displays beyond which viewport they access
	
		// Webrtc
		this.offerOptions = {
			offerToReceiveVideo: 1,
			offerToReceiveAudio: 1
		};
		this.configForPeer = {
			"iceServers": [
				// These stun servers from simplepeer.js
				// { "urls": ["stun:stun.l.google.com:19302"] },
				{urls:"stun:global.stun.twilio.com:3478?transport=udp"},
			]
		}

		this.peer = new RTCPeerConnection(this.configForPeer); // a webkitRTCPeerConnection

		// Standby data
		this.iceCandidatesReadyToSend = [];
		this.completedOfferAnswerResponse = false;
	}

	setupUIHandlers(stream) {
		this.debugprint("Setting up handlers for UI");
		// This is a UI sending a stream
		this.myId = this.streamerId;
		// On ice candidates
		this.peer.onicecandidate = (event) => {
			if (event.icecandidate) {
				this.debugprint("Got ice candidate");
				// Only if completed, then send
				if (this.completedOfferAnswerResponse) {
					this.sendMessage(JSON.stringify({ "ice": event.candidate }));
				} else { // Otherwise store until ready to send
					this.iceCandidatesReadyToSend.push({ "ice": event.candidate });
				}
			}
		};
		
		// Collect stream (screenshare) track and add it to the connection
		stream.getTracks().forEach((track) => {
			this.peer.addTrack(track, stream); // Add track from stream
		});

		// Create offer, after creating, send to display
		this.peer.createOffer((offer) => {
			this.debugprint("Offer created");
			this.peer.setLocalDescription(offer)
			.then(() => {
				this.sendMessage(JSON.stringify({ "sdp": this.peer.localDescription }));
			})
		}, (error) => {
			console.log("SAGE2_webrtc> Error while creating offer");
		}, this.offerOptions);
	}

	setupDisplayHandlers(streamElement) {
		this.debugprint("Setting up handlers for Display");
		// This is a display
		this.myId = this.displayId;
		this.streamElement = streamElement;
		
		// Handler for ice candidates
		this.peer.onicecandidate = (event) => {
			if (event.candidate) {
				this.debugprint("Got ice candidate");
				// Only send if completed connection
				if (this.completedOfferAnswerResponse) {
					this.sendMessage(JSON.stringify({ "ice": event.candidate }));
				} else { // Otherwise store until ready to send
					this.iceCandidatesReadyToSend.push({ "ice": event.candidate });
				}
			}
		}

		// Handler for tracks
		this.peer.ontrack = (event) => {
			if (event.streams) {
				this.debugprint("Got stream");
				let track = event.streams[0];
				if (track.active) {
					this.streamElement.srcObject = track;
					console.log("Track:", track)
				} else {
					console.log("SAGE2_webrtc> discarding inactive track received");
				}
			}

		}
	}

	// Sends to specific display, this.displayId
	sendMessage(message) {
		// Can't send without myId
		if (!this.myId) {
			this.debugprint(" ERROR sendMessage activated without proper destination the following are myId, streamerId, displayId");
			this.debugprint(this.myId);
			this.debugprint(this.streamerId);
			this.debugprint(this.displayId);
		}
		// If this is UI sending to Display
		if (this.displayId && (this.displayId !== this.myId)) {
			this.debugprint("Sending to display:" + message);
			// create data to send, then emit
			var data = {};
			data.app = this.appId;
			data.func = "webrtc_SignalMessageFromUi";
			data.parameters = {};
			data.parameters.destinationId = this.displayId;
			data.parameters.sourceId = this.myId;
			data.parameters.message = message;
			wsio.emit('callFunctionOnApp', data);
		} else if (this.streamerId && (this.streamerId !== this.myId)) {
			// Elese it is a Display -> UI
			this.debugprint("Sending to UI:" + message);
			// Else must be a display sending to UI
			var dataForClient = {};
			dataForClient.destinationId = this.streamerId;
			dataForClient.sourceId  = this.myId;
			dataForClient.message = message;
			wsio.emit("sendDataToClient", {
				clientDest: this.streamerId,
				func: "webrtc_SignalMessageFromDisplay",
				appId: this.appId,
				destinationId: this.streamerId,
				sourceId: this.myId,
				message: message,
			});
		} else {
			this.debugprint(" ERROR sendMessage activated without proper destination the following are myId, streamerId, displayId");
			this.debugprint(this.myId);
			this.debugprint(this.streamerId);
			this.debugprint(this.displayId);
		}
	}

	// This assumes the app properly figures out where it should go
	readMessage(message) {
		this.debugprint("Got message " + message);
		let mConverted = JSON.parse(message);
		// Check if it was an ice message, if it was add it
		if (mConverted.ice !== undefined) {
			this.peer.addIceCandidate(mConverted.ice)
			.catch(() => { console.log("ice candidate error")});
		} else if (mConverted.sdp.type === "answer") {
			// Answers are seen by the UI (streamer)
			this.peer.setRemoteDescription(new RTCSessionDescription(mConverted.sdp))
			.then(() => { this.sendStoredIceCandidates(); })
			.catch(() => { console.log("answer handling error")});
		} else if (mConverted.sdp.type === "offer") {
			this.debugprint("got offer, going to make answer"); 
			// Offers seen by displays
			this.peer.setRemoteDescription(new RTCSessionDescription(mConverted.sdp))
			.then(()=> { return this.peer.createAnswer();})
			.then((answer) => {this.peer.setLocalDescription(answer); this.debugprint("Set local description, btw answer was:"); })
			.then(() => {
				this.debugprint("local description:", this.peer.localDescription); 
				this.sendMessage(JSON.stringify({"sdp": this.peer.localDescription}));
				this.debugprint("sent answer to UI"); 
				this.sendStoredIceCandidates();
				this.debugprint("sent stored ice candidates"); 
			})
			.catch(() => { console.log("offer handling error")});
		} else {
			this.debugprint(" ERROR unknown message (not ice, answer or offer): " + message);
		}
	}

	// Sends the stored up ice candidates, sending too early will cause silent errors within webrtc
	sendStoredIceCandidates() {
		this.completedOfferAnswerResponse = true;
		for (let i = 0; i < this.iceCandidatesReadyToSend.length; i++) {
			this.sendMessage(this.iceCandidatesReadyToSend[i]);
		}
		this.iceCandidatesReadyToSend = []; // Clear it out
	}
}


