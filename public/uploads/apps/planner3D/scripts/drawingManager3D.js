function DrawingManager3D(app, serverStr) {
	this.app = app;
	this.serverStr = serverStr;
	this.drawingAreaWrap = document.createElement("div");
	this.drawingAreaWrap.style.position = "absolute";
	this.drawingAreaWrap.style.display = "block";
	this.app.element.appendChild(this.drawingAreaWrap);

	this.drawingArea = document.createElement("canvas");
	this.drawingArea.id = app.id + "_drawingArea";
	
	this.drawingAreaWrap.appendChild(this.drawingArea);
	
	
	this.drawingAreaWrap.style.top = "30px";



	this.gridSize = 30;
	
	this.renderer = new THREE.WebGLRenderer( { canvas: this.drawingArea, antialias: true } );
	this.renderer.shadowMap.enabled = true;
	this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
	this.scene = new THREE.Scene();
	this.sceneOverview = new THREE.Scene();
	this.scene.background = new THREE.Color().setRGB(11, 35, 91);
	
	/*this.light1 = new THREE.DirectionalLight("0xffffff", 5, 100);
	this.light1.position.set(0.1, 1, 0.1);
	this.light1.castShadow = true;
	this.light1.shadow.mapSize.width = 512;  // default
	this.light1.shadow.mapSize.height = 512; // default
	this.light1.shadow.camera.near = 0.5;    // default
	this.light1.shadow.camera.far = 500;     // default
	this.scene.add(this.light1);*/
	this.scene.background = new THREE.Color(0xBEDAF7);
	this.sceneOverview.background = new THREE.Color(0xCCCCCC);
	this.fov = 60;
	this.camera = new THREE.PerspectiveCamera(this.fov, 16/9, 0.1, 10000);
	this.cameraBase = new THREE.Object3D();
	this.cameraBase.add(this.camera);
	this.scene.add(this.cameraBase);
	var offsetX = ui.offsetX;
	console.log(offsetX);
	this.size = 121.92; // mts
	
	this.divisions = parseInt(this.size * 3.28084);
	this.origin = new THREE.Vector3(this.size / 2.0, 0, this.size / 2.0);
	
	this.structure = {
		walls: {},
		doorsAndWindows: {},
		furnitures: {},
		flags: {}
	};
	this.allSceneObjects = {};
	this.pickableSceneObjects = [];
	this.wallObjects = [];
	this.modelDict = {};
	this.pickedUpItem = null;
	this.clients = {};
	this.flagTimeOut = 1000 * 60 * 3; // Three minutes
	this.clientId = getUniqueId3D('CM');
	this.init();
	this.setupScene();
	this.createMenu();
	this.resize();
	/*if (this.app.isClientWithLeftEdge()) {
		offsetX = this.app.sage2_x + parseInt(this.drawingAreaWrap.style.left);
		console.log(offsetX);
	}*/
	//this.camera.setViewOffset(parseInt(ui.main.style.width), parseInt(ui.main.style.height), offsetX , ui.offsetY, ui.main.clientWidth, ui.main.clientHeight);
	
	this.camera.updateProjectionMatrix();
	this.cameraBase.position.set(this.size / 8.0, 1.6, this.size / 8.0);
	this.setupCamerasForMultipleViews();
	this.translator = new ViewPortTranslator(30); // 30 fps
	this.viewMode = 'perspective';
	this.maximized = 1;
	this.axes = {
		x: new THREE.Vector3(1, 0, 0),
		y: new THREE.Vector3(0, 1, 0),
		z: new THREE.Vector3(0, 0, 1)
	};
	//this.axesLines = new THREE.AxesHelper(5);
};

DrawingManager3D.prototype.renderSingleView = function() {
	//requestAnimationFrame(this.render.bind(this));
	this.renderer.render(this.scene, this.camera);
};

DrawingManager3D.prototype.renderMultipleViews =  function() {
	var result = this.translator.getViewPortValues();
	var viewPortValues = result.viewPortValues;
	//console.log(result);
	var viewIndices = result.indices;
	viewIndices.sort(function (a, b) {
		return viewPortValues[b].z - viewPortValues[a].z;
	});
	this.mainCamera = this.multiViewCameras[result.mainCameraIdx];
	for (var ii = 0; ii < viewIndices.length; ++ii) {
		var i = viewIndices[ii];
		var camera = this.multiViewCameras[i];
		//console.log(ii, i, camera);
		var left   = Math.floor(this.dAWidth  * viewPortValues[i].x);
		var top    = Math.floor(this.dAHeight * viewPortValues[i].y);
		var width  = Math.floor(this.dAWidth  * viewPortValues[i].z);
		var height = Math.floor(this.dAHeight * viewPortValues[i].w);
		this.renderer.setViewport(left, top, width, height);
		this.renderer.setScissor(left, top, width, height);
		this.renderer.setScissorTest(true);
		//this.renderer.setClearColor(view.background);
		camera.aspect = width / height;
		
		camera.updateProjectionMatrix();
		this.renderer.render((i === 3) ? this.sceneOverview: this.scene, camera);
	}
	if (result.inTranslation === true) {
		this.requestRendering();
	} else if (result.indices.length === 1 && result.indices[0] === 0) {
		this.camera.aspect = this.dAWidth / this.dAHeight;
		this.render = this.renderSingleView;
		this.effectiveCanvasWidth = this.dAWidth;
		this.requestRendering();
	}
};

DrawingManager3D.prototype.requestRendering = function() {
	requestAnimationFrame(this.render.bind(this));
};

DrawingManager3D.prototype.setupCamerasForMultipleViews = function(callback) {
	//<a-entity camera="userHeight: 1.6" look-controls></a-entity>
	this.multiViewCameras = [this.camera];
	var aspect = 0.75 * this.dAWidth / this.dAHeight;
	this.views = [
		{
			eye: new THREE.Vector3(this.origin.x, 100, this.origin.z),
			left: this.size / -8, right: this.size / 8, top: this.size / (8 * aspect),
			bottom: this.size / (-8 * aspect), near: 1, far: 10000,
			up: [0, 0, -1],
			scene: this.scene
		}, {
			eye: new THREE.Vector3(0, 1.6, 100),
			left: this.size / -16, right: this.size / 16, top: this.size / (8 * aspect),
			bottom: -2, near: 1, far: 10000,
			up: [0, 1, 0],
			scene: this.scene
		}, {
			eye: new THREE.Vector3(this.origin.x, 100, this.origin.z),
			left: this.size / -2, right: this.size / 2, top: this.size / (2 * aspect),
			bottom: this.size / (-2 * aspect), near: 1, far: 10000,
			up: [0, 0, -1],
			scene: this.scene
		}
	];
	//New aspect ratio because of multiple views is calculated as below.
	// (W - w) / H === w / (H / 3) ==> w === 0.75 * W
	
	var camera, view;
	for (var ii =  0; ii < this.views.length; ++ii) {
		var view = this.views[ii];
		camera = new THREE.OrthographicCamera(view.left, view.right, view.top,
			view.bottom, view.near, view.far);
		
		camera.position.copy(view.eye);
		camera.up.fromArray(view.up);
		camera.lookAt(this.origin);
		this.multiViewCameras.push(camera);
	}
};

