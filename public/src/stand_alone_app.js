// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/* global Pointer, dataSharingPortals, createDrawingElement, RadialMenu, d3 */

"use strict";

/**
 * Building the display background and elememnts
 *
 * @module client
 * @submodule UIBuilder
 */

/**
* Constructor for StandAloneApp object
*
* @class StandAloneApp
* @constructor
* @param ui {Object} UIBuilder for creating pointers and UI elements
*/
function StandAloneApp(id, wsio) {


	this.id = id;
	this.wsio = wsio;
	// set the default style sheet
	this.csssheet = "css/style.css";
	
	// Get handle on the main div
	this.bg   = document.getElementById("background");
	this.main = document.getElementById("main");
	this.windowTitle = null;
	this.windowItem = null;
	this.appParentDiv = null;
	this.sageItem = null;
	this.appWidth;
	this.appHeight;

	this.application = null;
	this.controlObjects = {};
	this.user = {
		label: localStorage.SAGE2_ptrName,
		color: localStorage.SAGE2_ptrColor,
		sourceType: "Pointer"
	};
	this.appPositionOnDisplay = {left:0, top: 0, width: 0, height: 0};
	this.localPointerID = null;

	this.setup = function(ui) {
		// Save the wall configuration object
		this.json_cfg = ui.json_cfg;
		this.ui = ui;
		this.titleBarHeight = this.json_cfg.ui.titleBarHeight;
		this.titleTextSize  = this.json_cfg.ui.titleTextSize;
		// background color
		if (this.json_cfg.background) {
			this.bg.style.backgroundColor = this.json_cfg.background.color || "#333333";	
		} else {
			this.bg.style.backgroundColor = "#333333";
		}
		
		this.bg.style.top    = "0px";
		this.bg.style.left   = "0px";
		this.main.style.left = "0px";
		this.main.style.top  = "0px";

		// Set at the bottom of the stack
		this.bg.style.zIndex = 0;
		ui.buildStandAlone();
		window.onresize = this.resize.bind(this);
		window.onresize();
		this.startLocalSAGE2Pointer();
	};

	this.resize = function() {
		this.browserWidth = document.documentElement.clientWidth;
		this.browserHeight = document.documentElement.clientHeight;

		this.mainWidth  = this.browserWidth;
		this.mainHeight = this.browserHeight;
		
		this.bg.style.width    = this.browserWidth  + "px";
		this.bg.style.height   = this.browserHeight + "px";
		
		
		this.main.style.width  = this.mainWidth + "px";
		this.main.style.height = this.mainHeight + "px";
		// Bringing main to the center
		
		
		//Calculating new scale for pointers
		var wallWidth  = this.json_cfg.resolution.width  * this.json_cfg.layout.columns;
		var wallHeight = this.json_cfg.resolution.height * this.json_cfg.layout.rows;
		var wallRatio = wallWidth / wallHeight;
		
		var browserRatio = document.documentElement.clientWidth / document.documentElement.clientHeight;
		var newratio;
		if (wallRatio >= browserRatio) {
			newratio = document.documentElement.clientWidth / wallWidth;
		} else {
			newratio = document.documentElement.clientHeight / wallHeight;
		}
		this.ui.resizePointers(newratio);


		if (this.appParentDiv === null || this.sageItem === null) {
			this.appParentDiv = document.getElementById(this.id);
			if (!this.appParentDiv) {
				setTimeout(this.resize.bind(this), 1000);
				return;
			}
			var child = this.appParentDiv.getElementsByClassName("sageItem");
			// If application not ready, return
			if (child.length < 1) {
				setTimeout(this.resize.bind(this), 1000);
				return;
			}
			this.sageItem = child[0];
		}
		this.computeWindowFit();
		var translate = "translate(" + Math.round(this.appLeft) + "px," + Math.round(this.appTop) + "px)";
		var sx = this.appWidth / this.appPositionOnDisplay.width;
		var sy = this.appHeight / this.appPositionOnDisplay.height;
		var scale = "scale(" + sx + "," + sy + ") ";
		this.appParentDiv.style.webkitTransform = translate;
		this.appParentDiv.style.mozTransform    = translate;
		this.appParentDiv.style.transform       = translate;
		if (this.sageItem.tagName.toLowerCase() === "div" ||
			this.sageItem.tagName.toLowerCase() === "iframe" ||
			this.sageItem.tagName.toLowerCase() === "webview") {
			this.sageItem.style.width  = Math.round(this.appPositionOnDisplay.width) + "px";
			this.sageItem.style.height = Math.round(this.appPositionOnDisplay.height) + "px";
			
		} else {
			// if it's a canvas or else, just use width and height
			this.sageItem.width  = Math.round(this.appPositionOnDisplay.width);
			this.sageItem.height = Math.round(this.appPositionOnDisplay.height);
			this.sageItem.left = Math.round(this.appLeft) + "px";
			this.sageItem.top = Math.round(this.appTop) + "px";
		}
		this.sageItem.style.webkitTransform = scale;
		this.sageItem.style.mozTransform    = scale;
		this.sageItem.style.transform       = scale;
		this.appParentDiv.style.width 		= Math.round(this.appPositionOnDisplay.width) + "px";
		this.appParentDiv.style.height = Math.round(this.appPositionOnDisplay.height) + "px";

	};
	
	this.computeWindowFit = function(data) {
		//Find the app window dimensions that fit into the current browser size
		var mainAspect = this.mainWidth / this.mainHeight;
		var appAspect, w, h;
		if (data) {
			w = data.width;
			h = data.height;
		} else {
			w = this.appWidth;
			h = this.appHeight;
		}
		appAspect = w / h;
		if (mainAspect > appAspect) {
			this.appWidth = Math.round(w * this.mainHeight / h);
			this.appHeight = Math.round(this.mainHeight);
		} else {
			this.appWidth = Math.round(this.mainWidth);
			this.appHeight = Math.round(h * this.mainWidth / w);
		}

		this.appLeft = Math.round((this.mainWidth - this.appWidth) / 2);
		this.appTop = Math.round((this.mainHeight - this.appHeight) / 2);
	};
	this.createAppWindow = function(data) {
		var _this = this;
		this.saveAppPositionAndSize(data);
		this.computeWindowFit(data);
		var date = new Date(data.date);

		var windowItem = document.createElement("div");
		windowItem.id = data.id;
		windowItem.className      = "windowItem";
		windowItem.style.top      = "0px";

		windowItem.style.overflow = "hidden";
		windowItem.style.zIndex   = (itemCount + 1).toString();
		if (ui.noDropShadow === true) {
			windowItem.style.boxShadow = "none";
		}
		
		var windowState = document.createElement("div");
		windowState.id = data.id + "_state";
		windowState.style.position = "absolute";
		windowState.style.width  = data.width.toString() + "px";
		windowState.style.height = data.height.toString() + "px";
		windowState.style.backgroundColor = "rgba(0,0,0,0.8)";
		windowState.style.lineHeight = Math.round(1.5 * this.titleTextSize) + "px";
		windowState.style.zIndex = "100";
		windowState.style.display = "none";

		var windowStateContatiner = document.createElement("div");
		windowStateContatiner.id = data.id + "_statecontainer";
		windowStateContatiner.style.position = "absolute";
		windowStateContatiner.style.top = "0px";
		windowStateContatiner.style.left = "0px";
		windowState.appendChild(windowStateContatiner);
		windowItem.appendChild(windowState);

		this.main.appendChild(windowItem);

		// App launched in window
		if (data.application === "media_stream") {
			this.wsio.emit('receivedMediaStreamFrame', {id: data.id});
		}
		if (data.application === "media_block_stream") {
			this.wsio.emit('receivedMediaBlockStreamFrame', {id: data.id, newClient: true});
		}

		// convert url if hostname is alias for current origin
		var url = cleanURL(data.url);
		function loadApplication() {
			var init = {
				id: data.id,
				x: data.left,
				y: data.top,
				width: data.width,
				height: data.height,
				resrc: url,
				state: data.data,
				date: date,
				title: data.title,
				application: data.application
			};
			// extra data that may be passed from launchAppWithValues
			if (data.customLaunchParams) {
				init.customLaunchParams = data.customLaunchParams;
			}

			// load new app
			if (window[data.application] === undefined) {
				var js = document.createElement("script");
				js.addEventListener('error', function(event) {
					console.log("Error loading script: " + data.application + ".js");
				}, false);
				js.addEventListener('load', function(event) {
					var newapp = new window[data.application]();
					newapp.init(init);
					newapp.refresh(date);

					// Sending the context menu info to the server
					if (isMaster) {
						newapp.getFullContextMenuAndUpdate();
					}

					_this.application = newapp;
					_this.controlObjects[data.id] = newapp;

					if (data.animation === true) {
						_this.wsio.emit('finishedRenderingAppFrame', {id: data.id});
					}
				}, false);
				js.type  = "text/javascript";
				js.async = false;
				js.src = url + "/" + data.application + ".js";
				console.log("Loading>", data.id, url + "/" + data.application + ".js");
				document.head.appendChild(js);
			} else {
				// load existing app
				var app = new window[data.application]();
				app.init(init);
				app.refresh(date);

				// Sending the context menu info to the server
				if (isMaster) {
					app.getFullContextMenuAndUpdate();
				}

				_this.application = app;
				_this.controlObjects[data.id] = app;

				if (data.animation === true) {
					_this.wsio.emit('finishedRenderingAppFrame', {id: data.id});
				}
				if (data.application === "movie_player") {
					setTimeout(function() {
						_this.wsio.emit('requestVideoFrame', {id: data.id});
					}, 500);
				}
			}
		}

		// load all dependencies
		if (data.resrc === undefined || data.resrc === null || data.resrc.length === 0) {
			loadApplication();
		} else {
			var loadResource = function(idx) {
				var resourceUrl = data.resrc[idx];

				if (dependencies[resourceUrl] !== undefined) {
					if ((idx + 1) < data.resrc.length) {
						loadResource(idx + 1);
					} else {
						console.log("all resources loaded", data.id);
						loadApplication();
					}

					return;
				}

				// Not loaded yet
				dependencies[resourceUrl] = false;

				// Check the type
				var loaderType;
				if (resourceUrl.endsWith(".js")) {
					loaderType = "script";
				} else if (resourceUrl.endsWith(".css")) {
					loaderType = "link";
				} else {
					console.log('Dependencies> unknown file extension, assuming script', resourceUrl);
					loaderType = "script";
				}

				if (loaderType) {
					// Create the DOM element to laod the resource
					var loader = document.createElement(loaderType);

					// Place an error handler
					loader.addEventListener('error', function(event) {
						console.log("Dependencies> Error loading", resourceUrl);
					}, false);

					// When done, try next dependency in the list
					loader.addEventListener('load', function(event) {
						// Success, mark as loaded
						dependencies[data.resrc[idx]] = true;
						if ((idx + 1) < data.resrc.length) {
							// load the next one
							loadResource(idx + 1);
						} else {
							// We are done
							console.log("Dependencies> all resources loaded", data.id);
							loadApplication();
						}
					});

					// if not a full URL, add the local one
					if (resourceUrl.indexOf("http://")  !== 0 &&
						resourceUrl.indexOf("https://") !== 0 &&
						resourceUrl.indexOf("/") !== 0) {
						resourceUrl = url + "/" + resourceUrl;
					}

					// is it a JS file
					if (loaderType === "script") {
						loader.type  = "text/javascript";
						loader.async = false;
						loader.src   = resourceUrl;
					} else if (loaderType === "link") {
						// is it a CSS file
						loader.setAttribute("type", "text/css");
						loader.setAttribute("rel",  "stylesheet");
						loader.setAttribute("href", resourceUrl);
					} else {
						console.log('Dependencies> unknown file type', resourceUrl);
					}

					// Finally, add it to the document to trigger the laod
					document.head.appendChild(loader);
				}
			};
			// Start loading the first resource
			loadResource(0);
		}

		this.resize();

	};
	this.saveAppPositionAndSize = function(data) {
		this.appPositionOnDisplay = {
			left: data.left || data.elemLeft,
			top: data.top || data.elemTop,
			width: data.width || data.elemWidth,
			height: data.height || data.elemHeight
		};
	};
	this.updateSagePointerPosition = function(pointer_data) {
		var inside = false;
		if (pointer_data.left > this.appPositionOnDisplay.left && 
			pointer_data.left < (this.appPositionOnDisplay.left + this.appPositionOnDisplay.width) &&
			pointer_data.top > this.appPositionOnDisplay.top &&
			pointer_data.top < (this.appPositionOnDisplay.top + this.appPositionOnDisplay.height)) {
				pointer_data.left = this.appLeft + this.appWidth * 
					(pointer_data.left - this.appPositionOnDisplay.left) / this.appPositionOnDisplay.width;
				pointer_data.top = this.appTop - this.titleBarHeight + this.appHeight *
					(pointer_data.top - this.appPositionOnDisplay.top) / this.appPositionOnDisplay.height;

				inside = true;
		}
		if (inside === true && this.ui.isPointerShown(pointer_data.id) === false) {
			pointer_data.label = localStorage.SAGE2_ptrName;
			pointer_data.color = localStorage.SAGE2_ptrColor;
			pointer_data.sourceType = "Pointer";
			pointer_data.mode = 1;
			this.ui.changeSagePointerMode(pointer_data);
			this.ui.showSagePointer(pointer_data);
			return "show";
		} else if (inside === false && this.ui.isPointerShown(pointer_data.id) === true) {
			this.ui.hideSagePointer(pointer_data);
			return "hide";
		}
		this.ui.updateSagePointerPosition(pointer_data);
		return "move";
	};
	this.hideSagePointer = function(pointer_data) {
		this.ui.hideSagePointer(pointer_data);
	};

	this.pointerMove = function(event) {
		var inside = false;
		var pointer_data = {
			id: this.user.id + "_pointer"
		};
		if (event.x > this.appLeft && event.x < (this.appLeft + this.appWidth) &&
			event.y > this.appTop && event.y < (this.appTop + this.appHeight)) {
				
				inside = true;
				pointer_data.left = event.x;
				pointer_data.top = event.y;
		}
		if (inside === true && this.ui.isPointerShown(pointer_data.id) === false) {
			pointer_data.label = this.user.label;
			pointer_data.color = this.user.color;
			this.ui.showSagePointer(pointer_data);
			return "show";
		} else if (inside === false && this.ui.isPointerShown(pointer_data.id) === true) {
			this.ui.hideSagePointer(pointer_data);
			return "hide";
		}
		this.ui.updateSagePointerPosition(pointer_data);
		return "move";
	};

	this.startLocalSAGE2Pointer = function() {
		if (hasMouse) {
			this.main.addEventListener('pointerlockchange', function(e) {
				console.log('Pointerlockchange>', e);
			});
			this.main.requestPointerLock = this.main.requestPointerLock       ||
										this.main.mozRequestPointerLock    ||
										this.main.webkitRequestPointerLock;

			// Ask the browser to lock the pointer
			if (this.main.requestPointerLock) {
				this.main.requestPointerLock();
			} else {
				console.log("No PointerLock support in this browser. Google Chrome is preferred.");
			}
		} else {
			console.log("No mouse detected - entering touch interface for SAGE2 Pointer");
		}
	};
	this.stopLocalSAGE2Pointer = function() {
		if (hasMouse) {
			if (document.exitPointerLock) {
				document.exitPointerLock();
			} else {
				console.log("No PointerLock support");
			}
		} else {
			this.wsio.emit('stopSagePointer', this.user);
		}
	};
}