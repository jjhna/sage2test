function PlannerButton(paper, imgUrl, callback, showImmediately) {
	this.paper = paper;
	this.width = 100;
	this.buttonBack = this.paper.rect(0, 0, 200, 200);
	/*this.buttonBack.attr({
		stroke: 'black',
		strokeWidth: 1,
		fill: "yellow"
	});
	/*fabric.Image.fromURL(imgUrl, function(obj) {
		this.buttonFace = obj;
		var bound = obj.getBoundingRect();
		//console.log(imgUrl, bound);
		//this.img
		this.imgMaxDim = bound.width > bound.height ? bound.width : bound.height;
		this.imgWidth = bound.width;
		this.imgHeight = bound.height;
		if (showImmediately === true) {
			this.show();
		}
	}.bind(this));*/
	this.buttonFace = this.paper.image(imgUrl, 0, 0, 200, 200);

	this.callback = callback;
	this.pressed = undefined;
	this.hovered = false;
	this.id = null;
	this.hide();
}

PlannerButton.prototype.addPressedState = function() {
	this.pressed = false;
};

PlannerButton.prototype.setSize = function(width, height) {
	this.width = width;
	this.height = height;
};

PlannerButton.prototype.setPosition = function(left, top) {
	this.left = left;
	this.top = top;
};

PlannerButton.prototype.isPointInside = function(x, y) {
	return (x > this.left && x <= (this.left + this.width) &&
		y > this.top && y <= (this.top + this.height));
};

PlannerButton.prototype.show = function() {
	if (this.pressed) {
		this.buttonBack.attr({fill: '#666666'});
	} else if (this.hovered) {
		this.buttonBack.attr({fill: '#6666aa'});
	} else {
		this.buttonBack.attr({fill: '#efefef'});
	}
	this.buttonBack.attr({
		x: this.left, y: this.top,
		width: this.width, height: this.height
	});
	this.paper.add(this.buttonBack);
	if (this.buttonFace) {
		this.buttonFace.attr({
			width: 0.7 * this.width, height: 0.7 * this.height,
			x: this.left + 0.15 * this.width, y: this.top + 0.15 * this.height
		});
		//this.buttonFace.attrCoords();
		this.paper.add(this.buttonFace);
		//this.canvas.bringToFront(this.buttonFace);
	}
	
	//this.canvas.requestRenderAll();
};

PlannerButton.prototype.hide = function() {
	this.buttonBack.remove();
	this.buttonFace.remove();
};

PlannerButton.prototype.hover = function() {
	if (this.hovered === false) {
		this.buttonBack.attr({fill: '#6666aa'});
		this.hovered = true;
	}
};

PlannerButton.prototype.hoverEnd = function() {
	if (this.hovered) {
		if (this.pressed === true) {
			this.buttonBack.attr({fill: '#666666'});
		} else {
			this.buttonBack.attr({fill: '#efefef'});
		}
		this.hovered = false;
	}
};
PlannerButton.prototype.click = function() {
	this.callback(this.id);
	if (this.pressed !== undefined) {
		if (this.pressed === true) {
			this.buttonBack.attr({fill: '#6666aa'});
		} else {
			this.buttonBack.attr({fill: '#666666'});
		}
		this.pressed = !this.pressed;
	}
};

function PlannerMenu(app, canvas, parameters) {
	this.canvas = canvas;
	this.buttons = [];
	this.buttonDict = {};
	this.app = app;
	var menuImgUrl = this.app.resrcPath + "images/menu.png";
	this.addButton('menu', menuImgUrl, this.toggleMenu.bind(this), true);
	this.buttons[0].addPressedState();

	this.menuShown = false;
	this.left = this.top = 0;
	this.width = this.height = 50;
	this.columns = parameters.columns || 3;
	this.buttonUnderPointer = null;
}



PlannerMenu.prototype.setPosition = function(position) {
	this.left = position.x || position.left;
	this.top = position.y || position.top;
	this.arrangeButtons();
};

PlannerMenu.prototype.setSize = function(size) { //Button size
	this.width = size.width;
	this.height = size.height;
	this.arrangeButtons();
}

PlannerMenu.prototype.addButton = function(id, imgUrl, callback, showImmediately) {
	var button = new PlannerButton(this.canvas, imgUrl, callback, showImmediately);
	this.buttons.push(button);
	//this.buttonSprites.push(button.buttonSprite);
	this.buttonDict[id] = button;
	button.id = id;
	//button.buttonSprite.userData.id = id;
};

PlannerMenu.prototype.reDraw = function() {
	this.buttons[0].pressed = false;
	this.menuShown = false;
	this.buttons[0].show();
};

PlannerMenu.prototype.moveTo = function(position) {
	this.hideMenu();
	this.setPosition(position);
	this.buttons[0].show();
}

PlannerMenu.prototype.showMenu = function() {
	if(this.menuShown === false) {
		this.buttons.forEach(b => {
			//console.log(b.id);
			b.show();
		});
	}
	this.menuShown = true;
};

PlannerMenu.prototype.hideMenu = function() {
	if(this.menuShown) {
		this.buttons.slice(1).forEach(b => {
			b.hide();
		});
	}
	this.menuShown = false;
};

PlannerMenu.prototype.toggleMenu = function() {
	if(this.menuShown) {
		this.hideMenu();
	} else {
		this.showMenu();
	}
};

PlannerMenu.prototype.arrangeButtons = function() {
	var col, row, multiple;
	var x, y, z;
	this.buttons[0].setSize(this.width, this.height);
	this.buttons[0].setPosition(this.left, this.top);
	this.buttons.slice(1).forEach((b, i) => {
		col = i % this.columns + 1;
		multiple = i + 1 - col;
		row = multiple / this.columns;
		b.setSize(this.width, this.height);
		x = this.left + this.width * col * 1.02;
		y = this.top + this.height * row * 1.02;
		//console.log(x, y);
		b.setPosition(x, y);
	});
	//this.canvas.requestRenderAll();
}

PlannerMenu.prototype.checkForButtonUnderPointer = function(x, y) {
	var buttonObjsLength = this.menuShown ? this.buttons.length : 1;
	var buttonUnderPointer = null;
	//console.log(x, y);
	for(var b = 0; b < buttonObjsLength; b++) {
		var bobj = this.buttons[b];
		if (bobj.isPointInside(x, y) === true) {
			buttonUnderPointer = bobj;
			//console.log(bobj.id);
			break;
		}
	}
	if (buttonUnderPointer !== null) {
		if (this.buttonUnderPointer && this.buttonUnderPointer.id !== buttonUnderPointer.id) {
			this.buttonUnderPointer.hoverEnd();
		}
		buttonUnderPointer.hover();
		this.buttonUnderPointer = buttonUnderPointer;
	} else if (this.buttonUnderPointer) {
		this.buttonUnderPointer.hoverEnd();
		this.buttonUnderPointer = null;
	}
}