DrawingManager3D.prototype.changeMode = function(mode) {
	var modes = {
		perspective: [[0, 1, 2, 3], [4, 5, 5, 5]],
		plan: [[3, 0, 1, 2], [5, 4, 5, 5]],
		elevation: [[2, 3, 0, 1], [5, 5, 4, 5]],
		front: [[1, 2, 3, 0], [5, 5, 5, 4]]
	}
	if (mode === "maximized") {
		this.maximized = 1 - this.maximized;
	} else {
		this.viewMode = mode || this.viewMode;
	}

	this.translator.startTranslation(modes[this.viewMode][this.maximized]);
	this.render = this.renderMultipleViews;
	this.requestRendering();
};
DrawingManager3D.prototype.init = function() {
	this.sm = new fsm3D();
	this.sm.init(this.app.id, 7, 12); // Ten states, 15 kinds of input
	this.sm.setInputMap({
		pointerPress: 0,
		pointerMove: 1,
		pointerRelease: 2,
		pointerScroll: 3,
		leftArrow: 4,
		rightArrow: 5,
		onObject: 6,
		menuOpt: 7,
		x: 8, X: 8,
		WL: 9,
		DR: 10,
		WD: 11,
	});
	
	this.sm.copyTransitions([
		//dn, mv, up, scr, l, r, oo, mo, x, W, D,  I
		[1, 0,	0,	0,	0,	0,	0,	0,	0,	4,	6,	6], // Start
		[1, 3,	0,	1,	1,	1,	2,	1,	1,	5,	6,	1], 
		[2, 2,	0,	2,	2,	2,	2,	2,	2,	2,	2,	2],
		[3, 3,	0,	3,	3,	3,	3,	3,	3,	3,	3,	3],
		[5,	4, 	4,  4,	4,	4,	4,	4,	0, 	4,	7, 	7], // Start Wall
		[0,	5, 	5, 	5,	5,	5,	5,	5,	0,	0, 	5, 	5], // Draw Wall
		[6,	6, 	6, 	6, 	6, 	6, 	0, 	6, 	0, 	6, 	6, 	6] // Add door or Window
		//[8,	7, 	0, 	8, 	8, 	8, 	8, 	8, 	8, 	8, 	8, 	8] // Edit door or window

	]);
	this.sm.setActionContext(this);
	this.sm.copyActions([
		['select', null, null, 'zoom', 'objectRotateLeft', 'objectRotateRight', null, 'toggleMenu', 'deleteSelection', 'startHighlight', 'pickupDoorOrWindow', 'pickupDoorOrWindow'],
		[null, 'rotateCamera', 'clearSelection', null, null, null, null, null, null, ['startHighlight', 'editWall'], 'pickupSelectedDoorOrWindow', null],
		[null, 'moveObject', null, null, null, null, null, null],
		[null, 'rotateCamera', null, null, null, null, null, null],
		[['startNewWall','pushPoint'], null, null, 'zoom', null, null, null, null, 'stopHighlight', null, null, null],
		[['pushPoint','saveWall', 'stopHighlight'], null, null, 'zoom', null, null, null, null, ['popPoint', 'stopHighlight'], 'stopHighlight', null, null],
		['setDoorOrWindow', 'alignDoorOrWindowOnWall', null, 'zoom', null, null, null, null, 'dropDoorOrWindow', null, null, null]
	]);

	this.user = {};
	this.render = this.renderSingleView;
	this.requestRendering();
	this.boundingBoxForScaleAdjust = new THREE.Box3();
};

DrawingManager3D.prototype.createMenu = function() {
	var menu = new Planner3DMenu(this.app, this.camera, {columns: 3});
	menu.setReference(this.cameraBase);
	var menuPositionNormalized = new THREE.Vector2(100 / this.dAWidth * 2 - 1, - 100 / this.dAHeight * 2 + 1);
	menu.setPosition(menuPositionNormalized);

	menu.setSize(0.2, 0.2);
	this.menu = menu;
	this.requestRendering();
};

DrawingManager3D.prototype.toggleMenu = function(userId) {
	var point = this.user[userId].point;
	this.menu.setPosition(point, this.effectiveCanvasWidth, this.dAHeight, this.fov);
	this.menu.toggleMenuAttachment();
};

DrawingManager3D.prototype.setupScene = function() {
	this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
	this.hemiLight.color.setHSL(0.6, 1, 0.6);
	this.hemiLight.groundColor.setHSL(0.095, 1, 0.75);
	this.hemiLight.position.set(0, 50, 0);
	this.scene.add(this.hemiLight);

	this.dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
	this.dirLight.color.setHSL(0.55, 1, 0.91);
	//this.dirLight.color.setHSL(0.55, 1, 0.91);
	//this.dirLight.position.copy(this.origin);
	this.dirLight.position.x += 0.3;
	/*this.dirLight.position.y += 1;
	this.dirLight.position.z += -0.3;*/
	this.dirLight.lookAt(this.origin);
	//this.dirLight.position.set(- 1, 1.75, 1);
	//this.dirLight.position.multiplyScalar(30);
	this.scene.add(this.dirLight);

	this.dirLight.castShadow = true;

	this.dirLight.shadow.mapSize.width = 2048;
	this.dirLight.shadow.mapSize.height = 2048;

	var d = 400;

	this.dirLight.shadow.camera.left = this.origin.x - d;
	this.dirLight.shadow.camera.right = this.origin.x + d;
	this.dirLight.shadow.camera.top = this.origin.z + d;
	this.dirLight.shadow.camera.bottom = this.origin.z - d;

	this.dirLight.shadow.camera.far = 50000;
	//this.dirLight.shadow.bias = - 0.0000001;


	// GROUND

	var groundGeo = new THREE.PlaneBufferGeometry(this.size, this.size);
	var groundMat = new THREE.MeshPhongMaterial({ color: 0xAA9285, shininess: 0.8, emissive: 0x4c4949 });
	//groundMat.color.setRGB(21, 33, 47);

	this.ground = new THREE.Mesh( groundGeo, groundMat );
	this.ground.position.copy(this.origin);
	//this.ground.position.y = -0.1;
	this.ground.rotation.x = Math.PI / -2;
	this.ground.receiveShadow = true;
	this.scene.add(this.ground);

	this.gridObject = new THREE.GridHelper(this.size, this.divisions);
	this.gridObject.userData.id = 'grid';
	this.gridObject.position.copy(this.origin);
	this.scene.add(this.gridObject);
	// SKYDOME
	var skyboxGeo = new THREE.BoxGeometry(200, 200, 200);
	var skyBoxMats = [];
	for (var i = 1; i < 7; i++) {
		var texture = new THREE.TextureLoader().load(this.app.resrcPath + 'images/skybox/' + i + '.jpg');
		skyBoxMats.push(new THREE.MeshBasicMaterial({
			map: texture,
			side: THREE.BackSide
		}));
	}
	var skybox = new THREE.Mesh(skyboxGeo, skyBoxMats);
	skybox.position.copy(this.origin);
	this.scene.add(skybox);
	

};



