function windowManager(id, ws) {
	this.element = document.getElementById(id);
	this.ctx = this.element.getContext("2d");
	this.wsio = ws;
	this.nRows = 0;
	this.nCols = 0;
	this.aspectRatio = 1.0;
	this.resolution = [];
	this.scale = 1.0;
	this.titleBarHeight = 0;
	this.applications = [];
	this.mouseX = 0;
	this.mouseY = 0;
	
	this.canvasImg = new Image();
	this.canvasImg.src = "images/canvas.png";
	this.imageImg = new Image();
	this.imageImg.src = "images/image.png";
	this.kineticjsImg = new Image();
	this.kineticjsImg.src = "images/kineticjs.png";
	this.pdfImg = new Image();
	this.pdfImg.src = "images/pdf.png";
	this.screenImg = new Image();
	this.screenImg.src = "images/screen.png";
	this.threejsImg = new Image();
	this.threejsImg.src = "images/threejs.png";
	this.videoImg = new Image();
	this.videoImg.src = "images/video.png";
	this.webglImg = new Image();
	this.webglImg.src = "images/webgl.png";
	this.youtubeImg = new Image();
	this.youtubeImg.src = "images/youtube.png";
	
	var widthPercent = this.element.style.width;
	var widthPx = parseFloat(widthPercent.substring(0, widthPercent.length-1)/100) * this.element.parentNode.clientWidth;
	
	this.ctx.canvas.width = widthPx;
	this.ctx.canvas.height = widthPx / this.aspectRatio;
	
	this.draw = function() {
		// clear canvas		
		this.ctx.clearRect(0,0, this.element.width, this.element.weight);
		
		var i;
		
		/* draw display background */
		this.ctx.fillStyle = "rgba(200, 200, 200, 1.0)";
		this.ctx.fillRect(0,0, this.element.width, this.element.height);
        
        
		/* draw all items */
		for(i=0; i<this.applications.length; i++){
			// item
			this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
			this.ctx.lineWidth = 2;
			this.ctx.strokeStyle = "rgba(90, 90, 90, 1.0)";
			
			this.ctx.shadowOffsetX = 8;
			this.ctx.shadowOffsetY = 8;
			this.ctx.shadowBlur = 12;
			this.ctx.shadowColor = "#222222";
			
			var eLeft = this.applications[i].left * this.scale;
			var eTop = (this.applications[i].top+this.titleBarHeight) * this.scale;
			var eWidth = this.applications[i].width * this.scale;
			var eHeight = this.applications[i].height * this.scale;
			
			this.ctx.fillRect(eLeft, eTop, eWidth, eHeight);
			
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
			this.ctx.shadowBlur = 0;
			
			this.ctx.strokeRect(eLeft, eTop, eWidth, eHeight);
			
			// item icon
			var size = 0.8*Math.min(eWidth, eHeight);
			var x = eLeft + (eWidth/2) - (size/2);
			var y = eTop + (eHeight/2) - (size/2);
			
			if(this.applications[i].application === "image_viewer") this.ctx.drawImage(this.imageImg, x, y, size, size);
			else if(this.applications[i].application === "movie_player") this.ctx.drawImage(this.videoImg, x, y, size, size);
			else if(this.applications[i].application === "pdf_viewer") this.ctx.drawImage(this.pdfImg, x, y, size, size);
			else if(this.applications[i].application === "media_stream") this.ctx.drawImage(this.screenImg, x, y, size, size);
			else this.ctx.drawImage(this.canvasImg, x, y, size, size);
			
			/*
			if(this.applications[i].type == "canvas") this.ctx.drawImage(this.canvasImg, x, y, size, size);
			else if(this.applications[i].type == "img") this.ctx.drawImage(this.imageImg, x, y, size, size);
			else if(this.applications[i].type == "kineticjs") this.ctx.drawImage(this.kineticjsImg, x, y, size, size);
			else if(this.applications[i].type == "pdf") this.ctx.drawImage(this.pdfImg, x, y, size, size);
			else if(this.applications[i].type == "screen") this.ctx.drawImage(this.screenImg, x, y, size, size);
			else if(this.applications[i].type == "threejs") this.ctx.drawImage(this.threejsImg, x, y, size, size);
			else if(this.applications[i].type == "video") this.ctx.drawImage(this.videoImg, x, y, size, size);
			else if(this.applications[i].type == "webgl") this.ctx.drawImage(this.webglImg, x, y, size, size);
			else if(this.applications[i].type == "youtube") this.ctx.drawImage(this.youtubeImg, x, y, size, size);
			*/
			
			// title bar
			this.ctx.fillStyle = "rgba(102, 102, 102, 1.0)";
			this.ctx.lineWidth = 2;
			this.ctx.strokeStyle = "rgba(90, 90, 90, 1.0)";
			
			var eLeft = this.applications[i].left * this.scale;
			var eTop = (this.applications[i].top) * this.scale;
			var eWidth = this.applications[i].width * this.scale;
			var eHeight = this.titleBarHeight * this.scale;
			
			this.ctx.fillRect(eLeft, eTop, eWidth, eHeight);
			this.ctx.strokeRect(eLeft, eTop, eWidth, eHeight);
		}
		
		
		/* draw tiled display layout */
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
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
	};
	
	this.mousePress = function(event) {
		this.wsio.emit('pointerPress');
		event.preventDefault();
	};
	
	this.mouseMove = function(event) {
		var rect = this.element.getBoundingClientRect();
		this.mouseX = event.clientX - rect.left;
		this.mouseY = event.clientY - rect.top;
		var globalX = this.mouseX / this.scale;
		var globalY = this.mouseY / this.scale;
		
		this.wsio.emit('pointerPosition', {pointerX: globalX, pointerY: globalY});
	};
	
	this.mouseRelease = function(event) {
		this.wsio.emit('pointerRelease');
		event.preventDefault();
	};
	
	////////////////////////////////////////////
	// Initial touch code
	//   uses only the first touch to move
	//   compared to move, need to update position on press and release events
	////////////////////////////////////////////	
	this.touchPress = function(event) {
		event.preventDefault();

		// Update "cursor" position
		var rect = this.element.getBoundingClientRect();
		this.mouseX = event.changedTouches[0].clientX - rect.left;
		this.mouseY = event.changedTouches[0].clientY - rect.top;
		var globalX = this.mouseX / this.scale;
		var globalY = this.mouseY / this.scale;		
		this.wsio.emit('pointerPosition', {pointerX: globalX, pointerY: globalY});
		// Emit the press event
		this.wsio.emit('pointerPress');
	};
	
	this.touchMove = function(event) {
		event.preventDefault();

		// Emot the move event
		var rect = this.element.getBoundingClientRect();
		this.mouseX = event.changedTouches[0].clientX - rect.left;
		this.mouseY = event.changedTouches[0].clientY - rect.top;
		var globalX = this.mouseX / this.scale;
		var globalY = this.mouseY / this.scale;		
		this.wsio.emit('pointerPosition', {pointerX: globalX, pointerY: globalY});
	};
	
	this.touchRelease = function(event) {
		event.preventDefault();

		// Update the "cursor" position
		var rect = this.element.getBoundingClientRect();
		this.mouseX = event.changedTouches[0].clientX - rect.left;
		this.mouseY = event.changedTouches[0].clientY - rect.top;
		var globalX = this.mouseX / this.scale;
		var globalY = this.mouseY / this.scale;		
		this.wsio.emit('pointerPosition', {pointerX: globalX, pointerY: globalY});
		// Emit the release event
		this.wsio.emit('pointerRelease');
	};
	////////////////////////////////////////////


	this.mouseScroll = function(event) {
		var scale = 1.0 + Math.abs(event.wheelDelta)/512;
		if(event.wheelDelta > 0) scale = 1.0 / scale;
		
		this.wsio.emit('pointerScrollStart');
		this.wsio.emit('pointerScroll', {scale: scale});
		event.preventDefault();
	};
	
	this.mouseScrollFF = function(event) {
		var wheelDelta = -120*event.detail;
		var scale = 1.0 + Math.abs(wheelDelta)/512;
		if(wheelDelta > 0) scale = 1.0 / scale;
		
		this.wsio.emit('pointerScrollStart');
		this.wsio.emit('pointerScroll', {scale: scale});
		event.preventDefault();
	};
	
	this.mouseDblClick = function(event) {
		wsio.emit('pointerDblClick');
		event.preventDefault();
	}
	
	this.keyDown = function(event) {
		this.wsio.emit('keyDown', {code: event.keyCode});
		event.preventDefault();
	};
	
	this.keyUp = function(event) {
		this.wsio.emit('keyUp', {code: event.keyCode});
		event.preventDefault();
	}
	
    this.keyPress = function(event) {
		this.wsio.emit('keyPress', {code: event.charCode});
		event.preventDefault();
	}
	
	
	this.addNewElement = function(elem_data) {
		this.applications.push(elem_data);
		console.log("added: " + elem_data.id + "(" + elem_data.type + ")");
		this.draw();
	};
	
	this.addAppWindow = function(data) {
		this.applications.push(data);
		this.draw();
	};
	
	this.deleteElement = function(elemId) {
		var selectedIndex;
		var selectedItem;
		
		for(var i=0; i<this.applications.length; i++){
			if(this.applications[i].id == elemId){
				selectedIndex = i;
				selectedItem = this.applications[i];
				break;
			}
		}
		for(var i=selectedIndex; i<this.applications.length-1; i++){
			this.applications[i] = this.applications[i+1];
		}
		this.applications[this.applications.length-1] = selectedItem;
		this.applications.pop();
		this.draw();
	};
	
	this.initDisplayConfig = function(config) {
		this.nRows = config.layout.rows;
		this.nCols = config.layout.columns;
		this.aspectRatio = (config.resolution.width*this.nCols) / (config.resolution.height*this.nRows);
		
		var widthPercent = this.element.style.width;
		var widthPx = (widthPercent.substring(0, widthPercent.length-1)/100) * this.element.parentNode.clientWidth;
		
		this.element.width = widthPx;
		this.element.height = widthPx / this.aspectRatio;
		
		this.resolution = [(config.resolution.width*this.nCols), (config.resolution.height*this.nRows)];
		this.scale = this.element.width / this.resolution[0];
		
		this.titleBarHeight = Math.round(0.03 * (config.resolution.height * config.layout.rows));
		
		this.draw();
	};
	
	this.resize = function() {
		var widthPercent = this.element.style.width;
		var widthPx = (widthPercent.substring(0, widthPercent.length-1)/100) * this.element.parentNode.clientWidth;
		
		this.element.width = widthPx;
		this.element.height = widthPx / this.aspectRatio;
		
		this.scale = this.element.width / this.resolution[0];
		this.draw();
	}
	
	this.updateItemOrder = function(idList) {
		var i;
		var j;
		for(i=0; i<idList.length; i++){
			for(j=0; j<this.applications.length; j++){
				if(this.applications[j].id == idList[i]){
					var tmp = this.applications[i];
					this.applications[i] = this.applications[j];
					this.applications[j] = tmp;
				}
			}
		}
		
		this.draw();
	}
	
	this.setItemPosition = function(position_data) {
		var i;
		for(i=0; i<this.applications.length; i++){
			if(this.applications[i].id == position_data.elemId){
				this.applications[i].left = position_data.elemLeft;
				this.applications[i].top = position_data.elemTop;
				break;
			}
		}
		this.draw();
	};
	
	this.setItemPositionAndSize = function(position_data) {
		var i;
		for(i=0; i<this.applications.length; i++){
			if(this.applications[i].id == position_data.elemId){
				this.applications[i].left = position_data.elemLeft;
				this.applications[i].top = position_data.elemTop;
				this.applications[i].width = position_data.elemWidth;
				this.applications[i].height = position_data.elemHeight;
				break;
			}
		}
		this.draw();
	};
}
