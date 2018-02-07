//
// SAGE2 application: Snippets_List
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2017
//

"use strict";

/* global  */

var Snippets_List = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = "#525252";
		this.element.style.fontFamily = 'monospace';
		this.element.style.whiteSpace = 'pre';

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // continuous
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// use mouse events normally
		this.passSAGE2PointerAsMouseEvents = true;

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		SAGE2_CodeSnippets.registerSnippetListApp(data.id, this);
	},

	updateFunctionBank: function(data, date) {
		console.log("Snippets_List> Update Functions", data);

		let lightColor = {
			gen: "#b3e2cd",
			data: "#cbd5e8",
			draw: "#fdcdac"
		};

		let darkColor = {
			gen: "#87d1b0",
			data: "#9db0d3",
			draw: "#fba76d"
		}

		this.element.innerHTML = "";

		for (let func of Object.values(data)) {

			let fElem = document.createElement("div")
			fElem.style.padding = "10px";
			fElem.style.margin = "5px";
			
			fElem.style.border = "3px solid " + (func.locked ? lightColor[func.type] : darkColor[func.type]);
			fElem.style.background = func.locked ? "#525252" : lightColor[func.type];
			fElem.style.borderRadius = "5px";
			
			fElem.style.color = func.locked ? lightColor[func.type] : "black";
			fElem.style.wordWrap = "break-word";
			fElem.style.fontWeight = "bold";
			fElem.style.overflow = "hidden";
			
			fElem.innerHTML = func.id + " - " + func.type + " - " + func.desc;

			let that = this;

			fElem.onclick = function(e) {
				console.log("Function clicked", func, e);
				console.log(that.lastUserClick);

				SAGE2_CodeSnippets.notifyUserListClick(that.lastUserClick, func);
				that.lastUserClick = null;
			}

			this.element.appendChild(fElem);
		}
	},

	load: function(date) {
		console.log("Snippets_List> Load with state value", this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
		console.log('Snippets_List> Draw with state value', this.state.value);
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
			this.lastUserClick = user_id;
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