DrawingManager3D.prototype.draw = function() {
	
};

DrawingManager3D.prototype.drawStructure = function() {
	
};

DrawingManager3D.prototype.drawMeasurements = function() {
	
}


DrawingManager3D.prototype.drawGrid = function() {
	
};

DrawingManager3D.prototype.resize = function() {
	this.drawingArea.style.height = parseInt(this.app.sage2_height - 60) + 'px';
	this.drawingArea.style.width = parseInt(this.app.sage2_width - 80) + 'px';
	this.drawingAreaWrap.style.left =  "40px";

	this.drawingAreaAspect = parseInt(this.drawingArea.style.width) / parseInt(this.drawingArea.style.height);
	this.dAWidth = parseInt(this.drawingArea.style.width);
	this.dAHeight = parseInt(this.drawingArea.style.height);
	this.renderer.setSize(this.dAWidth, this.dAHeight);
	this.camera.aspect = this.drawingAreaAspect;
	this.camera.updateProjectionMatrix();
	this.hFOV = 2 * Math.atan(Math.tan(this.camera.fov / 2) * this.drawingAreaAspect);
	var menuPositionNormalized = new THREE.Vector2(50 / this.dAWidth * 2 - 1, - 50 / this.dAHeight * 2 + 1);
	this.menu.setPosition(menuPositionNormalized);
	this.setMeasurements();
	//this.menu.setSize()
	this.effectiveCanvasWidth = this.dAWidth;
	this.requestRendering();
	//this.draw();
};

DrawingManager3D.prototype.setMeasurements = function() {
	this.perFeet = parseInt(this.drawingArea.style.width) / this.widthInFeet;
	this.feetToMeter = 0.3048;
	this.meterToFeet = 1 / this.feetToMeter;
	this.gridSize =  this.perFeet; // 1 unit = 2 ft
	this.wallThickness = (6.5 / 12) * this.feetToMeter;
	this.wallHeight = 8 * this.feetToMeter;
	this.doorWidth = (38.625 / 12) * this.feetToMeter;
	this.doorOpeningWidth = this.doorWidth + 2 * this.wallThickness;
	this.halfDoorOpeningWidth = this.doorOpeningWidth / 2;
	this.halfDoorWidth = this.doorWidth / 2;
	this.windowWidth = (46.5 / 12) * this.feetToMeter;
	this.windowOpeningWidth = this.windowWidth + 2 * this.wallThickness;
	this.measurementTextSize = this.gridSize / 2.0;
	this.userRadius = 15;
	this.floorY = 0;
	this.couchDim = {
		width: 7 * this.feetToMeter,
		height: (34 / 12) * this.feetToMeter,
		depth: (35 / 12) * this.feetToMeter
	};
	this.furnitureDim = {
		PT: {
			width: (72 / 12) * this.feetToMeter,
			height: (70 / 12) * this.feetToMeter,
			depth: (2 / 12) * this.feetToMeter
		},
		CO: {
			width: 7 * this.feetToMeter,
			height: (34 / 12) * this.feetToMeter,
			depth: (35 / 12) * this.feetToMeter
		},
		CR: {
			width: (18 / 12) * this.feetToMeter,
			height: (31.5 / 12) * this.feetToMeter,
			depth: (17.5 / 12) * this.feetToMeter
		},
		OC: {
			width: (25 / 12) * this.feetToMeter,
			height: (42 / 12) * this.feetToMeter,
			depth: (24 / 12) * this.feetToMeter
		},
		SC: {
			width: (30 / 12) * this.feetToMeter,
			height: (40 / 12) * this.feetToMeter,
			depth: (35 / 12) * this.feetToMeter
		},
		ST: {
			width: (23 / 12) * this.feetToMeter,
			height: (28 / 12) * this.feetToMeter,
			depth: (23 / 12) * this.feetToMeter
		},
		DK: {
			width: 7 * this.feetToMeter,
			height: (34 / 12) * this.feetToMeter,
			depth: (35 / 12) * this.feetToMeter
		},
		TB: {
			width: 6 * this.feetToMeter,
			height: (34 / 12) * this.feetToMeter,
			depth: 4 * this.feetToMeter
		},
		CT: {
			width: (30 / 12) * this.feetToMeter,
			height: (25 / 12) * this.feetToMeter,
			depth: (30 / 12) * this.feetToMeter
		},
		CB: {
			width: 2 * this.feetToMeter,
			height: 5 * this.feetToMeter,
			depth: 3 * this.feetToMeter
		},
		DA: {
			width: 4 * this.feetToMeter,
			height: (34 / 12) * this.feetToMeter,
			depth: (35 / 12) * this.feetToMeter
		},
		FT: {
			width: (23 / 12) * this.feetToMeter,
			height: (35 / 12) * this.feetToMeter,
			depth: (23 / 12) * this.feetToMeter
		},
		RB: {
			width: 3 * this.feetToMeter,
			height: 3 * this.feetToMeter,
			depth: 1 * this.feetToMeter
		},
		VM: {
			width: 3.5 * this.feetToMeter,
			height: 6 * this.feetToMeter,
			depth: 3 * this.feetToMeter
		},
		DR: {
			width: this.doorOpeningWidth,
			height: (82 / 12) * this.feetToMeter,
			depth: (14 / 12) * this.feetToMeter
		},
		WD: {
			width: this.windowOpeningWidth,
			height: 4 * this.feetToMeter,
			depth: (14 / 12) * this.feetToMeter
		},
		FG: {
			width: 2 * this.feetToMeter,
			height: 50 * this.feetToMeter,
			depth: 2 * this.feetToMeter
		}
	};
	this.clientDim = {
		'3D': {
			width: 20 * this.feetToMeter,
			depth: 0.5 * this.feetToMeter,
			height: 11.25 * this.feetToMeter
		},
		'2D': {
			width: 2 * this.feetToMeter,
			height: 0.2 * this.feetToMeter,
			depth: 4 * this.feetToMeter
		},
		'VR': {
			width: 3 * this.feetToMeter,
			height: 5 * this.feetToMeter,
			depth: 1.5 * this.feetToMeter
		}
	}
};




