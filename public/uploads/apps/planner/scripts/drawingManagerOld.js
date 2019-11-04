function DrawingManager(app, wsio) {
	this.app = app;
	this.wsio = wsio;

	this.drawingAreaWrap = document.createElement("div");
	this.drawingAreaWrap.style.position = "absolute";
	this.drawingAreaWrap.style.display = "block";
	this.app.element.appendChild(this.drawingAreaWrap);

	this.drawingArea = document.createElement("canvas");
	this.drawingArea.id = app.id + "_drawingArea";
	
	this.drawingAreaWrap.appendChild(this.drawingArea);
	
	
	this.drawingAreaWrap.style.top = "30px";


	this.point = {x: 0, y: 0};
	this.gridSize = 30;
	this.dACanvas = new fabric.Canvas(this.drawingArea.id, {
		selection: false
	});

	this.structure = {
		walls: {},
		doorsAndWindows: {},
		furnitures: {}
	};
	this.canvasObjects = {
		walls: {},
		doorsAndWindows: {},
		furnitures: {},
		measurements: {}
	};
	this.pickedUpItem = null;
	this.pickupFurnitureType = null;
	this.updateCounter = 0;
	this.frameCount = 0;
	this.init();
	this.createMenu();
	this.resize();
	this.setupServerConnection();

};
DrawingManager.prototype.init = function() {
	this.sm = new fsm();
	this.sm.init(10, 14); // Six states, 7 kinds of input
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
		fCreate: 13
	});
	
	this.sm.copyTransitions([
	   //W, S, dn, mv, up, db, rt,  x, poi, D,  I, dws,fsl,f1
		[1,	0, 	3, 	0, 	0, 	0, 	0, 	0, 	0, 	5, 	5,	6,	8,	7], // Selection
		[1,	0, 	2, 	1, 	1, 	1, 	1, 	1, 	1, 	5, 	5, 	1, 	1, 	7], // Start Wall
		[1,	0, 	2, 	2, 	2, 	1, 	1, 	1, 	2, 	2, 	2, 	2, 	2, 	2], // Draw Wall
		[3,	3, 	3, 	9, 	0, 	3, 	0, 	0, 	4, 	3, 	3, 	6,  8,	3], // Start Selection Rectangle
		[1,	0, 	0, 	4, 	4, 	4, 	0, 	0, 	4, 	5, 	5, 	4, 	4, 	4], // Edit Wall
		[5,	5, 	5, 	5, 	5, 	5, 	0, 	0, 	5, 	5, 	5, 	0, 	5, 	5], // Add door or Window
		[6,	6, 	6, 	5, 	0, 	6, 	6, 	6, 	6, 	6, 	6, 	6, 	6, 	6], // Edit door or window
		[7,	7, 	7, 	7, 	7, 	7, 	0, 	0, 	7, 	7, 	7, 	7,  0, 	7], // Add Furniture
		[8,	8,	8,	7,	0,	8,	8,	8,	8,	8,	8,	8,	8,	8],  // Edit door or window
		[9,	9,	9,	9,	0,	9,	9,	9,	9,	9,	9,	9,	0,	9]  // Rotate selected Item
	]);
	this.sm.setActionContext(this);
	this.sm.defaultActionOnStateChange('updateHelpText');
	this.sm.copyActions([
		[null, null, 'select', null, null, null, null, 'deleteSelection', null, 'pickupDoor', 'pickupWindow', null, null, 'pickupFurniture'],
		[null, null, ['startNewWall','pushPoint'], null, null, null, null, null, null, 'pickupDoor', 'pickupWindow', null, null, 'pickupFurniture'],
		['popPoint', 'popPoint', ['pushPoint', 'saveWall', 'startNewWall', 'pushPoint'], null, null, ['pushPoint','saveWall'], 'popPoint', 'popPoint', null, null, null, null, null, null],		
		[null, null, null, 'beginRotation', 'deSelect', null, null, null, 'editWall', null, null, null, null, null],
		[['pushPoint','saveWall'], ['pushPoint','saveWall'], ['pushPoint','saveWall'], null, null,  ['pushPoint','saveWall'], null, 'popPoint', null, ['resetWall', 'pickupDoor'], ['resetWall', 'pickupWindow'], null, null, null],
		[null, null, null, 'alignDoorOrWindowOnWall', 'setDoorOrWindow', null, 'dropItem', 'dropItem', null, null, null, null, null, null],
		[null, null, null, 'pickupSelectedItem', null, null, null, null, null, null, null, null, null, null],
		[null, null, 'setPickedUpItem', null, null, null, 'dropItem', 'dropItem', null, null, null, null, null, null],
		[null, null, null, 'pickupSelectedItem', null, null, null, null, null, null, null, null, null, null],
		[null, null, null, 'rotateSelectedItem', null, null, null, null, null, null, null, null, null, null]

	]);


	this.geometry = new Geometry();
	this.geometry.init({pointSensitivity: 1});
	// Standby walls to help with interface
	this.rubberbandWall = new fabric.Line([0, 0, 1, 1], {
		strokeWidth: 3,
		stroke: 'rgba(120, 120, 200, 1.0)',
		originX: 'center',
		originY: 'center'
	});
	this.rubberbandWallMeasurement = new fabric.Text("", {
		originY: 'center',
		originX: 'center',
		stroke: 'black',
		fontSize: 10,
		textBackgroundColor: '#efefef'
	});
	this.selectionArea = new fabric.Rect({
		id: 'selectionRect',
		left: 0,
		top: 0,
		fill: 'rgba(180, 180, 200, 0.3)',
		stroke: 'rgba(180, 180, 200, 0.6)',
		strokeWidth: 1,
		width: 1,
		height: 1
	});
	this.helpText = new fabric.Text("", {
		stroke: 'black',
		textBackgroundColor: "#efefef",
		fontSize: 10
	});
	this.selectedObjectDescriptor = new fabric.Text("", {
		stroke: 'black',
		textBackgroundColor: "#efefef",
		fontSize: 10
	});
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
	this.pointerRect = {
		TL: new fabric.Point(0, 0),
		BR: new fabric.Point(0, 0)		
	}
	this.outerWallOptions = {
		id: null,
		strokeWidth: this.wallThickness,
		stroke: 'black',
		originX: 'center',
		originY: 'center',
		hasControls: false,
		hasBorder: false
	};
	this.currentWall = null;
	this.widthInFeet = 200;
	this.clients = {};
	this.minWidthInFeet = 40;
	this.maxWidthInFeet = 400;
	this.directionSymbol = new PlannerButton(this.dACanvas, this.app.resrcPath + 'images/north.svg', null, true);
	this.setupEvents();
};

