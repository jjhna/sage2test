// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2016

"use strict";

var htmlVideo = SAGE2_App.extend({
	init: function(data) {
		this.SAGE2Init("div", data);
		this.element.id = "div" + data.id;
		this.maxFPS = 20;
		
		// App setup
		this.setup(data.customLaunchParams);
	},

	setup: function(data) {
		// uses a different width and height
		this.sendResize(data.width, data.height);

		this.videoElement = document.createElement("video");
		this.videoElement.style.width = "100%";
		this.videoElement.style.height = "100%";
		this.sourceElement = document.createElement("source");

		var type = this.videoTypeLookup(data.url);
		// if (type) {
		// 	this.sourceElement.src = data.url;
		// 	this.sourceElement.type = type;	
		// } else {
		// 	console.log("Invalid extension on: " + data.url);
		// }
		// According to one post, don't need to specify the type
		this.sourceElement.src = data.url;

		this.videoElement.appendChild(this.sourceElement);
		this.element.appendChild(this.videoElement);
	},

	videoTypeLookup: function(fullUrl) {
		var retval = "video/";
		var extension = fullUrl;
		// Cut out anything in front of '/' '\' and '.'
		while(extension.includes("/")) {
			extension = extension.substring(extension.indexOf("/") + 1);
		}
		while(extension.includes("\\")) {
			extension = extension.substring(extension.indexOf("\\") + 1);
		}
		while(extension.includes(".")) {
			extension = extension.substring(extension.indexOf(".") + 1);
		}
		// With Extension do check:
		if (extension.length < 1) {
			// No length means no extension
			retval = null;
		} else if (extension === "mp4") {
			retval += "mp4";
		} else if (extension === "webm") {
			retval += "webm";
		} else if (extension === "ogg") {
			retval += "ogg";
		} else if (extension === "mov") {
			retval += "ogg";
		}

		return retval;
	},
	
	/**
	* Builds the widgets to control the movie player
	*
	* @method initWidgets
	*/
	initWidgets: function() {
		console.log("Creating widget");
		this.controls.addSlider({
			identifier: "Seek",
			minimum: 0,
			maximum: this.videoElement.duration * 1000,
			increments: 1,
			property: "this.state.time",
			labelFormatFunction: (value, end) => {
				var duration = parseInt(1000 * this.state.time, 10);
				return formatHHMMSS(duration);
			}
		});

		this.controls.finishedAddingControls();
	},



	load: function(date) {
	},

	draw: function(date) {
		// Check if video loaded
		if (this.videoElement.readyState === 4
			&& !this.hasLoadedWidgets) {
			this.hasLoadedWidgets = true;
			this.initWidgets();
		}
		// Update time
		this.state.time = this.videoElement.currentTime;
	},

	resize: function(date) {
		// this.videoElement.width = this.sage2_width;
		// this.videoElement.height = this.sage2_height;
	},

	/**
	* To enable right click context menu support this function needs to be present.
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

		if (!this.state.isPlaying) {
			entry = {};
			entry.description = "Play";
			entry.callback    = "togglePlayPause";
			entry.parameters  = {shouldPlay: true};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Pause";
			entry.callback    = "togglePlayPause";
			entry.parameters  = {shouldPlay: false};
			entries.push(entry);
		}
		entry = {};
		entry.description = "Stop";
		entry.callback    = "stopVideo";
		entry.parameters  = {};
		entries.push(entry);

		entries.push({description: "separator"});

		if (!this.state.isLooping) {
			entry = {};
			entry.description = "Loop";
			entry.callback    = "toggleLoop";
			entry.parameters  = {shouldLoop: true};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Stop Looping";
			entry.callback    = "toggleLoop";
			entry.parameters  = {shouldLoop: false};
			entries.push(entry);
		}

		return entries;
	},

	togglePlayPause: function(responseObject) {
		this.state.isPlaying = responseObject.shouldPlay;

		if (this.state.isPlaying) {
			this.videoElement.play();
		} else {
			this.videoElement.pause();
		}
		this.getFullContextMenuAndUpdate();
	},

	stopVideo: function() {
		this.videoElement.pause();
		this.videoElement.currentTime = 0;
		this.state.isPlaying = false;

		this.getFullContextMenuAndUpdate();
	},
	
	toggleLoop: function(responseObject) {
		this.state.isLooping = responseObject.shouldLoop;

		if (this.state.isLooping) {
			this.videoElement.setAttribute("loop", "");
		} else {
			this.videoElement.removeAttribute("loop");
		}
		this.getFullContextMenuAndUpdate();
	},
	
	event: function(eventType, position, user_id, data, date) {
		if (eventType === "widgetEvent") {
			switch (data.identifier) {
				case "Seek":
					switch (data.action) {
						case "sliderLock":
							break;
						case "sliderUpdate":
							break;
						case "sliderRelease":
							if (isMaster) {
								console.log("release value:" + this.state.time);
							}
							break;
					}
					break;
				default:
					console.log("No handler for:", data.identifier);
			}
			this.refresh(date);
		}
	},

	quit: function() {
		// no additional calls needed.
	}

});
