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

/* global showdown */

var quickNote = SAGE2_App.extend({
	init: function(data) {
		this.SAGE2Init("div", data);

		this.resizeEvents = "continuous"; // "onfinish";

		this.element.id = "div" + data.id;
		// this.element.style.background = "lightyellow";
		this.element.style.fontSize   = ui.titleTextSize + "px";
		// Using SAGE2 default mono font
		this.element.style.fontFamily = "Oxygen Mono";
		// Default starting attributes
		this.backgroundChoice = "lightyellow";



		// Separate div since the html will be contantly edited with showdown
		this.markdownDiv = document.createElement("div");
		this.markdownDiv.style.position = "absolute";
		this.markdownDiv.style.top      = "0";
		this.markdownDiv.style.left     = "0";
		this.markdownDiv.style.width    = "100%";
		this.markdownDiv.style.height   = "100%";
		this.markdownDiv.style.padding = ui.titleTextSize + "px " + ui.titleTextSize + "px 0 " + ui.titleTextSize + "px"; // multiplier based on starting size
		this.markdownDiv.style.fontFamily = "Oxygen Mono";
		this.markdownDiv.style.transformOrigin = "0% 0%";
		this.markdownDiv.style.fontSize = ui.titleTextSize + "px";
		this.markdownDiv.style.boxSizing = "border-box";
		this.element.appendChild(this.markdownDiv);
		// Keep a copy of the title
		this.noteTitle = "";
		// Make a converter
		this.showdown_converter = new showdown.Converter();
		// If loaded from session, this.state will have meaningful values.
		this.setMessage(this.state);
		var _this = this;
		// If it got file contents from the sever, then extract.
		if (data.state.contentsOfNoteFile) {
			this.parseDataFromServer(data.state.contentsOfNoteFile);
		} else if (this.state.contentsOfNoteFile) {
			this.parseDataFromServer(this.state.contentsOfNoteFile);
		} else if (data.customLaunchParams) {
			// if it was passed additional init values
			data.customLaunchParams.serverDate = new Date(Date.now());
			_this.setMessage(data.customLaunchParams);
		}
		this.adjustFontSize();
		this.showOrHideArrow();
	},

	/**
	Currently assumes that file from server will contain three lines.
	1st: creator and timestamp
	2nd: color for note
	3rd: content for note
	*/
	parseDataFromServer: function(fileContentsFromServer) {
		var fileData  = {};
		fileData.fileDefined = true;
		fileData.clientName  = fileContentsFromServer.substring(0, fileContentsFromServer.indexOf("\n"));
		fileContentsFromServer  = fileContentsFromServer.substring(fileContentsFromServer.indexOf("\n") + 1); // Remove first line
		fileData.colorChoice  = fileContentsFromServer.substring(0, fileContentsFromServer.indexOf("\n"));
		fileContentsFromServer  = fileContentsFromServer.substring(fileContentsFromServer.indexOf("\n") + 1); // Remove second line
		fileData.clientInput = fileContentsFromServer; // The rest is to be displayed
		this.setMessage(fileData);
	},

	/**
	msgParams.clientName	Client input pointer name
	msgParams.clientInput	What they typed for the note.
	*/
	setMessage: function(msgParams) {
		// If defined by a file, use those values
		if (msgParams.fileDefined === true) {
			this.element.style.background = this.state.colorChoice  = this.backgroundChoice = msgParams.colorChoice;
			this.state.creationTime = msgParams.clientName;
			this.formatAndSetTitle(this.state.creationTime);
			this.saveNote(msgParams.creationTime);
		} else { // else defined by load or user input
			// Otherwise set the values using probably user input.
			if (msgParams.clientName === undefined || msgParams.clientName === null || msgParams.clientName == "") {
				msgParams.clientName = ""; // Could be anon
			}
			// If the color choice was defined, use the given color.
			if (msgParams.colorChoice !== undefined && msgParams.colorChoice !== null && msgParams.colorChoice !== "") {
				this.element.style.background = this.backgroundChoice = this.state.colorChoice = msgParams.colorChoice;
			}
			// client input state set as part of the clean
			this.state.clientName  = msgParams.clientName;
			this.state.colorChoice = this.backgroundChoice;
			// if the creationTime has not been set, then fill it out.
			if (this.state.creationTime === null
				&& msgParams.serverDate !== undefined
				&& msgParams.serverDate !== null) {
				this.state.creationTime = new Date(msgParams.serverDate);
				// Remove the unicode charaters from client name because used in the file name
				var cleanName = msgParams.clientName.replace(/[^\x20-\x7F]/g, "").trim();
				// build the title string
				var titleString = cleanName + "-QN-" + this.state.creationTime.getFullYear();
				if (this.state.creationTime.getMonth() < 9) {
					titleString += "0";
				}
				titleString += (this.state.creationTime.getMonth() + 1) + ""; // month +1 because starts at 0
				if (this.state.creationTime.getDate() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getDate() + "-";
				if (this.state.creationTime.getHours() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getHours();
				if (this.state.creationTime.getMinutes() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getMinutes();
				if (this.state.creationTime.getSeconds() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getSeconds();
				if (this.state.creationTime.getMilliseconds() < 10) {
					titleString += "0";
				}
				if (this.state.creationTime.getMilliseconds() < 100) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getMilliseconds();
				// store it for later and update the tile.
				this.state.creationTime = titleString;
				this.formatAndSetTitle(this.state.creationTime);
			}
			// if loaded will include the creationTime
			if (msgParams.creationTime !== undefined && msgParams.creationTime !== null) {
				this.formatAndSetTitle(msgParams.creationTime);
			}
		}

		// set the text, currently innerHTML matters to render <br> and allow for html tags
		this.state.clientInput = msgParams.clientInput;
		this.markdownDiv.innerHTML = this.showdown_converter.makeHtml(msgParams.clientInput);

		// save if didn't come from file
		if (msgParams.fileDefined !== true) {
			this.saveNote(msgParams.creationTime);
		}
	},

	setColor: function(responseObject) {
		this.backgroundChoice         = responseObject.color;
		this.state.colorChoice        = this.backgroundChoice;
		this.markdownDiv.style.background = responseObject.color;
		this.saveNote(responseObject.creationTime);
	},

	formatAndSetTitle: function(wholeName) {
		// Breaking apart whole name and using moment.js to make easier to read.
		var parts  = wholeName.split("-"); // 0 name - 1 qn - 2 YYYYMMDD - 3 HHMMSSmmm
		var author = parts[0];
		var month  = parseInt(parts[2].substring(4, 6)); // YYYY[MM]
		var day    = parseInt(parts[2].substring(6, 8)); // YYYYMM[DD]
		var hour   = parseInt(parts[3].substring(0, 2)); // [HH]
		var min    = parseInt(parts[3].substring(2, 4)); // HH[MM]
		// Moment conversion
		var momentTime = {
			month: month - 1,
			day: day,
			hour: hour,
			minute: min
		};
		momentTime = moment(momentTime);
		// If the author is supposed to be Anonymouse, then omit author inclusion and marker.
		if (author === "Anonymous") {
			this.noteTitle = momentTime.format("MMM Do, hh:mm A");
		} else { // Otherwise have the name followed by @
			this.noteTitle = author + " @ " + momentTime.format("MMM Do, hh:mm A");
		}
		this.updateTitle(this.noteTitle);
	},

	load: function(date) {
		if (this.state.clientInput !== undefined && this.state.clientInput !== null) {
			this.setMessage({
				clientName:   this.state.clientName,
				clientInput:  this.state.clientInput,
				colorChoice:  this.state.colorChoice,
				creationTime: this.state.creationTime
			});
			this.adjustFontSize();
			this.showOrHideArrow();
		}
		this.resize(date);
	},

	saveNote: function(date) {
		if (this.state.creationTime === null || this.state.creationTime === undefined) {
			return;
		}
		// This is what saves the state between sessions as far as can be determined.
		this.SAGE2UpdateAppOptionsFromState();
		this.SAGE2Sync(true);
		this.resize();
		// Tell server to save the file.
		var fileData = {};
		fileData.fileType = "note"; // Extension
		fileData.fileName = this.state.creationTime + ".note"; // Fullname with extension
		// What to save in the file
		fileData.fileContent = this.state.creationTime
			+ "\n"
			+ this.state.colorChoice
			+ "\n"
			+ this.state.clientInput;
		wsio.emit("saveDataOnServer", fileData);
		// save the state value
		this.state.contentsOfNoteFile = fileData.fileContent;
		// update the context menu with the current content
		this.getFullContextMenuAndUpdate();
	},

	draw: function(date) {
	},

	resize: function(date) {
		// Adjust the width according to the scale factor: helps with word wrapping
		// this.markdownDiv.style.width  = (this.sage2_width  / this.state.scale) + "px";
		// this.markdownDiv.style.height = (this.sage2_height / this.state.scale) + "px";
	},

	event: function(eventType, position, user_id, data, date) {
		// arrow down
		if (data.code === 40 && data.state === "down") {
			this.adjustFontSize({ modifier: "decrease" });
		} else if (data.code === 38 && data.state === "down") {
			// arrow up
			this.adjustFontSize({ modifier: "increase" });
		}
	},

	duplicate: function(responseObject) {
		if (isMaster) {
			// function(appName, x, y, params, funcToPassParams) {
			this.launchAppWithValues("quickNote", {
				clientName: responseObject.clientName,
				clientInput: this.state.clientInput,
				colorChoice: this.state.colorChoice,
				scale: this.state.scale,
				showArrow: true
			},
			this.sage2_x + 100, this.sage2_y);
		}
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

		entry = {};
		entry.description = "Edit Note";
		entry.callback    = "SAGE2_editQuickNote";
		entry.parameters  = {
			currentContent:     this.state.clientInput,
			currentColorChoice: this.state.colorChoice
		};
		entries.push(entry);

		entries.push({description: "separator"});

		if (!this.isShowingArrow) {
			entry = {};
			entry.description = "Show arrow";
			entry.callback    = "showOrHideArrow";
			entry.parameters  = {status: "show"};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Hide arrow";
			entry.callback    = "showOrHideArrow";
			entry.parameters  = {status: "hide"};
			entries.push(entry);
		}

		entries.push({description: "separator"});

		entry = {};
		entry.description = "Duplicate";
		entry.callback    = "duplicate";
		entry.parameters  = {};
		entries.push(entry);

		entries.push({description: "separator"});

		entry = {};
		entry.description = "Set Color";
		entry.children = [
			{
				description: "Blue",
				callback: "setColor",
				parameters: { color: "lightblue"},
				entryColor: "lightblue"
			},
			{
				description: "Yellow",
				callback: "setColor",
				parameters: { color: "lightyellow"},
				entryColor: "lightyellow"
			},
			{
				description: "Pink",
				callback: "setColor",
				parameters: { color: "lightpink"},
				entryColor: "lightpink"
			},
			{
				description: "Green",
				callback: "setColor",
				parameters: { color: "lightgreen"},
				entryColor: "lightgreen"
			},
			{
				description: "White",
				callback: "setColor",
				parameters: { color: "white"},
				entryColor: "white"
			},
			{
				description: "Orange",
				callback: "setColor",
				parameters: { color: "lightsalmon"},
				entryColor: "lightsalmon"
			}
		];
		entries.push(entry);

		entries.push({description: "separator"});

		entries.push({
			description: "Increase font size",
			accelerator: "\u2191",     // up-arrow
			callback: "adjustFontSize",
			parameters: {
				modifier: "increase"
			}
		});
		entries.push({
			description: "Decrease font size",
			accelerator: "\u2193",     // down-arrow
			callback: "adjustFontSize",
			parameters: {
				modifier: "decrease"
			}
		});

		entries.push({description: "separator"});

		entries.push({
			description: "Copy content to clipboard",
			callback: "SAGE2_copyURL",
			parameters: {
				url: this.noteTitle + "\n" + this.state.clientInput + "\n"
			}
		});

		return entries;
	},

	adjustFontSize: function(responseObject) {
		// if this is activated as part of a state update, skip the adjustment
		if (responseObject) {
			if (responseObject.modifier === "increase") {
				this.state.scale *= 1.2; // 20 percent increase good?
			} else if (responseObject.modifier === "decrease") {
				this.state.scale *= 0.8; // same reduction?
			}
		}
		// this.markdownDiv.style.transform = "scale(" + this.state.scale + ")";
		this.markdownDiv.style.fontSize = parseInt(ui.titleTextSize * this.state.scale) + "px";
		this.getFullContextMenuAndUpdate();
		this.SAGE2Sync(true);
	},

	showOrHideArrow: function(responseObject) {
		if (!responseObject) { // state update
			if (this.state.showArrow) {
				this.addTopLeftArrowToWall();
			} else {
				this.hideTopLeftArrow();
			}
		} else {
			if (responseObject.status === "show") {
				this.addTopLeftArrowToWall();
				this.state.showArrow = true;
			} else if (responseObject.status === "hide") {
				this.hideTopLeftArrow();
				this.state.showArrow = false;
			}
			this.SAGE2Sync(true);
		}
	},

	addTopLeftArrowToWall: function() {
		if (this.hasLoadedTopLeftArrow) {
			if (!this.isShowingArrow) {
				this.arrow.style.display = "block";
				this.isShowingArrow = true;
				this.getFullContextMenuAndUpdate();
			}
			return;
		}
		this.hasLoadedTopLeftArrow = true;
		this.isShowingArrow = true;

		let arrow = document.createElement("img");
		arrow.style.position = "absolute";
		arrow.style.top = "0px"; // keep aligned to top of window
		// need to calculate size
		arrow.style.height = ui.titleBarHeight * 2 + "px";
		arrow.style.left = ui.titleBarHeight * -2 + "px"; // move it outside of the title bar
		arrow.src = "images/quickNote_leftArrow.svg";

		let titlebar = document.getElementById(this.id + "_title");
		titlebar.appendChild(arrow);
		titlebar.style.overflow = "visible";

		this.arrow = arrow;
		this.getFullContextMenuAndUpdate();
	},

	hideTopLeftArrow: function () {
		if (this.arrow) {
			this.arrow.style.display = "none";
			this.isShowingArrow = false;
		}
		this.getFullContextMenuAndUpdate();
	}

});