DrawingManager3D.prototype.setPoint = function(point, user, date) {
	var x = point.x - parseInt(this.drawingAreaWrap.style.left);
	var y = point.y - parseInt(this.drawingAreaWrap.style.top);
	var temp;
	try {
		if (x > 0 && y > 0) {
			this.user[user.id].delta.set(x, y); // Set new value
			this.user[user.id].delta.sub(this.user[user.id].point); // Sub by old
			this.user[user.id].point.set(x, y); // Set new value
			this.user[user.id].active = true;
			//console.log(x, y);
			this.user[user.id].normalizedPoint.set(x / this.dAWidth * 2 - 1, - y / this.dAHeight * 2 + 1, 1);
			this.timestamp = date;
			
		} else {
			this.user[user.id].active = false;
			this.scene.remove(this.user[user.id].laser);
		}
	} catch(err) {
		console.log(err);
		this.user[user.id] = {
			point: new THREE.Vector2(),
			normalizedPoint: new THREE.Vector3(),
			rayCaster: new THREE.Raycaster(),
			laser: new THREE.ArrowHelper(this.axes.z, this.origin, 1, user.color),
			floorHighlight: getFloorHighlight(this.feetToMeter, user.color),
			sm: this.sm.clone(user.id), //Important
			scroll: 0,
			selectedObj: null,
			active: true,
			delta: new THREE.Vector2(),
			dragStart: {},
			selectionHighlight: new THREE.BoxHelper(new THREE.Object3D(), user.color),
			color: new THREE.Color(user.color),
			buttonUnderPointer: null,
			dot: new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial( { color: user.color })),
			rubberbandWall: getWireframeWall(this.wallHeight, this.wallThickness, user.color),
			rubberbandDrawing: false
		};
		this.scene.add(this.user[user.id].laser);
	}
	//this.movePickedUpItem();
};



DrawingManager3D.prototype.processInput = function(type, data, user) {
	if (this.user[user.id].active === true) {
		//console.log("processInput", type, data, user.id);
		switch (type) {
			case 'keyboard':
				switch (data) {
					case "1":
						this.changeMode("maximized");
						break;
					case "2":
						this.changeMode("perspective");
						break;
					case "3":
						this.changeMode("plan");
						break;
					case "4":
						this.changeMode("elevation");
						break;
					case "5":
						this.changeMode("front");
						break;
					case "m":
						data = "menuOpt";
						break;
				}
				this.user[user.id].sm.transition(data);
				break;
			case 'pointerMove':
			case 'pointerRelease':
				this.user[user.id].sm.transition(type);
				break;
			case 'pointerScroll':
				this.user[user.id].scroll = data.wheelDelta / 200;
				this.user[user.id].sm.transition(type);
				break;
			case 'specialKey':
				this.user[user.id].sm.transition(data);
				break;
			case 'pointerPress':
				if (this.user[user.id].buttonUnderPointer !== null) {
					console.log("buttonClicked!");
					this.user[user.id].buttonUnderPointer.click(user.id);
				} else {
					this.user[user.id].sm.transition(type);
				}
			
			default:
				break;
		}
	}
};

DrawingManager3D.prototype.startNewWall = function(userId) {
	this.user[userId].currentWall = {
		id: getUniqueId3D('WL'),
		updateCounter: 1,
		points: []
	};
	this.scene.add(this.user[userId].rubberbandWall);
	this.user[userId].rubberbandDrawing = true;
	console.log("start new Wall");
};

DrawingManager3D.prototype.pushPoint = function(userId) {
	var point = this.user[userId].floorHighlight.position.clone();
	this.user[userId].currentWall.points.push(point);
	
	console.log("push point");
};


DrawingManager3D.prototype.startHighlight = function(userId) {
	this.scene.add(this.user[userId].floorHighlight);
	this.user[userId].showFloorHighlight = true;
};

DrawingManager3D.prototype.stopHighlight = function(userId) {
	this.scene.remove(this.user[userId].floorHighlight);
	this.user[userId].showFloorHighlight = false;
};

DrawingManager3D.prototype.updateFloorHighlight = function(userId) {
	if (this.user[userId].showFloorHighlight === true) {
		temp = this.user[userId].rayCaster.intersectObject(this.ground);
		if (temp.length > 0) {
			temp = temp[0];
			if (temp.distance < this.userRadius) {
				this.user[userId].floorHighlight.position.copy(this.toGrid(temp.point));
				this.user[userId].floorHighlight.position.setY(this.floorY + 0.01);
			}
		}
	}
};

DrawingManager3D.prototype.popPoint = function(userId) {
	if (this.user[userId].currentWall.points.length === 1) {
		this.user[userId].currentWall.points.pop();
		this.scene.remove(this.user[userId].rubberbandWall);
	}
	this.user[userId].rubberbandDrawing = false;
};

DrawingManager3D.prototype.drawRubberbandWall = function(userId) {
	// Draw rubberband wall
	if (this.user[userId].rubberbandDrawing === true) {
		if (this.user[userId].currentWall.points.length === 1) {
			var P2 = this.user[userId].floorHighlight.position.clone();
			var P1 = this.user[userId].currentWall.points[0];
			var P = P2.clone();
			P.add(P1).multiplyScalar(0.5);
			this.user[userId].rubberbandWall.scale.setX(P1.distanceTo(P2));
			this.user[userId].rubberbandWall.quaternion.setFromUnitVectors(this.axes.x, P2.sub(P1).normalize());
			this.user[userId].rubberbandWall.position.set(P.x, P.y + this.wallHeight / 2.0, P.z);
		}
		//console.log("drawRubberbandWall");
	}
};

DrawingManager3D.prototype.saveWall = function(userId, smInput) {
	var wall = this.user[userId].currentWall;
	console.log(wall);
	if (wall.points.length === 2) {
		var dx = wall.dx = wall.points[1].x - wall.points[0].x;
		var dy = wall.dy = wall.points[1].z - wall.points[0].z;
		wall.length = Math.sqrt(dx * dx + dy * dy) * this.meterToFeet;
		var theta = Math.atan2(dy, dx);
		wall.angle = theta * 180 / Math.PI;
		wall.sinTheta = Math.sin(theta);
		wall.cosTheta = Math.cos(theta);
		wall.children = [];
		wall.points = [{
			x: wall.points[0].x * this.meterToFeet,
			y: wall.points[0].z * this.meterToFeet
		}, {
			x: wall.points[1].x * this.meterToFeet,
			y: wall.points[1].z * this.meterToFeet
		}];
		this.scene.remove(this.user[userId].rubberbandWall);
		this.rubberbandDrawing = false;
		this.addWall(wall);

		this.sendData('addElement', wall);
		console.log("saveWall");
	}
};


DrawingManager3D.prototype.editWall = function(userId) {
	var wallObj = this.user[userId].selectedObj;
	var intersectionPoint = this.user[userId].intersectionPoint;
	
	var wall = this.structure.walls[wallObj.userData.id];
	if (wall.children.length > 0) {

		this.sm.transition('WL');
		return;
	}
	this.discardActiveObject(userId);
	var vecList = wall.points.map(d => {
		return new THREE.Vector3(d.x * this.feetToMeter, 0, d.y * this.feetToMeter);
	});
	var closer = closerPoint(vecList, intersectionPoint);
	var farther = 1 - closer;
	var fixed = vecList[farther];
	this.user[userId].currentWall = {
		id: wall.id,
		updateCounter: wall.updateCounter + 1,
		points: [fixed]
	};
	

	this.removeElement(wall.id);
	this.sendData('removeElement', {id: wall.id});
	this.scene.add(this.user[userId].rubberbandWall);
	this.user[userId].rubberbandDrawing = true;

	console.log("Begin edit wall");


};


