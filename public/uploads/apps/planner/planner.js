//
// SAGE2 application: planner
// by: Krishna Bharadwaj <kbhara5@uic.edu>
//
// Copyright (c) 2015
//

"use strict";

/* global  */

var planner = SAGE2_App.extend({
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
		this.maxFPS = 15;
		// Not adding controls but making the default buttons available
		//this.controls.finishedAddingControls();
		//this.enableControls = true;
		var serverStr = "ws://localhost:5555";
		console.log(this.resrcPath);
		this.drawingManager = new DrawingManager(this, serverStr);
		console.log(this.state);
	},

	load: function(date) {
		console.log('planner> Load with state value', this.state.value);
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
		this.drawingManager.setPoint(position, date);
		if (eventType === "pointerPress" && (data.button === "left")) {
			this.drawingManager.processInput(eventType, null);
			this.dragging = true;
			this.refresh(date);
			// click
		} else if (eventType === "pointerMove") {
			this.drawingManager.processInput(eventType, null);
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			this.drawingManager.processInput(eventType, null);
			this.dragging = false;
			this.refresh(date);
			// click release
		} else if (eventType === "pointerPress" && (data.button === "right")) {
			this.drawingManager.processInput("pointerRtClick", null);
			this.refresh(date);
			// click release
		} else if (eventType === "pointerDblClick") {
			console.log('Double click');
			this.drawingManager.processInput(eventType, null);
			this.refresh(date);
		} else if (eventType === "pointerScroll") {
			this.drawingManager.zoom(data.wheelDelta);
			this.refresh(date);
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			this.drawingManager.processInput(eventType, data.character);
			this.refresh(date);
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.drawingManager.processInput(eventType, 'leftArrow');
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.drawingManager.processInput(eventType, 'rightArrow');
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.refresh(date);
			}
		}
	},
	setupControls: function() {
		this.controls.connectToStateMachine(this.drawingManager.sm);
		var buttons = [{
				text: "Select / Edit Mode",
				id: 'S'
			}, {
				text: "Add a Wall",
				id: 'W'
			}, {
				text: "Add a Door",
				id: 'D'
			}, {
				text: "Add a Window",
				id: 'I'
			}, {
				text: "Add a Couch",
				id: 'C'
			}, {
				text: "Add a Desk",
				id: 'K'
			}, {
				text: "Add a Chair",
				id: 'R'
			}
		];
		this.controls.populate(buttons);
	}
});
