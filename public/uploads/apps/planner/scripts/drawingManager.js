function DrawingManager(app, serverStr) {
	this.app = app;
	this.serverStr = serverStr;
	this.drawingAreaWrap = document.createElement("div");
	this.drawingAreaWrap.style.position = "absolute";
	this.drawingAreaWrap.style.display = "block";
	//this.drawingAreaWrap.style.backgroundColor = "#efefef";
	this.app.element.appendChild(this.drawingAreaWrap);

	var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute('width', '100%');
	svg.setAttribute('height', '100%');
	svg.setAttribute('style', "border: 1px solid black; background-color: #efefef");
	svg.setAttribute('viewBox', '0 0 1000 1000');
	svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
	this.drawingArea = svg;
	
	this.drawingArea.id = app.id + "_drawingArea";
	
	this.drawingAreaWrap.appendChild(this.drawingArea);
	
	
	this.drawingAreaWrap.style.top = "30px";


	this.point = {x: 0, y: 0};
	this.gridSize = 30;
	this.zoomLevel = 5;
	this.divisions = 40;
	this.size = 400 * this.divisions; // feet
	this.maxZoom = 40;
	this.minZoom = 1;
	this.dAPaper = Snap('#' + this.drawingArea.id);
	this.dAPaper.attr({
		fill: "#efefef"
	});
	this.structure = {
		walls: {},
		doorsAndWindows: {},
		furnitures: {},
		flags: {}
	};
	this.canvasObjects = {
		walls: {},
		doorsAndWindows: {},
		furnitures: {},
		flags: {},
		measurements: {}
	};
	this.ruler = {
		top: [],
		bottom: [],
		left: [],
		right: []
	};
	this.pickedUpItem = null;
	this.pickupFurnitureOrFlagType = null;
	this.updateCounter = 0;
	this.frameCount = 0;
	this.flagTimeOut = 1000 * 60 * 3; // Three minutes
	this.clientId = getUniqueId2D('CM'); //Potential bug if more clients of same type join
	this.computeSizesAndLengths();
	this.init();
	this.createMenu();
	this.drawGrid();
	this.resize();
	this.buildStructure(this.app.state.structure);
	this.zoomLevel = this.app.state.zoomLevel;
	this.zoom(0);
	this.wsio = new WebSocket(serverStr);
	this.setupServerConnection();
};
DrawingManager.prototype.init = function() {
	this.sm = new fsm();
	this.sm.init(9, 16); // Six states, 7 kinds of input
	this.sm.setInputMap({
		WL: 0,
		s: 1, S: 1,
		pointerPress: 2,
		pointerMove: 3,
		pointerRelease: 4,
		pointerDblClick: 5,
		pointerRtClick: 6,
		x: 7, X: 7,
		pointOfInterest: 8,
		DR: 9,
		WD: 10,
		dwSelected: 11,
		fSelected: 12,
		fCreate: 13,
		leftArrow: 14,
		rightArrow: 15
	});
	
	this.sm.copyTransitions([
	   //W, S, dn, mv, up, db, rt,  x, poi, D,  I, dws,fsl,f1, <-, ->
		[1,	0, 	3, 	0, 	0, 	0, 	0, 	0, 	0, 	5, 	5,	6,	8,	7,	0,	0], // Selection
		[1,	0, 	2, 	1, 	1, 	1, 	1, 	1, 	1, 	5, 	5, 	1, 	1, 	7,	1,	1], // Start Wall
		[1,	0, 	2, 	2, 	2, 	1, 	1, 	1, 	2, 	2, 	2, 	2, 	2, 	2,	2,	2], // Draw Wall
		[3,	3, 	3, 	3, 	0, 	3, 	0, 	0, 	4, 	3, 	3, 	6,  8,	3,	3,	3], // Start Selection Rectangle
		[1,	0, 	0, 	4, 	4, 	4, 	0, 	0, 	4, 	5, 	5, 	4, 	4, 	4,	4,	4], // Edit Wall
		[5,	5, 	5, 	5, 	5, 	5, 	0, 	0, 	5, 	5, 	5, 	0, 	5, 	5,	5,	5], // Add door or Window
		[6,	6, 	6, 	5, 	0, 	6, 	6, 	6, 	6, 	6, 	6, 	6, 	6, 	6,	6,	6], // Edit door or window
		[7,	7, 	7, 	7, 	7, 	7, 	0, 	0, 	7, 	7, 	7, 	7,  0, 	7,	7,	7], // Add Furniture
		[8,	8,	8,	7,	0,	8,	8,	8,	8,	8,	8,	8,	8,	8,	8,	8],  // Edit door or window
	]);
	this.sm.setActionContext(this);
	this.sm.defaultActionOnStateChange('updateHelpText');
	this.sm.copyActions([
		[null, null, 'select', null, null, null, null, 'deleteSelection', null, 'pickupDoor', 'pickupWindow', null, null, 'pickupFurnitureOrFlag', 'rotateLeftSelectedItem', 'rotateRightSelectedItem'],
		[null, null, ['startNewWall','pushPoint'], null, null, null, null, null, null, 'pickupDoor', 'pickupWindow', null, null, 'pickupFurnitureOrFlag', null, null],
		['popPoint', 'popPoint', ['pushPoint', 'saveWall', 'startNewWall', 'pushPoint'], null, null, ['pushPoint','saveWall'], 'popPoint', 'popPoint', null, null, null, null, null, null, null, null],
		[null, null, null, null, 'deSelect', null, null, null, 'editWall', null, null, null, null, null, null, null],
		[['pushPoint','saveWall'], ['pushPoint','saveWall'], ['pushPoint','saveWall'], null, null,  ['pushPoint','saveWall'], null, 'popPoint', null, ['resetWall', 'pickupDoor'], ['resetWall', 'pickupWindow'], null, null, null, null, null],
		[null, null, null, 'alignDoorOrWindowOnWall', 'setDoorOrWindow', null, 'dropItem', 'dropItem', null, null, null, null, null, null, null, null],
		[null, null, null, 'pickupSelectedItem', null, null, null, null, null, null, null, null, null, null, null, null],
		[null, null, 'setPickedUpItem', null, null, null, 'dropItem', 'dropItem', null, null, null, null, null, null, null, null],
		[null, null, null, 'pickupSelectedItem', null, null, null, null, null, null, null, null, null, null, null, null]

	]);


	this.geometry = new Geometry();
	this.geometry.init({pointSensitivity: 1});
	// Standby walls to help with interface
	this.rubberbandWall = this.dAPaper.line(0, 0, 1, 1);
	this.rubberbandWall.attr({
		strokeWidth: 3,
		stroke: 'rgba(120, 120, 200, 1.0)'
	});
	this.rubberbandWallMeasurement = this.dAPaper.text(0, 0, "");
	this.rubberbandWallMeasurement.attr({
		fill: 'black',
		fontSize: 10,
		textBackgroundColor: '#efefef'
	});
	this.selectionArea = this.dAPaper.rect(0, 0, 1, 1);
	this.selectionArea.attr({
		id: 'selectionRect',
		fill: 'rgba(180, 180, 200, 0.3)',
		stroke: 'rgba(180, 180, 200, 0.6)',
		strokeWidth: 1
	});
	this.helpText = this.dAPaper.text(0, 0, "");
	this.helpText.attr({
		fill: 'black',
		textBackgroundColor: "#efefef",
		fontSize: 10
	});
	this.selectedObjectDescriptor = this.dAPaper.text(0, 0, "");
	this.selectedObjectDescriptor.attr({
		fill: 'black',
		textBackgroundColor: "#efefef",
		fontSize: 10
	});
	//this.pointHighlight = this.dAPaper.circle(0, 0, 50);
	//this.pointHighlight.attr("fill", 'red');
	//console.log(this.pointHighlight);
	this.helpDict = {
		0: "Selection mode",
		1: "click to start wall",
		2: "click to complete wall and start a new one, x to cancel",
		3: "Selection mode",
		4: "click to complete wall",
		5: "Move on wall to align, click to place, x to remove",
		6: "Move on wall to align, click to place, x to remove",
		7: "Click to place item, x to remove",
		8: "Click to place item, x to remove",
		9: "Drag horizontally to rotate selected item"
	};

	this.outerWallOptions = {
		id: null,
		strokeWidth: this.wallThickness,
		stroke: 'black',
		originX: 'center',
		originY: 'center'
	};
	this.currentWall = null;
	
	
	this.clients = {};

	this.directionSymbol = new PlannerButton(this.dAPaper, this.app.resrcPath + 'images/north.svg', null, true);
	this.showUI();
};

