//
// SAGE2 application: JupyterLab
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2015
//
/* global Prism */

"use strict";

var JupyterCodeCell = SAGE2_App.extend({
	init: function (data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'white';
		this.element.style.margin = '0 auto';
		// this.element.style.display = 'flex';
		// this.element.style.justifyContent = 'center';

		this.updateTitle("Jupyter Code Cell");

		let {
			index,
			cell,
			metadata
		} = data.state;

		let cellOutputs = cell.outputs;
		let language = metadata.language_info.name;

		if (cellOutputs[0]) {
			let cellData = cellOutputs[0].data;

			if (cellData && cellData["image/png"]) {
				this.img = document.createElement("img");
				this.img.style.width = "100%";
				this.img.style.height = "auto";

				this.img.src = "data:image/png;base64, " + cellData["image/png"];
				this.element.appendChild(this.img);
			} else if (cellData && cellData["text/html"]) {
				this.element.innerHTML = cellData["text/html"];
			}
		} else {
			this.codeVisible = true;
		}

		// add code view holder
		this.codeView = document.createElement("div");
		this.codeView.style.position = "absolute";
		this.codeView.style.left = 0;
		this.codeView.style.top = 0;
		this.codeView.style.right = 0;
		this.codeView.style.bottom = 0;

		this.codeView.style.whiteSpace = "pre-line";
		this.codeView.style.backgroundColor = "#fffa";
		this.codeView.style.padding = "20px";
		this.codeView.style.fontFamily = "'Oxygen Mono'";
		this.codeView.style.fontWeight = "bold";
		this.codeView.style.opacity = this.codeVisible ? 1 : 0;
		this.codeView.style.transition = "opacity 250ms";
		this.codeView.style.overflowY = "auto";

		this.codeView.innerHTML = Prism.highlight(
			cell.source.join(""),
			Prism.languages[language],
			language
		);

		this.cellLabel = document.createElement("div");
		this.cellLabel.style.position = "absolute";
		this.cellLabel.style.left = 0;
		this.cellLabel.style.bottom = 0;

		this.cellLabel.style.background = "#b2df8a";
		this.cellLabel.style.padding = "2px 4px 4px 8px";
		this.cellLabel.style.borderRadius = "0 8px 0 0";
		this.cellLabel.style.boxShadow = "2px -1px 6px 1px #6668";
		this.cellLabel.style.color = "#333";
		this.cellLabel.style.fontFamily = "'Arimo'";

		this.cellLabel.innerHTML = cell.cell_type +
			`<i class="fas fa-code"></i> <span style="font-family: 'Courier New';font-weight:bold;">[${+index +
		1}]</span>`;

		// this.element.appendChild(this.img);
		this.element.appendChild(this.codeView);
		this.element.appendChild(this.cellLabel);

		// this.codeVisible = false;

		// this.updateContent({
		//   src: data.state.src,
		//   code: data.state.code,
		//   height: data.height,
		//   width: data.width,
		//   title: data.title
		// });

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;
	},

	load: function (date) {
		// console.log('JupyterLab> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function (date) {
		// console.log('JupyterLab> Draw with state value', this.state.value);
	},

	toggleShowCode: function () {
		this.codeVisible = (!this.state.cell.outputs.length) || !this.codeVisible;

		if (this.codeVisible && this.state.cell.source.length) {
			this.codeView.style.opacity = 1;
		} else {
			this.codeView.style.opacity = 0;
		}
	},

	getContextEntries: function () {
		var entries = [];

		// Show overlay with EXIF data
		entries.push({
			description: "Show Code",
			callback: "toggleShowCode",
			accelerator: "C",
			parameters: {}
		});

		entries.push({
			description: "Copy Source",
			callback: "SAGE2_copyURL",
			parameters: {
				url: this.state.cell.source.join("")
			}
		});

		return entries;
	},

	updateContent: function (data, date) {
		// update title with nb/cell name
		this.updateTitle("JupyterLab Cell - " + data.title);

		// calculate new size
		// let newAspect = data.width / data.height;

		// // resize for new image aspect ratio
		// if (newAspect > this.imgAspect) { // wider
		//   this.sendResize(this.sage2_height * newAspect, this.sage2_height);
		// } else { // taller
		//   this.sendResize(this.sage2_width, this.sage2_width / newAspect);
		// }

		// // update image
		// this.img.src = data.src.trim(); // update image contents
		// this.img.style.width = this.sage2_width;
		// this.img.style.height = this.sage2_height;

		// this.codeView.innerHTML = Prism.highlight(this.state.code, Prism.languages.python, 'python');

		// // save aspect ratio
		// this.imgAspect = newAspect;
	},

	resize: function (date) {
		// Called when window is resized
		// this.img && (this.img.style.width = this.sage2_width + "px");
		// this.img && (this.img.style.height = this.sage2_height + "px");

		// this.refresh(date);
	},

	move: function (date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function () {
		// Make sure to delete stuff (timers, ...)
	},

	event: function (eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
		} else if (eventType === "pointerMove" && this.dragging) {
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom

			// console.log("scroll", data);
			this.codeView.scrollTop += data.wheelDelta;

		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 67 && data.state === "down") {
				// c

				this.toggleShowCode();
			}
		} else if (eventType === "dataUpdate") {
			console.log("JupyterLab Data Update", data);

			this.state.src = data.state.src;
			this.state.code = data.state.code;

			this.updateContent(data, date);
			this.refresh(date);
		}
	}
});
