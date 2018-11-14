
function VRUser() {
	this.id = "";
	this.vrMode = null;
	this._avatar = null;
	this._cameraModel = null;
	this.visible = true;
	this.setVRMode = function(mode) {
		this.vrMode = (mode === true);
		if (this._avatar && this._cameraModel) {
			var avatar3D = (this._avatar.isObject3D)? this._avatar : this._avatar.object3D;
			var camera3D = (this._cameraModel.isObject3D)? this._cameraModel : this._cameraModel.object3D;
			if (this.vrMode === true) {
				avatar3D.visible = true;
				camera3D.visible = false;
				this.object3D = avatar3D;
			} else {
				avatar3D.visible = false;
				camera3D.visible = true;
				this.object3D = camera3D;
			}
		}
	};
	this.setVisibility = function(flag) {
		if (this._avatar && this._cameraModel) {
			var avatar3D = (this._avatar.isObject3D)? this._avatar : this._avatar.object3D;
			var camera3D = (this._cameraModel.isObject3D)? this._cameraModel : this._cameraModel.object3D;
			flag = (flag === true);
			avatar3D.visible = flag;
			camera3D.visible = flag;
			this.visible = flag;
			if (this.visible === true) {
				this.setVRMode(this.vrMode);
			}
		}
	}
};

function findBoundingBox(threeObj) {
	var box;
	if (threeObj.isObject3D) {
		box =  new THREE.Box3().setFromObject(threeObj);
	} else {
	 	box =  new THREE.Box3().setFromObject(threeObj.getObject3D('mesh'));
	}
	return box;
	/*console.log(threeObj);
	if (!threeObj) {
		return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
	}
	if (threeObj.type === "Group") {
		var children = threeObj.children;
		var boundingBox = findBoundingBox(children[0]);
		var childSize1 = distance(boundingBox.max, boundingBox.min);
		for (var i = 1; i < children.length; i++) {
			var childBox = findBoundingBox(children[i]);
			var childSize2 = distance(childBox.max, childBox.min);
			if (childSize1 > 2 * childSize2) {
				continue;
			} else if (childSize2 > 2 * childSize1) {
				boundingBox = childBox;
				continue;
			}
			if (boundingBox.min.x > childBox.min.x) {
				boundingBox.min.x = childBox.min.x;
			}
			if (boundingBox.min.y > childBox.min.y) {
				boundingBox.min.y = childBox.min.y;
			}
			if (boundingBox.min.z > childBox.min.z) {
				boundingBox.min.z = childBox.min.z;
			}
			if (boundingBox.max.x < childBox.max.x) {
				boundingBox.max.x = childBox.max.x;
			}
			if (boundingBox.max.y < childBox.max.y) {
				boundingBox.max.y = childBox.max.y;
			}
			if (boundingBox.max.z < childBox.max.z) {
				boundingBox.max.z = childBox.max.z;
			}
			childSize1 = distance(boundingBox.max, boundingBox.min);
		}
		return boundingBox;
	} else if (threeObj.type === "Mesh") {
		threeObj.geometry.computeBoundingBox();
		return threeObj.geometry.boundingBox;
	} else {
		return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
	}*/
}

function distance(A, B) {
	var a = new THREE.Vector3(A.x, A.y, A.z);
	var b = new THREE.Vector3(B.x, B.y, B.z);
	return a.distanceTo(b);
}

function axesExtent(A, B) {
	return {x: Math.abs(A.x - B.x), y: Math.abs(A.y - B.y), z: Math.abs(A.z - B.z)};
}

function midpoint(A, B) {
	return {
		x: (A.x + B.x) / 2,
		y: (A.y + B.y) / 2,
		z: (A.z + B.z) / 2
	};
}

function getFileName(path) {
	var pathParts = path.split(/\\|\/|\./);
	return pathParts[pathParts.length - 2];
}

function getMaterialFilePath(path) {
	var extIdx = path.lastIndexOf('.');
	return path.slice(0, extIdx) + '.mtl';
}

