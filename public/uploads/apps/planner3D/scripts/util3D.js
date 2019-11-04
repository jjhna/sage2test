

var getUniqueId3D = function(prefix, param) {
	// reset the counter
	if (param && param === -1) {
		getUniqueId3D.count = 0;
		return;
	}
	var id = prefix + '3D' + getUniqueId3D.count.toString();
	getUniqueId3D.count++;
	return id;
};
getUniqueId3D.count = 0;


var distance = function(x1, y1, x2, y2) {
	return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
};

function spriteButton(message, iconUrl, parameters, callback) {
    if (parameters === undefined) parameters = {};

    var fontface = parameters.hasOwnProperty("fontface") ?
        parameters["fontface"] : "Arial";

    var fontsize = parameters.hasOwnProperty("fontsize") ?
        parameters["fontsize"] : 18;

    var borderThickness = parameters.hasOwnProperty("borderThickness") ?
        parameters["borderThickness"] : 4;

    var borderColor = parameters.hasOwnProperty("borderColor") ?
        parameters["borderColor"] : { r: 0, g: 0, b: 0, a: 1.0 };

    var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
        parameters["backgroundColor"] : { r: 255, g: 255, b: 255, a: 1.0 };

    //var spriteAlignment = THREE.SpriteAlignment.topLeft;

    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    context.font = "Bold " + fontsize + "px " + fontface;

    // get size data (height depends only on font size)
	var metrics = context.measureText(message);
	var textWidth = metrics.width;

	// background color
	context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
							+ backgroundColor.b + "," + backgroundColor.a + ")";
	// border color
	context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
							+ borderColor.b + "," + borderColor.a + ")";

	context.lineWidth = borderThickness;
	//roundRect(context, borderThickness / 2, borderThickness / 2, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
	// 1.4 is extra height factor for text below baseline: g,j,p,q.

	// text color
	context.fillStyle = "rgba(0, 0, 0, 1.0)";

	
	

	var iconTemp = new Image();
	iconTemp.src = iconUrl;

	iconTemp.onload = function() {
		context.drawImage(iconTemp, 0, 0, 200, 200);
		// canvas contents will be used for a texture
		var texture = new THREE.Texture(canvas);
		//texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({
			map: texture
		});
		var sprite = new THREE.Sprite(spriteMaterial);
		//sprite.scale.set(1000, 500, 10);
		context.fillText(message, borderThickness, fontsize + borderThickness + 20);
		callback(sprite);
	};
}

// function for drawing rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function makeTransparent(object) {
	object.traverse(function(node) {
		if(node.material) {
			node.material.opacity = 0.5;
			node.material.transparent = true;
		}
	});
}

function makeOpaque(object) {
	object.traverse(function(node) {
		if(node.material) {
			node.material.transparent = false;
		}
	});
}

function ViewPortTranslator(frameRate) {
	this.timeDelta = 0;
	this.transitionRate = frameRate;
	this.configTable = [new THREE.Vector4(0, 0, 1.0, 1.0), new THREE.Vector4(0.75, 0.0, 0.25, 0.333),
		new THREE.Vector4(0.75, 0.333, 0.25, 0.334), new THREE.Vector4(0.75, 0.667, 0.25, 0.333),
		new THREE.Vector4(0, 0, 1.0, 1.0), new THREE.Vector4(1.0, 0.0, 0.0, 0.0)];
	this.currentConfig = [4, 5, 5, 5];
	this.renderIndices = [...this.currentConfig];
	this.toConfig = [...this.currentConfig];
	this.inTranslation = false;
	this.startTranslation = function(toConfig) {
		this.timeDelta = this.transitionRate;
		this.toConfig = [...toConfig];
		this.inTranslation = true;
		this.cameraIdx = this.toConfig.findIndex(x => x === 0 || x === 4);
	};

	this.getViewPortValues = function() {
		var viewPortValues = [];
		var result = {};
		var inTranslation = false;
		if (this.timeDelta > 0) {
			var alpha = 1.0 - this.timeDelta / this.transitionRate;
			this.timeDelta--;
			for (var i = 0; i < this.currentConfig.length; i++) {
				if (this.currentConfig[i] !== this.toConfig[i]) {
					var tempVec4 = this.configTable[this.currentConfig[i]].clone();
					tempVec4.lerp(this.configTable[this.toConfig[i]], alpha);
					viewPortValues.push(tempVec4);	
				} else {
					viewPortValues.push(this.configTable[this.currentConfig[i]]);
				}
			}
			if (this.timeDelta <= 0) {
				this.currentConfig = this.toConfig;
				this.inTranslation = false;
				this.renderIndices = this.currentConfig.map(function(d, i) {
					return d < 5? i : -1;
				}).filter(d => {
					return d >= 0;
				});
			} else {
				this.renderIndices = this.toConfig.map(function(d, i) {
					return d < 5? i : -1;
				}).filter(d => {
					return d >= 0;
				});
			}
		} else {
			for (var j = 0; j < this.currentConfig.length; j++) {
				viewPortValues.push(this.configTable[this.currentConfig[j]]);
			}
		}
		return {viewPortValues: viewPortValues, indices: this.renderIndices,
			inTranslation: this.inTranslation, mainCameraIdx: this.cameraIdx};
	};
}

