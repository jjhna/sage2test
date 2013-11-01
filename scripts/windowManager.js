function windowManager(id, sock) {
	this.element = document.getElementById(id);
	this.ctx = this.element.getContext("2d");
	this.socket = sock;
	this.nRows = 0;
	this.nCols = 0;
	this.aspectRatio = 1.0;
	this.scale = 1.0;
	this.items = [];
	
	var widthPercent = this.element.style.width;
	var widthPx = parseFloat(widthPercent.substring(0, widthPercent.length-1)/100) * this.element.parentNode.clientWidth;
	
	this.ctx.canvas.width = widthPx;
	this.ctx.canvas.height = widthPx / this.aspectRatio;
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.weight);
		
		var i;
		
		/* draw tiled display layout */
		this.ctx.fillStyle = "rgba(200, 200, 200, 255)";
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = "rgba(0, 0, 0, 255)";
		this.ctx.fillRect(0,0, this.element.width, this.element.height);
		this.ctx.strokeRect(0,0, this.element.width, this.element.height);
		
		var stepX = this.element.width/this.nCols;
		var stepY = this.element.height/this.nRows;
		this.ctx.beginPath();
		for(i=1; i<this.nCols; i++){
			this.ctx.moveTo(i*stepX, 0);
			this.ctx.lineTo(i*stepX, this.element.height);
        }
        for(i=1; i<this.nRows; i++){
			this.ctx.moveTo(0, i*stepY);
			this.ctx.lineTo(this.element.width, i*stepY);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        /* draw all items */
        this.ctx.fillStyle = "rgba(255, 255, 255, 255)";
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = "rgba(90, 90, 90, 255)";
        for(i=0; i<this.items.length; i++){
        	var eLeft = this.items[i].left * this.scale;
        	var eTop = this.items[i].top * this.scale;
        	var eWidth = this.items[i].width * this.scale;
        	var eHeight = this.items[i].height * this.scale;
        	
			this.ctx.fillRect(eLeft, eTop, eWidth, eHeight);
			this.ctx.strokeRect(eLeft, eTop, eWidth, eHeight);
        }
	};
	
	this.resize = function() {
		alert("resize");
	};
	
	this.mousePress = function(event) {
		var rect = this.element.getBoundingClientRect();
		var mouseX = event.clientX - rect.left;
		var mouseY = event.clientY - rect.top;
		var globalX = mouseX / this.scale;
		var globalY = mouseY / this.scale;
		for(i=this.items.length-1; i>=0; i--){
        	var eLeft = this.items[i].left * this.scale;
        	var eTop = this.items[i].top * this.scale;
        	var eWidth = this.items[i].width * this.scale;
        	var eHeight = this.items[i].height * this.scale;
        	
        	if(mouseX >= eLeft && mouseX <= (eLeft+eWidth) && mouseY >= eTop && mouseY <= (eTop+eHeight)){
        		var selectOffsetX = this.items[i].left - globalX;
        		var selectOffsetY = this.items[i].top - globalY;
        		
        		this.socket.emit('selectElementById', {elemId: this.items[i].id, elemLeft: this.items[i].left, elemTop: this.items[i].top, eventX: globalX, eventY: globalY, eventOffsetX: selectOffsetX, eventOffsetY: selectOffsetY});
        		return;
        	}
        }
	};
	
	this.mouseMove = function(event) {
		var rect = this.element.getBoundingClientRect();
		var mouseX = event.clientX - rect.left;
		var mouseY = event.clientY - rect.top;
		var globalX = mouseX / this.scale;
		var globalY = mouseY / this.scale;
		this.socket.emit('moveSelectedElement', {eventX: globalX, eventY: globalY});
	};
	
	this.mouseRelease = function(event) {
		this.socket.emit('releaseSelectedElement');
	};
	
	this.initDisplayConfig = function(config) {
		this.nRows = config.layout.rows;
		this.nCols = config.layout.columns;
		this.aspectRatio = (config.resolution.width*this.nCols) / (config.resolution.height*this.nRows);
		
		var widthPercent = this.element.style.width;
		var widthPx = (widthPercent.substring(0, widthPercent.length-1)/100) * this.element.parentNode.clientWidth;
		
		this.ctx.canvas.width = widthPx;
		this.ctx.canvas.height = widthPx / this.aspectRatio;
		
		this.scale = this.ctx.canvas.width / (config.resolution.width*this.nCols);
		
		this.draw();
	};
	
	this.addNewElement = function(elem_data) {
		this.items.push(elem_data);
		this.draw();
	};
	
	this.element.addEventListener('mousedown', this.mousePress.bind(this), false);
	this.element.addEventListener('mousemove', this.mouseMove.bind(this), false);
	this.element.addEventListener('mouseup', this.mouseRelease.bind(this), false);
}
