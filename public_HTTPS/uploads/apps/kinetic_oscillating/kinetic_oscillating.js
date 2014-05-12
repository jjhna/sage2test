// SAGE2 is available for use under the following license, commonly known
//          as the 3-clause (or "modified") BSD license:
//
// Copyright (c) 2014, Electronic Visualization Laboratory,
//                     University of Illinois at Chicago
// All rights reserved.
//
// http://opensource.org/licenses/BSD-3-Clause
// See included LICENSE.txt file

var kinetic_oscillating = SAGE2_App.extend( {
	construct: function() {
		this.timer  = null;
		this.redraw = null;
		this.stage  = null;
		this.layer  = null;
		this.blobs  = null;
		this.frame  = null;
		this.width  = null;
		this.height = null;
		this.resizeEvents = "onfinish";
		this.lastZoom = null;
	},

	init: function(id, width, height, resrc, date) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, id, "div", width, height, resrc, date);

		this.lastZoom = date;

		this.element.id = "div" + id;
		this.element.style.background = '#000';
		this.frame  = 0;
		this.width  = this.element.clientWidth;
		this.height = this.element.clientHeight;
		this.stage  = new Kinetic.Stage({container: this.element.id, width: this.width, height: this.height});
		this.layer  = new Kinetic.Layer();
		

		var colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
		this.blobs = [];

		// create 6 blobs
		for(var n = 0; n < 6; n++) {
			// build array of random points
			var points = [];
			for(var i = 0; i < 5; i++) {
				points.push(this.width  * Math.random());
				points.push(this.height * Math.random());
			}

			var blob = new Kinetic.Line({
							points: points,
							fill: colors[n],
							stroke: 'black',
							strokeWidth: 2,
							tension: 0,
							closed: true,
							opacity: Math.random(),
							draggable: true
						});

			this.layer.add(blob); 
			this.blobs.push(blob);
		}

		this.stage.add(this.layer);

		this.timer  = 0.0;
		this.redraw = true;
	},

	load: function(state, date) {
		
	},

	draw: function(date) {
		// call super-class 'preDraw'
		arguments.callee.superClass.preDraw.call(this, date);

		this.timer = this.timer + this.dt;
		if(this.timer >= 0.033333333) {
			this.timer  = 0.0;
			this.redraw = true;
		}
		
		if(this.redraw) {
			var period        = 2000;
			var amplitude     = 1;
			var centerTension = 0;

			for(var n = 0; n < this.blobs.length; n++) {
				this.blobs[n].setTension(amplitude * Math.sin(this.t*1000.0 * 2 * Math.PI / period) + centerTension);
			}

			this.stage.draw();
			this.frame++;
			this.redraw = false;
		}

		// call super-class 'postDraw'
		arguments.callee.superClass.postDraw.call(this, date);
	},


	resize: function(date) {
        this.stage.setSize({
			width : this.element.clientWidth,
   			height : this.element.clientHeight
		});
        var val = this.element.clientWidth/this.width;
		this.stage.setScale({x:val, y:val});

		this.redraw = true;
		this.draw(date);
	},
	
	event: function(eventType, userId, x, y, data, date) {
		// Scroll events for zoom
		if (eventType === "pointerScroll") {
			var amount = data.wheelDelta;
			var diff = date - this.lastZoom;
			if (amount >= 3 && (diff>100)) {
				// zoom in within the stage
				var scale = this.stage.scale();
				scale.x *= 1.2;
				scale.y *= 1.2;
				this.stage.setScale(scale);
				this.lastZoom = date;
			}
			else if (amount <= -3 && (diff>100)) {
				// zoom out within the stage
				var scale = this.stage.scale();
				scale.x *= 0.8;
				scale.y *= 0.8;
				this.stage.setScale(scale);
				this.lastZoom = date;
			}
		}
	}

});