DrawingManager.prototype.createMenu = function() {
	var menu = new PlannerMenu(this.app, this.dACanvas, {columns: 3});
	
	menu.setSize({width: 100, height: 100});
	menu.setPosition({left: 50, top: 200});
	this.menu = menu;
	var assests = getAssetList();
	assests.forEach(idata => {
		this.menu.addButton(idata.id, this.app.resrcPath + idata.iconUrl, function(type) {
			if (type === 'WL' || type === 'DR' || type === 'WD') {
				this.sm.transition(type);
			} else {
				this.setPickupFurnitureType(type);
				this.sm.transition('fCreate');	
			}
		}.bind(this));
	});
	this.menu.arrangeButtons();
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.updateSelectionText = function(obj) {
	var selectedObjText = "";
	if (obj !== null) {
		selectedObjText = "Selected: ";
		selectedObjText = selectedObjText + getItemTypeName(obj.id);
		var type = this.getType(obj.id);
		if (type === 'walls') {
			var len = wallLengthFormatted(this.structure.walls[obj.id]);
			selectedObjText = selectedObjText + '\nLength: ' + len;	
		}
	}
	this.selectedObjectDescriptor.set({text: selectedObjText});
}

DrawingManager.prototype.setupEvents = function() {
	
	this.dACanvas.on('selection:created', function(selectedObject) {
		if (selectedObject.hasOwnProperty('selected')) {
			selectedObject.selected.forEach(o => {
				o.set('stroke', 'rgba(120, 120, 200, 1.0)');
				this.updateSelectionText(o);
			});
			
		}
	}.bind(this));
	this.dACanvas.on('selection:cleared', function(selectedObject) {
		//console.log(selectedObject);
		if (selectedObject.deselected !== undefined) {
			selectedObject.deselected.forEach(o => {
				o.set('stroke', 'black');
			});
			this.updateSelectionText(null);
		}
	}.bind(this));
	this.dACanvas.on('selection:updated', function(selectedObject) {
		//console.log(selectedObject);
		if (selectedObject.selected !== undefined) {
			selectedObject.selected.forEach(o => {
				o.set('stroke', 'rgba(120, 120, 200, 1.0)');
				this.updateSelectionText(o);
			});
		}
		if (selectedObject.deselected !== undefined) {
			selectedObject.deselected.forEach(o => {
				o.set('stroke', 'black');
			});
			this.updateSelectionText(null);
		}
	}.bind(this));
};



DrawingManager.prototype.draw = function() {
	var selectedObject = this.dACanvas.getActiveObject();
	this.dACanvas.clear();
	this.drawGrid();
	this.drawStructure();
	this.drawMeasurements();
	this.dACanvas.setActiveObject(selectedObject);
	this.directionSymbol.show();
	this.menu.reDraw();
	this.dACanvas.add(this.helpText);
	this.dACanvas.add(this.selectedObjectDescriptor);
	this.drawClients();
	this.dACanvas.requestRenderAll();
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
			this.dACanvas.add(this.clients[c].item);
		}
	}
};

DrawingManager.prototype.update = function() {
	//Called by the SAGE2 animation loop
	this.drawRubberbandWall();
	this.movePickedUpItem();
	this.menu.checkForButtonUnderPointer(this.point.x, this.point.y);
	var data = toGrid(this.point, this.gridSize);
	if (this.pointChanged === true) {
		this.sendData('setPoint', {id: this.clientId, point: data});
		this.pointChanged = false;
	}
	if (this.pickedUpItem) {
		var id = this.pickedUpItem.item.id;
		var type = this.getType(id);
		this.sendData('transformElement', this.structure[type][id]);
	}
	
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
			this.dACanvas.add(el);
			var el1 = this.canvasObjects.walls[key + '_end1'];
			el1.set({left: list[0], top: list[1],
				width: this.outerWallOptions.strokeWidth, height: this.outerWallOptions.strokeWidth});
			this.dACanvas.add(el1);
			var el2 = this.canvasObjects.walls[key + '_end2'];
			el2.set({left: list[2], top: list[3],
				width: this.outerWallOptions.strokeWidth, height: this.outerWallOptions.strokeWidth});
			this.dACanvas.add(el2);
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
			
			this.dACanvas.add(el);
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
			
			this.dACanvas.add(el);
		}
	}
};

DrawingManager.prototype.drawMeasurements = function() {
	var measurements = this.canvasObjects.measurements;
	for (var key in measurements) {
		if (measurements.hasOwnProperty(key) === true) {
			var m = measurements[key];
			this.dACanvas.add(m);
		}
	}
}


