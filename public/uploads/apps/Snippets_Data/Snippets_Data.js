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
		this.element.style.backgroundColor = 'white';
		this.element.style.fontFamily = 'monospace';
		this.element.style.whiteSpace = "pre";
		// this.element.style.padding = '10px';

		this.dataset = [];

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

		errorBox.style.fontFamily = "monospace";
		errorBox.style.whiteSpace = "pre";

		errorBox.style.display = "none";

		this.errorBox = errorBox;
		this.element.appendChild(errorBox);

		// add content wrapper to app
		let content = document.createElement("div");
		content.style.width = "100%";
		content.style.height = "100%";
		content.style.padding = "40px 10px";
		content.style.boxSizing = "border-box";

		this.content = content;
		this.element.appendChild(content);
		
		// add wrapper for function execution information
		let ancestry = d3.select(this.element).append("svg")
			.attr("class", "snippetAncestry")
			.attr("height", 32)
			.attr("width", data.width);

		this.ancestry = ancestry;

		console.log(this.state);
		// set up link to parent
		SAGE2_CodeSnippets.displayApplicationLoaded(this.state.snippetsID, this);

		this.createAncestorList();

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

		this.errorBox.style.display = "none";

		let dataString = JSON.stringify(
			this.dataset,
			null,
			2
		) + "";

		// draw
		this.content.innerHTML = dataString.length > 500 ? 
			(dataString).substring(0, 500) + "\n\n..." : 
			(dataString);

		this.updateChildren();

		// refresh ancestor list (in case of name change)
		this.createAncestorList();
	},

	updateChildren: function(date) {
		// update all children
		for (let childLink of this.childLinks) {
			console.log(childLink);
			childLink.update();
		}
	},

	displayError: function(err) {
		this.errorBox.style.display = "initial";
		this.errorBox.innerHTML = err;
	},

	addChildLink: function(data, date) {
		this.childLinks.push(data);
	},

	removeChildLink: function(link) {
		let linkInd = this.childLinks.indexOf(link);

		this.childLinks.splice(linkInd, 1);
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
		let ancestry = SAGE2_CodeSnippets.getAppAncestry(this);
		// outsource ancestry drawing ot SAGE2_CodeSnippets
		SAGE2_CodeSnippets.drawAppAncestry({
			svg: this.ancestry,
			width: this.sage2_width,
			height: 32,
			ancestry
		});
	},

	updateAncestorTree: function() {
		this.createAncestorList();

		for (let link of this.childLinks) {
			link.getChild().updateAncestorTree();
		}
	},

	resize: function(date) {
		// Called when window is resized

		// update ancestor list size
		this.ancestry.attr("width", this.sage2_width);
		this.createAncestorList();

		// this.refresh(date);
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
