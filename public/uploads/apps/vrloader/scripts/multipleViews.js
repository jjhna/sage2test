

function MasterView(app) {
	this.app = app;
	this.renderer = new THREE.WebGLRenderer( { antialias: true } );
	this.views = [];
	this.userWaitlistForAvatars = {};
	this.width = app.width;
	this.height = app.height;
	this.translator = new ViewPortTranslator(app.maxFPS / 2);
	this.MODEL = null;
	this.sceneRadius = 30;
	this.modelLoaded = false;
	this.cameraDirectionVector = new THREE.Vector3();
	//Handles different views
	


	this.setupScene = function(modelPath, callback) {
		var entityPos = {
			x: -100,
			y: 10,
			z: -100
		};
		this.scene = new THREE.Scene();
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(this.app.width, this.app.height);
		this.app.element.appendChild(this.renderer.domElement);
		this.addLight();
		
		if (modelPath) {
			var setModel = function(object) {
				this.MODEL = this.adjustScale(object.model, this.sceneRadius, true, 0);
				this.scene.add(this.MODEL);
				this.attachCamera(callback);
			};
			if (typeof modelPath === "string") {
				loadModel(modelPath, true, setModel.bind(this));
			} else if (modelPath.isObject3D === true) { // Threejs obj
				console.log(modelPath);
				setModel.bind(this)({model: modelPath});
			}
		} else {
			this.createDemoScene();
		}
	};
	this.initMode = function(data) {
		this.maximized = data.maximized;
		this.mode = data.mode;
	};
	this.changeMode = function(mode) {
		var modes = {
			perspective: [[0, 1, 2, 3], [4, 5, 5, 5]],
			plan: [[1, 0, 2, 3], [5, 4, 5, 5]],
			elevation: [[1, 2, 0, 3], [5, 5, 4, 5]],
			front: [[1, 2, 3, 0], [5, 5, 5, 4]]
		}
		if (mode === "maximized") {
			this.maximized = 1 - this.maximized;
		} else {
			this.mode = mode || this.mode;
		}

		this.translator.startTranslation(modes[this.mode][this.maximized]);
	};

	
	
	this.move = function(value) {
		this.views[0].camera.getWorldDirection(this.cameraDirectionVector);
		var position = this.views[0].camera.position;
		position.add(this.cameraDirectionVector.multiplyScalar(value));
		this.views[0].updateCallback('p', position);
	};

	this.turn = function(rx, ry) {
		//console.log(rx, ry);
		var rotation = this.views[0].camera.rotation;
		if (rx !== 0) {
			rx = rx / Math.abs(rx);
		}
		if (ry !== 0) {
			ry = ry / Math.abs(ry);
		}
		rotation.x += (ry * 0.1);
		rotation.y += (rx * 0.1);
		this.views[0].updateCallback('r', rotation);
	};

	this.preLoadModels = function(resrcPath) {
		var modelList = [resrcPath + 'data/toy/toy.obj', resrcPath + 'data/camera/camera.obj'];
		var mtlExists = [true, true];
		loadMultiple(modelList, mtlExists, function(data) {
			this.avatarobj = data[0].model;
			this.cameraobj = data[1].model;
			console.log(data);
			for (var k in this.userWaitlistForAvatars) {
				if (this.userWaitlistForAvatars.hasOwnProperty(k)) {
					this.addModelsForUser(this.userWaitlistForAvatars[k]);
					delete this.userWaitlistForAvatars[k];
				}
			}
		}.bind(this));
	};
	this.addModelsForUser = function(user) {
		if (this.avatarobj && this.cameraobj) {
			var avatar = this.avatarobj.clone();
			avatar = this.adjustScale(avatar, 1, true, Math.PI);
			avatar.name = user.id + 'avatar';
			this.scene.add(avatar);
			user._avatar = avatar;

			var camera = this.cameraobj.clone();
			camera = this.adjustScale(camera, 1, true, Math.PI);
			camera.name = user.id + 'camera';		
			this.scene.add(camera);
			user._cameraModel = camera;
			user.setVRMode(false);
			console.log("avatar and camera models added for " + user.id);
		} else {
			this.userWaitlistForAvatars[user.uid] = user;
		}
	};
	this.addLight = function() {
		var light1 = new THREE.DirectionalLight(0xffffff);
		light1.position.set(0, 0, 1);
		var light2 = new THREE.DirectionalLight(0xffffff);
		light2.position.set(0, 0, -1);
		var light3 = new THREE.DirectionalLight(0xffffff);
		light3.position.set(0, 1, 0);
		var light4 = new THREE.DirectionalLight(0xffffff);
		light4.position.set(0, -1, 0);
		var light5 = new THREE.DirectionalLight(0xffffff);
		light5.position.set(1, 0, 0);
		var light6 = new THREE.DirectionalLight(0xffffff);
		light6.position.set(-1, 0, 0);
		this.scene.add(light1);
		this.scene.add(light2);
		this.scene.add(light3);
		this.scene.add(light4);
		this.scene.add(light5);
		this.scene.add(light6);
	};
	this.attachCamera = function(callback) {
		//<a-entity camera="userHeight: 1.6" look-controls></a-entity>
		var views = [
			{
				background: new THREE.Color(0.5, 0.5, 0.7),
				eye: new THREE.Vector3(0, 0, this.sceneRadius * 4),
				up: [ 0, 1, 0 ],
				fov: 60
			},
			{
				background: new THREE.Color(0.7, 0.5, 0.5),
				eye: new THREE.Vector3(0, 100, 0),
				up: [0, 0, 1],
				fov: 60
			},
			{
				background: new THREE.Color(0.5, 0.7, 0.7 ),
				eye: new THREE.Vector3(100, 0, 0),
				up: [ 0, 1, 0 ],
				fov: 60
			},
			{
				background: new THREE.Color(0.5, 0.5, 0.5 ),
				eye: new THREE.Vector3(0, 0, 100),
				up: [ 0, 1, 0 ],
				fov: 60
			}
		];
		//New aspect ratio because of multiple views is calculated as below.
		// (W - w) / H === w / (H / 3) ==> w === 0.75 * W
		var aspect = 0.75 * this.width / this.height;
		var camera = new THREE.PerspectiveCamera(views[0].fov, aspect, 1, 10000);
		for (var ii =  0; ii < views.length; ++ii) {
			var view = views[ii];
			camera.position.copy(view.eye);
			camera.up.fromArray(view.up);
			view.camera = camera;
			view.updateCallback = callback;
			camera = new THREE.OrthographicCamera(-this.sceneRadius * aspect / 2, this.sceneRadius * aspect / 2,
				this.sceneRadius / 2, -this.sceneRadius / 2, 1, 10000);
		}
		this.views = views;
		this.modelLoaded = true;

	};

	this.adjustScale = function(model, scale, bringToCenter, yangle) {
		var box = findBoundingBox(model);
		var extent = axesExtent(box.max, box.min);
		model.scale.set(scale / extent.x, scale / extent.y, scale / extent.z);
		var pivot = new THREE.Group();
		pivot.add(model);
		if (bringToCenter) {
			box = findBoundingBox(model);
			var mid = midpoint(box.max, box.min);
			model.position.set(-mid.x, -mid.y, 2 * mid.z);
			model.rotation.y = yangle;	
		}
		
		return pivot;
	};

	this.getFileName = function(path) {
		var pathParts = path.split(/\\|\/|\./);
		return pathParts[pathParts.length - 2];
	};
	this.getMaterialFilePath = function(path) {
		var ext = path.indexOf('.obj');
		return path.slice(0, ext) + '.mtl';
	};
	this.createDemoScene = function() {
		for (var i = -5; i <= 5; i++) {
			if (i === 0) {
				continue;
			}
			var theta = Math.PI * i / 6;
			var geometry = new THREE.BoxGeometry(10, 10, 10);
			var material = new THREE.MeshBasicMaterial({color: (i > 0) ? 0xcc4444 : 0xaaaaaa});
			var cube = new THREE.Mesh(geometry, material);
			this.scene.add(cube);
			cube.position.set(0, 0, i * 50);
		}
	};

	this.render =  function() {
		var result = this.translator.getViewPortValues();
		var viewPortValues = result.viewPortValues;
		var viewIndices = result.indices;
		for (var ii = 0; ii < viewIndices.length; ++ii) {
			var i = viewIndices[ii];
			var view = this.views[i];
			if (view) {
				
				var camera = view.camera;
				var left   = Math.floor(this.width  * viewPortValues[i].x);
				var top    = Math.floor(this.height * viewPortValues[i].y);
				var width  = Math.floor(this.width  * viewPortValues[i].z);
				var height = Math.floor(this.height * viewPortValues[i].w);
				this.renderer.setViewport(left, top, width, height);
				this.renderer.setScissor(left, top, width, height);
				this.renderer.setScissorTest(true);
				this.renderer.setClearColor(view.background);
				camera.aspect = width / height;
				if (i > 0 && this.MODEL !== null) {
					camera.lookAt(this.MODEL.position);
				}
				camera.updateProjectionMatrix();
				this.renderer.render(this.scene, camera);
			}
		}
		
	};

	this.resize = function() {
		if (this.width !== this.app.width || this.height !== this.app.height) {
			this.width  = this.app.width;
			this.height = this.app.height;
			this.renderer.setSize(this.width, this.height);
		}
	};
	this.removeUser = function(user) {
		var avatar = this.scene.getObjectByName(user.id + 'avatar');
		if (avatar) {
			this.scene.remove(avatar);
		}
		var cameraModel = this.scene.getObjectByName(user.id + 'camera');
		if (cameraModel) {
			this.scene.remove(cameraModel);
		}
	};
}