DrawingManager.prototype.createMenu = function() {
	var menu = new PlannerMenu(this.app, this.dAPaper, {columns: 4});
	var buttonSize = this.negateZoom({x: 80, y: 80});
	menu.setSize({width: buttonSize.x, height: buttonSize.y});

	this.menu = menu;
	var assests = Planner2D_getAssetList();
	assests.forEach(idata => {
		this.menu.addButton(idata.id, this.app.resrcPath + idata.iconUrl, function(type) {
			if (type === 'S' || type === 'WL' || type === 'DR' || type === 'WD') {
				this.sm.transition(type);
			} else {
				this.setPickupFurnitureType(type);
				this.sm.transition('fCreate');
				console.log(type);
			}
		}.bind(this));
	});
};

DrawingManager.prototype.updateSelectionText = function(obj) {
	var selectedObjText = "";
	if (obj !== null) {
		var id = obj.attr("id");
		selectedObjText = "Selected: ";
		selectedObjText = selectedObjText + Planner2D_getItemTypeName(id);
		var type = this.getType(id);
		if (type === 'walls') {
			var len = Planner2D_wallLengthFormatted(this.structure.walls[id]);
			selectedObjText = selectedObjText + ',\n Length: ' + len;	
		} else if (type === 'furnitures') {
			selectedObjText = selectedObjText + ',\n Use <- -> keys to rotate, X to delete, Click and drag to pick up.'
		} else if (type === 'doorsAndWindows') {
			selectedObjText = selectedObjText + ',\n X to delete, Click and drag to pick up.';
		}
	}
	this.selectedObjectDescriptor.attr({text: selectedObjText});
}



DrawingManager.prototype.setActiveObject = function(obj) {
	this.discardActiveObject();
	this.activeObject = obj;
	if (this.activeObject) {
		this.activeObjectStrokeColor = this.activeObject.attr("stroke");
		this.activeObjectFillColor = this.activeObject.attr("fill");
		this.activeObject.attr("stroke", "blue");
		this.activeObject.attr("fill", "rgba(120, 120, 230, 1.0)");
		this.updateSelectionText(obj);
	}
};

DrawingManager.prototype.getActiveObject = function() {
	return this.activeObject;
};

DrawingManager.prototype.discardActiveObject = function() {
	if (this.activeObject) {
		this.activeObject.attr("stroke", this.activeObjectStrokeColor);
		this.activeObject.attr("fill", this.activeObjectFillColor);	
	}	
	this.activeObject = null;
	this.updateSelectionText(null);
};

DrawingManager.prototype.draw = function() {
	//var selectedObject = this.getActiveObject();
	//this.dAPaper.clear();
	//this.drawGrid();
	//this.drawStructure();
	//this.drawMeasurements();
	//this.setActiveObject(selectedObject);
	//this.directionSymbol.show();
	//this.menu.reDraw();
	//this.dAPaper.add(this.helpText);
	//this.dAPaper.add(this.selectedObjectDescriptor);
	//this.drawClients();
};


DrawingManager.prototype.drawClients = function() {
	for (var c in this.clients) {
		if (this.clients.hasOwnProperty(c) === true) {
			var type = c.slice(2, 4);
			this.clients[c].item.set({
				left: this.clients[c].point.x * this.gridSize,
				top: this.clients[c].point.y * this.gridSize,
				width: this.clientDim[type].width,
				height: this.clientDim[type].height
			});
			this.clients[c].item.rotate(this.clients[c].angle);
			this.dAPaper.add(this.clients[c].item);
		}
	}
};

DrawingManager.prototype.update = function(date) {
	//Called by the SAGE2 animation loop
	this.timestamp = date;
	this.drawRubberbandWall();
	this.movePickedUpItem();
	var point = this.toFeetAfterZoom(this.point);
	this.menu.checkForButtonUnderPointer(point.x, point.y);
	var data = this.toGrid(this.point);
	if (this.pointChanged === true) {
		this.sendData('setPoint', {id: this.clientId, point: data});
		this.pointChanged = false;
	}
	if (this.pickedUpItem) {
		var id = this.pickedUpItem.item.attr("id");
		var type = this.getType(id);
		this.sendData('transformElement', this.structure[type][id]);
	}
	
	var oldFlagsIds = this.app.state.structure.flags.filter(x => {
		return (date - x.touchedAt) > this.flagTimeOut; 
	}).map(x => {
		return x.id;
	});

	oldFlagsIds.forEach(x => {
		this.removeElement(x);
		this.sendData('removeElement', {id: x});
		this.app.SAGE2Sync(false);
	});
	
	/*this.updateCounter++;
	
	if (this.updateCounter > 60) {
		this.updateCounter = 0;
		this.frameCount++;
		this.sendData('canvasImage', {
			frame: this.frameCount,
			img: this.drawingArea.toDataURL('image/jpeg', 0.6),
			type: '2D'
		});
	}*/
}

DrawingManager.prototype.drawStructure = function() {
	var walls = this.structure.walls;
	var key;
	delete this.outerWallOptions["id"];
	for (key in walls) {
		console.log(key);
		if (walls.hasOwnProperty(key) === true) {
			var el = this.canvasObjects.walls[key];
			var list = this.geometry.getXYListForPoints(this.structure.walls[key].points, this.gridSize);
			this.outerWallOptions.x1 = list[0];
			this.outerWallOptions.y1 = list[1];
			this.outerWallOptions.x2 = list[2];
			this.outerWallOptions.y2 = list[3];
			el.set(this.outerWallOptions);
			this.dAPaper.add(el);
			var el1 = this.canvasObjects.walls[key + '_end1'];
			el1.set({left: list[0], top: list[1],
				width: this.outerWallOptions.strokeWidth, height: this.outerWallOptions.strokeWidth});
			this.dAPaper.add(el1);
			var el2 = this.canvasObjects.walls[key + '_end2'];
			el2.set({left: list[2], top: list[3],
				width: this.outerWallOptions.strokeWidth, height: this.outerWallOptions.strokeWidth});
			this.dAPaper.add(el2);
		}
	}
	var doorsAndWindows = this.canvasObjects.doorsAndWindows;
	for (key in doorsAndWindows) {
		console.log(key);
		if (doorsAndWindows.hasOwnProperty(key) === true) {
			var el = doorsAndWindows[key];
			el.rotate(this.structure.doorsAndWindows[key].angle);
			var point = this.structure.doorsAndWindows[key].point;
			console.log(this.structure.doorsAndWindows[key]);
			el.set({
				left: point.x * this.gridSize,
				top: point.y * this.gridSize,
				height: this.wallThickness,
				width: (key.indexOf('DR') > -1) ? this.doorOpeningWidth : this.windowOpeningWidth
			});
			
			this.dAPaper.add(el);
		}
	}

	var furnitures = this.canvasObjects.furnitures;
	for (key in furnitures) {
		console.log(key);
		if (furnitures.hasOwnProperty(key) === true) {
			var el = furnitures[key];
			el.rotate(this.structure.furnitures[key].angle);
			var point = this.structure.furnitures[key].point;
			var furnitureType = key.slice(0, 2);
			el.set({
				left: point.x * this.gridSize,
				top: point.y * this.gridSize,
				height: this.furnitureDim[furnitureType].height,
				width: this.furnitureDim[furnitureType].width
			});
			
			this.dAPaper.add(el);
		}
	}
};

