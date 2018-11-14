//
// SAGE2 application: vrloader
// by: Krishna Bharadwaj <kbhara5@uic.edu>
//
// Copyright (c) 2015
//

"use strict";

/* global  */


var vrloader = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'black';

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
		// this.moveEvents   = "continuous";

		// SAGE2 Application Settings
		//
		// Control the frame rate for an animation application
		this.maxFPS = 30.0;
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;
		// When the page request fullscreen
		this.element.addEventListener("enter-html-full-screen", function(event) {
			console.log('Webview>	Enter fullscreen');
			// not sure if this works
			event.preventDefault();
		});
		this.element.addEventListener("leave-html-full-screen", function(event) {
			console.log('Webview>	Leave fullscreen');
			// not sure if this works
			event.preventDefault();
		});
		this.vruser = null;
		this.saveSize();
		this.position = {x: 0, y: 0};

		this.standAloneAppEventSharing = false;
		
		var id;
		if (window.browserID) {
			this.view = new BrowserView(this);
		} else {
			this.view = new MasterView(this);
			
		}
		this.view.preLoadModels(this.resrcPath);
		
		//Temp
		this.translatorIdx = 0;
		if (this.parentIdOfThisApp !== undefined && this.parentIdOfThisApp !== null) {
			this.state.file = data.customLaunchParams.model;
			this.ancestorIdOfThisApp = data.customLaunchParams.ancestorIdOfThisApp;
			this.initMode(data.customLaunchParams);
			//console.log(this.parentIdOfThisApp);
		} else {
			this.ancestorIdOfThisApp = this.id;
			this.initMode({maximized: 1, mode: "perspective"});
			// First instance loads the model
			this.appInit(this.state.file);
		}

	},
	initMode: function(data) {
		if (!window.browserID) { // this.vruser isn't constructed at this point
			this.view.initMode(data);
		}
	},
	load: function(date) {
		this.refresh(date);
		//console.log(this.state.users);
	},

	draw: function(date) {
		if (!this.parentIdOfThisApp && this.view.modelLoaded === true) {
			this.draw = this.drawAfterLoad;
		} else if (this.parentIdOfThisApp) {
			if (this.view.modelLoaded !== true) {
				var ancestor = applications[this.ancestorIdOfThisApp];
				//console.log(this.ancestorIdOfThisApp, this.parentIdOfThisApp);
				if (ancestor !== undefined) {
					if (ancestor.view.modelLoaded === true) {
						var model = ancestor.view.MODEL.clone();
						this.appInit(model);
					}
				}
			} else {
				this.draw = this.drawAfterLoad;
			}
		}
	},
	drawAfterLoad: function(date) {
		//this.applyChanges();
		if (this.vruser.id === this.id + "_" + "Display") {
			this.view.render();
		}
		//console.log(this.state.users);
	},
	resize: function(date) {
		// Called when window is resized
		this.element.style.width  = this.sage2_width  + "px";
		this.element.style.height = this.sage2_height + "px";
		this.saveSize();
		this.view.resize();
		this.refresh(date);
	},
	saveSize: function() {
		this.width = parseInt(this.element.style.width);
		this.height = parseInt(this.element.style.height);
		this.aspect = this.width / this.height;
	},
	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		if (this.listOfUserIDs) {
			var removeIdx = this.listOfUserIDs.findIndex(x => x === this.vruser.id);
			this.listOfUserIDs.splice(removeIdx, 1);
			console.log(this.listOfUserIDs);
			this.serverDataSetValue(this.ancestorIdOfThisApp + ":destination:" + "users", this.listOfUserIDs, "List of users");
		}
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			this.dragging = true;
			this.moved = false;
			this.position.x = position.x;
			this.position.y = position.y;
			this.clickedAt = date;
			//console.log(this.state.users);
		} else if (eventType === "pointerMove" && this.dragging) {
			this.view.turn(this.position.x - position.x, this.position.y - position.y);
			this.position.x = position.x;
			this.position.y = position.y;
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			if (date - this.clickedAt > 500) {
				this.moved = true;
			}
			//console.log('click', this.dragging, this.moved);
			if (this.dragging === true && this.moved === false) {

			}
			this.dragging = false;
			this.position.x = position.x;
			this.position.y = position.y;

		} else if (eventType === "pointerScroll") {
			this.view.move(data.wheelDelta * 0.02);
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			switch (data.character) {
				case "w":
					this.view.move(1);
					break;
				case "a":
					this.view.move(1);
					break;
				case "s":
					this.view.move(-1);
					break;
				case "d":
					this.view.move(1);
					break;
				case "1":
				case "m":
				case "M":
					this.changeMode("maximized");
					break;
				case "2":
				case "p":
				case "P":
					this.changeMode("perspective");
					break;
				case "3":
				case "t":
				case "T":
					this.changeMode("plan");
					break;
				case "4":
				case "e":
				case "E":
					this.changeMode("elevation");
					break;
				case "5":
				case "f":
				case "F":
					this.changeMode("front");
					break;
				case "n":
				case "N":
					this.createClone();
					break;
				case "p":
					console.log(this.state.users);
					break;
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.view.move(-1);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.view.move(1);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.view.move(1);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.view.move(-1);
			}
		}
		this.refresh(date);
	},
	appInit: function(model) {
		this.users = {};
		this.listOfUserIDs = [];
		this.view.setupScene(model, function(attr, value) {
			this.captureChange(attr, value);
			//console.log(attr, value);
		}.bind(this));

		var id = window.browserID || "Display";
		id = this.id + "_" + id;
		this.vruser = this.createNewUser(id);
		this.initializeSharedVariables([id]);
		this.changeMode(this.mode);
		console.log("app Init called", this.id);
	},
	removeUser: function(uid) {
		this.view.removeUser(this.users[uid]);
		delete this.users[uid];
	},
	createNewUser: function(uid) {
		console.log(this.id + " At create user");
		if (this.users.hasOwnProperty(uid) === false) {
			console.log(this.id + " Creating user: " + uid);
			var user = new VRUser();
			user.id = uid;
			if (uid === this.id + "_" + "Display") {
				user.view = uid;
			}
			this.users[uid] = user;
			var rand1 = parseInt(1000 * Math.random()) % 255;
			var rand2 = parseInt(2000 * Math.random()) % 255;
			user.color = "rgba(120, " + rand1 + "," + rand2 + " )";
			this.view.addModelsForUser(user);
		}

		return this.users[uid];		
	},
	captureChange: function(attr, val) {
		var change = {
			id: this.vruser.id
		};
		if (typeof val === 'string') {
			change[attr] = val;
		} else {
			change[attr] = xyzToString(val);	
		}
		//this.state.userAction.push(change);
		this.serverDataSetValue(this.ancestorIdOfThisApp + ":destination:" + "userAction", change, "User action");
	},
	getContextEntries: function() {
		var entries = [];
		entries.push({
			description: "Open in browser",
			callback: "SAGE2_standAloneApp",
			parameters: {}
		});
		if (this.state.file) {
			//TODO: use this file to load
			entries[0].parameters.url = cleanURL(this.state.file);
			// Special callback: download the file
			entries.push({
				description: "Download model",
				callback: "SAGE2_zipDownload",
				parameters: {
					url: cleanURL(this.state.file)
				}
			});
		}
		return entries;
	},

	applyChanges: function(data) {
		console.log(this.id, data);
		var id = data.id;
		if (this.users.hasOwnProperty(id)) {
			if (this.users[id].object3D === null || this.users[id].object3D === undefined) {
				this.view.addModelsForUser(this.users[id]);
				return;
			}
			if (data.p) {
				var position = stringToXyz(data.p);
				this.users[id].object3D.position.set(position.x, position.y, position.z);
			}
			if (data.r) {
				var rotation = stringToXyz(data.r);
				console.log(this.id, rotation);
				this.users[id].object3D.rotation.set(rotation.x, rotation.y, rotation.z);
			}
			if (data.m) {
				this.users[id].setVRMode(data.m === '1');
			}
		}
		if (isBrowser && this.vruser.visible) {
			this.vruser.setVisibility(false);
		}
	},
	changeMode: function(mode) {
		if (this.vruser.id === this.id + "_" + "Display") {
			this.view.changeMode(mode);
		}
	},
	createClone: function() {
		if (this.vruser.id === this.id + "_" + "Display") {
			var paramObj = {
				maximized: this.view.maximized,
				mode: this.view.mode,
				model: this.state.file,
				ancestorIdOfThisApp: this.ancestorIdOfThisApp
			}
			this.launchAppWithValues("vrloader", paramObj, this.sage2_x + 100, this.sage2_y + 100);
		}
		
	},
	notifyOthersAboutUserCreationAndDeletion: function(data) {
		console.log(this.id, data);
		var userID;
		var updateOthers = false;
		//Removing deleted users from the scene
		for (var i = this.listOfUserIDs.length - 1; i >= 0; i--) {
			userID = this.listOfUserIDs[i];
			if (data.indexOf(userID) < 0) {
				this.removeUser(userID);
				this.listOfUserIDs.splice(i, 1);
				if (userID.indexOf(this.ancestorIdOfThisApp) > -1) {
					this.setNewAncestor();
					this.initializeSharedVariables(this.listOfUserIDs);
				}
			}
		}

		// Adding new users to the scene
		for (var i = data.length - 1; i >= 0; i--) {
			userID = data[i];
			if (this.listOfUserIDs.indexOf(userID) < 0) {
				this.createNewUser(userID);
				this.listOfUserIDs.push(userID);
				if (userID !== this.vruser.id) {
					updateOthers = true;	
				}
			}
		}

		// Adding this user to the others' scenes
		if (data.indexOf(this.vruser.id) < 0) {
			console.log(this.id + ": adding " + this.vruser.id + " to list of users");
			data.push(this.vruser.id);
			this.listOfUserIDs = data;
			this.serverDataSetValue(this.ancestorIdOfThisApp + ":destination:" + "users", data, "List of users");
		}

		if (updateOthers === true) {
			this.captureChange('p', this.vruser.object3D.position);
			this.captureChange('r', this.vruser.object3D.rotation);
		}		
	},
	setNewAncestor: function() {
		this.ancestorIdOfThisApp = this.listOfUserIDs.map(function(d) {
			return d.split('_')[0];
		}).sort(function(a, b) {
			return a - b;
		})[0];
	},
	initializeSharedVariables: function(list) {
		if (isMaster && this.id === this.ancestorIdOfThisApp) {
			console.log(this.id, list);
			this.serverDataBroadcastDestination("users", list,
				"List of users", "notifyOthersAboutUserCreationAndDeletion");
			this.serverDataBroadcastDestination("userAction", "",
				"List of users", "applyChanges");
		} else {
			this.serverDataGetValue(this.ancestorIdOfThisApp + ":destination:" + "users", "notifyOthersAboutUserCreationAndDeletion");
			this.serverDataSubscribeToValue(this.ancestorIdOfThisApp + ":destination:" + "users", "notifyOthersAboutUserCreationAndDeletion");
			this.serverDataSubscribeToValue(this.ancestorIdOfThisApp + ":destination:" + "userAction", "applyChanges");
		}
	}
 });

