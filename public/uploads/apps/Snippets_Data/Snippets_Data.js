//
// SAGE2 application: Snippets_Data
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2017
//

"use strict";

/* global  */

var Snippets_Data = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'white';
		this.element.style.fontFamily = 'monospace';
		this.element.style.whiteSpace = 'pre';

		this.dataset = {};

		this.parentLink = null;
		this.childLinks = [];

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // continuous
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		// set up link to parent
		SAGE2_CodeSnippets.displayApplicationLoaded(this.state.snippetsID, this);

		if (this.parentLink) {
      if (this.parentLink.getParent()) {
        this.updateTitle("Snippets - " + this.state.snippetsID + " - " + `${this.parentLink.getSnippetID()}(${this.parentLink.getParent().state.snippetsID})`);
      } else {
        this.updateTitle("Snippets - " + this.state.snippetsID + " - " + `${this.parentLink.getSnippetID()}()`);
      }
    } else {
      this.updateTitle("Snippets - " + this.state.snippetsID);
    }
	},

	load: function(date) {
		console.log("Snippets_Data> Load with state value", this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
		console.log('Snippets_Data> Draw with state value', this.state.value);
	},

	getDataset: function (date) {
		// update with new data and draw
		return this.dataset;
	},

	updateDataset: function(data, date) {
		// update dataset
		console.log("Updated Dataset:", data);
		this.dataset = data;

		// draw
		this.element.innerHTML = JSON.stringify(
			this.dataset,
			null,
			2
		).substring(0, 500) + "\n ...";

		// update all children
		for (let childLink of this.childLinks) {
			console.log(childLink);
			childLink.update();
		}
	},

	addChildLink: function(data, date) {
		this.childLinks.push(data);
	},

	setParentLink: function (link, date) {
		// save the parent of the function
		this.parentLink = link;
	},

	resize: function(date) {
		// Called when window is resized
		

		// this.refresh(date);
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
			SAGE2_CodeSnippets.notifyUserDataClick(user_id, this.state.snippetsID);
		} else if (eventType === "pointerMove" && this.dragging) {
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// widget events
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