DrawingManager3D.prototype.select = function(userId) {
	var selectedObj = this.user[userId].selectedObj;
	var intersects = this.user[userId].rayCaster.intersectObjects(this.pickableSceneObjects, true);
	var intersectionPoint;
	if (intersects.length > 0) {
		intersectionPoint = intersects[0].point;
		intersects = intersects[0].object;
		while(intersects.parent !== this.scene) {
			if (intersects.userData.id) {
				intersects.parent.userData.id = intersects.userData.id;
			}
			intersects = intersects.parent;
		}
		var selectedId = intersects.userData.id;
		this.setActiveObject(userId, intersects, intersectionPoint);
		console.log(this.user[userId].selectedObj, selectedId);
		switch(selectedId.slice(0, 2)) {
			case 'WL':
				if (selectedObj && selectedObj.userData.id === selectedId) {
					this.user[userId].sm.transition('WL');
				}
				break;
			case 'DR':
			case 'WD':
				if (selectedObj && selectedObj.userData.id === selectedId) {
					console.log("reaching here");
					this.user[userId].sm.transition('DR');
				}
				console.log("reaching here too!");
				break;
			default:
				this.user[userId].sm.transition('onObject');
				break;
		}
	}
};

DrawingManager3D.prototype.setActiveObject = function(userId, obj, point) {
	this.discardActiveObject(userId);
	this.user[userId].selectedObj = obj;
	this.user[userId].intersectionPoint = point;
	this.user[userId].selectionHighlight.setFromObject(obj);
	this.scene.add(this.user[userId].selectionHighlight);
	this.requestRendering();
};

DrawingManager3D.prototype.discardActiveObject = function(userId) {
	if (this.user[userId].selectedObj !== null) {
		this.scene.remove(this.user[userId].selectionHighlight);
		this.user[userId].intersectionPoint = null;
		this.user[userId].selectedObj = null;
		this.requestRendering();
	}
};

DrawingManager3D.prototype.deleteSelection = function(userId) {
	if (this.user[userId].selectedObj !== null) {
		this.scene.remove(this.user[userId].selectionHighlight);
		var selectedObj = this.user[userId].selectedObj;
		var id = this.user[userId].selectedObj.userData.id;
		var type = this.getType(id);
		var element = this.structure[type][id];
		this.discardActiveObject(userId);
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
		this.requestRendering();
	}
};

DrawingManager3D.prototype.zoom = function(userId) {
	//console.log('zoom');
	this.cameraBase.translateZ(this.user[userId].scroll);
	if (this.cameraBase.position.z > this.origin.z + this.size / 2) {
		this.cameraBase.position.z = this.origin.z + this.size / 2;
	} else if (this.cameraBase.position.z < this.origin.z + this.size / -2) {
		this.cameraBase.position.z = this.origin.z + this.size / -2;
	}
	if (this.cameraBase.position.x > this.origin.x + this.size / 2) {
		this.cameraBase.position.x = this.origin.x + this.size / 2;
	} else if (this.cameraBase.position.x < this.origin.x + this.size / -2) {
		this.cameraBase.position.x = this.origin.x + this.size / -2;
	}
	if (this.cameraBase.position.y > this.origin.y + this.size / 2) {
		this.cameraBase.position.y = this.origin.y + this.size / 2;
	} else if (this.cameraBase.position.y < this.origin.y + this.size / -2) {
		this.cameraBase.position.y = this.origin.y + this.size / -2;
	}
	for(var i = 1; i < this.multiViewCameras.length; i++) {
		this.multiViewCameras[i].position.copy(this.cameraBase.position);
		this.multiViewCameras[i].position.setComponent(i % 3, 100 + this.cameraBase.position.getComponent(i % 3));
		this.multiViewCameras[i].lookAt(this.cameraBase.position);
	}
	
	this.cameraMoved = true;
	this.requestRendering();
};

DrawingManager3D.prototype.rotateCamera = function(userId) {
	//console.log('rotateCamera');
	if (Math.abs(this.user[userId].delta.x) > Math.abs(this.user[userId].delta.y)) {
		var angleDeltaY = this.user[userId].delta.x * this.camera.fov / this.dAWidth;
		this.cameraBase.rotateY(angleDeltaY);
	} else {
		var angleDeltaX = this.user[userId].delta.y * this.hFOV / this.dAHeight;
		this.camera.rotateX(angleDeltaX);
	}
	this.cameraMoved = true;
	this.requestRendering();
};


DrawingManager3D.prototype.moveObject = function(userId) {
	//console.log('moveObject');
	// Move object along ray
	if (this.user[userId].selectedObj) {
		var id = this.user[userId].selectedObj.userData.id;
		var type = this.getType(id);
		if (type === 'doorsAndWindows') {
			return;
		}
		var intersection = this.user[userId].rayCaster.intersectObject(this.gridObject, true);
		if (intersection.length > 0) {
			intersection = intersection[0];
			if (intersection.distance < this.userRadius) {
				this.user[userId].selectedObj.position.copy(intersection.point);
				this.user[userId].selectedObj.position.setY(this.floorY);
				this.user[userId].selectionHighlight.update();
				var element = this.structure[type][id];
				element.point = {
					x: intersection.point.x * this.meterToFeet,
					y: intersection.point.z * this.meterToFeet
				};
				if (type === "flags") {
					element.touchedAt = this.timestamp;
				}
				this.user[userId].selectedObjMoved = true;
			}
		}
	}
	

};

DrawingManager3D.prototype.objectRotateRight = function(userId) {
	var id = this.user[userId].selectedObj.userData.id;
	var type = this.getType(id);
	if (type === "furnitures") {
		this.user[userId].selectedObj.rotation.y -= 0.1;
		this.user[userId].selectionHighlight.update();
		this.structure[type][id].angle = -this.user[userId].selectedObj.rotation.y * 180 / Math.PI;
		this.user[userId].selectedObjMoved = true;
	}
};

DrawingManager3D.prototype.objectRotateLeft = function(userId) {
	var id = this.user[userId].selectedObj.userData.id;
	var type = this.getType(id);
	if (type === "furnitures") {
		this.user[userId].selectedObj.rotation.y += 0.1;
		this.user[userId].selectionHighlight.update();
		this.structure[type][id].angle = -this.user[userId].selectedObj.rotation.y * 180 / Math.PI;
		this.user[userId].selectedObjMoved = true;
	}
};