DrawingManager.prototype.drawMeasurements = function() {
	var measurements = this.canvasObjects.measurements;
	for (var key in measurements) {
		if (measurements.hasOwnProperty(key) === true) {
			var m = measurements[key];
			this.dAPaper.add(m);
		}
	}
}


DrawingManager.prototype.drawGrid = function() {
	//Draw grid
	console.log("Draw grid");
	var canvas = this.dAPaper;
	//canvas.clear();
	//canvas.setBackgroundColor("#efefef");
	var width = parseInt(this.drawingAreaWrap.style.width);
	var height = parseInt(this.drawingAreaWrap.style.height);
	var i;
	var gridLineSpacing = 1;
	var gridline, tempRuler;
	console.log(width, height, this.gridSize);
	for (i = 0; i < this.size; i+= this.divisions) {
		gridline = this.dAPaper.line(i, 0, i, this.size);
		gridline.attr({
			class: 'gridline',
			stroke: '#999'
		});
	}
	var gapInRuler = 2 * this.divisions;
	for (i = 0; i < this.size; i+= gapInRuler) {
		tempRuler = this.dAPaper.text(i, 0, "" + (i / this.divisions) + '\'');
		tempRuler.attr({
			class: 'ruler',
			fill: 'black',
			alignmentBaseline: 'hanging'
		});
		this.ruler.top.push(tempRuler);
		tempRuler = this.dAPaper.text(i, 0, "" + (i / this.divisions) + '\'');
		tempRuler.attr({
			class: 'ruler',
			fill: 'black'
		});
		this.ruler.bottom.push(tempRuler);
	}
	
	for (i = 0; i < this.size; i+= this.divisions) {
		gridline = this.dAPaper.line(0, i, this.size, i);
		gridline.attr({
			class: 'gridline',
			stroke: '#999'
		});
	}

	for (i = 0; i < this.size; i+= gapInRuler) {
		tempRuler = this.dAPaper.text(0, i, "" + (i / this.divisions) + '\'');
		tempRuler.attr({
			class: 'ruler',
			fill: 'black',
			alignmentBaseline: 'hanging'
		});
		this.ruler.left.push(tempRuler);
		tempRuler = this.dAPaper.text(0, i, "" + (i / this.divisions) + '\'');
		tempRuler.attr({
			class: 'ruler',
			fill: 'black',
			alignmentBaseline: 'hanging',
			textAnchor: 'end'
		});
		this.ruler.right.push(tempRuler);
	}
};

DrawingManager.prototype.resize = function() {

	this.computeSizesAndLengths();
	this.drawingArea.setAttribute('viewBox', '0 0 ' + this.widthInFeetAfterZoom + ' ' + this.heightInFeetAfterZoom);
	this.drawingAreaWrap.style.left = "40px";
	this.setMeasurements();
	
	
	this.showUI();
	var buttonSize = this.negateZoom({x: this.currentHeight / 16, y: this.currentHeight / 16});
	this.menu.setSize({width: buttonSize.x, height: buttonSize.y});
	var menuPos = this.negateZoom({x: 30, y: 30});
	this.menu.moveTo(menuPos);
};

DrawingManager.prototype.computeSizesAndLengths = function() {
	this.drawingAreaWrap.style.height = parseInt(this.app.sage2_height - 60) + "px";
	this.drawingAreaWrap.style.width = parseInt(this.app.sage2_width - 80) + "px";
	this.currentHeight = parseInt(this.drawingAreaWrap.style.height);
	this.currentWidth = parseInt(this.drawingAreaWrap.style.width);
	this.currentGrid = this.toGrid({x: this.currentWidth, y: this.currentHeight});
	this.aspect = this.currentWidth / this.currentHeight;
	this.widthInFeetAfterZoom = parseInt(this.size / this.zoomLevel);
	this.heightInFeetAfterZoom = parseInt(this.widthInFeetAfterZoom / this.aspect);
};

DrawingManager.prototype.setMeasurements = function() {
	this.perFeet = this.divisions;
	this.gridSize =  this.perFeet; // 1 unit = 1 ft
	this.wallThickness = (6.5 / 12) * this.perFeet;
	this.doorWidth = (38.625 / 12) * this.perFeet;
	this.doorOpeningWidth = this.doorWidth + 2 * this.wallThickness;
	this.halfDoorOpeningWidth = this.doorOpeningWidth / 2;
	this.halfDoorWidth = this.doorWidth / 2;
	this.windowWidth = (46.5 / 12) * this.perFeet;
	this.windowOpeningWidth = this.windowWidth + 2 * this.wallThickness;
	this.measurementTextSize = this.currentHeight * 0.04;
	this.outerWallOptions.strokeWidth = this.wallThickness;
	this.furnitureDim = {
		PT: {
			width: (72 / 12) * this.perFeet,
			height: (2 / 12) * this.perFeet
		},
		CO: {
			width: 7 * this.perFeet,
			height: (35 / 12) * this.perFeet
		},
		CR: {
			width: (18 / 12) * this.perFeet,
			height: (17.5 / 12) * this.perFeet
		},
		OC: {
			width: (25 / 12) * this.perFeet,
			height: (24 / 12) * this.perFeet
		},
		SC: {
			width: (30 / 12) * this.perFeet,
			height: (35 / 12) * this.perFeet
		},
		ST: {
			width: (23 / 12) * this.perFeet,
			height: (23 / 12) * this.perFeet
		},
		DK: {
			width: 7 * this.perFeet,
			height: (35 / 12) * this.perFeet
		},
		TB: {
			width: 6 * this.perFeet,
			height: 4 * this.perFeet
		},
		CT: {
			width: (30 / 12) * this.perFeet,
			height: (30 / 12) * this.perFeet
		},
		CB: {
			width: 2 * this.perFeet,
			height: 3 * this.perFeet
		},
		DA: {
			width: 4 * this.perFeet,
			height: (35 / 12) * this.perFeet
		},
		FT: {
			width: (23 / 12) * this.perFeet,
			height: (23 / 12) * this.perFeet
		},
		RB: {
			width: 3 * this.perFeet,
			height: 1 * this.perFeet
		},
		VM: {
			width: 3.5 * this.perFeet,
			height: 3 * this.perFeet
		},
		DR: {
			width: this.doorOpeningWidth,
			height: (11 / 12) * this.perFeet
		},
		WD: {
			width: this.windowOpeningWidth,
			height: (11 / 12) * this.perFeet
		},
		FG: {
			width: 2 * this.perFeet,
			height: 2 * this.perFeet
		}
	};
	this.clientDim = {
		'2D': {
			width: 2 * this.perFeet,
			height: 4 * this.perFeet
		},
		'3D': {
			width: 20 * this.perFeet,
			height: 5 * this.perFeet
		},
		'VR': {
			width: 2 * this.perFeet,
			height: 2 * this.perFeet
		}
	}

		/*	"name": "chair",
			"id": "CR",
			"iconUrl": "images/chair.svg"
		}, {
			"name": "officeChair",
			"id": "OC",
			"iconUrl": "images/officeChair.svg"
		}, {
			"name": "schoolChair",
			"id": "SC",
			"iconUrl": "images/schoolChair.svg"
		}, {
			"name": "stool",
			"id": "ST",
			"iconUrl": "images/stool.svg"
		}, {
			"name": "desk",
			"id": "DK",
			"iconUrl": "images/desk.svg"
		}, {
			"name": "table",
			"id": "TB",
			"iconUrl": "images/table.svg"
		}, {
			"name": "coffeeTable",
			"id": "CT",
			"iconUrl": "images/coffeeTable.svg"
		}, {
			"name": "cabinet",
			"id": "CB",
			"iconUrl": "images/cabinet.svg"
		}, {
			"name": "drawer",
			"id": "DA",
			"iconUrl": "images/drawer.svg"
		}, {
			"name": "fountain",
			"id": "FT",
			"iconUrl": "images/fountain.svg"
		},  {
			"name": "recycleBin",
			"id": "RB",
			"iconUrl": "images/recycleBin.svg"
		},  {
			"name": "vendingMachine",
			"id": "VM",
			"iconUrl": "images/vendingMachine.svg"
		}
	];*/
};
DrawingManager.prototype.beginRotation = function() {
	/*
	var selectedObject = this.getActiveObject();
	if (selectedObject) {
		this.rotationdata = {
			angle0: selectedObject.attr("angle"),
			x0: this.point.x,
			y0: this.point.y
		};
		console.log("beginRotation", selectedObject.attr("angle"));
	} else {
		this.sm.transition('fSelected');
	}*/
	this.panBeginPoint = {
		x: this.point.x,
		y: this.point.y
	}
};

