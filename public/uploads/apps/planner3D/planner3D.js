//
// SAGE2 application: planner3D
// by: Krishna Bharadwaj <kbhara5@uic.edu>
//
// Copyright (c) 2015
//

"use strict";

/* global  */

var planner3D = SAGE2_App.extend({
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
		this.maxFPS = 30;
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;
		var serverStr = "ws://localhost:5555";
		console.log(this.resrcPath);
		this.drawingManager = new DrawingManager3D(this, serverStr);
		this.loadModels();
	},

	load: function(date) {
		console.log('planner3D> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
		this.drawingManager.update(date);
	},

	resize: function(date) {
		// Called when window is resized
		this.drawingManager.resize();
		this.refresh(date);
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	event: function(eventType, position, user_id, data, date) {
		//console.log(eventType, data);
		this.drawingManager.setPoint(position, user_id, date);
		if (eventType === "pointerPress" && (data.button === "left")) {
			this.drawingManager.processInput(eventType, null, user_id);
			this.refresh(date);
			// click
		} else if (eventType === "pointerMove") {
			this.drawingManager.processInput(eventType, null, user_id);
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			this.drawingManager.processInput(eventType, null, user_id);
			this.refresh(date);
			// click release
		} else if (eventType === "pointerScroll") {
			this.drawingManager.processInput(eventType, data, user_id);
			this.refresh(date);
			// Scroll events for zoom
		} else if (eventType === "pointerPress" && (data.button === "right")) {
			this.drawingManager.processInput("pointerRtClick", null, user_id);
			this.refresh(date);
			
			// click release
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			this.drawingManager.processInput(eventType, data.character, user_id);
			this.refresh(date);
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				this.drawingManager.processInput(eventType, 'leftArrow', user_id);
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.drawingManager.processInput(eventType, 'rightArrow', user_id);
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
			}
		}
	},
	loadModels: function() {
		var index = 0;
		var models = getAssetList();
		var modelLoader = new THREE.GLTFLoader();
		function loadNextFile() {
			if (index > models.length - 1) {
				return;
			}
			if (models[index].url) {
				modelLoader.load(this.resrcPath + models[index].url, function(object) {
					//console.log(object.scene);
					this.drawingManager.addModel(object.scene, models[index]);
					index++;
					loadNextFile.bind(this)();
					//console.log(index);
					if (index === models.length) {
						this.drawingManager.buildStructure(this.state.structure);
						this.drawingManager.wsio = new WebSocket(this.drawingManager.serverStr);
						this.drawingManager.setupServerConnection();
					}
				}.bind(this));
			} else {
				this.drawingManager.addModel(null, models[index]);
				index++;
				loadNextFile.bind(this)();
				//console.log(index);
				if (index === models.length) {
					this.drawingManager.buildStructure(this.state.structure);
					this.drawingManager.wsio = new WebSocket(this.drawingManager.serverStr);
					this.drawingManager.setupServerConnection();
				}	
			}
			
		}

		loadNextFile.bind(this)();
	},	
	/*isClientWithLeftEdge: function() {
		var checkWidth  = this.config.resolution.width;
		var checkHeight = this.config.resolution.height;
		// Overview client covers all
		if (clientID === -1) {
			return true;
		} else {
			// multiply by the size of the tile
			checkWidth  *= (this.config.displays[clientID].width  || 1);
			checkHeight *= (this.config.displays[clientID].height || 1);
		}
		return (this.sage2_x > ui.offsetX && this.sage2_x < (ui.offsetX + checkWidth));
	},*/

});