DrawingManager3D.prototype.addModel = function(model, data) {
	this.modelDict[data.id] = data;
	this.modelDict[data.id].model = model;
	//console.log(model);
	if (data.doNotAddToMenu) {
		return;
	}

	var addModelToScene = function (userId, smInput) {
		var cameraDir = new THREE.Vector3();
		this.camera.getWorldDirection(cameraDir);
		cameraDir.multiplyScalar(3);
		cameraDir.add(this.cameraBase.position);
		cameraDir.setY(this.floorY);
		var elementData = {
			id: getUniqueId3D(smInput),
			position: cameraDir,
			rotation: new THREE.Vector3(0, Math.atan2((this.cameraBase.position.x - cameraDir.x), (this.cameraBase.position.z - cameraDir.z)), 0),
			scale: new THREE.Vector3()
		}
		this.addElement(elementData);
		var type = this.getType(elementData.id);
		this.structure[type][elementData.id].updateCounter = 0;
		//console.log(this.structure[type][elementData.id]);
		this.sendData('addElement', this.structure[type][elementData.id]);
	};

	var makeSmTransition = function(userId, smInput) {
		this.user[userId].sm.transition(smInput);
	};
	//console.log(data, this.menu, this.app.resrcPath + data.iconUrl, data.id);
	var callback = (model && data.smTrigger !== true) ? addModelToScene : makeSmTransition;
	this.menu.addButton(data.id, this.app.resrcPath + data.iconUrl,
		this.app.resrcPath + data.iconHoverUrl, callback.bind(this));
	this.menu.arrangeButtons();
};

DrawingManager3D.prototype.toGrid = function(point) {
    return point.clone().multiplyScalar(this.meterToFeet).ceil().multiplyScalar(this.feetToMeter);
}


DrawingManager3D.prototype.update = function(date) {
	//Called by the SAGE2 animation loop
	this.timestamp = date;
	var type, id, tp, element;
	for (var u in this.user) {
		if (this.user.hasOwnProperty(u) === true) {
			tp = this.user[u].normalizedPoint;
			this.user[u].rayCaster.setFromCamera(this.user[u].normalizedPoint, this.camera);
			this.user[u].laser.position.copy(this.cameraBase.position);
			this.user[u].laser.setDirection(this.user[u].rayCaster.ray.direction);
			this.user[u].laser.setLength(20, 0.1, 0.1);
			
			temp = this.user[u].rayCaster.intersectObjects(this.menu.buttonSprites);
			if (temp.length > 0) {
				temp = temp[0].object;
				temp = this.menu.buttonDict[temp.userData.id];
				if (this.user[u].buttonUnderPointer  && this.user[u].buttonUnderPointer.id !== temp.id) {
					this.user[u].buttonUnderPointer.hoverEnd();
				}
				temp.hover();
				this.user[u].buttonUnderPointer = temp;
			} else if (this.user[u].buttonUnderPointer) {
				this.user[u].buttonUnderPointer.hoverEnd();
				this.user[u].buttonUnderPointer = null;
			}
			

			this.updateFloorHighlight(u);

			temp = this.user[u].rayCaster.ray.direction;
			//this.sendData('setRayDirection', {id: u, x: temp.x, y: temp.z});
			if (this.user[u].selectedObjMoved) {
				id = this.user[u].selectedObj.userData.id;
				type = this.getType(id);
				element = this.structure[type][id];
				element.updateCounter = element.updateCounter + 1;
				this.sendData('transformElement', element);
				this.user[u].selectedObjMoved = false;
			}
			this.drawRubberbandWall(u);
		}
	}
	this.requestRendering();
	if (this.cameraMoved === true) {
		pos = this.cameraBase.position;
		angle = - this.cameraBase.rotation.y * 180 / Math.PI;
		this.sendData('camera', {
			id: this.clientId,
			point: {
				x: pos.x * this.meterToFeet,
				y: pos.z * this.meterToFeet
			},
			angle: angle
		});
		this.cameraMoved = false;
	}
	var oldFlagsIds = this.app.state.structure.flags.filter(x => {
		return (date - x.touchedAt) > this.flagTimeOut; 
	}).map(x => {
		return x.id;
	});

	oldFlagsIds.forEach(x => {
		this.removeElement(x);
		this.sendData('removeElement', {id: x});
	});
	
};


DrawingManager3D.prototype.setupServerConnection = function() {
	this.connectedToDataServer = false;
	this.wsio.addEventListener('open', function() {
		this.connectedToDataServer = true;
		this.sendData('addClient', {id: this.clientId, structure: this.structure});
		console.log('Connected To Data Server');
	}.bind(this));
	this.wsio.addEventListener('close', function() {
		this.connectedToDataServer = false;
		this.wsio = null;
	}.bind(this));
	this.wsio.addEventListener('error', function() {
		this.connectedToDataServer = false;
		this.wsio = null;
	}.bind(this));
	this.wsio.addEventListener('message', function(message) {
		this.processServerMessage(JSON.parse(message.data));	
	}.bind(this));

};


DrawingManager3D.prototype.sendData = function (action, jsonData) {
	var data = JSON.stringify({action: action, data: jsonData});
	if (this.connectedToDataServer === true) {
		this.wsio.send(data);
	}
};


DrawingManager3D.prototype.processServerMessage = function(message) {
	//console.log(data);
	var action = message.action;
	var data = message.data;
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
		case "setPoint":
			console.log(data);
			this.transformClient(data);
			break;
		case "addElement":
			console.log("addElement!!!!");
			var type = data.id.slice(0, 2);
			if (type === 'WL') {
				this.addWall(data);
			} else if (type === 'DR' || type === 'WD') {
				this.addDoorOrWindow(data);
			} else {
				this.addFurnitureOrFlag(data);
			}
			//this.structure[type][id] = data.data;
			break;
		case "removeElement":
		console.log('remove!!!', data.id);
			this.removeElement(data.id);
			break;
		case "transformElement":
			console.log(data);
			this.transformElement(data);
			break;
		case "addAsWallChild":
			this.addAsWallChild(data);
			break;

		case "removeFromWall":
			this.removeFromWall(data);
			break;
	}
};


DrawingManager3D.prototype.addWall = function(element) {
	console.log(element);
	this.structure.walls[element.id] = element;
	var dupInArray = this.app.state.structure.walls.findIndex(x => {
		return x.id === element.id;
	});
	if (dupInArray > -1) {
		this.app.state.structure.walls[dupInArray] = element;
	} else {
		this.app.state.structure.walls.push(element);
	}
	var geometry = new THREE.BoxGeometry(element.length * this.feetToMeter, this.wallHeight, this.wallThickness, 32, 32, 8);

	//var material = new THREE.MeshBasicMaterial( {color: 0xffffff, vertexColors: THREE.FaceColors} );
	var wall = new THREE.Mesh(geometry, wallMaterial3D);
	wall.castShadow = true;
	wall.receiveShadow = true;
	var x = (element.points[0].x + element.points[1].x) / 2.0;
	var z = (element.points[0].y + element.points[1].y) / 2.0;
	wall.rotation.set(0, - element.angle * Math.PI / 180, 0);
	wall.position.set(x * this.feetToMeter, this.floorY + this.wallHeight / 2.0, z * this.feetToMeter);
	wall.userData.id = element.id;
	this.allSceneObjects[element.id] = wall;
	this.pickableSceneObjects.push(wall);
	this.wallObjects.push(wall);
	this.scene.add(wall);
	this.requestRendering();

};

