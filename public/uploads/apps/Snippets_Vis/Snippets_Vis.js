//
// SAGE2 application: Snippets_Vis
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2017
//

"use strict";

/* global d3 */

var Snippets_Vis = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'white';

		this.svg = d3.select(this.element)
			.append("svg")
			.attr("width", data.width)
			.attr("height", data.height - 32)
			.style("margin-top", "32px")
			.style("background", "white")
			.style("box-sizing", "border-box");

		this.parentLink = null;
		this.childLinks = [];

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // continuous
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// add error popup to app
		let errorBox = document.createElement("div");
		errorBox.style.width = "90%";
		errorBox.style.height = "50%";
		errorBox.style.position = "absolute";
		errorBox.style.boxSizing = "border-box";
		errorBox.style.left = "5%";
		errorBox.style.top = "20%";

		errorBox.style.borderRadius = "10px";
		errorBox.style.background = "#ffe2e2";
		errorBox.style.boxShadow = "3px 3px 25px 3px black";
		errorBox.style.border = "2px solid #ffb4b4";
		errorBox.style.color = "red";
		errorBox.style.fontWeight = "bold";
		errorBox.style.padding = "10px";

		errorBox.style.fontFamily = 'monospace';
		errorBox.style.whiteSpace = "pre";

		errorBox.style.display = "none";

		this.errorBox = errorBox;
		this.element.appendChild(errorBox);

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		console.log(data);

		// add wrapper for function execution information
		let ancestry = document.createElement("div");
		ancestry.className = "snippetAncestry";

		this.ancestry = ancestry;
		this.element.appendChild(ancestry);

		SAGE2_CodeSnippets.displayApplicationLoaded(this.state.snippetsID, this);

		this.createAncestorList();

		// give descriptive title to app
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
		console.log('Snippets_Vis> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function(date) {
		console.log('Snippets_Vis> Draw with state value', this.state.value);
	},

	getElement: function (data, date) {
		// update with new data and draw

		// remove error dialogue when the element is requested for draw function
		this.errorBox.style.display = "none";

		// refresh ancestor list (in case of name change)
		this.createAncestorList();

		return this.svg.node();
	},

	displayError: function(err) {
		this.errorBox.style.display = "initial";
		this.errorBox.innerHTML = err;
	},

	setParentLink: function (link, date) {
		// save the parent of the function
		this.parentLink = link;
	},

	removeParentLink: function() {
		delete this.parentLink;
		
		this.createAncestorList();
	},

	createAncestorList: function() {
	// build sequential function call list and display
		let ancestorList = SAGE2_CodeSnippets.getAppAncestry(this);

		let lightColor = { gen: "#b3e2cd", data: "#cbd5e8", draw: "#fdcdac" };
		let darkColor = { gen: "#87d1b0", data: "#9db0d3", draw: "#fba76d" };
		
		this.ancestry.innerHTML = "";

		for (let ancestor of ancestorList) {
			let block = document.createElement("div");
			block.classList.add("snippetsExecutionOrderBlock");

			block.style.border = "2px solid " + darkColor[ancestor.type];
			block.style.background = lightColor[ancestor.type];
			
			block.innerHTML = `cS-${ancestor.id.split("-")[1]}: ${ancestor.desc}`;

			this.ancestry.appendChild(block);
		}
	},

	updateAncestorTree: function() {
		this.createAncestorList();

		for (let link of this.childLinks) {
			link.getChild().updateAncestorTree();
		}
	},

	resize: function(date) {
		// Called when window is resized

		this.svg
			.attr("width",   this.sage2_width - 32)
			.attr("height",  this.sage2_height);

		if (this.parentLink) {
			this.parentLink.update(); // redraw
		}
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
		SAGE2_CodeSnippets.outputAppClosed(this);
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
