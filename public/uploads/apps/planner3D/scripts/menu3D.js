function Planner3DButton(imgUrl, hvrImgUrl, callback) {
	this.buttonTexture = new THREE.TextureLoader().load(imgUrl);
	//this.buttonTexture.magFilter = THREE.NearestFilter;
	this.buttonHoverTexture = new THREE.TextureLoader().load(hvrImgUrl);
	this.buttonHoverTexture.magFilter = THREE.NearestFilter;
	this.buttonMaterial = new THREE.SpriteMaterial({
		map: this.buttonTexture,
		color: 0xffffff
	});
	this.buttonMaterial.transparent = true;
	this.buttonMaterial.opacity = 1.0;
	this.buttonSprite = new THREE.Sprite(this.buttonMaterial);
	this.callback = callback;
	this.pressed = undefined;
	this.hovered = false;
	this.shown = false;
	this.id = null;
}

Planner3DButton.prototype.addPressedImage = function(prsdImgUrl) {
	this.buttonPressedTexture = new THREE.TextureLoader().load(prsdImgUrl);
	this.buttonPressedTexture.magFilter = THREE.NearestFilter;
	this.pressed = false;
};
Planner3DButton.prototype.hover = function() {
	if (this.hovered === false) {
		this.buttonSprite.material.map = this.buttonHoverTexture;
		this.buttonSprite.material.needsUpdate = true;
		this.hovered = true;
	}
};
Planner3DButton.prototype.hoverEnd = function() {
	if (this.hovered) {
		if (this.pressed === true) {
			this.buttonSprite.material.map = this.buttonPressedTexture;
		} else {
			this.buttonSprite.material.map = this.buttonTexture;
		}
		this.buttonSprite.material.needsUpdate = true;
		this.hovered = false;
	}
};
Planner3DButton.prototype.click = function(userId) {
	if (this.shown === false) {
		return;
	}
	this.callback(userId, this.id);
	if (this.pressed !== undefined) {
		if (this.pressed === true) {
			this.buttonSprite.material.map = this.buttonHoverTexture;
		} else {
			this.buttonSprite.material.map = this.buttonPressedTexture;
		}
		this.buttonSprite.material.needsUpdate = true;
		this.pressed = !this.pressed;
	}
};

function Planner3DMenu(app, camera, parameters) {
	this.parent = camera;
	this.buttons = [];
	this.buttonSprites = [];
	this.buttonDict = {};
	this.app = app;
	var menuImgUrl = this.app.resrcPath + "images/menu3d.png";
	var menuHvrImgUrl = this.app.resrcPath + "images/menuHover3d.png";
	var menuPressedImgUrl = this.app.resrcPath + "images/menuPressed3d.png";
	this.addButton('menu', menuImgUrl, menuHvrImgUrl, this.toggleMenu.bind(this));
	this.buttons[0].addPressedImage(menuPressedImgUrl);
	this.menuShown = false;
	this.position = new THREE.Vector3();
	this.scale = new THREE.Vector3();
	this.columns = parameters.columns || 3;
	this.rayCaster = new THREE.Raycaster();
	this.plane = new THREE.Plane();
	this.planeNormal = new THREE.Vector3();
	this.planeHelper = new THREE.PlaneHelper(this.plane, 50, 0xff00ff);
}

Planner3DMenu.prototype.detachMenuFromScene = function() {
	this.parent.remove(this.buttons[0].buttonSprite);
	this.menuAttached = false;
	this.buttons[0].shown = false;
	this.hideMenu();
};

Planner3DMenu.prototype.attachMenuToScene = function() {
	this.parent.add(this.buttons[0].buttonSprite);
	this.buttons[0].shown = true;
	this.menuAttached = true;
};

Planner3DMenu.prototype.toggleMenuAttachment = function() {
	if (this.menuAttached) {
		this.detachMenuFromScene();
	} else {
		this.attachMenuToScene();
	}
}


Planner3DMenu.prototype.setReference = function(ref) {
	this.worldReference = ref;
};

Planner3DMenu.prototype.setPosition = function(point, width, height, fov) {
	var menuPositionNormalized = new THREE.Vector2(point.x / width * 2 - 1, - point.y / height * 2 + 1);
	this.rayCaster.setFromCamera(menuPositionNormalized, this.parent);
	this.rayCaster.ray.at(5, this.position);
	this.worldReference.worldToLocal(this.position);
	//console.log(this.position);
	this.arrangeButtons();
};

Planner3DMenu.prototype.setSize = function(x, y) { //Button size
	this.scale.set(x, y, 1);
	this.arrangeButtons();
}

Planner3DMenu.prototype.addButton = function(id, imgUrl, hvrImgUrl, callback) {
	var button = new Planner3DButton(imgUrl, hvrImgUrl, callback);
	this.buttons.push(button);
	this.buttonSprites.push(button.buttonSprite);
	this.buttonDict[id] = button;
	button.id = id;
	button.buttonSprite.userData.id = id;
};

Planner3DMenu.prototype.showMenu = function() {
	if(this.menuShown === false) {
		this.buttons.slice(1).forEach(b => {
			console.log(b.id);
			this.parent.add(b.buttonSprite);
			b.shown = true;
		});
	}
	this.menuShown = true;
};

Planner3DMenu.prototype.hideMenu = function() {
	if(this.menuShown) {
		this.buttons.slice(1).forEach(b => {
			this.parent.remove(b.buttonSprite);
			b.shown = false;
		});
	}
	this.menuShown = false;
};

Planner3DMenu.prototype.toggleMenu = function() {
	console.log('toggle!');
	if(this.menuShown) {
		this.hideMenu();
	} else {
		this.showMenu();
	}
};

Planner3DMenu.prototype.arrangeButtons = function() {
	var col, row, multiple;
	var x, y, z;
	z = this.position.z;
	this.buttons.forEach((b, i) => {
		col = i % this.columns;
		multiple = i - col;
		row = multiple / this.columns;
		b.buttonSprite.scale.copy(this.scale);
		x = this.position.x + this.scale.x * col * 1.1;
		y = this.position.y - this.scale.y * row * 1.1;
		b.buttonSprite.position.set(x, y, z);
		//console.log(b.buttonSprite.position);
	});
};