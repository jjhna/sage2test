function BrowserView(app) {
	
	this.app = app;
	this.modelLoaded = false;
	this.MODEL = null;
	this.assets = document.createElement('a-assets');
	this.scene = document.createElement('a-scene');
	this.cameraDirectionVector = new THREE.Vector3();
	this.sceneRadius = 30;


	this.setupScene = function(modelPath, callback) {
		var entityPos = {
			x: -100,
			y: 10,
			z: -100
		};
		var sky = document.createElement('a-sky');
		sky.setAttribute('color', '#88E');
		this.scene.appendChild(sky);
		this.scene.appendChild(this.assets);

		//this.addLight();
		this.attachCamera(callback);
		if (modelPath) {

			var modelDetails = resolveModelType(modelPath);

			var assetItem = document.createElement('a-asset-item');
			assetItem.setAttribute('id', modelDetails.assetId);
			assetItem.setAttribute('src', modelDetails.assetSrc);

			this.assets.appendChild(assetItem);

			if (modelDetails.assetMtlId !== null) {
				var assetItemMtl = document.createElement('a-asset-item');
				assetItemMtl.setAttribute('id', modelDetails.assetMtlId);
				assetItemMtl.setAttribute('src', modelDetails.assetMtlSrc);
				this.assets.appendChild(assetItemMtl);
			}
			var entityModel = document.createElement('a-entity');
			entityModel.setAttribute(modelDetails.entityModelAttribString,
				modelDetails.entityModelValueString);

			this.MODEL = entityModel;
			this.scene.appendChild(this.MODEL);
			entityModel.addEventListener('model-loaded', this.repositionScene.bind(this));
		} else if (this.state.scene) {
			// Load scene

		} else {
			this.createDemoScene();
		}
		this.app.element.appendChild(this.scene);
	};
		
	this.move = function(value) {
		this.camera.object3D.getWorldDirection(this.cameraDirectionVector);
		var position = this.camera.object3D.position;
		this.cameraDirectionVector.multiplyScalar(value);
		add(position, this.cameraDirectionVector);
		this.cameraUpdateCallback('p', position);
	};

	this.turn = function(rx, ry) {
		//console.log(rx, ry);
		var rotation = this.camera.object3D.rotation;
		if (rx !== 0) {
			rx = rx / Math.abs(rx);
		}
		if (ry !== 0) {
			ry = ry / Math.abs(ry);
		}
		rotation.x += (ry * 0.1);
		rotation.y += (rx * 0.1);
		this.cameraUpdateCallback('r', rotation);
	};

	this.preLoadModels = function(resrcPath) {
		var avatarPath = resrcPath + 'data/toy/toy.obj';
		var assetItem = document.createElement('a-asset-item');
		assetItem.setAttribute('id', "avatarobj");
		assetItem.setAttribute('src', avatarPath);

		this.assets.appendChild(assetItem);

		var cameraPath = resrcPath + 'data/camera/camera.obj';
		assetItem = document.createElement('a-asset-item');
		assetItem.setAttribute('id', "cameraobj");
		assetItem.setAttribute('src', cameraPath);

		this.assets.appendChild(assetItem);

		var avatarMtlPath = resrcPath + 'data/toy/toy.mtl';
		assetItem = document.createElement('a-asset-item');
		assetItem.setAttribute('id', "avatarmtl");
		assetItem.setAttribute('src', avatarMtlPath);
		this.assets.appendChild(assetItem);

		var cameraMtlPath = resrcPath + 'data/camera/camera.mtl';
		assetItem = document.createElement('a-asset-item');
		assetItem.setAttribute('id', "cameramtl");
		assetItem.setAttribute('src', cameraMtlPath);
		this.assets.appendChild(assetItem);
	};
	this.addModelsForUser = function(user) {
		var avatar = document.createElement('a-entity');
		avatar.setAttribute('obj-model', "obj: #avatarobj; mtl: #avatarmtl;");
		
		this.scene.appendChild(avatar);
		avatar.addEventListener('model-loaded', function() {
			this.adjustScale(avatar, 1, true, Math.PI);
			user._avatar = avatar;
			user.setVRMode(false);
		}.bind(this));

		var camera = document.createElement('a-entity');
		camera.setAttribute('obj-model', "obj: #cameraobj; mtl: #cameramtl;"); 
		this.scene.appendChild(camera);
		camera.addEventListener('model-loaded', function() {
			this.adjustScale(camera, 1, true, Math.PI);
			user._cameraModel = camera;
			user.setVRMode(false);
		}.bind(this));
		
		console.log("avatar and camera models added for " + user.id);
	};

	this.addLight = function() {
		this.directionalLight1 = document.createElement('a-light');
		this.directionalLight1.setAttribute('color', '#FFF');
		this.directionalLight1.setAttribute('position', '0 0 1');
		this.scene.appendChild(this.directionalLight1);

		this.directionalLight2 = document.createElement('a-light');
		this.directionalLight2.setAttribute('color', '#FFF');
		this.directionalLight2.setAttribute('position', '0 0 -1');
		this.scene.appendChild(this.directionalLight2);

		this.directionalLight3 = document.createElement('a-light');
		this.directionalLight3.setAttribute('color', '#FFF');
		this.directionalLight3.setAttribute('position', '0 1 0');
		this.scene.appendChild(this.directionalLight3);

		this.directionalLight4 = document.createElement('a-light');
		this.directionalLight4.setAttribute('color', '#FFF');
		this.directionalLight4.setAttribute('position', '0 -1 0');
		this.scene.appendChild(this.directionalLight4);

		this.directionalLight5 = document.createElement('a-light');
		this.directionalLight5.setAttribute('color', '#FFF');
		this.directionalLight5.setAttribute('position', '1 0 0');
		this.scene.appendChild(this.directionalLight5);

		this.directionalLight6 = document.createElement('a-light');
		this.directionalLight6.setAttribute('color', '#FFF');
		this.directionalLight6.setAttribute('position', '-1 0 0');
		this.scene.appendChild(this.directionalLight6);

	};
	this.attachCamera = function(callback) {
		//<a-entity camera="userHeight: 1.6" look-controls></a-entity>
		this.camera = document.createElement('a-camera');
		this.camera.setAttribute('id', "userCamera");
		this.camera.setAttribute('active', true);
		this.camera.setAttribute('fov', 90);
		this.camera.setAttribute('near', 0.1);
		this.camera.setAttribute('far', 10000);
		this.camera.setAttribute('position', '0 0 ' + (this.sceneRadius * 4))
		this.cameraUpdateCallback = callback;
		this.scene.appendChild(this.camera);
		this.scene.addEventListener('enter-vr', function () {
		   console.log("ENTERED VR");
		   callback('m', '1');
		}.bind(this));

		this.scene.addEventListener('exit-vr', function () {
		   console.log("Exit VR");
		   callback('m', '0');
		}.bind(this));
		
		/*this.camera.addEventListener('componentchanged', function (evt) {
			if (evt.detail.name === "camera") {
				return;
			}
			switch(evt.detail.name) {
				case 'position':
					callback('p', this.camera.object3D.position);
					break;
				case 'rotation':
					callback('r', this.camera.object3D.rotation);
					break;
				default:
					break;
			}
			
		}.bind(this));*/
	};
	
	this.repositionScene = function() {
		this.modelLoaded = true;
		this.adjustScale(this.MODEL, this.sceneRadius, true, 0);
	};
	this.adjustScale = function(model, scale, bringToCenter, yangle) {
		var box = findBoundingBox(model);
		var threeObj = model.object3D;
		var extent = axesExtent(box.max, box.min);
		threeObj.scale.set(scale / extent.x, scale / extent.y, scale / extent.z);
		if (bringToCenter) {
			box = findBoundingBox(model);
			var mid = midpoint(box.max, box.min);
			threeObj.position.set(-mid.x, -mid.y, 2 * mid.z);
			threeObj.rotation.y = yangle;
		}
		var parent = threeObj.parent;
		var pivot = new THREE.Group();
		parent.remove(threeObj);
		pivot.add(threeObj);
		parent.add(pivot);
		model.object3D = pivot;
		pivot.position.set(0, 0, 0);
	};
	this.getFileName = function(path) {
		var pathParts = path.split(/\\|\/|\./);
		return pathParts[pathParts.length - 2];
	};
	this.getMaterialFilePath = function(path) {
		var ext = path.indexOf('.obj');
		return path.slice(0, ext) + '.mtl';
	};
	this.resolveModelType = function(path) {
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
		var name = this.getFileName(path);
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
	};
	this.createDemoScene = function() {
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
			this.scene.appendChild(box);
		}

	};
	this.removeUser = function(user) {
		var temp = user._avatar;
		temp.parentNode.removeChild(temp);
		temp = user._cameraModel;
		temp.parentNode.removeChild(temp);
	}
}