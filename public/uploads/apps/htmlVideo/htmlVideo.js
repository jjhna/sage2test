// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

"use strict";

/**
 * @module client
 * @submodule image_viewer
 */

/**
 * Movie player application, inherits from SAGE2_BlockStreamingApp
 *
 * @class movie_player
 */
var htmlVideo = SAGE2_App.extend({

	/**
	* Init method, creates an 'div' tag in the DOM
	*
	* @method init
	* @param data {Object} contains initialization values (id, width, height, ...)
	*/
	init: function(data) {
		this.SAGE2Init("div", data);
		this.element.id = "div" + data.id;
		this.maxFPS = 20;
		
		// App setup
		this.setup(data.customLaunchParams);
	},

	/**
	* setup method for handling not inherited values
	*
	* @method setup
	* @param {Object} data - From init
	*/
	setup: function(data) {
		// Keep a copy of the title string
		this.title = data.title;
		// May uses a different width and height
		if (data.width) {
			this.sendResize(data.width, data.height);
		}
		// Create elements
		this.videoElement = document.createElement("video");
		this.videoElement.style.width = "100%";
		this.videoElement.style.height = "100%";
		this.sourceElement = document.createElement("source");
		this.sourceElement.src = data.url;
		// Add Them
		this.videoElement.appendChild(this.sourceElement);
		this.element.appendChild(this.videoElement);
	},

	/**
	* This doesn't happen until the video is registered as loaded.
	*
	* @method initWidgets
	*/
	initWidgets: function() {
		var _this = this;
		var extension = this.sourceElement.src;
		console.log("erase me, creating widget");
		// Cut out anything in front of '/' '\' and '.'
		while(extension.includes("/")) {
			extension = extension.substring(extension.indexOf("/") + 1);
		}
		while(extension.includes("\\")) {
			extension = extension.substring(extension.indexOf("\\") + 1);
		}
		this.title = extension;

		this.loopBtn = this.controls.addButton({
			identifier: "Loop",
			type: "loop",
			position: 11
		});

		this.muteBtn = this.controls.addButton({
			identifier: "Mute",
			type: "mute",
			position: 9
		});

		this.playPauseBtn = this.controls.addButton({
			identifier: "PlayPause",
			type: "play-pause",
			position: 5
		});
		this.stopBtn = this.controls.addButton({
			identifier: "Stop",
			type: "rewind",
			position: 3
		});

		this.controls.addSlider({
			identifier: "Seek",
			minimum: 0,
			maximum: this.videoElement.duration * 1000,
			increments: 1,
			property: "this.state.milliTime",
			labelFormatFunction: (value, end) => {
				var duration = parseInt(this.state.milliTime, 10);
				return formatHHMMSS(duration);
			}
		});
		// this.controls.addSlider({
		// 	identifier: "Seek",
		// 	minimum: 0,
		// 	maximum: this.state.numframes - 1,
		// 	increments: 1,
		// 	property: "this.state.frame",
		// 	labelFormatFunction: function(value, end) {
		// 		var duration = parseInt(1000 * (value / _this.state.framerate), 10);
		// 		return formatHHMMSS(duration);
		// 	}
		// });

		this.controls.finishedAddingControls();

		setTimeout(function() {
			_this.muteBtn.state      = _this.state.muted  ? 0 : 1;
			_this.loopBtn.state      = _this.state.looped ? 0 : 1;
			_this.playPauseBtn.state = _this.state.paused ? 0 : 1;
		}, 500);
	},

	/**
	* Load the app from a previous state and builds the widgets
	*
	* @method load
	* @param {Date} date - time from the server
	*/
	load: function(date) {
		console.log("State change detected");
		console.dir(this.state);
	},
	
	draw: function(date) {
		// Check if video loaded
		if (this.videoElement.readyState === 4
			&& !this.hasLoadedWidgets) {
			this.hasLoadedWidgets = true;
			this.initWidgets();
		}
		// Update time if playing
		if (!this.state.paused) {
			this.state.time = this.videoElement.currentTime;
			this.state.milliTime = this.state.time * 1000;
		}
	},

	/**
	* Overloading the postDraw call to update the title
	*
	* @method postDraw
	* @param {Date} date - current time from the server
	*/
	postDraw: function(date) {
		this.prevDate = date;
		this.frame++;

		// new code: put current time in title bar
		var duration = parseInt(1000 * this.state.time, 10);
		var current  = formatHHMMSS(duration);
		var end = formatHHMMSS(1000 * this.videoElement.duration);

		this.updateTitle(this.title + " - " + current + " / " + end);
	},


	/**
	* Toggle between play and pause. Should only be triggered from context menu to ensure sync
	* as part of the refresh check for SAGE2UserModification === true.
	*
	* @method togglePlayPause
	*
	*/
	togglePlayPause: function(date) {
		if (this.state.paused === true) {
			this.videoElement.play();
		} else {
			this.videoElement.pause();
		}
		this.state.paused = !this.state.paused;
		this.refresh(date);
		this.playPauseBtn.state = (this.state.paused) ? 0 : 1;
		this.getFullContextMenuAndUpdate();
	},

	/**
	* Toggle between mute and unmute
	*
	* @method toggleMute
	*
	*/
	toggleMute: function(date) {
		if (this.state.muted === true) {
			this.videoElement.muted = false;
		} else {
			this.videoElement.muted = true;
		}
		this.state.muted = !this.state.muted;
		this.muteBtn.state = (this.state.muted) ? 0 : 1;
		this.getFullContextMenuAndUpdate();
	},

	/**
	* Toggle between looping and not looping
	*
	* @method toggleLoop
	*
	*/
	toggleLoop: function(date) {
		if (this.state.looped === true) {
			this.videoElement.removeAttribute("loop");
		} else {
			this.videoElement.setAttribute("loop", "");
		}
		this.state.looped = !this.state.looped;
		this.loopBtn.state = (this.state.looped) ? 0 : 1;
		this.getFullContextMenuAndUpdate();
	},

	stopVideo: function() {
		this.state.paused = true;
		// This pauses and sets html player to beginning
		this.videoElement.pause();
		this.videoElement.currentTime = 0;
		// must change play-pause button (should show 'play' icon)
		this.playPauseBtn.state = 0;
		this.getFullContextMenuAndUpdate();
	},


	/**
	* To enable right click context menu support this function needs to be present with this format.
	*
	* Must return an array of entries. An entry is an object with three properties:
	*	description: what is to be displayed to the viewer.
	*	callback: String containing the name of the function to activate in the app. It must exist.
	*	parameters: an object with specified datafields to be given to the function.
	*		The following attributes will be automatically added by server.
	*			serverDate, on the return back, server will fill this with time object.
	*			clientId, unique identifier (ip and port) for the client that selected entry.
	*			clientName, the name input for their pointer. Note: users are not required to do so.
	*			clientInput, if entry is marked as input, the value will be in this property. See pdf_viewer.js for example.
	*		Further parameters can be added. See pdf_view.js for example.
	*/
	getContextEntries: function() {
		var entries = [];
		var entry;

		if (this.state.paused) {
			entry = {};
			entry.description = "Play";
			entry.accelerator = "P";
			entry.callback = "contextTogglePlayPause";
			entry.parameters = {};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Pause";
			entry.accelerator = "P";
			entry.callback = "contextTogglePlayPause";
			entry.parameters = {};
			entries.push(entry);
		}

		entry = {};
		entry.description = "Stop";
		entry.accelerator = "S";
		entry.callback = "stopVideo";
		entry.parameters = {};
		entries.push(entry);

		entry = {};
		entry.description = "separator";
		entries.push(entry);

		if (this.state.muted) {
			entry = {};
			entry.description = "Unmute";
			entry.callback = "contextToggleMute";
			entry.accelerator = "M";
			entry.parameters = {};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Mute";
			entry.accelerator = "M";
			entry.callback = "contextToggleMute";
			entry.parameters = {};
			entries.push(entry);
		}


		if (this.state.looped) {
			entry = {};
			entry.description = "Stop looping";
			entry.accelerator = "L";
			entry.callback = "toggleLoop";
			entry.parameters = {};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Loop video";
			entry.accelerator = "L";
			entry.callback = "toggleLoop";
			entry.parameters = {};
			entries.push(entry);
		}

		entry = {};
		entry.description = "separator";
		entries.push(entry);

		// Special callback: dowload the file
		entries.push({
			description: "Download video",
			callback: "SAGE2_download",
			parameters: {
				url: this.state.video_url
			}
		});
		entries.push({
			description: "Copy URL",
			callback: "SAGE2_copyURL",
			parameters: {
				url: this.state.video_url
			}
		});

		return entries;
	},

	/**
	* Calls togglePlayPause passing the given time.
	*
	* @method contextTogglePlayPause
	* @param {Object} responseObject - contains response from entry selection
	*/
	contextTogglePlayPause: function(responseObject) {
		this.togglePlayPause(new Date(responseObject.serverDate));
	},

	/**
	* Calls togglePlayPause passing the given time.
	*
	* @method contextToggleMute
	* @param {Object} responseObject - contains response from entry selection
	*/
	contextToggleMute: function(responseObject) {
		this.toggleMute(new Date(responseObject.serverDate));
	},

	/**
	* Assumes that the update value is an object with properties:
	*		command
	*		timestamp
	*		frame
	*		framerate
	* @method videoSyncCommandHandler
	* @param {Object} valueUpdate - contains last sent command
	*/
	videoSyncCommandHandler: function(valueUpdate) {
		var playStatusToSend = false;
		var timestampToSend = valueUpdate.timestamp;
		var shouldSendTimeUpdate = false;

		if (valueUpdate.command == "play") {
			playStatusToSend = true;
			this.playPauseBtn.state = 1; // show stop
			shouldSendTimeUpdate = true;
		} else if (valueUpdate.command == "pause") {
			playStatusToSend = false;
			this.playPauseBtn.state = 0; // show play
			shouldSendTimeUpdate = true;
		} else if (valueUpdate.command == "stop") {
			playStatusToSend = false;
			timestampToSend = 0;
			this.playPauseBtn.state = 0; // show play
			shouldSendTimeUpdate = true;
		} else if (valueUpdate.command == "seek") {
			this.state.playAfterSeek = valueUpdate.play;
			playStatusToSend = valueUpdate.play;
			this.playPauseBtn.state = playStatusToSend ? 1 : 0;
			shouldSendTimeUpdate = true;
		}
	},

	/**
	* Handles event processing, arrow keys to navigate, and r to redraw
	*
	* @method event
	* @param eventType {String} the type of event
	* @param position {Object} contains the x and y positions of the event
	* @param user_id {Object} data about the user who triggered the event
	* @param data {Object} object containing extra data about the event,
	* @param date {Date} current time from the server
	*/
	event: function(eventType, position, user, data, date) {
		if (eventType === "keyboard") {
			if (data.character === " ") {
				this.togglePlayPause(date);
			} else if (data.character === "l") {
				this.toggleLoop(date);
			} else if (data.character === "m") {
				// m mute
				this.toggleMute(date);
			} else if (data.character === "1" || data.character === "s") {
				// 1 start of video
				this.stopVideo();
			}
		} else if (eventType === "specialKey") {
			if (data.code === 80 && data.state === "up") { // P key
				this.togglePlayPause(date);
			}
		} else if (eventType === "widgetEvent") {
			switch (data.identifier) {
				case "Loop":
					this.toggleLoop(date);
					break;
				case "Mute":
					this.toggleMute(date);
					break;
				case "PlayPause":
					this.togglePlayPause(date);
					break;
				case "Stop":
					this.stopVideo();
					break;
				case "Seek":
					switch (data.action) {
						case "sliderLock":
							if (this.state.paused === false) {
								this.togglePlayPause(date);
							}
							break;
						case "sliderUpdate":
							this.state.time = this.state.milliTime;
							break;
						case "sliderRelease":
							if (isMaster) {
								console.log("erase me, slider release time:" + this.state.milliTime);
							}
							this.state.time = this.state.milliTime / 1000;
							this.videoElement.currentTime = this.state.time;
							break;
					}
					break;
				default:
					console.log("No handler for:", data.identifier);
			}
			this.refresh(date);
		}
	}
});
