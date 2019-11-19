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
var movie_player = SAGE2_BlockStreamingApp.extend({

	/**
	* Init method, creates an 'div' tag in the DOM
	*
	* @method init
	* @param data {Object} contains initialization values (id, width, height, ...)
	*/
	init: function(data) {

		this.blockStreamInit(data);

		this.firstLoad();
		this.initWidgets();

		// Keep a copy of the title string
		this.title = data.title;

		// command variables
		this.shouldSendCommands = false;
		this.shouldReceiveCommands = false;

		// which column to display (assumes #rows in wall === 1)
		var slice = parseInt(clientID);

		// Determine if should use HTML player mode
		if (true) { //(this.isOnlyDisplay() && this.isFileTypeSupportedByHtmlPlayer(this.state.video_url)) {
			if (true) { // (!((ui.json_cfg.experimental) && (ui.json_cfg.experimental.disableHTMLPlayer === true))) {
                                var url = this.state.video_url;
                                var stemIndex = url.lastIndexOf("/");
                                var stem = url.substring(0,stemIndex);
                                var file = url.substring(stemIndex+1,url.length);
                                var segurl = stem+'/.segments/'+file+'/_'+slice+'_0.mp4';
                                var testurl = stem+'/.segments/'+file+'/_small.mp4';
                                console.log("client "+clientID+" Movie player trying segment url "+segurl);
                                var request = new XMLHttpRequest();
                                request.open('GET', testurl, true);
                                var self = this;
                                request.onreadystatechange = function(){
                                    if (request.readyState === 4){
                                        console.log(clientID+" videoplayer url "+segurl+" "+request.status);
                                        if (request.status === 404) {
                                            // segments not available
                                            self.makeHtmlPlayer(url,{slice:false});
                                        } else {
                                            // segments available
                                            self.makeHtmlPlayer(segurl,{slice:true});
                                        }
                                    }
                                };
                                request.send();

				this.makeHtmlPlayer(this.state.video_url);
			}
		}
	},

	/**
	* Builds the widgets to control the movie player
	*
	* @method initWidgets
	*/
	initWidgets: function() {
		var _this = this;

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
			maximum: this.state.numframes - 1,
			increments: 1,
			property: "this.state.frame",
			labelFormatFunction: function(value, end) {
				var duration = parseInt(1000 * (value / _this.state.framerate), 10);
				return formatHHMMSS(duration);
			}
		});

		this.controls.finishedAddingControls();

		// Calculate human readable string for the length of the video
		var clipLength = this.state.numframes / this.state.framerate;
		this.lengthString = formatHHMMSS(1000 * clipLength);

		setTimeout(function() {
			_this.muteBtn.state      = _this.state.muted  ? 0 : 1;
			_this.loopBtn.state      = _this.state.looped ? 0 : 1;
			_this.playPauseBtn.state = _this.state.paused ? 0 : 1;
		}, 500);
	},

	/**
	* Set to movie player to a given frame
	*
	* @method setVideoFrame
	* @param frameIdx {Number} change the current frame number
	*/
	setVideoFrame: function(frameIdx) {
		if (!this.isUsingHtmlPlayer) {
			this.state.frame = frameIdx;
			this.SAGE2Sync(false);
		}
	},

	/**
	* Pause the movie if not in loop mode
	*
	* @method videoEnded
	*/
	videoEnded: function() {
		if (this.state.looped === false) {
			this.stopVideo();
		} else if (this.shouldSendCommands) {
			wsio.emit("serverDataSetValue", {
				nameOfValue: "videoSyncCommandVariable",
				value: {
					command: "seek",
					timestamp: 0,
					frame: 0,
					framerate: this.state.framerate,
					play: false
				},
				description: "This variable contains the last send command"
			});
		}
	},

	/**
	* Load the app from a previous state and builds the widgets
	*
	* @method load
	* @param date {Date} time from the server
	*/
	load: function(date) {
		if (this.isUsingHtmlPlayer) {
			this.htmlSetSeekTime();
			this.htmlSetLoopStatus();
			this.htmlSetPlayPauseStatus();
			this.getFullContextMenuAndUpdate();
		}
	},

	/**
	* Overloading the postDraw call to update the title
	*
	* @method postDraw
	* @param date {Date} current time from the server
	*/
	postDraw: function(date) {
		this.prevDate = date;
		this.frame++;
		this.updateTitleInformation();
	},

	/**
	 * Update the tile bar of the video
	 *
	 * @method     updateTitleInformation
	 */
	updateTitleInformation: function() {
		// new code: put current time in title bar
		var duration = parseInt(1000 * (this.state.frame / this.state.framerate), 10);
		var current  = formatHHMMSS(duration);

		// modified to have (frame) [(Sending / Receiving Commands)]
		if (this.isUsingHtmlPlayer) {
			duration = parseInt(1000 * this.videoElement.currentTime);
			current = formatHHMMSS(duration);
			let titleString = this.title + " - " + current + " / " + this.lengthString + " (HTML mode)";
			if (this.state.looped) {
				// Add a unicode character in the title
				titleString += " &#8634;";
			}
			if (this.state.muted) {
				// Add a unicode character in the title
				titleString += " &#128263;";
			}
			this.updateTitle(titleString);
			if (this.lastDrawnHtmlPlayerTime != this.videoElement.currentTime) {
				// prevents getting state stuck when moving the widget slider
				this.lastDrawnHtmlPlayerTime = this.videoElement.currentTime;
				this.state.frame = this.videoElement.currentTime * this.state.framerate;
			}
		} else if (this.shouldSendCommands) {
			this.updateTitle(this.title + " - " + current + "(f:" + this.state.frame + ")(Sending Commands)");
		} else if (this.shouldReceiveCommands) {
			this.updateTitle(this.title + " - " + current + "(f:" + this.state.frame + ")(Receiving Commands)");
		} else {
			// Default mode: show current time and duration
			let titleString = this.title + " - " + current + " / " + this.lengthString;
			this.updateTitle(titleString);
		}
	},


	/**
	* Toggle between play and pause
	*
	* @method togglePlayPause
	*
	*/
	togglePlayPause: function(date) {
		if (this.state.paused === true) {
			if (isMaster) {
				// Trying to sync
				wsio.emit('updateVideoTime', {
					id: this.div.id,
					timestamp: (this.state.frame / this.state.framerate),
					play: true
				});
				// wsio.emit('playVideo', {id: this.div.id});

				// if this is a sender, also send the command to the server holding variable
				if (this.shouldSendCommands) {
					wsio.emit("serverDataSetValue", {
						nameOfValue: "videoSyncCommandVariable",
						value: {
							command: "play",
							timestamp: (this.state.frame / this.state.framerate),
							frame: this.state.frame,
							framerate: this.state.framerate
						},
						description: "This variable contains the last send command"
					});
				}
			}
			this.state.paused = false;
		} else {
			if (isMaster) {
				if (this.isUsingHtmlPlayer) {
					// On the server, the handler for this packet issues a pause action that doesn't consistently send out pauseVideo values.
					wsio.emit('pauseVideo', {id: this.div.id, audioPause: true});
					// When pausing with the html player, time delay may be caused by lag by server to keep with with frame processing.
					// Using this to force the server to the current video player time.
					this.state.frame = parseInt(this.videoElement.currentTime * this.state.framerate);
					wsio.emit('updateVideoTime', {
						id: this.div.id,
						timestamp: this.videoElement.currentTime,
						play: false
					});
					// Ignore the next frame from server
					this.videoElement.frameUpdateIgnoreCount++;
				} else {
					wsio.emit('pauseVideo', {id: this.div.id});
				}

				// if this is a sender, also send the command to the server holding variable
				if (this.shouldSendCommands) {
					wsio.emit("serverDataSetValue", {
						nameOfValue: "videoSyncCommandVariable",
						value: {
							command: "pause",
							timestamp: (this.state.frame / this.state.framerate),
							frame: this.state.frame,
							framerate: this.state.framerate
						},
						description: "This variable contains the last send command"
					});
				}
			}
			this.state.paused = true;
		}
		this.refresh(date);
		this.playPauseBtn.state = (this.state.paused) ? 0 : 1;
		this.getFullContextMenuAndUpdate();
		this.htmlSetPlayPauseStatus();
	},

	/**
	* Toggle between mute and unmute
	*
	* @method toggleMute
	*
	*/
	toggleMute: function(date) {
		if (this.state.muted === true) {
			if (isMaster) {
				wsio.emit('unmuteVideo', {id: this.div.id});
			}
			this.state.muted = false;
		} else {
			if (isMaster) {
				wsio.emit('muteVideo', {id: this.div.id});
			}
			this.state.muted = true;
		}
		this.muteBtn.state = (this.state.muted) ? 0 : 1;
		this.updateTitleInformation();
	},

	/**
	* Toggle between looping and not looping
	*
	* @method toggleLoop
	*
	*/
	toggleLoop: function(date) {
		if (this.state.looped === true) {
			if (isMaster) {
				wsio.emit('loopVideo', {id: this.div.id, loop: false});
			}
			this.state.looped = false;
		} else {
			if (isMaster) {
				wsio.emit('loopVideo', {id: this.div.id, loop: true});
			}
			this.state.looped = true;
		}
		this.loopBtn.state = (this.state.looped) ? 0 : 1;
		this.getFullContextMenuAndUpdate();
		this.htmlSetLoopStatus();
		this.updateTitleInformation();
	},

	stopVideo: function() {
		this.state.paused = true;
		this.state.frame = 0;
		if (isMaster) {
			// wsio.emit('stopVideo', {id: this.div.id});

			// On the server, the handler for this packet issues a pause action that doesn't consistently send out pauseVideo values.
			wsio.emit('pauseVideo', {id: this.div.id, audioPause: true});
			// When pausing with the html player, time delay may be caused by lag by server to keep with with frame processing.
			// Using this to force the server to the current video player time.
			this.state.frame = 0;
			wsio.emit('updateVideoTime', {
				id: this.div.id,
				timestamp: 0,
				play: false
			});

			// if this is a sender, also send the command to the server holding variable
			if (this.shouldSendCommands) {
				wsio.emit("serverDataSetValue", {
					nameOfValue: "videoSyncCommandVariable",
					value: {
						command: "stop",
						timestamp: (this.state.frame / this.state.framerate),
						frame: this.state.frame,
						framerate: this.state.framerate
					},
					description: "This variable contains the last send command"
				});
			}
		}
		// must change play-pause button (should show 'play' icon)
		this.SAGE2Sync(true);
		this.playPauseBtn.state = 0;
		this.getFullContextMenuAndUpdate();
		this.htmlStop();
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

		// If a sender, then have access to additional command, step forward and step back.
		if (this.shouldSendCommands) {
			entry = {};
			entry.description = "separator";
			entries.push(entry);

			entry = {};
			entry.description = "< Step back";
			entry.callback = "contextVideoSyncStep";
			entry.parameters = {
				step: "back"
			};
			entries.push(entry);

			entry = {};
			entry.description = "> Step forward";
			entry.callback = "contextVideoSyncStep";
			entry.parameters = {
				step: "forward"
			};
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
	* @param responseObject {Object} contains response from entry selection
	*/
	contextTogglePlayPause: function(responseObject) {
		this.togglePlayPause(new Date(responseObject.serverDate));
		this.getFullContextMenuAndUpdate();
	},

	/**
	* Calls toggleMute passing the given time.
	*
	* @method contextToggleMute
	* @param responseObject {Object} contains response from entry selection
	*/
	contextToggleMute: function(responseObject) {
		this.toggleMute(new Date(responseObject.serverDate));
		this.getFullContextMenuAndUpdate();
	},

	/**
	* Sets variables necessary sending or receiving of commands.
	* A player can send or receive, but not both.
	*
	* @method contextVideoSyncHandler
	* @param responseObject {Object} contains response from entry selection
	*/
	contextVideoSyncHandler: function(responseObject) {
		if (responseObject.send) {
			this.shouldSendCommands = true;
			this.shouldReceiveCommands = false;
			// no purpose behind this other than to ensure variable exists after a sender is specified.
			wsio.emit("serverDataSetValue", {
				nameOfValue: "videoSyncCommandVariable",
				value: {
					command: "newSender",
					timestamp: (this.state.frame / this.state.framerate),
					frame: this.state.frame,
					framerate: this.state.framerate
				},
				description: "This variable contains the last send command"
			});
		} else if (responseObject.receive) {
			this.shouldSendCommands = false;
			this.shouldReceiveCommands = true;

			wsio.emit("serverDataSubscribeToValue", {
				nameOfValue: "videoSyncCommandVariable",
				app: this.id,
				func: "videoSyncCommandHandler",
				description: "This variable contains the last send command"
			});

		} else {
			this.shouldSendCommands = false;
			this.shouldReceiveCommands = false;
		}
		this.getFullContextMenuAndUpdate();
	},

	/**
	* Initiates a step and pauses.
	*
	* @method contextVideoSyncStep
	* @param responseObject {Object} contains response from entry selection
	*/
	contextVideoSyncStep: function(responseObject) {
		var timestampToSend;
		var shouldSendTimeUpdate = false;

		if (responseObject.step == "back") {
			shouldSendTimeUpdate = true;
			if (this.state.frame == 0) { // if at 0, they go to last frame.
				timestampToSend = this.state.numframes / this.state.framerate;
			} else { // else frame is > 0
				timestampToSend = this.state.frame - this.state.framerate;
				if (timestampToSend < 0) { // stepping always stops at 0 before wrap around.
					timestampToSend = 0;
				} else { // non zero means calc its time.
					timestampToSend = timestampToSend / this.state.framerate;
				}
			}
		} else if (responseObject.step == "forward") {
			shouldSendTimeUpdate = true;
			if (this.state.frame == this.state.numframes) { // if at last frame, wrap around
				timestampToSend = 0;
			} else { // else frame is < max
				timestampToSend = this.state.frame + this.state.framerate;
				if (timestampToSend > this.state.numframes) { // stepping always stops at max before wrap
					timestampToSend = this.state.numframes / this.state.framerate;
				} else { // if not max, then calc
					timestampToSend = timestampToSend / this.state.framerate;
				}
			}
		}

		// steps must be forward or back.
		if (shouldSendTimeUpdate) {
			wsio.emit('updateVideoTime', {
				id: this.div.id,
				timestamp: timestampToSend,
				play: false
			});

			wsio.emit("serverDataSetValue", {
				nameOfValue: "videoSyncCommandVariable",
				value: {
					command: "seek",
					timestamp: timestampToSend,
					frame: this.state.frame,
					framerate: this.state.framerate,
					play: false
				},
				description: "This variable contains the last send command"
			});
		}
	},

	/**
	* Assumes that the update value is an object with properties:
	*		command
	*		timestamp
	*		frame
	*		framerate
	* @method videoSyncCommandHandler
	* @param valueUpdate {Object} contains last sent command
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

		if (shouldSendTimeUpdate) {
			wsio.emit('updateVideoTime', {
				id: this.div.id,
				timestamp: timestampToSend,
				play: playStatusToSend
			});
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
				if (this.state.muted === true) {
					if (isMaster) {
						wsio.emit('unmuteVideo', {id: this.div.id});
					}
					this.state.muted = false;
				} else {
					if (isMaster) {
						wsio.emit('muteVideo', {id: this.div.id});
					}
					this.state.muted = true;
				}
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
								this.state.playAfterSeek = true;
								this.htmlSetPlayPauseStatus("pause");
								if (isMaster) {
									wsio.emit('pauseVideo', {id: this.div.id});
								}
							} else {
								this.state.playAfterSeek = false;
							}
							break;
						case "sliderUpdate":
							break;
						case "sliderRelease":
							this.htmlSetSeekTime();
							if (this.state.playAfterSeek) {
								this.videoElement.play();
							}
							if (isMaster) {
								wsio.emit('updateVideoTime', {
									id: this.div.id,
									timestamp: (this.state.frame / this.state.framerate),
									play: !this.state.paused
								});
								if (this.shouldSendCommands) {
									wsio.emit("serverDataSetValue", {
										nameOfValue: "videoSyncCommandVariable",
										value: {
											command: "seek",
											timestamp: (this.state.frame / this.state.framerate),
											frame: this.state.frame,
											framerate: this.state.framerate,
											play: !this.state.paused
										},
										description: "This variable contains the last send command"
									});
								}
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

	/**
	* Checks the configuration to see if there are multiple displays.
	* If there is only one display listed, or if there is an entry that covers all, then will return true.
	*
	* @method isOnlyDisplay
	* @return {bool} If config shows only one display.
	*/
	isOnlyDisplay() {
		let totalDisplays = ui.json_cfg.layout.columns * ui.json_cfg.layout.rows;
		let displayClientList = ui.json_cfg.displays;
		let currentDisplay, w, h;
		for (let i = 0; i < displayClientList.length; i++) {
			currentDisplay = displayClientList[i];
			w = currentDisplay.width;
			h = currentDisplay.height;
			// If w and h have values
			if (w && h) {
				if (totalDisplays == (w * h)) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	* Checks the file extension to see if it is supported by the HTML player.
	* Based on https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
	* Special check for .mov, needed additional exif data from the server.
	*
	* @method isFileTypeSupportedByHtmlPlayer
	* @param file {string} URL path of hte file to be played.
	* @return {bool} True if supported. Otherwise false.
	*/
	isFileTypeSupportedByHtmlPlayer: function(file) {
		let supportedTypes = ["webm", "ogg", "mp4", "mov"]; // flac
		let ext = file.lastIndexOf(".");
		if (ext > -1) {
			ext = file.substring(ext + 1);
			ext = ext.trim().toLowerCase();
			for (let i = 0; i < supportedTypes.length; i++) {
				if (ext === supportedTypes[i]) {
					// mov is a container. If contents aren't H.264, probably can't decode.
					if ((ext === "mov") && (this.state.CompressorName !== "H.264")) {
						// Clear out state to reduce workload
						this.state.exif = {};
						continue;
					}
					return true;
				}
			}
		}
		return false;
	},

	/**
	* Creates video and source. Then appends to the application.
	* HTML player is currently muted by default so sound should come from audioManager.
	*
	* @method makeHtmlPlayer
	* @param url {string} URL path of hte file to be played.
	*/
	makeHtmlPlayer: function(url) {
                // Create elements
                this.videoElement = document.createElement("video");
                this.slice = options.slice;

                if (options.slice) {
                        this.videoElement.style.position = "fixed";
                        this.videoElement.style.right = 0;
                        this.videoElement.style.bottom = 0;
                        this.videoElement.style.width = "100%";
                        this.videoElement.style.height = "100%";
                        this.sourceElement = document.createElement("source");
                        this.sourceElement.src = url;
                        console.log("makeHtmlPlayer "+url);
                        // Keep the HTML player muted, let the sound come through the audioManager.
                        this.videoElement.muted = true;
                        // Add Them
                        this.videoElement.appendChild(this.sourceElement);
                        //this.element.appendChild(this.videoElement);
                        document.body.appendChild(this.videoElement);
                } else {
                        this.videoElement.style.position = "absolute";
                        this.videoElement.style.width = "100%";
                        this.videoElement.style.height = "100%";
                        this.sourceElement = document.createElement("source");
                        this.sourceElement.src = url;
                        console.log("makeHtmlPlayer "+url);
                        // Keep the HTML player muted, let the sound come through the audioManager.
                        this.videoElement.muted = true;
                        // Add Them
                        this.videoElement.appendChild(this.sourceElement);
                        this.element.appendChild(this.videoElement);
                }

                // Hide default. This doesn't remove them.
                this.canvas.style.display = "none";
                this.canvas.style.width = "1px";
                this.canvas.style.height = "1px";
                // Remove the draw calculations, this prevents some cases of flickering while updating.
                this.draw = function() {};
                // Ignore updates from server caused by delay.
                this.videoElement.frameUpdateIgnoreCount = 0;

                this.isUsingHtmlPlayer = true;
                this.htmlSetSeekTime();
	},

	/**
	* Sets the play and pause status of the HTML player.
	*
	* @method htmlSetPlayPauseStatus
	*/
	htmlSetPlayPauseStatus: function(paused) {
		if (!this.isUsingHtmlPlayer) {
			return;
		}
		this.htmlSetSeekTime();
		if ((paused) || this.state.paused === true) {
			this.videoElement.pause();
		} else {
			this.videoElement.play();
		}
		// requestAnimationFrame(() => { this.htmlTimeCheckers(); });
	},

	/**
	* Using this to figure out if the server or the player is time-wise wrong.
	*
	* @method htmlTimeCheckers
	*/
	htmlTimeCheckers: function() {
		if (!this.timeCheckStart) {
			this.timeCheckStart = Date.now();
		}

		// 5 seconds later
		if (Date.now() >= this.timeCheckStart + 5000) {
			console.log("state frame:" + this.state.frame + "(" + (this.state.frame / this.state.framerate) + ")");
			console.log("video frame:" + this.videoElement.currentTime);
			this.togglePlayPause(new Date(Date.now()));
			this.timeCheckStart = false;
			console.log("stopping");
		} else {
			requestAnimationFrame(() => {
				this.htmlTimeCheckers();
			});
		}
	},

	/**
	* Sets the loop status of the HTML player
	*
	* @method htmlSetLoopStatus
	*/
	htmlSetLoopStatus: function() {
		if (!this.isUsingHtmlPlayer) {
			return;
		}
		if (this.state.looped === false) {
			this.videoElement.removeAttribute("loop");
		} else {
			this.videoElement.setAttribute("loop", "");
		}
	},

	/**
	* Stops the HTML player by pausing and seeking to 0.
	*
	* @method htmlStop
	*/
	htmlStop: function() {
		if (!this.isUsingHtmlPlayer) {
			return;
		}
		// This pauses and sets HTML player to beginning
		this.videoElement.pause();
		this.videoElement.currentTime = 0;
	},

	/**
	* This seek will reset to the state value of frame position calculation for current time.
	*
	* @method htmlSetSeekTime
	*/
	htmlSetSeekTime: function() {
		if (!this.isUsingHtmlPlayer) {
			return;
		}
		let time = this.state.frame / this.state.framerate;
		this.videoElement.currentTime = time;
	}
});