DrawingManager.prototype.drawGrid = function() {
	//Draw grid
	var canvas = this.dACanvas;
	//canvas.clear();
	canvas.setBackgroundColor("#efefef");
	var width = parseInt(this.drawingArea.style.width);
	var height = parseInt(this.drawingArea.style.height);
	var i;
	var gridLineSpacing = 2;
	for (i = 0; i < (width / this.gridSize); i+= gridLineSpacing) {
		canvas.add(new fabric.Line([i * this.gridSize, 0, i * this.gridSize, height], {
			class: 'gridline',
			stroke: '#ccc',
			selectable: false,
			evented: false
		}));
	}
	for (i = 0; i < (height / this.gridSize); i+= gridLineSpacing) {
		canvas.add(new fabric.Line([0, i * this.gridSize, width, i * this.gridSize], {
			class: 'gridline',
			stroke: '#ccc',
			selectable: false,
			evented: false
		}));
	}
};

DrawingManager.prototype.resize = function() {
	this.dACanvas.setHeight(parseInt(this.app.sage2_height - 60));
	this.dACanvas.setWidth(parseInt(this.app.sage2_width - 80));
	this.drawingAreaWrap.style.left = "40px";
	this.setMeasurements();
	var currentHeight = parseInt(this.drawingArea.style.height);
	var currentWidth = parseInt(this.drawingArea.style.width);
	this.helpText.set({
		left: 50,
		top: 50,
		fontSize: currentHeight * 0.02
	});
	this.selectedObjectDescriptor.set({
		left: 50,
		top: 50 + currentHeight * 0.05,
		fontSize: currentHeight * 0.02
	});
	var buttonSize = currentHeight * 0.1;
	this.directionSymbol.setSize(buttonSize / 2, buttonSize / 2);
	this.directionSymbol.setPosition(currentWidth - buttonSize - 50, 50);
	this.menu.setSize({width: buttonSize, height: buttonSize});

	this.draw();
};

DrawingManager.prototype.setMeasurements = function() {
	this.perFeet = parseInt(this.drawingArea.style.width) / this.widthInFeet;
	this.gridSize =  this.perFeet; // 1 unit = 1 ft
	this.wallThickness = (6.5 / 12) * this.perFeet;
	this.doorWidth = (38.625 / 12) * this.perFeet;
	this.doorOpeningWidth = this.doorWidth + 2 * this.wallThickness;
	this.halfDoorOpeningWidth = this.doorOpeningWidth / 2;
	this.halfDoorWidth = this.doorWidth / 2;
	this.windowWidth = (46.5 / 12) * this.perFeet;
	this.windowOpeningWidth = this.windowWidth + 2 * this.wallThickness;
	this.measurementTextSize = parseInt(this.drawingArea.style.height) * 0.02;
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
	var selectedObject = this.dACanvas.getActiveObject();
	if (selectedObject) {
		this.rotationdata = {
			angle0: selectedObject.angle,
			x0: this.point.x,
			y0: this.point.y
		};
		console.log("beginRotation", selectedObject.angle);
	} else {
		this.sm.transition('fSelected');
	}
};