DrawingManager.prototype.rotateLeftSelectedItem = function() {
	var selectedObject = this.getActiveObject();
	if (selectedObject) {
		var id = selectedObject.attr("id");
		var type = id.slice(0, 2);
		if (type !== 'WD' && type !== 'DR' && type !== 'WL' && type !== 'FG') {
			var angle = parseInt(selectedObject.attr("angle")) - 5;
			angle = (angle + 36000) % 360;
			Planner2D_transformElement(selectedObject, angle);
			this.structure.furnitures[id].angle = angle;
			this.sendData('transformElement', this.structure.furnitures[selectedObject.attr("id")]);
		}
		console.log('rotateLeftSelectedItem', angle);
	}
};


DrawingManager.prototype.rotateRightSelectedItem = function() {
	var selectedObject = this.getActiveObject();
	if (selectedObject) {
		var id = selectedObject.attr("id");
		var type = id.slice(0, 2);
		if (type !== 'WD' && type !== 'DR' && type !== 'WL' && type !== 'FG') {
			var angle = parseInt(selectedObject.attr("angle")) + 5;
			angle = (angle + 36000) % 360;
			Planner2D_transformElement(selectedObject, angle);
			this.structure.furnitures[id].angle = angle;
			this.sendData('transformElement', this.structure.furnitures[selectedObject.attr("id")]);
		}
		console.log('rotateLeftSelectedItem', angle);
	}
};

DrawingManager.prototype.clearSelection = function() {
	if (this.groupSelectionBegun) {
		this.selectionArea.set({
			left: 0,
			top: 0,
			width: 0,
			height: 0
		});
		this.dAPaper.remove(this.selectionArea);
		this.groupSelectionBegun = false;
		console.log('clearSelection');
	}
	this.discardActiveObject();
};

DrawingManager.prototype.groupSelect = function() {
	this.selectionArea.setCoords();
	var objs = this.dAPaper.getObjects();
	var selectedList = [];
	objs.forEach(o => {
		if (o !== this.selectionArea && this.selectionArea.intersectsWithObject(o) === true && o.class !== 'gridline') {
			selectedList.push(o);
		}
	});

	var selection = new fabric.ActiveSelection(selectedList, {
		canvas: this.dAPaper,
		hasControls: false,
		hasBorder: false
	});

	this.setActiveObject(selection);
	this.selectionArea.set({
		left: 0,
		top: 0,
		width: 0,
		height: 0
	});
	this.dAPaper.remove(this.selectionArea);
	
	console.log('groupSelect');
};

DrawingManager.prototype.deleteSelection = function() {
	var selectedObject = this.getActiveObject();
	console.log(selectedObject);
	this.discardActiveObject();
	var id = selectedObject.attr("id");
	var type = this.getType(id);
	var element = this.structure[type][id];
	if (type === 'doorsAndWindows') {
		//this.mergeWallAroundItem(selectedObject[0].id);
		var parentWall = this.structure.walls[element.parentId];
		parentWall.children.splice(parentWall.children.indexOf(element.id), 1);
		this.removeFromWall({id: id});
		this.sendData('removeFromWall', {id: id});
	} else if (type === 'walls') {
		element.children.forEach(cId => {
			this.removeElement(cId);
			this.sendData('removeElement', {id: cId});
		});
	}
	
	this.removeElement(id);
	this.sendData('removeElement', {id: id});
};

DrawingManager.prototype.select = function() {
	//Previously selected object
	var selectedObject = this.getActiveObject();
	var selected = false;
	var point = this.toPointOnWindow(this.point);
	var o = Snap.getElementByPoint(point.x, point.y);
	
	if (!o.attr('id') && o.parent().attr('id')) {
		o = o.parent();
	}
	var id = o.attr("id");
	console.log(id);
	if (o.attr("class") !== 'gridline') {
		selected = true;
		//console.log(o.id, this.point, o.id.slice(0, 2));
		this.setActiveObject(o);
		
		switch(id.slice(0, 2)) {
			case 'DR':
			case 'WD':
				this.sm.transition('dwSelected');
				break;
			case 'WL':
				if (selectedObject && selectedObject.attr("id") === id) {
					this.sm.transition('pointOfInterest');
				}
				break;
			case 'ap':
				selected = false;
				this.setActiveObject(selectedObject);
				break;
			default:
				this.sm.transition('fSelected');
				break;
		}
	}
	if (selected === false) {
		this.callDeselect = true;
	} else {
		this.callDeselect = false;
	}
	console.log('select');
};

DrawingManager.prototype.deSelect = function() {
	if (this.callDeselect) {
		this.discardActiveObject();
	}
};

DrawingManager.prototype.pickupSelectedItem = function() {
	var selectedObject = this.getActiveObject();
	this.discardActiveObject();
	
	var type = this.getType(selectedObject.attr("id"));
	console.log(selectedObject, type);
	if (type === 'doorsAndWindows') {
		console.log("removeFromWall");
		this.removeFromWall({id: selectedObject.attr("id")});
		this.sendData('removeFromWall', {id: selectedObject.attr("id")});		
	}
	this.pickUpItem(selectedObject);
};

DrawingManager.prototype.startNewWall = function() {
	this.currentWall = {
		id: getUniqueId2D('WL'),
		updateCounter: 1,
		points: []
	};
	this.dAPaper.add(this.rubberbandWall);
	this.dAPaper.add(this.rubberbandWallMeasurement);
	this.rubberbandDrawing = true;
	console.log("start new Wall");
};

