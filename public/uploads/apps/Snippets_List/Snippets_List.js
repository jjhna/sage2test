//
// SAGE2 application: Snippets_List
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2017
//

"use strict";

/* global  */

var Snippets_List = SAGE2_App.extend({
	init: function (data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = "#525252";
		// this.element.style.backgroundColor = "orange";
		// this.element.style.padding = "5px 0";
		this.element.style.fontFamily = 'monospace';
		this.element.style.whiteSpace = "pre";
		this.element.style.boxSizing = 'border-box';

		this.cols = {};

		this.svg = d3.select(this.element)
			.append("svg")
			.attr("width", data.width)
			.attr("height", data.height)
			.style("background", "#525252");

		let colNames = ["gen", "data", "draw"];

		let bgColor = {
			gen: "#b3e2cd",
			data: "#cbd5e8",
			draw: "#fdcdac"
		};

		// alias this as that
		let that = this;

		this.svg
			.selectAll(".snippetTypeColGroup").data(colNames)
			.enter().append("g")
			.attr("class", "snippetTypeColGroup")
			.each(function (d, i) {
				let col = that.cols[d] = d3.select(this);

				col.attr("transform", `translate(0, ${i * 46})`)

				col.append("rect")
					.attr("class", "snippetTypeColBG")
					.attr("width", data.width)
					.attr("height", 46)
					.style("fill", bgColor[d])
					.style("opacity", 0.25)
					.style("stroke", "white");
			});

		console.log(this.cols);

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
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

	createBlockPath: function (type, width, offset) {
		let mult = [width, 30];

		let points = {
			gen: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1]
			],
			data: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1],
				[0.075, 0.5]
			],
			draw: [
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 1],
				[0.075, 0.5]
			]
		};

		return "M " + points[type].map(point =>
			point.map((coord, i) =>
				(coord * mult[i]) + offset[i]
			).join(" ")).join(" L ") + " Z";
	},

	updateFunctionBank: function (data, date) {
		// console.log("Snippets_List> Update Functions", data);

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

		let that = this;

		let lengths = {};
		let currentY = 0;

		for (let type of Object.keys(lightColor)) {
			let funcsOfType = Object.values(data).filter(f => f.type === type);

			lengths[type] = funcsOfType.length;

			// resize the column background
			let col = this.cols[type];

			let thisHeight = Math.max(38 * lengths[type] + 8, this.sage2_height / 3);
			col.select("rect")
				.datum(38 * lengths[type] + 8)
				.attr("height", thisHeight);

			col.attr("transform", `translate(0, ${currentY})`);
			currentY += thisHeight;
		}


		for (let type of Object.keys(lightColor)) {
			let col = this.cols[type];
			let funcs = Object.values(data).filter(f => f.type === type);

			let colWidth = that.sage2_width;

			col.selectAll(".snippetFuncBlock").remove();

			col.selectAll(".snippetFuncBlock")
				.data(funcs)
				.enter().append("g")
				.attr("class", "snippetFuncBlock")
				.each(function (d, i) {
					let group = d3.select(this);

					group.append("path")
						.attr("class", "snippetPath")
						.attr("d", that.createBlockPath(type, colWidth - 12, [6, i * 38 + 8]))
						.style("stroke-linejoin", "round")
						.style("fill", d.locked ? "#525252" : lightColor[d.type])
						.style("stroke-width", 3)
						.style("stroke", () => d.locked ? lightColor[d.type] : darkColor[d.type])
						.on("click", function (e) {
							SAGE2_CodeSnippets.notifyUserListClick(that.lastUserClick, d);
							that.lastUserClick = null;
						});

					let selectorWidth = (((colWidth - 10) * 0.8) - (d.selectors.length + 1) * 3) / d.selectors.length;

					group.selectAll(".snippetSelectors")
						.data(d.selectors)
						.enter().append("line")
						.attr("class", "snippetSelectors")
						.attr("y1", (1 + i) * 38 - 4)
						.attr("y2", (1 + i) * 38 - 4)
						.attr("x1", (d, i) => colWidth / 10 + ((selectorWidth + 3) * i) + 13)
						.attr("x2", (d, i) => colWidth / 10 + ((selectorWidth + 3) * i) + selectorWidth - 3)
						.style("stroke-width", 4)
						.style("stroke-linecap", "round")
						.style("stroke", d => d.color);

					group.append("text")
						.attr("class", "snippetName")
						.attr("x", colWidth / 2)
						.attr("y", (1 + i) * 38 - 9)
						.style("text-anchor", "middle")
						.style("font-weight", "bold")
						.style("font-size", "12px")
						.style("fill", d.locked ? lightColor[d.type] : "black")
						.style("pointer-events", "none")
						.text(`cS-${d.id.split("-")[1]}: ${d.desc}`);
				});
		}

	},

	load: function (date) {
		console.log("Snippets_List> Load with state value", this.state.value);
		this.refresh(date);
	},

	draw: function (date) {
		console.log('Snippets_List> Draw with state value', this.state.value);
	},

	resize: function (date) {
		// Called when window is resized
		let colWidth = this.sage2_width;
		let colHeight = this.sage2_height / 3;

		let that = this;

		this.svg
			.attr("height", this.sage2_height)
			.attr("width", this.sage2_width);

		let currentY = 0;

		this.svg.selectAll(".snippetTypeColGroup")
			.each(function (type) {
				d3.select(this).attr("transform", (d, i) => `translate(0, ${currentY})`);

				d3.select(this).selectAll(".snippetFuncBlock")
					.each(function (func, i) {


						d3.select(this).selectAll(".snippetPath")
							.attr("d", that.createBlockPath(type, colWidth - 10, [5, i * 38 + 8]))

						let selectorWidth = (((colWidth - 10) * 0.8) - (func.selectors.length + 1) * 3) / func.selectors.length;

						d3.select(this).selectAll(".snippetSelectors")
							.attr("x1", (d, i) => colWidth / 10 + ((selectorWidth + 3) * i) + 13)
							.attr("x2", (d, i) => colWidth / 10 + ((selectorWidth + 3) * i) + selectorWidth - 3)
							.style("stroke-width", 4)
							.style("stroke-linecap", "round")
							.style("stroke", d => d.color);

						d3.select(this).selectAll(".snippetName")
							.attr("x", colWidth / 2)
					});

				d3.select(this).selectAll(".snippetTypeColBG")
					.attr("width", colWidth)
					.attr("height", d => {
						let height = Math.max(d, colHeight);

						currentY += height;

						return height;
					});
			});

		// this.refresh(date);
	},

	move: function (date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function () {
		// Make sure to delete stuff (timers, ...)
		SAGE2_CodeSnippets.unregisterSnippetListApp(this.id);
	},

	event: function (eventType, position, user_id, data, date) {
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