function getAssetList() {
	return  [ {
			"name": "wall",
			"id": "WL",
			"url": null,
			"iconUrl": "images/wall3d.png",
			"iconHoverUrl": "images/wallHover3d.png"
		}, {
			"name": "door",
			"id": "DR",
			"url": "models/door.glb",
			"smTrigger": true,
			"iconUrl": "images/door3d.png",
			"iconHoverUrl": "images/doorHover3d.png"
		}, {
			"name": "window",
			"id": "WD",
			"url": "models/window.glb",
			"smTrigger": true,
			"iconUrl": "images/window3d.png",
			"iconHoverUrl": "images/windowHover3d.png"
		}, {
			"name": "camera",
			"id": "3D",
			"url": "models/camera.glb",
			"doNotAddToMenu": true
		}, {
			"name": "avatar",
			"id": "VR",
			"url": "models/avatar.glb",
			"doNotAddToMenu": true
		}, {
			"name": "pointer",
			"id": "2D",
			"url": "models/pointer.glb",
			"doNotAddToMenu": true
		}, {
			"name": "partition",
			"id": "PT",
			"url": "models/partition.glb",
			"iconUrl": "images/partition3d.png",
			"iconHoverUrl": "images/partitionHover3d.png"
		}, {
			"name": "couch",
			"id": "CO",
			"url": "models/couch.glb",
			"iconUrl": "images/couch3d.png",
			"iconHoverUrl": "images/couchHover3d.png"
		}, {
			"name": "chair",
			"id": "CR",
			"url": "models/chair.glb",
			"iconUrl": "images/chair3d.png",
			"iconHoverUrl": "images/chairHover3d.png"
		}, {
			"name": "officeChair",
			"id": "OC",
			"url": "models/officeChair.glb",
			"iconUrl": "images/officeChair3d.png",
			"iconHoverUrl": "images/officeChairHover3d.png"
		}, {
			"name": "schoolChair",
			"id": "SC",
			"url": "models/schoolChair.glb",
			"iconUrl": "images/schoolChair3d.png",
			"iconHoverUrl": "images/schoolChairHover3d.png"
		}, {
			"name": "stool",
			"id": "ST",
			"url": "models/stool.glb",
			"iconUrl": "images/stool3d.png",
			"iconHoverUrl": "images/stoolHover3d.png"
		}, {
			"name": "desk",
			"id": "DK",
			"url": "models/desk.glb",
			"iconUrl": "images/desk3d.png",
			"iconHoverUrl": "images/deskHover3d.png"
		}, {
			"name": "table",
			"id": "TB",
			"url": "models/table.glb",
			"iconUrl": "images/table3d.png",
			"iconHoverUrl": "images/tableHover3d.png"
		}, {
			"name": "coffeeTable",
			"id": "CT",
			"url": "models/coffeeTable.glb",
			"iconUrl": "images/coffeeTable3d.png",
			"iconHoverUrl": "images/coffeeTableHover3d.png"
		}, {
			"name": "cabinet",
			"id": "CB",
			"url": "models/cabinet.glb",
			"iconUrl": "images/cabinet3d.png",
			"iconHoverUrl": "images/cabinetHover3d.png"
		}, {
			"name": "drawer",
			"id": "DA",
			"url": "models/drawer.glb",
			"iconUrl": "images/drawer3d.png",
			"iconHoverUrl": "images/drawerHover3d.png"
		}, {
			"name": "fountain",
			"id": "FT",
			"url": "models/fountain.glb",
			"iconUrl": "images/fountain3d.png",
			"iconHoverUrl": "images/fountainHover3d.png"
		}, {
			"name": "recycleBin",
			"id": "RB",
			"url": "models/recycleBin.glb",
			"iconUrl": "images/recycleBin3d.png",
			"iconHoverUrl": "images/recycleBinHover3d.png"
		}, {
			"name": "vendingMachine",
			"id": "VM",
			"url": "models/vendingMachine.glb",
			"iconUrl": "images/vendingMachine3d.png",
			"iconHoverUrl": "images/vendingMachineHover3d.png"
		}, {
			"name": "flag",
			"id": "FG",
			"url": "models/flag.glb",
			"iconUrl": "images/flag3d.png",
			"iconHoverUrl": "images/flagHover3d.png"
		}
	];
}