DrawingManager.prototype.pushPoint = function() {
	var gridPoint = this.toGrid(this.point);
	this.currentWall.points.push(gridPoint);
	if (this.currentWall.points.length === 1) {
		this.rubberbandWall.attr({
			x1: gridPoint.x * this.divisions,
			y1: gridPoint.y * this.divisions,
			x2: gridPoint.x * this.divisions,
			y2: gridPoint.y * this.divisions,
			strokeWidth: this.wallThickness
		});
	}
	console.log("push point");
};

DrawingManager.prototype.popPoint = function() {
	if (this.currentWall.points.length === 1) {
		this.currentWall.points.pop();
		this.rubberbandWall.remove();
		this.rubberbandWallMeasurement.remove();
	}
	this.rubberbandDrawing = false;
};

DrawingManager.prototype.drawRubberbandWall = function() {
	// Draw rubberband wall
	if (this.rubberbandDrawing === true) {
		if (this.currentWall.points.length === 1) {
			var P2 = this.toGrid(this.point);
			var P1 = this.currentWall.points[0];
			var dx = Math.abs(P1.x - P2.x);
			var dy = Math.abs(P1.y - P2.y);
			var mx = ((P1.x + P2.x) / 2) * this.divisions;
			var my = ((P1.y + P2.y) / 2) * this.divisions;
			var temp = Math.sqrt(dx * dx + dy * dy).toFixed(1).split('.');
			var dist = temp[0] ;
			dist += (temp[1] === '0') ? ' \' ' : ' \' '  + fractionLookup[temp[1]] + ' \"';
			this.rubberbandWallMeasurement.attr({
				text: dist,
				x: (dx > dy)? mx : mx + this.wallThickness * 2,
				y: (dx > dy)? my - this.wallThickness * 2 : my,
				fontSize: this.measurementTextSize 
			});
			this.rubberbandWall.attr({
				x2: P2.x * this.divisions,
				y2: P2.y * this.divisions
			});
		}
		//console.log("drawRubberbandWall");
	}
};

DrawingManager.prototype.saveWall = function(oldWall) {
	var wall = oldWall || this.currentWall;
	if (wall.points.length === 2) {
		/*wall.points.sort(function(a, b) {
			if (a.x === b.x) {
				return a.y - b.y;
			}
			return a.x - b.x;
		});*/
		this.outerWallOptions.id = wall.id;
		this.outerWallOptions.strokeWidth = 1;
		var dx = wall.dx = wall.points[1].x - wall.points[0].x;
		var dy = wall.dy = wall.points[1].y - wall.points[0].y;
		wall.length = Math.sqrt(dx * dx + dy * dy);
		if (wall.length < 1) { //Same point has been saved twice
			wall.points.pop();
			return;
		}
		var theta = Math.atan2(dy, dx);
		wall.angle = theta * 180 / Math.PI;
		wall.sinTheta = Math.sin(theta);
		wall.cosTheta = Math.cos(theta);
		var linePathStr = this.geometry.getPathForLinePoints(wall.points[0], wall.points[1], this.wallThickness,  this.divisions);
		var wallObj = this.dAPaper.path(linePathStr);
		wallObj.attr(this.outerWallOptions);
		wall.children = [];
		this.rubberbandWall.remove();
		this.rubberbandWallMeasurement.remove();
		this.rubberbandDrawing = false;
		this.addElement(wall, wallObj);

		if (oldWall === undefined) {
			this.sendData('addElement', wall);
		}
	}
};

DrawingManager.prototype.editWall = function() {
	var wallObj = this.getActiveObject();
	this.discardActiveObject();
	var wall = this.structure.walls[wallObj.attr("id")];
	if (wall.children.length > 0) {
		this.sm.transition('S');
		return;
	}
	var xyList = this.geometry.getXYListForPoints(wall.points, this.gridSize);
	var closer = Planner2D_closerPoint(xyList, this.toFeetAfterZoom(this.point));
	var farther = 1 - closer;
	var fixed, moving;
	moving = wall.points[closer];
	fixed = wall.points[farther];
	this.currentWall = {
		id: wall.id,
		updateCounter: wall.updateCounter + 1,
		points: [fixed]
	};
	closer = closer * 2;
	farther = farther * 2;
	this.rubberbandWall.attr({
		x1: xyList[farther],
		y1: xyList[farther + 1],
		x2: xyList[closer],
		y2: xyList[closer + 1],
		strokeWidth: this.wallThickness
	});

	this.removeElement(wall.id);
	this.sendData('removeElement', {id: wall.id});
	this.dAPaper.add(this.rubberbandWall);
	this.dAPaper.add(this.rubberbandWallMeasurement);
	this.rubberbandDrawing = true;

	console.log("Begin edit wall");


};

DrawingManager.prototype.resetWall = function() {
	var oldWall = this.structure.walls[this.currentWall.id];
	var options = {
		id: this.currentWall.id,
		strokeWidth: this.wallThickness,
		stroke: 'black',
		originX: 'center',
		originY: 'center',
		hasControls: false,
		hasBorder: false
	};
	var list = this.geometry.getXYListForPoints(oldWall.points, this.gridSize);
	var wall = new fabric.Line(list, options);
	this.canvasObjects.walls[this.currentWall.id] = wall;
	this.dAPaper.add(wall);
	this.rubberbandWall.remove();
	this.rubberbandWallMeasurement.remove();
	this.rubberbandDrawing = false;
};


DrawingManager.prototype.pickupDoor = function() {
	this.pickUpItem(Planner2D_makeDoorShape(this.dAPaper, {
		id: getUniqueId2D('DR'), // Door or Window
		stroke: 'black',
		fill: 'black',
		height: this.wallThickness,
		width: this.doorOpeningWidth
	}));
	var item = this.pickedUpItem.item;
	var type = this.getType(item.attr('id'));
	var gridPoint = this.toGrid(this.point);
	var element = {
		id: item.attr('id'),
		point: gridPoint,
		updateCounter: 0,
		angle: item.attr('angle'),
	};
	this.addElement(element, item);
	this.sendData('addElement', element);
};

DrawingManager.prototype.pickupWindow = function() {
	this.pickUpItem(Planner2D_makeWindowShape(this.dAPaper, {
		id: getUniqueId2D('WD'), // Window
		stroke: 'black',
		fill: 'black',
		height: this.wallThickness,
		width: this.windowOpeningWidth
	}));
	var item = this.pickedUpItem.item;
	var type = this.getType(item.attr("id"));
	var gridPoint = this.toGrid(this.point);
	var element = {
		id: item.attr("id"),
		point: gridPoint,
		updateCounter: 0,
		angle: item.attr('angle'),
	};
	this.addElement(element, item);
	this.sendData('addElement', element);
};

DrawingManager.prototype.setPickupFurnitureType = function(type) {
	this.pickupFurnitureOrFlagType = type;
};

