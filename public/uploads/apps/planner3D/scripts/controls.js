function ControlPanel(app) {
	this.app = app;
};

ControlPanel.prototype.init = function(options) {
	this.buttons = [];
	this.panelWrap = document.createElement('div');
	this.panelWrap.style.display = "block";
	this.panelWrap.style.position = "absolute";
	this.panelWrap.style.left = "30px";
	this.panelWrap.style.top = "30px";
	this.panel = document.createElement('div');
	this.panel.id = 'planner3DControlPanel';
	this.panel.style.display = "block";
	this.panel.style.position = "absolute";
	this.panelWrap.appendChild(this.panel);
	this.panel.style.width = parseInt(0.20 * (this.app.sage2_width - 120)) + 'px';
	this.panel.style.height = parseInt(this.app.sage2_height - 60) + 'px';
	this.app.element.appendChild(this.panelWrap);
};
ControlPanel.prototype.connectToStateMachine = function(sm) {
	this.sm = sm;
	sm.connectToControlPanel(this);
};

ControlPanel.prototype.resize = function(dim) {
	this.panel.style.width = parseInt(0.20 * (this.app.sage2_width - 120)) + 'px';
	this.panel.style.height = parseInt(this.app.sage2_height - 60) + 'px';
	this.arrange();	
};
ControlPanel.prototype.createButton = function(imageUrl, text, smInput) {
	var button = document.createElement('div');
	button.style.background = "#EFEFEF";
	button.style.display = "block";
	button.style.position = "absolute";
	button.setAttribute("smInput", smInput);
	if (imageUrl) {
		var iconWrap = document.createElement("div");
		iconWrap.style.display = "block";
		iconWrap.style.position = "absolute";
		iconWrap.style.top = "20%";
		iconWrap.style.width = "100%";
		iconWrap.style.height = "50%";
		var icon = document.createElement("img");
		icon.class = 'planner3DButtonIcon';
		icon.src = imageUrl;
		icon.style.display = "block";
		icon.style.marginLeft = "auto";
		icon.style.marginRight = "auto";
		icon.style.maxWidth = "15%";
		icon.style.maxHeight = "15%";
		icon.style.transformOrigin = "top center";
		icon.style.transform = "scale(5)";
		icon.style.margin = "auto";
		icon.style.objectFit = "contain";
		icon.setAttribute("smInput", smInput);
		iconWrap.appendChild(icon);
		button.appendChild(iconWrap);
	}
	var buttonText = document.createElement("div");
	buttonText.style.display = "block";
	buttonText.style.position = "absolute";
	buttonText.style.top = "70%";
	buttonText.style.width = "96%";
	buttonText.style.height = "22%";
	buttonText.style.fontSize   = "90%";
	buttonText.style.color      = "black";
	buttonText.style.textAlign = "center";
	buttonText.style.marginLeft = "2%";
	buttonText.style.marginRight = "2%";
	buttonText.style.marginTop = "4%";
	buttonText.style.marginBottom = "4%"; 
	buttonText.style.verticalAlign = "middle";
	buttonText.textContent      = text;
	buttonText.setAttribute("smInput", smInput);
	button.appendChild(buttonText);
	return button;
};

ControlPanel.prototype.populate = function(buttons) {
	buttons.forEach(b => {
		var btn = this.createButton(b.icon, b.text, b.id);
		this.panel.appendChild(btn);
		btn.id = getUniqueId('planner3DButton');
		this.buttons.push({id: b.id, button: btn, box: null});
	});
	this.arrange();
	console.log(this.box, this.app.sage2_y);
};


ControlPanel.prototype.buttonPress = function() {
	if (this.pointerOnButton > -1) {
		var btnObj = this.buttons[this.pointerOnButton];
		btnObj.button.style.background = "#5656CC";
	}
};

ControlPanel.prototype.buttonRelease = function() {

};

ControlPanel.prototype.buttonHover = function(point) {
	this.pointerOnButton = -1;
	if (point.x > this.box.left && point.x < this.box.right &&
		point.y > this.box.top && point.y < this.box.bottom) {
		this.buttons.forEach((b, i) => {
			if (point.x > b.box.left && point.x < b.box.right &&
				point.y > b.box.top && point.y < b.box.bottom) {
				this.pointerOnButton = i;
			}
			b.button.style.background = "#EFEFEF";
		});
	}
	if (this.pointerOnButton > -1) {
		this.buttons[this.pointerOnButton].button.style.background = "#8989CC";
	}
	
};

ControlPanel.prototype.arrange = function() {
	var width = parseInt(this.panel.style.width);
	var height = parseInt(this.panel.style.height);
	var columns = 2;
	var length = this.buttons.length;
	var rows = Math.round(length / columns);
	var margin = 10;
	var btnIdx = 0;
	var w = Math.round((width - (columns - 1) * margin) / columns);
	var h = Math.round((height - (rows - 1) * margin) / rows);
	var top = 0;
	var left = 0;
	for (var i = 0; i < rows && btnIdx < this.buttons.length; i ++) {
		left = 0;
		for (var j = 0; j < columns && btnIdx < this.buttons.length; j ++) {
			var b = this.buttons[btnIdx].button;
			b.style.left = left + 'px';
			b.style.top = top + 'px';
			b.style.width = w + 'px';
			b.style.height = h + 'px';
			btnIdx ++;
			left = left + margin + w;
			console.log(left, top);
		}
		top = top + margin + h;
		left = 0;
	}

	var box = this.panel.getBoundingClientRect();
	this.box = {
		left: box.left - this.app.sage2_x,
		top: box.top - this.app.sage2_y,
		right: box.right - this.app.sage2_x,
		bottom: box.bottom - this.app.sage2_y
	};
	this.buttons.forEach(b => {
		box = b.button.getBoundingClientRect();
		b.box = {
			left: box.left - this.app.sage2_x,
			top: box.top - this.app.sage2_y,
			right: box.right - this.app.sage2_x,
			bottom: box.bottom - this.app.sage2_y
		};
	});
};