// Create a MeshFaceMaterial, which allows the cube to have different materials on each face 
var wallMaterial3D = function() {
	var wallFaceMaterials3D = [ 
		new THREE.MeshPhongMaterial({color:0xF5F5DC}),
		new THREE.MeshPhongMaterial({color:0xF5F5DC}), 
		new THREE.MeshPhongMaterial({color:0x964B00}),
		new THREE.MeshPhongMaterial({color:0xF5F5DC}), 
		new THREE.MeshPhongMaterial({color:0xF5F5DC}), 
		new THREE.MeshPhongMaterial({color:0xF5F5DC}), 
	];
	wallFaceMaterials3D.forEach(m => {
		m.shininess = 60;
		m.specular.setHex(0x888888); 
	});
	return wallFaceMaterials3D;
}();


var boxForMakingHole = new THREE.Box3();


function makeHole(object, hole) {
	object.geometry.rotateY(object.rotation.y);
	object.geometry.translate(object.position.x, object.position.y, object.position.z);
	var objectGeometryCsg = new ThreeBSP(object.geometry);
	var holeRotationY = hole.rotation.y;
	hole.rotation.y = 0;
	boxForMakingHole.setFromObject(hole);
	console.log(boxForMakingHole);
	hole.rotation.y = holeRotationY;
	var size = new THREE.Vector3();
	boxForMakingHole.getSize(size);
	var geometryObjectForMakingHole = new THREE.BoxGeometry(size.x - 0.01, size.y - 0.01, size.z, 32, 32, 8);
	geometryObjectForMakingHole.rotateY(hole.rotation.y);
	geometryObjectForMakingHole.translate(hole.position.x, hole.position.y, hole.position.z);
	
	console.log(geometryObjectForMakingHole);
	var holeGeometryCsg = new ThreeBSP(geometryObjectForMakingHole);
	objectGeometryCsg = objectGeometryCsg.subtract(holeGeometryCsg);
	var newObject = objectGeometryCsg.toMesh(object.material);
	newObject.geometry.translate(-object.position.x, -object.position.y, -object.position.z);
	newObject.geometry.rotateY(-object.rotation.y);
	return newObject;
}


function closeHole(object, hole, thickness) {
	object.geometry.rotateY(object.rotation.y);
	object.geometry.translate(object.position.x, object.position.y, object.position.z);
	var objectGeometryCsg = new ThreeBSP(object.geometry);
	var holeRotationY = hole.rotation.y;
	hole.rotation.y = 0;
	boxForMakingHole.setFromObject(hole);
	//console.log(boxForMakingHole);
	hole.rotation.y = holeRotationY;
	var size = new THREE.Vector3();
	boxForMakingHole.getSize(size);
	var geometryObjectForMakingHole = new THREE.BoxGeometry(size.x, size.y, thickness, 32, 32, 8);
	geometryObjectForMakingHole.rotateY(hole.rotation.y);
	geometryObjectForMakingHole.translate(hole.position.x, hole.position.y, hole.position.z);
	
	//console.log(geometryObjectForMakingHole);
	var holeGeometryCsg = new ThreeBSP(geometryObjectForMakingHole);
	objectGeometryCsg = objectGeometryCsg.union(holeGeometryCsg);
	var newObject = objectGeometryCsg.toMesh(object.material);
	newObject.geometry.translate(-object.position.x, -object.position.y, -object.position.z);
	newObject.geometry.rotateY(-object.rotation.y);
	return newObject;
}

function getWireframeWall(height, thickness) {
	var geometry = new THREE.BoxBufferGeometry(1, height, thickness, 16, 16, 4);

	var wireframe = new THREE.WireframeGeometry(geometry);

	var box = new THREE.LineSegments(wireframe);
	box.material.depthTest = false;
	box.material.opacity = 0.5;
	box.material.transparent = true;
	return box;	
}

function getFloorHighlight(dim, color) {
	var geometry = new THREE.PlaneBufferGeometry(dim, dim, 4, 4);
	var material = new THREE.MeshBasicMaterial({color: color});
	var plane = new THREE.Mesh(geometry, material);
	plane.rotation.x = Math.PI / -2.0;
	return plane;
}

var closerPoint = function(line, P) {
	if (line[0].distanceTo(P) < line[1].distanceTo(P)) {
		return 0;
	}
	return 1;
};