DrawingManager.prototype.pickupFurnitureOrFlag = function() {
	try {
		var furniture = Furnitures[this.pickupFurnitureOrFlagType];
		console.log(this.pickupFurnitureOrFlagType);
		this.pickUpItem(furniture(this.dAPaper, {
			id: getUniqueId2D(this.pickupFurnitureOrFlagType),
			stroke: 'black',
			strokeWidth: 3,
			fill: 'rgba(160, 160, 160, 1.0)',
			height: this.furnitureDim[this.pickupFurnitureOrFlagType].height,
			width: this.furnitureDim[this.pickupFurnitureOrFlagType].width
		}));
		var item = this.pickedUpItem.item;
		item.attr('strokeWidth', 3);
		var type = this.getType(item.attr("id"));
		var gridPoint = this.toGrid(this.point);
		var element = {
			id: item.attr("id"),
			point: gridPoint,
			angle: item.attr("angle"),
		};
		this.addElement(element, item);
		this.sendData('addElement', this.structure[type][item.attr("id")]);

	} catch(err) {
		console.log(err);
		this.sm.transition('x');
	}
	this.pickupFurnitureOrFlagType = null;
};

DrawingManager.prototype.setPoint = function(point, date) {
	var x = point.x - parseInt(this.drawingAreaWrap.style.left);
	var y = point.y - parseInt(this.drawingAreaWrap.style.top);
	if (x > 0 && y > 0) {
		this.point = {
			x: x,
			y: y
		};
		this.active = true;
		this.pointChanged = true;
		this.timestamp = date;
	} else {
		this.active = false;
	}
};

DrawingManager.prototype.movePickedUpItem = function() {
	if (this.pickedUpItem) {
		var point = this.toFeetAfterZoom(this.point);
		Planner2D_transformElement(this.pickedUpItem.item, undefined, point.x, point.y);
		var id = this.pickedUpItem.item.attr("id");
		var type = this.getType(id);
		var element = this.structure[type][id];
		element.point = this.toGrid(this.point);
		//console.log("Set Furniture");
	}
};

DrawingManager.prototype.setPickedUpItem = function() {
	var item = this.pickedUpItem.item;
	console.log("Set Furniture");
	var item = this.pickedUpItem.item;
	var id = item.attr("id");
	var type = this.getType(id);
	var element = this.structure[type][id];
	element.point = this.toGrid(this.point);
	element.angle = item.attr("angle");
	element.updateCounter = element.updateCounter + 1;
	if (type === "flags") {
		element.touchedAt = this.timestamp;
	}
	this.dropItem(true);
	this.sm.transition('fSelected'); // Get back to Selection state
};

DrawingManager.prototype.processInput = function(type, char) {
	if (this.active === true) {
		//console.log("processInput", type, char)
		if (type === 'keyboard') {
			if (char === "m") {
				var point = this.toGrid(this.point)
				point.x *= this.divisions;
				point.y *= this.divisions;
				this.menu.moveTo(point);
			} else {
				this.sm.transition(char);	
			}
		} else if (type === 'specialKey') {
			this.sm.transition(char);
		} else if (type === 'pointerPress' && this.menu.buttonUnderPointer !== null) {
			//console.log("buttonClicked!");
			this.menu.buttonUnderPointer.click();
		} else {
			this.sm.transition(type);
		}
	}	
};

DrawingManager.prototype.zoom = function(delta) {
	if (delta < 0) {
		this.zoomLevel -= 0.1;
	} else if (delta > 0) {
		this.zoomLevel += 0.1;
	}
	if (this.zoomLevel > this.maxZoom) {
		this.zoomLevel = this.maxZoom;
	} else if (this.zoomLevel < this.minZoom) {
		this.zoomLevel = this.minZoom;
	}
	this.widthInFeetAfterZoom = parseInt(this.size / this.zoomLevel);
	this.heightInFeetAfterZoom = parseInt(this.widthInFeetAfterZoom / this.aspect);
	this.drawingArea.setAttribute('viewBox', '0 0 ' + this.widthInFeetAfterZoom + ' ' + this.heightInFeetAfterZoom);
	var buttonSize = this.negateZoom({x: this.currentHeight / 16, y: this.currentHeight / 16});
	this.menu.setSize({width: buttonSize.x, height: buttonSize.y});
	var menuPos = this.negateZoom({x: 30, y: 30});
	this.menu.moveTo(menuPos);
	this.showUI();
	this.app.state.zoomLevel = this.zoomLevel;

};
DrawingManager.prototype.alignDoorOrWindowOnWall = function() {
	console.log('alignDoorOnWall');
	var wallUnderPoint = null;
	/*var pos = this.pickedUpItem.item.attr("x");
	this.pickedUpItem.item.attr("x", -1000);
	
	var wallUnderPoint = null;
	var point = this.toPointOnWindow(this.point);
	var o = Snap.getElementByPoint(point.x, point.y);
	console.log(o.attr('id'));
	if (o.attr('class') !== 'gridline' && o.attr("id") !== null && o.attr("id").indexOf('WL') > -1) {
		wallUnderPoint = o;
	}	
	*/
	var wTemp;
	var point = this.toFeetAfterZoom(this.point);
	for (w in this.canvasObjects.walls) {
		if (this.canvasObjects.walls.hasOwnProperty(w)) {
			wTemp = this.canvasObjects.walls[w];
			if (this.geometry.isPointOnWall(wTemp, this.wallThickness, point.x, point.y)) {
				wallUnderPoint = wTemp;
				break;
			}
		}
	}
	if (wallUnderPoint) {
		var wall = this.structure.walls[wallUnderPoint.attr("id")];
		Planner2D_transformElement(this.pickedUpItem.item, wall.angle);
		console.log(wall.angle);
		this.setActiveObject(wallUnderPoint);
		this.setDoorOrWindowCandidate = wallUnderPoint;

	} else {
		Planner2D_transformElement(this.pickedUpItem.item, 0);
		this.discardActiveObject();
		this.setDoorOrWindowCandidate = null;
	}
	//this.pickedUpItem.item.attr("x", pos);
};

DrawingManager.prototype.setDoorOrWindow = function() {
	console.log("Set door or window");
	
	if (this.setDoorOrWindowCandidate) {
		var newDoorOrWindowPlacement = this.checkPlacementPoint(this.setDoorOrWindowCandidate);
		console.log(newDoorOrWindowPlacement.point.x, this.gridSize);
		if (newDoorOrWindowPlacement !== null) {
			Planner2D_transformElement(this.pickedUpItem.item, newDoorOrWindowPlacement.angle,
				newDoorOrWindowPlacement.point.x * this.gridSize,
				newDoorOrWindowPlacement.point.y * this.gridSize);
			var element = this.structure.doorsAndWindows[newDoorOrWindowPlacement.id];
			element.point = newDoorOrWindowPlacement.point;
			element.angle = newDoorOrWindowPlacement.angle;
			element.updateCounter = element.updateCounter + 1;
			this.sendData('transformElement', this.structure.doorsAndWindows[newDoorOrWindowPlacement.id]);
			this.discardActiveObject();
			//this.dAPaper.bringToFront(this.pickedUpItem.item);
			this.dropItem(true);
			this.addAsWallChild(newDoorOrWindowPlacement.id, this.setDoorOrWindowCandidate.attr("id"));

			this.sendData('addAsWallChild', this.structure.doorsAndWindows[newDoorOrWindowPlacement.id]);
			this.sm.transition('dwSelected'); // Get out of Door state
		}
		this.setDoorOrWindowCandidate = null;
	}
};

DrawingManager.prototype.addAsWallChild = function(elId, wallId) {
	console.log(elId, wallId);
	var element = this.structure.doorsAndWindows[elId];
	var parentWall = this.structure.walls[wallId];
	if (parentWall.children.indexOf(elId) < 0) {
		parentWall.children.push(elId);
	}	
	element.parentId = wallId;

};
DrawingManager.prototype.removeFromWall = function(data) {
	console.log(data.id);
	var element = this.structure.doorsAndWindows[data.id];
	var parentWall = this.structure.walls[element.parentId];
	var idx = parentWall.children.indexOf(element.id);
	if (idx > -1) {
		parentWall.children.splice(idx, 1);	
	}
	element.parentId = null;
};