DrawingManager.prototype.rotateSelectedItem = function() {
	var selectedObject = this.dACanvas.getActiveObject();
	if (selectedObject) {
		var type = selectedObject.id.slice(0, 2);
		if (type !== 'WD' && type !== 'DR' && type !== 'WL') {
			var x = this.point.x - this.rotationdata.x0;
			var y = this.point.y - this.rotationdata.y0;
			var angle = this.rotationdata.angle0 + x;
			selectedObject.rotate(angle);
			this.structure.furnitures[selectedObject.id].angle = angle;
			this.dACanvas.requestRenderAll();
			this.sendData('transformElement', this.structure.furnitures[selectedObject.id]);
		}
		console.log('rotateSelectedItem', this.point.x, angle);
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
		this.dACanvas.remove(this.selectionArea);
		this.groupSelectionBegun = false;
		console.log('clearSelection');
	}
	this.dACanvas.discardActiveObject();
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.groupSelect = function() {
	this.selectionArea.setCoords();
	var objs = this.dACanvas.getObjects();
	var selectedList = [];
	objs.forEach(o => {
		if (o !== this.selectionArea && this.selectionArea.intersectsWithObject(o) === true && o.class !== 'gridline') {
			selectedList.push(o);
		}
	});

	var selection = new fabric.ActiveSelection(selectedList, {
		canvas: this.dACanvas,
		hasControls: false,
		hasBorder: false
	});

	this.dACanvas.setActiveObject(selection);
	this.selectionArea.set({
		left: 0,
		top: 0,
		width: 0,
		height: 0
	});
	this.dACanvas.remove(this.selectionArea);
	
	this.dACanvas.requestRenderAll();
	console.log('groupSelect');
};

DrawingManager.prototype.deleteSelection = function() {
	var selectedObject = this.dACanvas.getActiveObject();
	console.log(selectedObject);
	this.dACanvas.discardActiveObject();
	var id = selectedObject.id;
	var type = this.getType(id);
	var element = this.structure[type][id];
	if (type === 'doorsAndWindows') {
		//this.mergeWallAroundItem(selectedObject[0].id);
		var parentWall = this.structure.walls[element.parentId];
		parentWall.children.splice(parentWall.children.indexOf(element.id), 1);
		this.removeFromWall(id);
		this.sendData('removeFromWall', {id: id});
	} else if (type === 'walls') {
		element.children.forEach(cId => {
			this.removeElement(cId);
			this.sendData('removeElement', {id: cId});
		});
	}
	
	this.removeElement(id);
	this.sendData('removeElement', {id: id});
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.select = function() {
	//Previously selected object
	var selectedObject = this.dACanvas.getActiveObject();
	var objs = this.dACanvas.getObjects();
	var pointer = this.pointerRect;
	pointer.TL.setXY(this.point.x, this.point.y);
	var selected = false;
	
	for(var i = objs.length - 1; i > -1; i--) {
		var o = objs[i];
		if (o.class !== 'gridline' && this.dACanvas.isTargetTransparent(o, this.point.x, this.point.y) === false) {
			selected = true;
			//console.log(o.id, this.point, o.id.slice(0, 2));
			this.dACanvas.setActiveObject(o);
			
			switch(o.id.slice(0, 2)) {
				case 'DR':
				case 'WD':
					this.sm.transition('dwSelected');
					break;
				case 'WL':
					if (selectedObject && selectedObject.id === o.id) {
						this.sm.transition('pointOfInterest');
					}
					break;
				default:
					this.sm.transition('fSelected');
					break;
			}
			break;
		}
	}
	if (selected === false) {
		this.callDeselect = true;
	} else {
		this.callDeselect = false;
	}
	this.dACanvas.requestRenderAll();
	console.log('select');
};

DrawingManager.prototype.deSelect = function() {
	if (this.callDeselect) {
		this.dACanvas.discardActiveObject();
		this.dACanvas.requestRenderAll();

	}
};

DrawingManager.prototype.pickupSelectedItem = function() {
	var selectedObject = this.dACanvas.getActiveObject();
	this.dACanvas.discardActiveObject();
	
	var type = this.getType(selectedObject.id);
	console.log(selectedObject, type);
	if (type === 'doorsAndWindows') {
		console.log("removeFromWall");
		this.removeFromWall(selectedObject.id);
		this.sendData('removeFromWall', {id: selectedObject.id});		
	}
	this.pickUpItem(selectedObject);
};

DrawingManager.prototype.startNewWall = function() {
	this.currentWall = {
		id: getUniqueId2D('WL'),
		points: []
	};
	this.dACanvas.add(this.rubberbandWall);
	this.dACanvas.add(this.rubberbandWallMeasurement);
	this.rubberbandDrawing = true;
	console.log("start new Wall");
};

DrawingManager.prototype.pushPoint = function() {
	var gridPoint = toGrid(this.point, this.gridSize);
	this.currentWall.points.push(gridPoint);
	if (this.currentWall.points.length === 1) {
		this.rubberbandWall.set({
			x1: gridPoint.x * this.gridSize,
			y1: gridPoint.y * this.gridSize,
			x2: gridPoint.x * this.gridSize,
			y2: gridPoint.y * this.gridSize,
			strokeWidth: this.wallThickness
		});
	}
	console.log("push point");
};

DrawingManager.prototype.popPoint = function() {
	if (this.currentWall.points.length === 1) {
		this.currentWall.points.pop();
		this.dACanvas.remove(this.rubberbandWall);
		this.dACanvas.remove(this.rubberbandWallMeasurement);
	}
	this.rubberbandDrawing = false;
};

DrawingManager.prototype.drawRubberbandWall = function() {
	// Draw rubberband wall
	if (this.rubberbandDrawing === true) {
		if (this.currentWall.points.length === 1) {
			var P2 = toGrid(this.point, this.gridSize);
			var P1 = this.currentWall.points[0];
			var dx = Math.abs(P1.x - P2.x);
			var dy = Math.abs(P1.y - P2.y);
			var mx = ((P1.x + P2.x) / 2) * this.gridSize;
			var my = ((P1.y + P2.y) / 2) * this.gridSize;
			var temp = Math.sqrt(dx * dx + dy * dy).toFixed(1).split('.');
			var dist = temp[0] ;
			dist += (temp[1] === '0') ? ' \' ' : ' \' '  + fractionLookup[temp[1]] + ' \"';
			this.rubberbandWallMeasurement.set({
				text: dist,
				left: (dx > dy)? mx : mx + this.wallThickness * 2,
				top: (dx > dy)? my - this.wallThickness * 2 : my,
				fontSize: this.measurementTextSize 
			});
			this.rubberbandWall.set({
				x2: P2.x * this.gridSize,
				y2: P2.y * this.gridSize
			});
		}
		//console.log("drawRubberbandWall");
		this.dACanvas.requestRenderAll();
	}
};

DrawingManager.prototype.saveWall = function(wall) {
	var wallSplitting = (wall !== undefined);
	wall = wall || this.currentWall;
	if (wall.points.length === 2) {
		/*wall.points.sort(function(a, b) {
			if (a.x === b.x) {
				return a.y - b.y;
			}
			return a.x - b.x;
		});*/
		this.outerWallOptions.id = wall.id;
		this.outerWallOptions.strokeWidth = this.wallThickness;
		var dx = wall.dx = wall.points[1].x - wall.points[0].x;
		var dy = wall.dy = wall.points[1].y - wall.points[0].y;
		wall.length = Math.sqrt(dx * dx + dy * dy);
		var theta = Math.atan2(dy, dx);
		wall.angle = theta * 180 / Math.PI;
		wall.sinTheta = Math.sin(theta);
		wall.cosTheta = Math.cos(theta);
		var list = this.geometry.getXYListForPoints(wall.points, this.gridSize);
		var wallObj = new fabric.Line(list, this.outerWallOptions);
		wall.children = [];
		this.dACanvas.remove(this.rubberbandWall);
		this.dACanvas.remove(this.rubberbandWallMeasurement);
		this.rubberbandDrawing = false;

		
		//Add rects at the end of the wall to cover corners
		var endPointOptions = {
			id: wall.id + '_end1',
			left: list[0],
			top: list[1],
			fill: this.outerWallOptions.stroke,
			width: this.outerWallOptions.strokeWidth,
			height: this.outerWallOptions.strokeWidth,
			originX: 'center',
			originY: 'center',
			hasControls: false,
			hasBorder: false
		}
		var corners1 = new fabric.Rect(endPointOptions);
		endPointOptions.id = wall.id + '_end2';
		endPointOptions.left = list[2];
		endPointOptions.top = list[3];
		var corners2 = new fabric.Rect(endPointOptions);
		this.addElement(wall, wallObj, [corners1, corners2]);
		if (wallSplitting === false) {
			this.sendData('addElement', wall);
		}
	}
};

DrawingManager.prototype.editWall = function() {
	var wallObj = this.dACanvas.getActiveObject();
	this.dACanvas.discardActiveObject();
	var wall = this.structure.walls[wallObj.id];
	if (wall.children.length > 0) {
		this.sm.transition('S');
		return;
	}
	var xyList = this.geometry.getXYListForPoints(wall.points, this.gridSize);
	var closer = closerPoint(xyList, this.point);
	var farther = 1 - closer;
	var fixed, moving;
	moving = wall.points[closer];
	fixed = wall.points[farther];
	this.currentWall = {
		id: wall.id,
		points: [fixed]
	};
	closer = closer * 2;
	farther = farther * 2;
	this.rubberbandWall.set({
		x1: xyList[farther],
		y1: xyList[farther + 1],
		x2: xyList[closer],
		y2: xyList[closer + 1]
	});

	this.removeElement(wall.id);
	this.sendData('removeElement', {id: wall.id});
	this.dACanvas.add(this.rubberbandWall);
	this.dACanvas.add(this.rubberbandWallMeasurement);
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
	this.dACanvas.add(wall);
	this.dACanvas.remove(this.rubberbandWall);
	this.dACanvas.remove(this.rubberbandWallMeasurement);
	this.rubberbandDrawing = false;
	this.dACanvas.requestRenderAll();	
};


DrawingManager.prototype.pickupDoor = function() {
	this.pickUpItem(new DoorShape({
		id: getUniqueId2D('DR'), // Door or Window
		left: 0,
		top: 0,
		originX: 'center',
		originY: 'center',
		stroke: 'black',
		fill: 'black',
		height: this.wallThickness,
		width: this.doorOpeningWidth,
		perPixelTargetFind: true,
		hasBorder: false,
		hasControls: false
	}));
	var item = this.pickedUpItem.item;
	var type = this.getType(item.id);
	var gridPoint = toGrid(this.point, this.gridSize);
	var element = {
		id: item.id,
		point: gridPoint,
		angle: item.angle,
	};
	this.addElement(element, item);
	this.sendData('addElement', element);
};

DrawingManager.prototype.pickupWindow = function() {
	this.pickUpItem(new WindowShape({
		id: getUniqueId2D('WD'), // Window
		left: 0,
		top: 0,
		originX: 'center',
		originY: 'center',
		stroke: 'black',
		fill: 'black',
		perPixelTargetFind: true,
		height: this.wallThickness,
		width: this.windowOpeningWidth,
		hasBorder: false,
		hasControls: false
	}));
	var item = this.pickedUpItem.item;
	var type = this.getType(item.id);
	var gridPoint = toGrid(this.point, this.gridSize);
	var element = {
		id: item.id,
		point: gridPoint,
		angle: item.angle,
	};
	this.addElement(element, item);
	this.sendData('addElement', element);
};

DrawingManager.prototype.setPickupFurnitureType = function(type) {
	this.pickupFurnitureType = type;
};

DrawingManager.prototype.pickupFurniture = function() {
	try {
		var furniture = Furnitures[this.pickupFurnitureType];
		console.log(this.pickupFurnitureType);
		this.pickUpItem(new furniture({
			id: getUniqueId2D(this.pickupFurnitureType), // Window
			left: 0,
			top: 0,
			originX: 'center',
			originY: 'center',
			stroke: 'black',
			strokeWidth: 2,
			fill: 'rgba(220, 220, 220, 1.0)',
			perPixelTargetFind: true,
			height: this.furnitureDim[this.pickupFurnitureType].height,
			width: this.furnitureDim[this.pickupFurnitureType].width,
			hasBorder: false,
			hasControls: false
		}));
		var item = this.pickedUpItem.item;
		var type = this.getType(item.id);
		var gridPoint = toGrid(this.point, this.gridSize);
		var element = {
			id: item.id,
			point: gridPoint,
			angle: item.angle,
		};
		this.addElement(element, item);
		this.sendData('addElement', this.structure[type][item.id]);

	} catch(err) {
		this.sm.transition('x');
	}
	this.pickupFurnitureType = null;
};

DrawingManager.prototype.setPoint = function(point) {
	var x = point.x - parseInt(this.drawingAreaWrap.style.left);
	var y = point.y - parseInt(this.drawingAreaWrap.style.top);
	if (x > 0 && y > 0) {
		this.point = {
			x: x,
			y: y
		};
		this.active = true;
		this.pointChanged = true;
	} else {
		this.active = false;
	}
};

DrawingManager.prototype.movePickedUpItem = function() {
	if (this.pickedUpItem) {
		this.pickedUpItem.item.set({
			left: this.point.x,
			top: this.point.y
		});
		var objs = this.dACanvas.getObjects();
		var id = this.pickedUpItem.item.id;
		var type = this.getType(id);
		var element = this.structure[type][id];
		element.point = toGrid(this.point, this.gridSize);
		element.angle = this.pickedUpItem.item.angle;
		//console.log("Set Furniture");
		this.dACanvas.requestRenderAll();
	}
};

DrawingManager.prototype.setPickedUpItem = function() {
	var objs = this.dACanvas.getObjects();
	var item = this.pickedUpItem.item;
	console.log("Set Furniture");
	var objectsInTheWay = false;
	item.setCoords();
	for(var i = 0; i < objs.length && !objectsInTheWay; i++) {
		var o = objs[i];
		if (o.class !== 'gridline' && o.id !== item.id && item.intersectsWithObject(o) === true) {
			objectsInTheWay = o;
		}
	}
	if (!objectsInTheWay) {
		var item = this.pickedUpItem.item;
		var id = item.id;
		var type = this.getType(id);
		var element = this.structure[type][id];
		element.point = toGrid(this.point, this.gridSize);
		element.angle = item.angle;
		this.dropItem(true);
		this.sm.transition('fSelected'); // Get back to Selection state
	} else {
		console.log(objectsInTheWay);
		console.log(item);
	}
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.processInput = function(type, char) {
	if (this.active === true) {
		//console.log("processInput", type, char)
		if (type === 'keyboard') {
			if (char === "m") {
				this.menu.moveTo(this.point);
			} else {
				this.sm.transition(char);	
			}
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
		this.widthInFeet -= 10;
	} else {
		this.widthInFeet += 10;
	}
	if (this.widthInFeet > this.maxWidthInFeet) {
		this.widthInFeet = this.maxWidthInFeet;
	} else if (this.widthInFeet < this.minWidthInFeet) {
		this.widthInFeet = this.minWidthInFeet;
	}
	this.setMeasurements();
	this.draw();
};
DrawingManager.prototype.alignDoorOrWindowOnWall = function() {
	var objs = this.dACanvas.getObjects('line');
	console.log('alignDoorOnWall');
	var wallUnderPoint = null;
	for(var i = 0; i < objs.length; i++) {
		var o = objs[i];
		if (o.class !== 'gridline' && o.id.indexOf('WL') > -1 && this.dACanvas.isTargetTransparent(o, this.point.x, this.point.y) === false) {
			wallUnderPoint = o;
			break;
		}
	}
	if (wallUnderPoint) {
		var wall = this.structure.walls[wallUnderPoint.id];
		this.pickedUpItem.item.rotate(wall.angle);
		console.log(angle);
		this.dACanvas.setActiveObject(wallUnderPoint);
		this.dACanvas.bringToFront(this.pickedUpItem.item);
	} else {
		this.pickedUpItem.item.rotate(0);
		this.dACanvas.discardActiveObject();
	}

	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.setDoorOrWindow = function() {
	var objs = this.dACanvas.getObjects('line');
	console.log("Set door or window");
	var wallUnderPoint = null;
	for(var i = 0; i < objs.length; i++) {
		var o = objs[i];
		if (o.class !== 'gridline' && o.id.indexOf('WL') > -1 && this.dACanvas.isTargetTransparent(o, this.point.x, this.point.y) === false) {
			wallUnderPoint = o;
			var newDoorOrWindowPlacement = this.checkPlacementPoint(wallUnderPoint);
			console.log(newDoorOrWindowPlacement.point.x, this.gridSize);
			if (newDoorOrWindowPlacement !== null) {
				this.pickedUpItem.item.set({
					left: newDoorOrWindowPlacement.point.x * this.gridSize,
					top: newDoorOrWindowPlacement.point.y * this.gridSize
				});
				var element = this.structure.doorsAndWindows[newDoorOrWindowPlacement.id];
				element.point = newDoorOrWindowPlacement.point;
				element.angle = newDoorOrWindowPlacement.angle;
				this.sendData('transformElement', this.structure.doorsAndWindows[newDoorOrWindowPlacement.id]);
				this.dACanvas.discardActiveObject();
				this.dACanvas.bringToFront(this.pickedUpItem.item);
				this.dropItem(true);
				this.addAsWallChild(newDoorOrWindowPlacement.id, wallUnderPoint.id);

				this.sendData('addAsWallChild', this.structure.doorsAndWindows[newDoorOrWindowPlacement.id]);
				this.sm.transition('dwSelected'); // Get out of Door state
			}
			break;
		}
	}

	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.addAsWallChild = function(elId, wallId) {
	var element = this.structure.doorsAndWindows[elId];
	var parentWall = this.structure.walls[wallId];
	if (parentWall.children.indexOf(elId) < 0) {
		parentWall.children.push(elId);
	}	
	element.parentId = wallId;

};
DrawingManager.prototype.removeFromWall = function(elId) {
	var element = this.structure.doorsAndWindows[elId];
	var parentWall = this.structure.walls[element.parentId];
	var idx = parentWall.children.indexOf(element.id);
	if (idx > -1) {
		parentWall.children.splice(idx, 1);	
	}
	element.parentId = null;
};

DrawingManager.prototype.checkPlacementPoint = function(wallObj, data) {
	var wall = this.structure.walls[wallObj.id];
	var angle = wall.angle;
	var point, width, id;
	if (data) {
		point = data.point;
		width = data.width;
		id = data.id;
	} else {
		point = toGrid(this.point, this.gridSize);
		width = this.pickedUpItem.item.get('width');
		id = this.pickedUpItem.item.id;
	}
	var l1 = distance(point.x, point.y, wall.points[0].x, wall.points[0].y);
	var L = wall.length;
	var halfWidth = width * 0.5 / this.gridSize;
	var l2 = L - l1;
	var l3 = l1 - halfWidth;
	var l4 = l2 - halfWidth;
	if (l3 < 0 || l4 < 0) {
		return null;
	}
	var doorPosition = pointOnParametricLine(wall.points, 0, 1, l1 / L);
	return {
		id: id,
		point: doorPosition,
		angle: angle,
		parentId: null
	};
}


DrawingManager.prototype.pickUpItem = function(item) {
	this.pickedUpItem = {
		itemStroke: item.get('stroke'),
		//itemFill: item.get('fill'),
		item: item
	};
	item.set('stroke', 'rgba(120, 120, 200, 1.0)');
	//item.set('fill', 'rgba(120, 120, 200, 1.0)');
	//this.dACanvas.setActiveObject(item);
	item.setCoords();
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.getType = function(id) {
	var type = id.slice(0, 2);
	if (type === 'WL') {
		return 'walls';
	} else if (type === 'DR' || type === 'WD') {
		return 'doorsAndWindows';
	} else {
		return 'furnitures';
	}
};

DrawingManager.prototype.dropItem = function(donotRemove) {
	if (this.pickedUpItem === null) {
		return;
	}
	if (donotRemove) {
		this.pickedUpItem.item.set('stroke', this.pickedUpItem.itemStroke);
		//this.pickedUpItem.item.set('fill', this.pickedUpItem.itemFill);
		this.pickedUpItem.item.setCoords();
		this.dACanvas.requestRenderAll();
	} else {
		this.sendData('removeElement', {id: this.pickedUpItem.item.id});
		this.removeElement(this.pickedUpItem.item.id);

	}
	
	this.pickedUpItem = null;
};

DrawingManager.prototype.addElement = function(element, canvasObject, extras) {
	var id = element.id;
	var type = this.getType(id);
	this.dACanvas.remove(canvasObject);
	this.dACanvas.add(canvasObject);
	this.structure[type][id] = element;
	this.canvasObjects[type][id] = canvasObject;
	if (extras) {
		console.log(extras);
		extras.forEach(e => {
			this.canvasObjects[type][e.id] = e;
			this.dACanvas.remove(e);
			this.dACanvas.add(e);
		});
	}
};

DrawingManager.prototype.removeElement = function(id) {
	var type = null;
	if (id.indexOf('WL') > -1) {
		type = 'walls';
	} else if (id.indexOf('DR') > -1 || id.indexOf('WD') > -1) {
		type = 'doorsAndWindows';
	} else {
		type = 'furnitures';
	}
	console.log(id, this.structure[type][id],  this.canvasObjects[type][id]);
	delete this.structure[type][id];
	this.dACanvas.remove(this.canvasObjects[type][id]);
	delete this.canvasObjects[type][id];
	if (type === 'walls') {
		this.dACanvas.remove(this.canvasObjects[type][id + '_end1']);
		delete this.canvasObjects[type][id + '_end1'];
		this.dACanvas.remove(this.canvasObjects[type][id + '_end2']);
		delete this.canvasObjects[type][id + '_end2'];
	}
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.updateHelpText = function() {
	this.helpText.set({
		text: this.helpDict[this.sm.currentState]
	});
	this.dACanvas.requestRenderAll();
};

function toGrid(point, gridSize) {
    return {
    	x: Math.round(point.x / gridSize),
    	y: Math.round(point.y / gridSize)
    }
};


DrawingManager.prototype.setupServerConnection = function() {
	this.connectedToDataServer = false;
	this.wsio.onopen = function() {
		this.connectedToDataServer = true;
		console.log('Connected to data server');
		this.requestStructure();
	}.bind(this);
	this.wsio.onclose = function() {
		this.connectedToDataServer = false;
	}.bind(this);
	this.wsio.onmessage = function(message) {
		this.processSyncData(JSON.parse(message.data));	
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

DrawingManager.prototype.requestStructure = function() {
	this.sendData('sync');
};

DrawingManager.prototype.processSyncData = function(data) {
	//console.log(data);

	switch(data.action) {
		case "sync":
			this.buildStructure(data.data);
			this.clientId = getUniqueId2D('CM'); //Potential bug if more clients of same type join
			this.sendData('addNewClient', {id: this.clientId});
			break;
		case "clients":
			data.data.forEach(d => {
				if (d.id !== this.clientId) {
					this.addNewClient(d.id);
				}	
			});
			
			break;
		case "camera":
			this.transformClient(data.data);
			break;
		case "addElement":
			var type = data.data.id.slice(0, 2);
			if (type === 'WL') {
				this.addWall(data.data);
			} else if (type === 'DR' || type === 'WD') {
				this.addDoorOrWindow(type, data.data);
			} else {
				this.addFurniture(data.data);
			}
			//this.structure[type][id] = data.data;
			break;
		case "removeElement":
			console.log("remove ", data.data.id);
			this.removeElement(data.data.id);
			break;
		case "transformElement":
			this.transformElement(data.data);
			break;
		
	}
};

DrawingManager.prototype.transformElement = function(element) {
	var id = element.id;
	var type = this.getType(id);
	var obj = this.canvasObjects[type][id];
	if (obj) {
		if (element.angle) {
			obj.rotate(element.angle);
		}
		obj.set({
			left: element.point.x * this.gridSize,
			top: element.point.y * this.gridSize
		});
	}
	this.structure[type][id] = element;
	this.dACanvas.requestRenderAll();
};

DrawingManager.prototype.addWall = function(wall) {
	if (wall.points.length === 2) {
		/*wall.points.sort(function(a, b) {
			if (a.x === b.x) {
				return a.y - b.y;
			}
			return a.x - b.x;
		});*/
		this.outerWallOptions.id = wall.id;
		this.outerWallOptions.strokeWidth = this.wallThickness;
		var dx = wall.dx = wall.points[1].x - wall.points[0].x;
		var dy = wall.dy = wall.points[1].y - wall.points[0].y;
		wall.length = Math.sqrt(dx * dx + dy * dy);
		var theta = Math.atan2(dy, dx);
		wall.angle = theta * 180 / Math.PI;
		wall.sinTheta = Math.sin(theta);
		wall.cosTheta = Math.cos(theta);
		var list = this.geometry.getXYListForPoints(wall.points, this.gridSize);
		var wallObj = new fabric.Line(list, this.outerWallOptions);
			
		//Add rects at the end of the wall to cover corners
		var endPointOptions = {
			id: wall.id + '_end1',
			left: list[0],
			top: list[1],
			fill: this.outerWallOptions.stroke,
			width: this.outerWallOptions.strokeWidth,
			height: this.outerWallOptions.strokeWidth,
			originX: 'center',
			originY: 'center',
			hasControls: false,
			hasBorder: false
		}
		var corners1 = new fabric.Rect(endPointOptions);
		endPointOptions.id = wall.id + '_end2';
		endPointOptions.left = list[2];
		endPointOptions.top = list[3];
		var corners2 = new fabric.Rect(endPointOptions);
		this.addElement(wall, wallObj, [corners1, corners2]);
	}
};

DrawingManager.prototype.addDoorOrWindow = function(shortType, element) {
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
			var shape = {
				DR: DoorShape,
				WD: WindowShape
			};
			var item = new shape[shortType]({
				id: element.id, // Door or Window
				left: newDoorOrWindowPlacement.point.x * this.gridSize,
				top: newDoorOrWindowPlacement.point.y * this.gridSize,
				originX: 'center',
				originY: 'center',
				stroke: 'black',
				fill: 'black',
				height: this.wallThickness,
				width: data.width,
				perPixelTargetFind: true,
				hasBorder: false,
				hasControls: false
			});
			if (newDoorOrWindowPlacement.angle) {
				item.rotate(newDoorOrWindowPlacement.angle);
			}
			this.addElement(newDoorOrWindowPlacement, item);
			this.dACanvas.bringToFront(item);
			this.addAsWallChild(newDoorOrWindowPlacement.id, wallId);
		}

		this.dACanvas.requestRenderAll();
	}
};

DrawingManager.prototype.addFurniture = function(element) {
	try {
		var id = element.id;
		var type = this.getType(id);
		var shortType = id.slice(0, 2);
		var furniture = Furnitures[shortType];
		var obj = new furniture({
			id: id,
			left: element.point.x * this.gridSize,
			top: element.point.y * this.gridSize,
			originX: 'center',
			originY: 'center',
			stroke: 'black',
			strokeWidth: 2,
			fill: 'rgba(220, 220, 220, 1.0)',
			perPixelTargetFind: true,
			height: this.furnitureDim[shortType].height,
			width: this.furnitureDim[shortType].width,
			hasBorder: false,
			hasControls: false
		});
		if (element.angle) {
			obj.rotate(element.angle);
		}
		this.addElement(element, obj);
		this.dACanvas.requestRenderAll();
	} catch(err) {
		console.log(err);
	}
};

DrawingManager.prototype.buildStructure = function(structure) {
	console.log("buildStructure", structure);
	if (this.structureBuilt !== true) {
		for (var w in structure.walls) {
			if (structure.walls.hasOwnProperty(w)) {
				this.addWall(structure.walls[w]);
			}
		}
		for (var d in structure.doorsAndWindows) {
			if (structure.doorsAndWindows.hasOwnProperty(d)) {
				this.addDoorOrWindow(d.slice(0, 2), structure.doorsAndWindows[d]);
			}
		}
		for (var f in structure.furnitures) {
			if (structure.furnitures.hasOwnProperty(f)) {
				this.addFurniture(structure.furnitures[f]);
			}
		}
		this.structureBuilt = true;
	}
	

};

DrawingManager.prototype.addNewClient = function(id) {
	var clientType = id.slice(2, 4);
	console.log(id, id.slice(0, 2), clientType);
	if (this.clients[id] === undefined) {
		var client = new ClientShape[clientType]({
			id: id,
			left: 0,
			top: 0,
			originX: 'center',
			originY: 'center',
			stroke: 'black',
			strokeWidth: 3,
			fill: 'rgba(220, 220, 220, 1.0)',
			height: this.clientDim[clientType].height,
			width: this.clientDim[clientType].width,
			hasBorder: false,
			hasControls: false
		});
		this.clients[id] = {
			item: client,
			point: {x: 0, y: 0},
			angle: 0
		}
		this.dACanvas.add(client);
		this.dACanvas.requestRenderAll();
	}
	
};

DrawingManager.prototype.transformClient = function(clientEl) {
	if (clientEl) {
		console.log(this.clients, clientEl);
		var clientObj = this.clients[clientEl.id];
		clientObj.point = clientEl.point;
		clientObj.angle = clientEl.angle;
		clientObj.item.set({
			left: clientObj.point.x * this.gridSize,
			top: clientObj.point.y * this.gridSize
		});
		clientObj.item.rotate(clientObj.angle);
		this.dACanvas.requestRenderAll();
	}
};
