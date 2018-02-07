//
// SAGE2 application: JupyterLab
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2015
//

"use strict";

/* global  */

var Snippets_Vis = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'black';

		this.svg = d3.select(this.element)
      .append("svg")
      .attr("width", data.width)
			.attr("height", data.height)
			.style("background", "lightblue");

		this.parentLink = null;

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // continuous
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		console.log(data);

		this.updateTitle("SAGE2 Code Snippets - " + this.state.snippetsID);

		SAGE2_CodeSnippets.displayApplicationLoaded(this.state.snippetsID, this);
	},

	load: function(date) {
		console.log('Snippets_Vis> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
		console.log('Snippets_Vis> Draw with state value', this.state.value);
	},

	getElement: function (data, date) {
		// update with new data and draw
		return this.svg.node();
	},

	setParentLink: function (link, date) {
		// save the parent of the function
		self.parentLink = link;
	},

	resize: function(date) {
		// Called when window is resized

		this.svg
			.attr("width",   this.sage2_width)
			.attr("height",  this.sage2_height);

		self.parentLink.update(); // redraw
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
		} else if (eventType === "dataUpdate") {
			console.log("JupyterLab Data Update", data);

			this.updateContent(data, date);
			// this.refresh(date);
		}
	}
});