DrawingManager.prototype.checkPlacementPoint = function(wallObj, data) {
	var wall = this.structure.walls[wallObj.attr("id")];
	var angle = wall.angle;
	var point, width, id;
	if (data) {
		point = data.point;
		width = data.width;
		id = data.id;
	} else {
		point = this.toGrid(this.point);
		width = this.pickedUpItem.item.getBBox().width;
		id = this.pickedUpItem.item.attr("id");
	}
	var l1 = Planner2D_distance(point.x, point.y, wall.points[0].x, wall.points[0].y);
	var L = wall.length;
	var halfWidth = width * 0.5 / this.gridSize;
	var l2 = L - l1;
	var l3 = l1 - halfWidth;
	var l4 = l2 - halfWidth;
	if (l3 < 0 || l4 < 0) {
		return null;
	}
	var doorPosition = Planner2D_pointOnParametricLine(wall.points, 0, 1, l1 / L);
	return {
		id: id,
		point: doorPosition,
		angle: angle,
		parentId: null
	};
}


DrawingManager.prototype.pickUpItem = function(item) {
	this.pickedUpItem = {
		itemStroke: item.attr('stroke'),
		//itemFill: item.get('fill'),
		item: item
	};
	this.discardActiveObject();
	item.attr('stroke', 'rgba(120, 120, 200, 1.0)');
	//item.set('fill', 'rgba(120, 120, 200, 1.0)');
	//this.dAPaper.setActiveObject(item);
};

DrawingManager.prototype.getType = function(id) {
	var type = id.slice(0, 2);
	if (type === 'WL') {
		return 'walls';
	} else if (type === 'DR' || type === 'WD') {
		return 'doorsAndWindows';
	} else if (type === 'FG') {
		return 'flags'
	} else {
		return 'furnitures';
	}
};

DrawingManager.prototype.dropItem = function(donotRemove) {
	if (this.pickedUpItem === null) {
		return;
	}
	if (donotRemove) {
		this.pickedUpItem.item.attr('stroke', this.pickedUpItem.itemStroke);
		//this.pickedUpItem.item.set('fill', this.pickedUpItem.itemFill);
	} else {
		this.sendData('removeElement', {id: this.pickedUpItem.item.attr("id")});
		this.removeElement(this.pickedUpItem.item.attr("id"));

	}
	
	this.pickedUpItem = null;
};

DrawingManager.prototype.addElement = function(element, canvasObject, extras) {
	var id = element.id;
	var type = this.getType(id);
	canvasObject.remove();
	this.dAPaper.add(canvasObject);
	if (type === 'flags') { // FLAG
		element.touchedAt = this.timestamp;
	}
	this.structure[type][id] = element;
	var dupInArray = this.app.state.structure[type].findIndex(x => {
		return x.id === id;
	});
	if (dupInArray > -1) {
		this.app.state.structure[type][dupInArray] = element;
	} else {
		this.app.state.structure[type].push(element);
	}
	this.canvasObjects[type][id] = canvasObject;
	if (extras) {
		console.log(extras);
		extras.forEach(e => {
			this.canvasObjects[type][e.id] = e;
			e.remove();
			this.dAPaper.add(e);
		});
	}
};

DrawingManager.prototype.removeElement = function(id) {
	var type = this.getType(id);
	console.log(id, this.structure[type][id],  this.canvasObjects[type][id]);
	delete this.structure[type][id];
	var entryInArray = this.app.state.structure[type].findIndex(x => {
		return x.id === id;
	});
	if (entryInArray > -1) {
		this.app.state.structure[type].splice(entryInArray, 1);
	}
	this.canvasObjects[type][id].remove();
	delete this.canvasObjects[type][id];
};

DrawingManager.prototype.updateHelpText = function() {
	this.helpText.attr({
		text: this.helpDict[this.sm.currentState]
	});
};

DrawingManager.prototype.toFeetAfterZoom = function(point) {
	return {
    	x: Math.round(point.x * this.widthInFeetAfterZoom / this.currentWidth),
    	y: Math.round(point.y * this.heightInFeetAfterZoom / this.currentHeight)
    }
};

DrawingManager.prototype.negateZoom = function(point) {
	return {
    	x: Math.round(point.x / this.currentWidth * this.widthInFeetAfterZoom),
    	y: Math.round(point.y / this.currentHeight * this.heightInFeetAfterZoom)
    };
};

DrawingManager.prototype.toPointOnWindow = function(point) {
	return {
		x: point.x + parseInt(this.drawingAreaWrap.style.left) + this.app.sage2_x,
		y: point.y + parseInt(this.drawingAreaWrap.style.top) + this.app.sage2_y
	};
};
DrawingManager.prototype.toGrid = function(point) {
    return {
    	x: Math.round(point.x * this.widthInFeetAfterZoom / (this.currentWidth * this.divisions)),
    	y: Math.round(point.y * this.heightInFeetAfterZoom / (this.currentHeight * this.divisions))
    }
};


DrawingManager.prototype.setupServerConnection = function() {
	this.connectedToDataServer = false;
	this.wsio.addEventListener('open', function() {
		this.connectedToDataServer = true;
		this.sendData('addClient', {id: this.clientId, structure: this.structure});
		console.log('Connected To Data Server');
	}.bind(this));
	this.wsio.onclose = function() {
		this.connectedToDataServer = false;
		this.wsio = null;
	}.bind(this);
	this.wsio.onerror = function() {
		this.connectedToDataServer = false;
		this.wsio = null;
	}.bind(this);
	this.wsio.onmessage = function(message) {
		this.processServerMessage(JSON.parse(message.data));	
	}.bind(this);
};

DrawingManager.prototype.sendData = function (action, jsonData) {
	var data = JSON.stringify({action: action, data: jsonData});
	if (this.connectedToDataServer === true) {
		this.wsio.send(data);
	}
};

DrawingManager.prototype.sendImg = function (dataUrl) {
	var data = JSON.stringify({action: 'canvasImage', data: dataUrl});
	if (this.connectedToDataServer === true) {
		this.wsio.send(data);
	}
};

DrawingManager.prototype.processServerMessage = function(message) {
	
	var action = message.action;
	var data = message.data;
	console.log(message);
	switch(action) {
		case "diff":
			this.buildStructure(data.state.update);
			data.state.remove.forEach(r => {
				this.removeElement(r);
			});
			
			break;
		case "addClient":
			if (data.id !== this.clientId) {
				this.addNewClient(data.id);
			}
			
			break;
		case "camera":
			this.transformClient(data);
			break;
		case "addElement":
			var type = data.id.slice(0, 2);
			if (type === 'WL') {
				this.saveWall(data);
			} else if (type === 'DR' || type === 'WD') {
				this.addDoorOrWindow(data);
			} else {
				this.addFurnitureOrFlag(data);
			}
			//this.structure[type][id] = data.data;
			break;
		case "removeElement":
			console.log("remove ", data.id);
			this.removeElement(data.id);
			break;
		case "transformElement":
			this.transformElement(data);
			break;
		case "addAsWallChild":
			this.addAsWallChild(data.id, data.parentId);
			break;

		case "removeFromWall":
			this.removeFromWall(data);
			break;	
	}
};

