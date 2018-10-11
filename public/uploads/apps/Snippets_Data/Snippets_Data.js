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

		this.element.style.backgroundColor = 'black';
		// this.element.style.padding = '10px';

		this.dataset = [];

		this.parentLink = null;
		this.childLinks = [];

		// child links split into two types
		this.viewLinks = {};
		this.dataLinks = {};

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // "continuous" or "onfinish"
		this.viewLayout = "tile"; // "tab" or "tile"
		this.activeView = "data";

		// SAGE2 Application Settings

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
		errorBox.style.fontSize =  (3 * ui.titleBarHeight / 4) + "px";
		errorBox.style.padding = "10px";

		errorBox.style.fontFamily = "monospace";
		errorBox.style.whiteSpace = "normal";

		errorBox.style.display = "none";

		this.errorBox = errorBox;
		this.element.appendChild(errorBox);

		let contentWidth = this.state.inputsOpen ? this.sage2_width - 300 : this.sage2_width;

		// add content wrapper to app
		// let content = document.createElement("div");
		// content.style.width = contentWidth + "px";
		// content.style.height = "100%";
		// content.style.padding = ui.titleBarHeight * 1.5 + 8 + "px 10px";
		// content.style.boxSizing = "border-box";
		// content.style.background = "white";
		// content.style.fontSize = ui.titleBarHeight / 2 + "px";

		// this.content = content;
		// this.element.appendChild(content);

		this.views = document.createElement("div");
		this.views.style.height = "100%";
		this.views.style.width = "100%";
		this.views.style.boxSizing = "border-box";
		this.views.style.paddingTop = ui.titleBarHeight * 1.5 + "px";

		this.element.appendChild(this.views);

		this.dataView = Snippet_View("data", this);
		this.dataView.updateTitle("Data");

		// let inputs = document.createElement("div");
		// inputs.className = "snippetsInputWrapper";
		// inputs.style.position = "absolute";
		// inputs.style.left = contentWidth + "px";
		// inputs.style.top = "0";
		// inputs.style.width = "300px";
		// inputs.style.minHeight = "100%";
		// inputs.style.padding = ui.titleBarHeight * 1.5 + 8 + "px 10px";
		// inputs.style.boxSizing = "border-box";
		// inputs.style.background = "lightgray";

		// this.inputs = inputs;
		// this.element.appendChild(inputs);



		// add wrapper for function execution information
		let ancestry = d3.select(this.element).append("svg")
			.attr("class", "snippetAncestry")
			.attr("height", ui.titleBarHeight * 1.5)
			.attr("width", data.width);

		this.ancestry = ancestry;

		// use mouse events normally
		this.passSAGE2PointerAsMouseEvents = true;

		// set up link to parent
		SAGE2_CodeSnippets.displayApplicationLoaded(this.id, this);

		this.createAncestorList();

		if (this.parentLink) {
			if (this.parentLink.getParent()) {
				this.updateTitle("VisSnippets: " + `snip[${this.parentLink.getSnippetID().split("-")[1]}](${this.parentLink.getParent().id}) ➔ ` + this.id);
			} else {
				this.updateTitle("VisSnippets: " + `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` + this.id);
			}
		} else {
			this.updateTitle("VisSnippets: " + this.state.snippetsID);
		}
	},

	load: function(date) {
		console.log("Snippets_Data> Load", this.state);
		this.refresh(date);
	},

	draw: function(date) {
	},

	getDataset: function (date) {
		// update with new data and draw
		return this.dataset;
	},

	updateDataset: function(data, date) {
		// update dataset
		this.dataset = data;

		this.errorBox.style.display = "none";

		let dataString = JSON.stringify(
			this.dataset,
			null,
			2
		) + "";

		// draw
		this.dataView.getElem().innerHTML = dataString.length > 500 ? 
			(dataString).substring(0, 1500) + "\n\n..." : 
			(dataString);

		// update any other views
		for (let link of Object.keys(this.viewLinks)) {
			link.udpate();
		}
		
		this.updateChildren();

		// refresh ancestor list (in case of name change)
		this.createAncestorList();
	},

	addView: function(viewID, link) {
		console.log("Snippets_Data.addView", viewID);

		this.viewLinks[viewID] = link;
		
		let newView = new Snippet_View("vis", this);

		link.setChild(newView);
		this.updateLayout();

		return newView;
	},

	updateChildren: function(date) {
		// update all children
		for (let childLink of this.childLinks) {
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

		if (this.parentLink) {
			if (this.parentLink.getParent()) {
				this.updateTitle("VisSnippets: " + `snip[${this.parentLink.getSnippetID().split("-")[1]}](${this.parentLink.getParent().id}) ➔ ` + this.id);
			} else {
				this.updateTitle("VisSnippets: " + `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` + this.id);
			}
		} else {
			this.updateTitle("VisSnippets: " + this.state.snippetsID);
		}
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
			height: ui.titleBarHeight * 1.5,
			ancestry,
			app: this
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

		// set content size to leave space for the inputs
		// let contentWidth = this.state.inputsOpen ? this.sage2_width - 300 : this.sage2_width;
		// this.content.style.width = contentWidth + "px";

		// this.inputs.style.left = contentWidth + "px";

		this.updateLayout();

		// update any other views (redraw with new size)
		for (let link of Object.values(this.viewLinks)) {
			link.update();
		}

		// update ancestor list size
		this.ancestry.attr("width", this.sage2_width);
		this.createAncestorList();

		this.refresh(date);
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
		SAGE2_CodeSnippets.outputAppClosed(this);
	},

	requestEdit: function(data) {
		// handled the same as a load request in the editor
		SAGE2_CodeSnippets.requestSnippetLoad(data.clientId, this.parentLink.getSnippetID());
	},

	changeLayout: function(data) {
		console.log("Update Layout:", data.layout);
		this.viewLayout = data.layout;

		this.updateLayout();

		this.getFullContextMenuAndUpdate();
	},

	updateLayout: function() {
		console.log("updateLayout", this.viewLayout);

		// update view layout by mode
		if (this.viewLayout === "tile") {
			console.log("tile mode")

			// make sure no views are hidden
			this.dataView.updateDisplay("block");
			for (let link of Object.values(this.viewLinks)) {
				link.getChild().updateDisplay("block");
			}

			let numViews = Object.values(this.viewLinks).length + 1;
			let viewHeight = (this.sage2_height - ui.titleBarHeight * 1.5) / numViews;
	
			this.dataView.resize(this.sage2_width, viewHeight);
	
			for (let link of Object.values(this.viewLinks)) {
				link.getChild().resize(this.sage2_width, viewHeight);
			}
		} else if (this.viewLayout === "tab") {
			// saved active view
			let activeID = this.activeView;

			let active = activeID === "data" ? this.dataView : this.viewLinks[activeID].getChild();

			this.dataView.updateDisplay("none");
			// this.dataView.updateVisibility("hidden");
			for (let link of Object.values(this.viewLinks)) {
				link.getChild().updateDisplay("none");
				// view.updateVisibility("hidden");
			}

			active.updateDisplay("block");
			// active.updateVisibility("visible");
			active.resize(this.sage2_width, this.sage2_height);
		}
	},

	changeActiveView: function(data) {
		this.activeView = data.view;
		console.log("changeActiveView", data.view, this.activeView);

		this.updateLayout();

		this.getFullContextMenuAndUpdate();
	},

	getContextEntries() {
		let entries = [
			{
				description: "Edit Snippet",
				// callback
				callback: "requestEdit",
				// parameters of the callback function
				parameters:  {}
			},
			{
				description: "View Layout",
				children: [
					{
						description: "Tabbed",
						callback: "changeLayout",
						parameters: {layout: "tab"},
						entryColor: this.viewLayout === "tab" && "lightblue"
					},
					{
						description: "Tiled",
						callback: "changeLayout",
						parameters: {layout: "tile"},
						entryColor: this.viewLayout === "tile" && "lightblue"
					}
				]
			}
		];

		console.log()

		if (this.viewLayout === "tab") {
			let childEntries = Object.keys(this.viewLinks).map(viewID => ({
					description: this.viewLinks[viewID].getChild().getTitle(),
					callback: "changeActiveView",
					parameters: {view: viewID},
					entryColor: this.activeView === viewID && "lightblue"
				}));
					
			childEntries.push({
					description: "Data View",
					callback: "changeActiveView",
					parameters: {view: "data"},
					entryColor: this.activeView === "data" && "lightblue"
				});

			console.log(childEntries);

			entries.push({
				description: "Active Tab",
				children: childEntries
			})
		}

		return entries;
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
			SAGE2_CodeSnippets.notifyUserDataClick(user_id, this.id);
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

// Snippets_Data.Snippet_View = function(viewType, link) {
// 	let self = {
// 		type
// 		link,
// 		el
// 	};

// 	function resize(width, height) {

// 	}

// 	return {
// 		resize
// 	};
// };

function Snippet_View(viewType, app) {
	let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);

	let self = {
		// link,
		type: viewType,
		title: "View Title",

		width: minDim / 4,
		height: minDim / 4,

		container: null,
		content: null,
		inputs: null,
		titlebar: null
	};

	init();

	function init() {
		let { width, height } = self;

		let contentWidth = app.state.inputsOpen ? width - 300 : width;

		self.container = document.createElement("div");
		self.container.style.position = "relative";
		self.container.style.width = width + "px";
		self.container.style.height = height + "px";
		self.container.style.border = "1px solid black";

		if (viewType === "data") {
			self.container.style.fontFamily = "monospace";
			self.container.style.whiteSpace = "pre";
		}

		self.content = document.createElement("div");
		self.content.style.width = contentWidth + "px";
		self.content.style.height = "100%";
		self.content.style.padding = `${ui.titleBarHeight + (viewType === "data" ? 10 : 0)}px ${viewType === "data" ? "10px" : 0} 0`;
		// self.content.style.padding = ui.titleBarHeight + "px 10px 0";
		self.content.style.boxSizing = "border-box";
		self.content.style.background = "white";
		// self.content.style.background = self.type === "data" ? "lightblue" : "lightgreen";
		self.content.style.fontSize = ui.titleBarHeight / 2 + "px";

		self.inputs = document.createElement("div");
		self.inputs.className = "snippetsInputWrapper";
		self.inputs.style.position = "absolute";
		self.inputs.style.left = contentWidth + "px";
		self.inputs.style.top = "0";
		self.inputs.style.width = "300px";
		self.inputs.style.minHeight = "100%";
		self.inputs.style.padding = "8px 10px";
		self.inputs.style.boxSizing = "border-box";
		self.inputs.style.background = "lightgray";

		self.titlebar = document.createElement("div");
		self.titlebar.style.position = "absolute";
		self.titlebar.style.left = "0";
		self.titlebar.style.top = "0";
		self.titlebar.style.width = "100%";
		self.titlebar.style.height = ui.titleBarHeight;
		self.titlebar.style.backgroundColor = "white";
		self.titlebar.style.border = "1px solid black";
		self.titlebar.style.fontSize = ui.titleBarHeight / 2 + "px";
		self.titlebar.style.fontFamily = "monospace";
		self.titlebar.style.padding = "3px";

		if (viewType === "data") {
			self.titlebar.style.backgroundColor = "rgb(203, 213, 232)";
			self.titlebar.style.border = "2px solid rgb(157, 176, 211)";
		} else {
			self.titlebar.style.backgroundColor = "rgb(253, 205, 172)";
			self.titlebar.style.border = "2px solid rgb(251, 167, 109)";
		}

		self.titlebar.innerHTML = "View Title";

		self.container.appendChild(self.content);
		self.container.appendChild(self.inputs);
		self.container.appendChild(self.titlebar);
		app.views.appendChild(self.container);
	}

	function getElem() {
		return self.content;
	}

	function getDimensions() {
		return {
			width: self.width,
			height: self.height
		};
	}

	function resize(width, height) {
		let contentWidth = app.state.inputsOpen ? width - 300 : width;

		self.width = width;
		self.height = height;

		console.log(width, height, self.width, self.height);
		
		self.container.style.width = width + "px";
		self.container.style.height = height + "px";

		self.content.style.width = contentWidth + "px";
		self.inputs.style.left = contentWidth + "px";
	}

	function updateVisibility(visibility) {
		self.container.style.visilibity = visibility;
	}


	function updateDisplay(display) {
		self.container.style.display = display;
	}
	
	function updateTitle(name) {
		self.title = name;

		self.titlebar.innerHTML = `<strong>${name}</strong> View`;
	}

	function getTitle() {
		return self.title;
	}

	return {
		getElem,
		getDimensions,
		getTitle,

		resize,
		updateVisibility,
		updateDisplay,
		updateTitle,

		displayError: app.displayError.bind(app),
		errorBox: app.errorBox,

		snippetVisElement: self.visElem
	};
};