DrawingManager3D.prototype.addDoorOrWindow = function(el) {
	console.log(el);
	var shortType = el.id.slice(0, 2);
	var height = this.furnitureDim[shortType].height;
	var floorOffset = (shortType === 'WD')? this.wallHeight / 2 : this.floorY +  height / 2.0;
	var elementData = {
		id: el.id,
		position: new THREE.Vector3(el.point.x * this.feetToMeter, floorOffset, el.point.y * this.feetToMeter),
		rotation: new THREE.Vector3(0, - el.angle * Math.PI / 180, 0),
		scale: new THREE.Vector3()
	};
	this.addElement(elementData);
	if (el.parentId) {
		this.addAsWallChild(el);
	}
 	this.requestRendering();

};

DrawingManager3D.prototype.addAsWallChild = function(data) {
	var id = data.id;
	var wallId = data.parentId;
	var element = this.structure.doorsAndWindows[id];
	var parentWall = this.structure.walls[wallId];
	if (parentWall.children.indexOf(id) < 0) {
		parentWall.children.push(id);
	}
	element.parentId = wallId;
	
	var wall = this.allSceneObjects[wallId];
	var hole = this.allSceneObjects[id];
	var modifiedWall = makeHole(wall, hole);
	console.log(element, parentWall);
	modifiedWall.castShadow = true;
	modifiedWall.receiveShadow = true;
	modifiedWall.position.copy(wall.position);
	modifiedWall.rotation.copy(wall.rotation);
	modifiedWall.userData.id = wallId;
	this.scene.remove(wall);
	this.allSceneObjects[wallId] = modifiedWall;
	var objIdx = this.pickableSceneObjects.findIndex(x => x === wall);
	if (objIdx > -1) {
		this.pickableSceneObjects.splice(objIdx, 1);
	}
	objIdx = this.wallObjects.findIndex(x => x === wall);
	if (objIdx > -1) {
		this.wallObjects.splice(objIdx, 1);
	}
	this.pickableSceneObjects.push(modifiedWall);
	this.wallObjects.push(modifiedWall);
	this.scene.add(modifiedWall);
	this.requestRendering();
};

DrawingManager3D.prototype.removeFromWall = function(data) {
	console.log("removeFromWall");
	var id = data.id;
	var element = this.structure.doorsAndWindows[id];
	var parentWall = this.structure.walls[element.parentId];
	var idx = parentWall.children.indexOf(element.id);
	if (idx > -1) {
		parentWall.children.splice(idx, 1);
	}
	element.parentId = null;
	var elementSceneObj = this.allSceneObjects[id];
	var parentWallObj = this.allSceneObjects[parentWall.id];
	var modifiedWall = closeHole(parentWallObj, elementSceneObj, this.wallThickness);
	//console.log(hole.position, hole.rotation);
	modifiedWall.castShadow = true;
	modifiedWall.receiveShadow = true;
	modifiedWall.userData.id = parentWallObj.userData.id;
	modifiedWall.position.copy(parentWallObj.position);
	modifiedWall.rotation.copy(parentWallObj.rotation);
	this.scene.remove(parentWallObj);
	this.allSceneObjects[parentWall.id] = modifiedWall;
	this.scene.add(modifiedWall);
	var objIdx = this.pickableSceneObjects.findIndex(x => x === parentWallObj);
	if (objIdx > -1) {
		this.pickableSceneObjects.splice(objIdx, 1);
	}
	objIdx = this.wallObjects.findIndex(x => x === parentWallObj);
	if (objIdx > -1) {
		this.wallObjects.splice(objIdx, 1);
	}
	this.pickableSceneObjects.push(modifiedWall);
	this.wallObjects.push(modifiedWall);
	this.requestRendering();
};


DrawingManager3D.prototype.addFurnitureOrFlag = function(el) {
	var elementData = {
		id: el.id,
		position: new THREE.Vector3(el.point.x * this.feetToMeter, this.floorY, el.point.y * this.feetToMeter),
		rotation: new THREE.Vector3(0, - el.angle * Math.PI / 180, 0),
		scale: new THREE.Vector3()
	};
	this.addElement(elementData);	
	this.requestRendering();
};

DrawingManager3D.prototype.transformElement = function(el) {
	var type = this.getType(el.id);
	var shortType = el.id.slice(0, 2);
	if (!this.structure[type][el.id]) {
		console.log('Error: Element not found - ' + el.id);
		return;
	}
	var floorOffset;
	if (type === 'doorsAndWindows') {
		var height = this.furnitureDim[shortType].height;
		floorOffset = (shortType === 'WD')? this.wallHeight / 2 : this.floorY +  height / 2.0;
	} else {
		floorOffset = this.floorY;
	}
	var element = this.structure[type][el.id];
	var sceneObj = this.allSceneObjects[el.id];
	if (el.point) {
		element.point = {x: el.point.x, y: el.point.y};
		sceneObj.position.set(el.point.x * this.feetToMeter, floorOffset, el.point.y * this.feetToMeter);

	}
	if (el.angle) {
		element.angle = el.angle;
		sceneObj.rotation.set(0, - element.angle * Math.PI / 180, 0);
	}
	this.requestRendering();
};

DrawingManager3D.prototype.addElement = function(elementData, useOriginalScale) {
	var type = this.getType(elementData.id);
	var shortType = elementData.id.slice(0, 2);
	console.log(elementData.id, type);
	var modelCopy = this.modelDict[shortType].model.clone();
	modelCopy.userData.id = elementData.id;
	if (useOriginalScale !== true) {
		this.adjustScaleForObject(modelCopy, shortType);	
	}
	modelCopy.rotation.setFromVector3(elementData.rotation);
	modelCopy.position.copy(elementData.position);
	this.allSceneObjects[elementData.id] = modelCopy;
	this.pickableSceneObjects.push(modelCopy);
	var element = {
		id:	elementData.id,
		point: {
			x: elementData.position.x * this.meterToFeet,
			y: elementData.position.z * this.meterToFeet
		},
		angle: - elementData.rotation.y * 180 / Math.PI
	};
	this.structure[type][elementData.id] = element;
	if (type === 'flags') { // FLAG
		element.touchedAt = this.timestamp;
	}
	var dupInArray = this.app.state.structure[type].findIndex(x => {
		return x.id === element.id;
	});
	if (dupInArray > -1) {
		this.app.state.structure[type][dupInArray] = element;
	} else {
		this.app.state.structure[type].push(element);
	}
	modelCopy.castShadow = true;
	modelCopy.receiveShadow = true;
	this.scene.add(modelCopy);
	return modelCopy;
};

