// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2015

var web_earth = SAGE2_App.extend( {
	construct: function() {
		arguments.callee.superClass.construct.call(this);

		this.resizeEvents = "onfinish";
		this.map          = null;
		this.ready        - null;
	},

	init: function(data) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, "div", data);

		// application specific 'init'
		this.element.id = "div" + data.id;

		// building up the state object
		this.state.zoomLevel = null;
		this.state.center    = null;

		this.maxFPS = 20.0;
		this.ready  = false;
		this.controls.finishedAddingControls();
	},

	initialize: function() {
	},

	updateMapFromState: function() {
		console.log('Map> updateMapFromState');
		this.map = new WE.map(this.element.id, {sky:true, atmosphere:true});
		this.map.setView([this.state.center.lat,this.state.center.lng], this.state.zoomLevel);
		WE.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
			attribution: '© OpenStreetMap contributors'
		}).addTo(this.map);
		this.ready = true;
		console.log(this.map);
	},

	load: function(state, date) {
		if (state) {
			this.state.zoomLevel = state.zoomLevel;
			this.state.center    = state.center;
		}
		this.updateMapFromState();
	},

	draw: function(date) {
		if (this.ready) {
			// Make it rotate
			var c = this.map.getPosition();
			c[1] += 3.0 * this.dt;
			this.map.setCenter([c[0], c[1]]);
		}
	},

	resize: function(date) {
		// Update the size of the internal canvas
		this.map.canvas.width  = this.element.clientWidth;
		this.map.canvas.height = this.element.clientHeight;
		// redraw
		this.refresh(date);
	},

	updateCenter: function () {
		//var c = this.map.getCenter();
		//this.state.center = {lat:c.lat(), lng:c.lng()};
	},

	quit: function() {
		// Make sure to delete timers when quitting the app
	},

	event: function(eventType, position, user_id, data, date) {
		//console.log("Web earth event", eventType, position, user_id, data, date);
		var z;

		if (eventType === "pointerPress" && (data.button === "left")) {
			this.refresh(date);
		}
		else if (eventType === "pointerMove" && this.dragging) {
			this.refresh(date);
		}
		else if (eventType === "pointerRelease" && (data.button === "left")) {
			this.refresh(date);
		}

		// Scroll events for zoom
		else if (eventType === "pointerScroll") {
			this.scrollAmount += data.wheelDelta;

			if (this.scrollAmount >= 128) {
				// zoom out
			}
			else if (this.scrollAmount <= -128) {
				// zoom in
			}

			this.refresh(date);
		}

		else if (eventType === "keyboard") {
			if(data.character === "m") {
			}
			else if (data.character === "t") {
			}
			else if (data.character === "w") {
			}

			this.refresh(date);
		}

		else if (eventType === "specialKey") {
			if (data.code === 18 && data.state === "down") {      // alt
				// zoom in
			}
			else if (data.code === 17 && data.state === "down") { // control
				// zoom out
			}
			else if (data.code === 37 && data.state === "down") { // left
			}
			else if (data.code === 38 && data.state === "down") { // up
			}
			else if (data.code === 39 && data.state === "down") { // right
			}
			else if (data.code === 40 && data.state === "down") { // down
			}
			this.refresh(date);
		}
	}
});