function resolveModelType(path) {
	var ext = path.slice(path.lastIndexOf('.') + 1, path.length);
	var details = {
		ext: ext,
		entityModelAttribString: null,
		entityModelValueString: null,
		assetId: null,
		assetSrc: null,
		assetMtlId: null,
		assetMtlSrc: null
	};
	var name = getFileName(path);
	switch(ext) {
		case 'obj':
			details.entityModelAttribString = 'obj-model';
			details.entityModelValueString = "obj: #" + name + 'obj; '
				+ 'mtl: #' + name + 'mtl';
			details.assetId = name + 'obj';
			details.assetSrc = path;
			details.assetMtlSrc = this.getMaterialFilePath(path);
			details.assetMtlId = name + 'mtl';
			break;
		case 'dae':
			details.entityModelAttribString = 'collada-model';
			details.entityModelValueString = '#' + name;
			details.assetId = name;
			details.assetSrc = path;
			break;
		case 'gltf':
		case 'glb':
			details.entityModelAttribString = 'gltf-model';
			details.entityModelValueString = '#' + name;
			details.assetId = name;
			details.assetSrc = path;
			break;
		case 'json':
			details.entityModelAttribString = 'json-model';
			details.entityModelValueString = '#' + name;
			details.assetId = name;
			details.assetSrc = path;
			break;
	}
	return details;
}
function createDemo(scene) {
	for (var i = -5; i <= 5; i++) {
		if (i === 0) {
			continue;
		}
		var theta = Math.PI * i / 6;
		var box = document.createElement('a-box');
		box.setAttribute('width', 10);
		box.setAttribute('height', 10);
		box.setAttribute('depth', 10);
		box.setAttribute('position', {x: 0, y: 0, z: i * 50});
		box.setAttribute('color', (i > 0) ? 'red' : 'blue');
		scene.appendChild(box);
	}
}


function loadModel(path, hasMaterial, callback, idx) {
	var ext = path.slice(path.lastIndexOf('.') + 1, path.length);
	var name = getFileName(path);
	var folder = path.slice(0, path.lastIndexOf('/') + 1);
	//var mtlPath = getMaterialFilePath(path);
	var loader;
	switch(ext) {
		case 'obj':
		case 'OBJ':
			function load(materials) {
				loader = new THREE.OBJLoader();
				if (materials !== undefined) {
					loader.setMaterials(materials);
				}
				loader.setPath(folder);
				loader.load(name + '.' + ext, function(object) {
					callback({name: name, model: object, idx: idx});
				});
			}
			if (hasMaterial === true) {
				var mtlLoader = new THREE.MTLLoader();
				mtlLoader.setTexturePath(folder);
				mtlLoader.setPath(folder);
				mtlLoader.load(name + '.mtl', function(materials) {
					materials.preload();
					load(materials);
				});
			} else {
				load();
			}
			
			break;
		case 'dae':
			break;
		case 'gltf':
		case 'glb':
			loader = new THREE.GLTFLoader();

			// Optional: Provide a DRACOLoader instance to decode compressed mesh data
			/*THREE.DRACOLoader.setDecoderPath( '/examples/js/libs/draco' );
			loader.setDRACOLoader( new THREE.DRACOLoader() );*/

			// Load a glTF resource
			loader.load(path, function(gltf) {
				callback({name: name, model: gltf.scene, idx: idx});
			});
			break;
		case 'json':
			break;
	}
}

function loadMultiple(array, materialExists, callback) {
	var loadedObjectArray = [];
	function metaCallback(object) {
		loadedObjectArray.push(object);
		if (array.length === loadedObjectArray.length) {
			loadedObjectArray.sort(function(a, b) {
				return a.idx - b.idx;
			})
			callback(loadedObjectArray);
		}
	}
	array.forEach((x, i) => loadModel(x, materialExists[i], metaCallback, i));
}

function ViewPortTranslator(frameRate) {
	this.timeDelta = 0;
	this.transitionRate = frameRate;
	this.configTable = [new THREE.Vector4(0, 0, 0.75, 1.0), new THREE.Vector4(0.75, 0.0, 0.25, 0.333),
		new THREE.Vector4(0.75, 0.333, 0.25, 0.334), new THREE.Vector4(0.75, 0.667, 0.25, 0.333),
		new THREE.Vector4(0, 0, 1.0, 1.0), new THREE.Vector4(1.0, 0.0, 0.0, 0.0)];
	this.currentConfig = [4, 5, 5, 5];
	this.renderIndices = [...this.currentConfig];
	this.toConfig = [...this.currentConfig];
	this.startTranslation = function(toConfig) {
		this.timeDelta = this.transitionRate;
		this.toConfig = [...toConfig];
	};

	this.getViewPortValues = function() {
		var viewPortValues = [];
		var result = {};
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
				this.renderIndices = this.currentConfig.map(function(d, i) {
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
		return {viewPortValues: viewPortValues, indices: this.renderIndices};
	};
}

function hashCode(str) {
	var hash = 0, i, chr;
	if (str.length === 0){
		return hash;
	}
	for (i = 0; i < str.length; i++) {
		chr   = str.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};


function xyzToString(xyz) {
	return parseInt(xyz.x * 100).toString(36) + '.'
		+ parseInt(xyz.y * 100).toString(36) + '.'
		+ parseInt(xyz.z * 100).toString(36);
}

function stringToXyz(numberString) {
	var xyzlst = numberString.split('.').map(function(d) {
		return parseInt(d, 36) / 100.0;
	});
	return {x: xyzlst[0], y: xyzlst[1], z: xyzlst[2]};
}

function add(xyz1, xyz2) {
	xyz1.x += xyz2.x;
	xyz1.y += xyz2.y;
	xyz1.z += xyz2.z;
	return xyz1;
}