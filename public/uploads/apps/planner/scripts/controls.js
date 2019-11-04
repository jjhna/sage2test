
function ControlPanel(app) {
	this.app = app;
	this.menuAreaWrap = document.createElement("div");
	this.menuAreaWrap.style.position = "absolute";
	this.menuAreaWrap.style.display = "block";
	this.app.element.appendChild(this.menuAreaWrap);
	
	this.menuArea = document.createElement("canvas");
	this.menuArea.id = app.id + "_menuArea";
	
	this.menuAreaWrap.appendChild(this.menuArea);
	this.menuAreaWrap.style.top = "30px";
	this.menuAreaWrap.style.left = "40px";
	var canvas = this.canvas = new fabric.Canvas(this.menuArea.id, {
		selection: false
	});

	function fakeContainsPointFunction(point) { 
		var isTransparent = canvas.isTargetTransparent(this, point.x, point.y);
		return !isTransparent; 
	}
	
}

ControlPanel.prototype.init = function(options) {
	this.panelHeight = parseInt(this.menuArea.style.height);
	this.panelWidth = parseInt(this.menuArea.style.width);
	this.sideMargin = options.sideMargin || 10;
	this.topMargin = options.topMargin || 10;
	this.buttons = {};
};

ControlPanel.prototype.connectToStateMachine = function(sm) {
	this.sm = sm;
	sm.connectToControlPanel(this);
};


ControlPanel.prototype.populate = function(buttons) {
	
	var options = {
		left: 0,
		top: 0,
		height: 100,
		width: 100,
		strokeWidth: 2,
		textFill: 'black',
	};
	buttons.forEach(b => {
		options.id = b.id;
		options.label = b.text;
		this.addButton(b.id, options);
	});
	this.canvas.requestRenderAll();
};
ControlPanel.prototype.addButton = function(id, options) {
	var button = new Button(options);
	this.buttons[id] = button;
	this.canvas.add(button);
};

ControlPanel.prototype.resize = function(dim) {
	var menuWidth = 0.20 * (this.app.sage2_width - 120);
	this.canvas.setHeight(parseInt(this.app.sage2_height - 60)); 
	this.canvas.setWidth(parseInt(menuWidth)); 
	this.panelHeight = parseInt(this.menuArea.style.height);
	this.panelWidth = parseInt(this.menuArea.style.width);
	this.draw();
};

ControlPanel.prototype.draw = function() {
	this.canvas.clear();
	this.canvas.setBackgroundColor("#efefef");
	var top = this.topMargin;
	var left = this.sideMargin;
	var column = 1;
	
	var buttonIds = Object.keys(this.buttons);
	if (buttonIds.length > 0) {
		var height = (this.panelHeight - this.topMargin) / (buttonIds.length / column) - this.topMargin;
		var width = (this.panelWidth - (column + 1) * this.sideMargin) / column;
		
		buttonIds.forEach(b => {
			this.buttons[b].set({
				left: left,
				top: top,
				height: height,
				width: width
			});
			top = top + height + this.topMargin;
			if (top + height > this.panelHeight) {
				top = this.topMargin;
				left = left + width + this.sideMargin;
			}
			this.canvas.add(this.buttons[b]);
		});

	}
	this.canvas.requestRenderAll();
};

ControlPanel.prototype.processClick = function(point) {
	var x = point.x - parseInt(this.menuAreaWrap.style.left);
	var y = point.y - parseInt(this.menuAreaWrap.style.top);
	var point = new fabric.Point(x, y);
	var buttonObjs = this.canvas.getObjects('button');
	var clickedButton = null;
	for(var b = 0; b < buttonObjs.length; b++) {
		var bobj = buttonObjs[b];
		if (this.canvas.isTargetTransparent(bobj, x, y) === false) {
			clickedButton = bobj;
			break;
		}
	}
	console.log('button click', clickedButton);
	if (clickedButton !== null) {
		console.log(clickedButton.id);
		this.sm.transition(clickedButton.id);
		this.setActive(clickedButton.id);
	}
};

ControlPanel.prototype.setActive = function(id) {
	var state;
	for (var key in this.buttons) {
		if (key === id) {
			state = true;
		} else {
			state = false;
		}
		this.buttons[key].setState(state);
	}
	this.draw();
}