DrawingManager.prototype.transformElement = function(element) {
	var id = element.id;
	var type = this.getType(id);
	var obj = this.canvasObjects[type][id];
	if (obj) {
		Planner2D_transformElement(obj, element.angle,
			element.point.x * this.gridSize, element.point.y * this.gridSize);
	}
	this.structure[type][id] = element;
};

DrawingManager.prototype.addDoorOrWindow = function(element) {
	var shortType = element.id.slice(0, 2);
	var shape = {
		DR: Planner2D_makeDoorShape,
		WD: Planner2D_makeWindowShape
	};
	if (element.parentId) {
		var wallId = element.parentId;
		var wallUnderPoint = this.canvasObjects.walls[wallId];
		var data = {
			id: element.id,
			width: (shortType === 'DR') ? this.doorOpeningWidth : this.windowOpeningWidth,
			point: element.point
		}
		var newDoorOrWindowPlacement = this.checkPlacementPoint(wallUnderPoint, data);
		console.log(newDoorOrWindowPlacement);
		if (newDoorOrWindowPlacement !== null) {
			var item = new shape[shortType](this.dAPaper, {
				id: element.id, // Door or Window
				stroke: 'black',
				fill: 'black',
				height: this.wallThickness,
				width: data.width
			});
			Planner2D_transformElement(item, newDoorOrWindowPlacement.angle,
				newDoorOrWindowPlacement.point.x * this.divisions, newDoorOrWindowPlacement.point.y * this.divisions);
			this.addElement(newDoorOrWindowPlacement, item);		
			this.addAsWallChild(newDoorOrWindowPlacement.id, wallId);
		}
	} else {
		var item = new shape[shortType](this.dAPaper, {
			id: element.id, // Door or Window
			stroke: 'black',
			fill: 'black',
			height: this.wallThickness,
			width: (shortType === 'DR') ? this.doorOpeningWidth : this.windowOpeningWidth
		});
		Planner2D_transformElement(item, element.angle, element.point.x * this.divisions, element.point.y * this.divisions);
		this.addElement(element, item);
	}
};

DrawingManager.prototype.addFurnitureOrFlag = function(element) {
	try {
		var id = element.id;
		var type = this.getType(id);
		var shortType = id.slice(0, 2);
		var furniture = Furnitures[shortType];
		var obj = new furniture(this.dAPaper, {
			id: id,
			stroke: 'black',
			fill: 'rgba(160, 160, 160, 1.0)',
			height: this.furnitureDim[shortType].height,
			width: this.furnitureDim[shortType].width,
		});
		obj.attr('strokeWidth', 3);
		Planner2D_transformElement(obj, element.angle,
			element.point.x * this.gridSize, element.point.y * this.gridSize);
		this.addElement(element, obj);
	} catch(err) {
		console.log(err);
	}
};

DrawingManager.prototype.buildStructure = function(structure) {
	console.log("buildStructure", structure);
	structure.walls.forEach(wall => {
		if (this.structure.walls.hasOwnProperty(wall.id) === false) {
			this.saveWall(wall);
		} else if (this.structure.walls[wall.id].updateCounter < wall.updateCounter) {
			this.removeElement(wall.id);
			this.saveWall(wall);
		}
	});
	structure.doorsAndWindows.forEach(doorOrWindow => {
		if (this.structure.doorsAndWindows.hasOwnProperty(doorOrWindow.id) === false) {
			this.addDoorOrWindow(doorOrWindow);
		} else if (this.structure.doorsAndWindows[doorOrWindow.id].updateCounter < doorOrWindow.updateCounter) {
			this.removeElement(doorOrWindow.id);
			this.addDoorOrWindow(doorOrWindow);
		}
	});
	structure.furnitures.forEach(furniture => {
		if (this.structure.furnitures.hasOwnProperty(furniture.id) === false) {
			this.addFurnitureOrFlag(furniture);
		} else if (this.structure.furnitures[furniture.id].updateCounter < furniture.updateCounter) {
			this.removeElement(furniture.id);
			this.addFurnitureOrFlag(furniture);
		}
	});
	structure.flags.forEach(flag => {
		if (this.structure.flags.hasOwnProperty(flag.id) === false) {
			this.addFurnitureOrFlag(flag);
		} else {
			this.removeElement(flag.id);
			this.addFurnitureOrFlag(flag);
		}
	});
};

DrawingManager.prototype.addNewClient = function(id) {
	var clientType = id.slice(2, 4);
	console.log(id, id.slice(0, 2), clientType);
	if (this.clients[id] === undefined) {
		var client = ClientShape[clientType](this.dAPaper, {
			id: id,
			stroke: 'black',
			strokeWidth: 3,
			fill: 'rgba(220, 220, 220, 1.0)',
			height: this.clientDim[clientType].height,
			width: this.clientDim[clientType].width,
		});
		this.clients[id] = {
			item: client,
			point: {x: this.size / 8.0, y: this.size / 8.0},
			angle: 0
		};
		Planner2D_transformElement(client, 0, this.size / 8.0 * this.gridSize, this.size / 8.0 * this.gridSize);
		this.dAPaper.add(client);
	}
	
};

DrawingManager.prototype.transformClient = function(clientEl) {
	if (clientEl) {
		console.log(this.clients, clientEl);
		var clientObj = this.clients[clientEl.id];
		clientObj.point = clientEl.point;
		clientObj.angle = (clientEl.angle + 36000) % 360;
		Planner2D_transformElement(clientObj.item, clientObj.angle, clientObj.point.x * this.gridSize, clientObj.point.y * this.gridSize);
	}
};

DrawingManager.prototype.showUI = function() {
	var buttonSize = this.negateZoom({x: this.currentHeight / 16, y: this.currentHeight / 16});
	this.directionSymbol.setSize(buttonSize.x, buttonSize.y);
	var dirSymPosition = this.negateZoom({x: this.currentWidth - this.currentHeight / 16 - 30, y: 30});
	console.log(buttonSize.x, this.currentWidth);
	this.directionSymbol.setPosition(dirSymPosition.x, dirSymPosition.y);
	this.directionSymbol.show();
	var helpTextPos = this.negateZoom({x: 30, y: this.currentHeight - 60});
	var helpTextSize = this.negateZoom({x: 0, y: this.currentHeight * 0.02});
	this.helpText.attr({
		x: helpTextPos.x,
		y: helpTextPos.y,
		fill: 'black',
		fontSize: helpTextSize.y
	});
	var selectedObjectDescriptorPos = this.negateZoom({x: 30, y: this.currentHeight - 30});
	this.selectedObjectDescriptor.attr({
		x: selectedObjectDescriptorPos.x,
		y: selectedObjectDescriptorPos.y,
		fontSize: helpTextSize.y
	});
	var rulerPos = this.negateZoom({x: this.currentWidth, y: this.currentHeight});
	var rulerTextSize = this.negateZoom({x: 0, y: this.currentHeight * 0.02});
	this.ruler.bottom.forEach(r => {
		r.attr({
			y: rulerPos.y,
			fontSize: rulerTextSize.y
		});
	});
	this.ruler.right.forEach(r => {
		r.attr({
			x: rulerPos.x,
			fontSize: rulerTextSize.y
		});
	});
	this.ruler.top.forEach(r => {
		r.attr({
			fontSize: rulerTextSize.y
		});
	});
	this.ruler.left.forEach(r => {
		r.attr({
			fontSize: rulerTextSize.y
		});
	});
};
