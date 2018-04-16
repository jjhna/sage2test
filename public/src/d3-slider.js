// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2017

"use strict";

/**
 * SAGE2 Performance monitoring display
 *
 * @module client
 * @submodule Slider
 */

/*global d3: true */


/**
 * Global variables
 */

//One object that holds all performance related information



function Slider(svg, box, margin) {
	this.svg = svg;
	this.box = box || {
		left: 0,
		top: 0,
		width: +svg.attr("width"),
		height: +svg.attr("height")
	};
	this.margin = margin || {
		right: 60,
		left: 20
	};

	this.scale = d3.scaleTime()
		.range([0, this.box.width - this.margin.right - this.margin.left])
		.clamp(true);

	this.startScale = d3.scaleLinear()
		.clamp(true);

	function moveHandle(h) {
		this.sliderHandle.attr("x", this.startScale(h));
	}

	this.makeSlider = function() {
		this.svg.selectAll("g").remove();

		this.sliderGroup = this.svg.append("g")
			.attr("class", "slider")
			.attr("transform", "translate(" + this.margin.left + "," + this.box.height / 4 + ")");

		this.sliderGroup.append("line")
			.attr("class", "track")
			.attr("x1", this.scale.range()[0])
			.attr("x2", this.scale.range()[1])
			.select(function() {
				return this.parentNode.appendChild(this.cloneNode(true));
			})
			.attr("class", "track-inset")
			.select(function() {
				return this.parentNode.appendChild(this.cloneNode(true));
			})
			.attr("class", "track-overlay")
			.call(d3.drag()
				.on("start.interrupt", function() {
					this.sliderGroup.interrupt();
				}.bind(this))
				.on("drag", function() {
					moveHandle.bind(this)(this.scale.invert(d3.event.x));
				}.bind(this))
				.on("end", function() {
					var l = this.scale.invert(d3.event.x);
					var clampedL = Math.min(l, this.startScale.domain()[1]);
					var h = this.scale.invert(this.startScale(clampedL) + this.handleWidth);
					this.onValueChange(clampedL, h);
				}.bind(this)));

		this.sliderGroup.insert("g", ".track-overlay")
			.attr("class", "ticks")
			.attr("transform", "translate(0," + 25 + ")")
			.selectAll("text")
			.data(this.scale.ticks(8))
			.enter().append("text")
			.attr("x", this.scale)
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d3.timeFormat("%X")(d);
			});

		this.sliderHandle = this.sliderGroup.insert("rect", ".track-overlay")
			.attr("class", "handle")
			.attr("width", this.handleWidth)
			.attr("height", 18)
			.attr("y", -9)
			.attr("rx", 6)
			.attr("ry", 6);
	};

	this.setRange = function(min, max) {
		this.scale.domain([min, max]);
		var extent = (max - min) / 60000; // ms to minutes
		var handleRatio;
		if (extent < 5) {
			handleRatio = 1;
		} else {
			handleRatio = 5 / extent;
		}

		this.handleWidth = Math.round(handleRatio * (this.scale.range()[1] - this.scale.range()[0]));
		console.log(this.handleWidth, handleRatio);
		// Possible values of handle's start
		this.startScale.range([0, this.scale.range()[1] - this.handleWidth]);

		this.startScale.domain([min, this.scale.invert(this.startScale.range()[1])]);
		console.log(this.scale.domain(), this.scale.range());
		this.makeSlider();
	};

	this.getValues = function() {
		return {
			l: this.scale.invert(+this.sliderHandle.attr("x")),
			h: this.scale.invert(+this.sliderHandle.attr("x") + this.handleWidth)
		};
	};
	this.onValueChange = function(l, h) {
		console.log(l, h);
	};
}

