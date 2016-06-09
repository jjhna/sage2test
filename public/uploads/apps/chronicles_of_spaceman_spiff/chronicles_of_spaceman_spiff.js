// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

"use strict";

//
// simple image of the day / calvin and hobbes comic viewer
// Written by Andy Johnson - 2014-2016
//

/* global d3 */

var chronicles_of_spaceman_spiff = SAGE2_App.extend({

	initApp: function()	{
		this.nextCallbackFunc = this.nextCallback.bind(this);
		this.prevCallbackFunc = this.prevCallback.bind(this);

		this.loadFailCallbackFunc = this.loadFailCallback.bind(this);
		this.loadSuccessCallbackFunc = this.loadSuccessCallback.bind(this);
	},

	createURL: function(timeMachine)	{
		// var aURL = 'http://www.gocomics.com/calvinandhobbes/2015/10/19/'

		var baseURL = "http://www.gocomics.com/calvinandhobbes/";

		if (timeMachine > 0) {
			timeMachine = 0;
		}

		var today = new Date(new Date().getTime() + 24 * timeMachine * 60 * 60 * 1000);
		var todayPrint;

		var todayDay     = today.getDate().toString();			// days are 1 - 31
		var todayMonth   = (today.getMonth() + 1).toString();	// months are 0 - 11
		var todayYear    = today.getFullYear().toString();		// year is correct
		var todayHour    = today.getHours().toString();			// hours are 0-23
		var todayMinutes = today.getMinutes().toString();		// minutes are 0-59

		if (todayDay.length < 2) {
			todayDay = "0" + todayDay;
		}

		if (todayMonth.length < 2) {
			todayMonth = "0" + todayMonth;
		}

		if (todayMinutes.length < 2) {
			todayMinutes = "0" + todayMinutes;
		}
		this.today = todayYear + '/' + todayMonth + '/' + todayDay;
		this.todayPrint = todayYear + '/' + todayMonth + '/' + todayDay + ' ' + todayHour + ':' + todayMinutes;
		return (baseURL + this.today);
	},

	drawText: function(textLocX, textLocY, theText, textFontSize)	{
		var displayFont = "Arial";
		var drawTempText;

		drawTempText = "#000";

		this.sampleSVG.append("svg:text")
			.attr("x", parseInt(textLocX * 1))
			.attr("y", parseInt(textLocY * 1))
			.style("fill", drawTempText)
			.style("font-size", textFontSize)
			.style("font-family", displayFont)
			.style("text-anchor", "middle")
			.text(theText);
	},

	drawBox: function(boxLocX, boxLocY, boxHeight, boxWidth, colorOut, percOut)	{
		this.sampleSVG.append("svg:rect")
			.style("stroke", "black")
			.style("fill", colorOut)
			.style("fill-opacity", percOut)
			.attr("x", parseInt(boxLocX * 1))
			.attr("y", parseInt(boxLocY * 1))
			.attr("rx", 8)
			.attr("ry", 8)
			.attr("height", parseInt(boxHeight * 1))
			.attr("width", parseInt(boxWidth * 1));
	},


	drawBoxPrev: function(boxLocX, boxLocY, boxHeight, boxWidth, colorOut, percOut)	{
		this.sampleSVG.append("svg:rect")
			.style("stroke", "black")
			.style("fill", colorOut)
			.style("fill-opacity", percOut)
			.attr("x", boxLocX)
			.attr("y", boxLocY)
			.attr("rx", 8)
			.attr("ry", 8)
			.attr("height", boxHeight)
			.attr("width", boxWidth)
			.on("click", this.prevCallbackFunc);

		var firstX = boxLocX + 10;
		var secondX = boxLocX + boxWidth * 0.75 - 10;
		var thirdX = boxLocX + boxWidth * 0.75 - 10;

		var firstY = boxLocY + boxHeight * 0.5;
		var secondY = boxLocY + boxHeight * 0.5 - 10;
		var thirdY = boxLocY + boxHeight * 0.5 + 10;

		this.sampleSVG.append("polygon")
			.style("stroke", "black")
			.style("fill", "black")
			.attr("points", "" + firstX + "," + firstY + "," + secondX + "," + secondY + "," + thirdX + "," + thirdY)
			.on("click", this.prevCallbackFunc);
	},

	drawBoxNext: function(boxLocX, boxLocY, boxHeight, boxWidth, colorOut, percOut)	{
		this.sampleSVG.append("svg:rect")
			.style("stroke", "black")
			.style("fill", colorOut)
			.style("fill-opacity", percOut)
			.attr("x", boxLocX)
			.attr("y", boxLocY)
			.attr("rx", 8)
			.attr("ry", 8)
			.attr("height", boxHeight)
			.attr("width", boxWidth)
			.on("click", this.nextCallbackFunc);

		var firstX = boxLocX + boxWidth - 10;
		var secondX = boxLocX + boxWidth * 0.25 + 10;
		var thirdX = boxLocX + boxWidth * 0.25 + 10;

		var firstY = boxLocY + boxHeight * 0.5;
		var secondY = boxLocY + boxHeight * 0.5 - 10;
		var thirdY = boxLocY + boxHeight * 0.5 + 10;

		this.sampleSVG.append("polygon")
			.style("stroke", "black")
			.style("fill", "black")
			.attr("points", "" + firstX + "," + firstY + "," + secondX + "," + secondY + "," + thirdX + "," + thirdY)
			.on("click", this.nextCallbackFunc);
	},

	prevCallback: function()	{
		this.state.timeDiff -= 1;
		this.update();
	},

	nextCallback: function()	{
		this.state.timeDiff += 1;
		if (this.state.timeDiff > 0) {
			this.state.timeDiff = 0;
		}
		this.update();
	},

	loadSuccessCallback: function()	{
		// update the canvas with the image aspect ratio
		var newratio = this.image1.width / this.image1.height;
		this.canvasHeight = this.canvasWidth / newratio;
		// ask for a resize
		this.sendResize(this.sage2_width,
						this.sage2_width / (this.image1.width / (this.image1.height + 20)));
		// and draw
		this.drawEverything(1);
	},

	loadFailCallback: function() {
		this.drawEverything(0);
	},

	drawImage: function(theImage, loadSuccess)	{
		// if there is an image then show it, else show black
		if (loadSuccess) {
			this.sampleSVG.append("image")
				.attr("xlink:href", theImage)
				.attr("opacity", 1)
				.attr("x", 0)
				.attr("y", 0)
				.attr("width",  this.canvasWidth)
				.attr("height", this.canvasHeight);
		} else {
			this.drawBox(0, 0, this.canvasHeight, this.canvasWidth, "#ffffff", 1.0);
			this.drawText(0.5 * this.canvasWidth, 0.5 * this.canvasHeight + 22, "no comic today", 24);
		}

		this.drawBox(0, this.canvasHeight, 30, this.canvasWidth, "#fdae61", 1.0);
		this.drawText(0.5 * this.canvasWidth, this.canvasHeight + 22, "classic Calvin and Hobbes", 24);

		this.drawBoxPrev(0, this.canvasHeight, 30, 50, "#fdae00", 1.0);
		this.drawBoxNext(this.canvasWidth - 50, this.canvasHeight, 30, 50, "#fdae00", 1.0);

	},

	drawEverything: function(loadSuccess) {
		this.sampleSVG.selectAll("*").remove();

		this.drawImage(this.image1.src, loadSuccess);
	},

	update: function() {
		// get new image
		var newurl = this.createURL(this.state.timeDiff);
		//if (newurl !== this.URL) {
			this.URL = newurl;
			this.updateSlim();
		//}
	},

	updateSlim: function() {
		// Send the call to the master (i.e. plugin.js)
		if (isMaster && this.URL) {
			this.applicationRPC({url: this.URL}, "gotPicture", true);
		}
	},

	updateSlimNode: function(data) {
		if (data) {
			this.image1.onload  = this.loadSuccessCallbackFunc;
			this.image1.onerror = this.loadFailCallbackFunc;
			this.image1.src     = data;
		}
	},

	updateWindow: function() {
		var x = this.element.clientWidth;
		var y = this.element.clientHeight;

		var newWidth  = this.canvasWidth;
		var newHeight = this.canvasHeight + 30;

		// set background color for areas around my app (in case of non-proportional scaling)
		this.element.style.backgroundColor = this.canvasBackground;

		var box = "0,0," + newWidth + "," + newHeight;
		this.sampleSVG.attr("width", x)
			.attr("height", y)
			.attr("viewBox", box)
			.attr("preserveAspectRatio", "xMinYMin meet");

		this.updateSlim();
	},

	init: function(data) {
		this.SAGE2Init("div", data);

		this.resizeEvents = "continuous"; // onfinish
		this.svg = null;

		this.canvasBackground = "black";

		this.canvasWidth = 1200;
		this.canvasHeight = 380;

		this.sampleSVG = null;

		this.image1 = new Image();

		this.URL   = "";
		this.today = "";

		// update once per hour
		this.maxFPS = 0.0003;

		this.element.id = "div" + data.id;

		var newWidth  = this.canvasWidth;
		var newHeight = this.canvasHeight + 30;

		// attach the SVG into the this.element node provided to us
		var box = "0,0," + newWidth + "," + newHeight;
		this.svg = d3.select(this.element).append("svg:svg")
			.attr("width",   data.width)
			.attr("height",  data.height + 30)
			.attr("viewBox", box)
			.attr("preserveAspectRatio", "xMinYMin meet"); // new
		this.sampleSVG = this.svg;

		this.initApp();

		// this.update();
		this.draw_d3(data.date);
		this.controls.addButton({type: "next", position: 7, identifier: "Next"});
		this.controls.addButton({type: "prev", position: 1, identifier: "Prev"});
		this.controls.finishedAddingControls(); // Not adding controls but making the default buttons available

		// Send the call to the master (i.e. plugin.js)
		if (isMaster) {
			this.applicationRPC({url: this.URL}, "gotPicture", true);
		}
	},

	gotPicture: function(data) {
		if (data.err && data.err !== null) {
			console.log('Welcome> error');
			return;
		}
		// Set the picture URL
		this.updateSlimNode("data:image/gif;base64," + data.image);
	},

	load: function(date) {
		this.refresh(date);
	},

	draw_d3: function(date) {
		this.updateWindow();
	},

	draw: function(date) {
		this.update();
	},

	resize: function(date) {
		this.svg.attr('width',  this.element.clientWidth  + "px");
		this.svg.attr('height', this.element.clientHeight + "px");
	},

	showNextPage: function() {
		this.state.timeDiff += 1;
		if (this.state.timeDiff > 0) {
			this.state.timeDiff = 0;
		}
		this.update();
	},

	showPreviousPage: function() {
		this.state.timeDiff -= 1;
		this.update();
	},

	event: function(eventType, position, user, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// pointer press
		} else if (eventType === "pointerMove") {
			// pointer move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			if (position.x < 0.5 * this.element.clientWidth) {
				this.showPreviousPage();
			} else {
				this.showNextPage();
			}
			this.refresh(date);
		} else if (eventType === "widgetEvent") {
			switch (data.identifier) {
				case "Next":
					this.showNextPage();
					break;
				case "Prev":
					this.showPreviousPage();
					break;
				default:
					console.log("No handler for:", data.identifier);
			}
			this.refresh(date);
		}
	}

});