DrawingManager3D.prototype.buildStructure = function(structure) {
	console.log("buildStructure", structure);
	structure.walls.forEach(wall => {
		if (this.structure.walls.hasOwnProperty(wall.id) === false) {
			this.addWall(wall);
		} else if (this.structure.walls[wall.id].updateCounter < wall.updateCounter) {
			this.removeElement(wall.id);
			this.addWall(wall);
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

DrawingManager3D.prototype.removeElement = function(eId) {
	console.log("removeElement", eId);
	var type = this.getType(eId);
	console.log(type, eId, this.structure[type]);
	var element = this.structure[type][eId];
	var sceneObject = this.allSceneObjects[element.id];
	this.scene.remove(sceneObject);
	var objIdx = this.pickableSceneObjects.findIndex(x => x === sceneObject);
	if (objIdx > -1) {
		this.pickableSceneObjects.splice(objIdx, 1);
	}
	objIdx = this.wallObjects.findIndex(x => x === sceneObject);
	if (objIdx > -1) {
		this.wallObjects.splice(objIdx, 1);
	}	
	delete this.structure[type][element.id];
	delete this.allSceneObjects[element.id];
	var entryInArray = this.app.state.structure[type].findIndex(x => {
		return x.id === element.id;
	});
	if (entryInArray > -1) {
		this.app.state.structure[type].splice(entryInArray, 1);
	}
	this.requestRendering();
};

DrawingManager3D.prototype.adjustScaleForObject = function(object, type, dim) {
	dim = dim || this.furnitureDim[type];
	if (dim !== undefined) {
		this.boundingBoxForScaleAdjust.setFromObject(object);
		var size = new THREE.Vector3();
		this.boundingBoxForScaleAdjust.getSize(size);
		object.scale.set(dim.width / size.x, dim.height / size.y, dim.depth / size.z);	
	}
	console.log(type, object.scale);
};


DrawingManager3D.prototype.addNewClient = function(id) {
	console.log("addNewClient", id);
	var clientType = id.slice(2, 4);
	if (this.clients[id] === undefined) {
		var client = this.modelDict[clientType].model.clone();
		this.clients[id] = {
			item: client,
			point: {x: 0, y: 0},
			angle: 0
		}
		this.adjustScaleForObject(client, clientType, this.clientDim[clientType]);
		this.scene.add(client);
	}
};

DrawingManager3D.prototype.transformClient = function(clientEl) {

	if (clientEl && this.clients[clientEl.id]) {
		console.log(this.clients, clientEl);
		var clientObj = this.clients[clientEl.id];
		clientObj.point = clientEl.point;
		clientObj.item.position.set(clientEl.point.x * this.feetToMeter, this.floorY, clientEl.point.y * this.feetToMeter);
		if (clientEl.angle) {
			clientObj.angle = clientEl.angle;
			clientObj.item.rotation.set(0, - el.angle * Math.PI / 180, 0);
		}
		this.requestRendering();
	} else {
		this.addNewClient(clientEl.id);
	}
};


DrawingManager3D.prototype.getType = function(id) {
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

DrawingManager3D.prototype.pickupDoorOrWindow = function(userId, smInput) {
	var position = new THREE.Vector3();
	this.user[userId].rayCaster.ray.at(4, position);	
	this.cameraBase.worldToLocal(position);
	var height = this.furnitureDim[smInput].height;
	var floorOffset = (smInput === 'WD')? this.wallHeight / 2 : this.floorY +  height / 2.0;
	var element = {
		id: getUniqueId3D(smInput),
		position: new THREE.Vector3(position.x, floorOffset, position.z),
		rotation: new THREE.Vector3(0, Math.atan2((this.cameraBase.position.x - position.x), (this.cameraBase.position.z - position.z)), 0),
		scale: new THREE.Vector3()
	};
	this.setActiveObject(userId, this.addElement(element));
	this.structure.doorsAndWindows[element.id].updateCounter = 0;
	this.sendData('addElement', this.structure.doorsAndWindows[element.id]);
};

DrawingManager3D.prototype.pickupSelectedDoorOrWindow = function(userId, smInput) {
	var id = this.user[userId].selectedObj.userData.id;
	this.removeFromWall({id: id});
	this.sendData('removeFromWall', {id: id});
};

DrawingManager3D.prototype.dropDoorOrWindow = function(userId) {
	var wd = this.user[userId].selectedObj;
	var eId = wd.userData.id;
	this.discardActiveObject(userId);
	this.removeElement(eId);
	this.sendData('removeElement', {id: eId});
};

DrawingManager3D.prototype.alignDoorOrWindowOnWall = function(userId, smInput) {
	var wd = this.user[userId].selectedObj;
	var type = wd.userData.id.slice(0, 2);
	var height = this.furnitureDim[type].height;
	var floorOffset = (type === 'WD')? this.wallHeight / 2 : this.floorY +  height / 2.0;
	var intersects = this.user[userId].rayCaster.intersectObjects(this.wallObjects, true);
	var intersectionPoint;
	if (intersects.length > 0) {
		intersectionPoint = intersects[0].point;
		intersects = intersects[0].object;
		while(intersects.parent !== this.scene) {
			if (intersects.userData.id) {
				intersects.parent.userData.id = intersects.userData.id;
			}
			intersects = intersects.parent;
		}
		wd.position.copy(intersectionPoint);
		wd.position.setY(floorOffset);
		wd.rotation.copy(intersects.rotation);
		this.setDoorOrWindowCandidate = intersects;
	} else {
		var position = new THREE.Vector3();
		this.user[userId].rayCaster.ray.at(4, position);	
		wd.position.set(position.x, floorOffset, position.z);
		wd.rotation.set(0, Math.atan2((this.cameraBase.position.x - position.x), (this.cameraBase.position.z - position.z)), 0);
		this.setDoorOrWindowCandidate = null;
	}
};

DrawingManager3D.prototype.setDoorOrWindow = function(userId, smInput) {
	var wd = this.user[userId].selectedObj;
	var type = wd.userData.id.slice(0, 2);
	var height = this.furnitureDim[type].height;
	var width = this.furnitureDim[type].width;
	var floorOffset = (type === 'WD')? this.wallHeight / 2 : this.floorY +  height / 2.0;
	if (this.setDoorOrWindowCandidate) {
		var wall = this.setDoorOrWindowCandidate;
		var intersectionPoint = wd.position;
		var dist = intersectionPoint.distanceTo(this.cameraBase.position) + this.wallThickness / 2.0;
		var doorOrWindowPos = new THREE.Vector3();
		doorOrWindowPos.subVectors(intersectionPoint, this.cameraBase.position).normalize();
		doorOrWindowPos.multiplyScalar(dist).add(this.cameraBase.position);
		wd.position.copy(doorOrWindowPos);
		wd.position.setY(floorOffset);
		var wallToWDDist = Math.abs(wall.position.x - intersectionPoint.x);
		var wallElement = this.structure.walls[wall.userData.id];
		if (wallToWDDist < (wallElement.length * this.feetToMeter - width) / 2.0) {
			console.log(wallToWDDist, wallElement.length, width, (wallElement.length * this.feetToMeter - width) / 2.0);
			var element = this.structure.doorsAndWindows[wd.userData.id];
			element.point = {
				x: wd.position.x * this.meterToFeet,
				y: wd.position.z * this.meterToFeet
			};
			element.angle = -wd.rotation.y * 180 / Math.PI;
			element.updateCounter = element.updateCounter + 1;
			this.sendData('transformElement', this.structure.doorsAndWindows[wd.userData.id]);
			this.discardActiveObject(userId);
			this.addAsWallChild({id: wd.userData.id, parentId: wall.userData.id});
			this.sendData('addAsWallChild', this.structure.doorsAndWindows[wd.userData.id]);
			this.user[userId].sm.transition('onObject'); // Get 
		}
		
	}
};