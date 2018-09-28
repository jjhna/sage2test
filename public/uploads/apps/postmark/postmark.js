//
// SAGE2 application: postmark
// by: Luc Renambot <renambot@gmail.com>
//
// Copyright (c) 2018
//

"use strict";

/* global  showdown */

var postmark = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		this.element.style.backgroundColor = '#f0b154';
		// move and resize callbacks
		this.resizeEvents = "continuous";

		this.newdiv = document.createElement("div");
		this.newdiv.style.position = "absolute";
		this.newdiv.style.overflow = "hidden";
		this.newdiv.style.top      = "0";
		this.newdiv.style.left     = "0";
		this.newdiv.style.width    = "100%";
		this.newdiv.style.height   = "100%";
		this.element.appendChild(this.newdiv);

		this.newdiv.style.fontSize = ui.titleTextSize + "px";
		// padding: top right bottom left
		this.newdiv.style.padding = "10px 0 0 10px";
		// Using SAGE2 default mono font
		this.newdiv.style.fontFamily = "Oxygen Mono";
		// Set center of scale
		this.newdiv.style.transformOrigin = "0% 0%";
		this.newdiv.style.transform = "scale(" + this.state.scale + ")";

		// SAGE2 Application Settings
		this.controls.finishedAddingControls();
		this.enableControls = true;

		this.state.text = `### Markdown
1.  Item 1
    * A corollary to the above item.
    * Yet another point to consider.
1.  Item 2
    * A corollary that does not need to be ordered.
    * This is indented four spaces
    * You might want to consider making a new list.
1.  Item 3`;

		this.converter = new showdown.Converter();
		this.html = this.converter.makeHtml(this.state.text);
		this.newdiv.innerHTML = this.html;
	},

	load: function(date) {
		this.html = this.converter.makeHtml(this.state.text);
		this.refresh(date);
	},

	draw: function(date) {
	},

	resize: function(date) {
		// Adjust the width according to the scale factor: helps with word wrapping
		this.newdiv.style.width  = (this.sage2_width  / this.state.scale) + "px";
		this.newdiv.style.height = (this.sage2_height / this.state.scale) + "px";
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	getContextEntries: function() {
		var entries = [];
		var entry;

		entry = {};
		entry.description = "Scale up";
		entry.accelerator = "\u2191";     // up arrow
		entry.callback = "changeScale";
		entry.parameters = {};
		entry.parameters.scale = "up";
		entries.push(entry);

		entry = {};
		entry.description = "Scale down";
		entry.accelerator = "\u2193";     // down arrow
		entry.callback = "changeScale";
		entry.parameters = {};
		entry.parameters.scale = "down";
		entries.push(entry);

		entry = {};
		entry.description = "Scale reset";
		entry.accelerator = "1";     // 1
		entry.callback = "changeScale";
		entry.parameters = {};
		entry.parameters.scale = "reset";
		entries.push(entry);

		return entries;
	},

	/**
	* Scaling the text
	*
	* @method changeScale
	* @param responseObject {Object} contains response from entry selection
	*/
	changeScale: function(responseObject) {
		var scale = responseObject.scale;
		// 40% up or down scale
		if (scale === "up") {
			this.state.scale *= 1.4;
		} else if (scale === "down") {
			this.state.scale /= 1.4;
		} else if (scale === "reset") {
			this.state.scale = 1;
		}
		this.newdiv.style.transform = "scale(" + this.state.scale + ")";
		// This needs to be a new date for the extra function.
		this.refresh(new Date(responseObject.serverDate));
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
			if (data.character === "1") {
				this.changeScale({scale: "reset", serverDate: date});
			} else if (data.character === "m") {
				this.refresh(date);
			} else if (data.character === "+") {
				this.changeScale({scale: "up", serverDate: date});
			} else if (data.character === "-") {
				this.changeScale({scale: "down", serverDate: date});
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.changeScale({scale: "up", serverDate: date});
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.changeScale({scale: "down", serverDate: date});
			}
		}
	}
});
