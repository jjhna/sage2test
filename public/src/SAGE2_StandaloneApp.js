// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-15

/* global ignoreFields, hostAlias */
/* global SAGE2RemoteSitePointer */
/* global process, StandAloneApp*/
/* global require */

"use strict";

/**
 * SAGE2 Display, client side rendering
 *
 * @module client
 * @submodule SAGE2_Display
 * @class SAGE2_Display
 */

window.URL = (window.URL || window.webkitURL || window.msURL || window.oURL);

var clientID;
var wsio;

var isMaster;
var hostAlias = {};

var itemCount = 20;
var controlItems   = {};
var controlObjects = {};
var lockedControlElements = {};
var widgetConnectorRequestList = {};

var application = null;
var partitions = {};
var dependencies = {};
var dataSharingPortals = {};
var createdLocalPointer = false;
// Maintain the file list available on the server
var storedFileList = null;
var storedFileListEventHandlers = [];

// UI object to build the element on the wall
var ui;
var uiTimer = null;
var uiTimerDelay;

// Global variables for screenshot functionality
var makingScreenshotDialog = null;

var interactor = null;
var pointerDown = false;
var	pointerX    = 0;
var	pointerY    = 0;

var keyEvents;
var touchMode;
var touchDist;
var touchTime;
var touchTap;
var touchTapTime;
var touchHold;
var touchStartX;
var touchStartY;
var hasMouse;

var standAloneApp;
var appId = null;
var wsioID = null;
// Explicitely close web socket when web browser is closed
window.onbeforeunload = function() {
	if (wsio !== undefined) {
		wsio.close();
	}
};

/**
 * When the page loads, SAGE2 starts
 *
 */
window.addEventListener('load', function(event) {
	SAGE2_init();
});


// Get Browser-Specifc Prefix
function getBrowserPrefix() {
	// Check for the unprefixed property.
	if ('hidden' in document) {
		return null;
	}
	// All the possible prefixes.
	var browserPrefixes = ['moz', 'ms', 'o', 'webkit'];

	for (var i = 0; i < browserPrefixes.length; i++) {
		var prefix = browserPrefixes[i] + 'Hidden';
		if (prefix in document) {
			return browserPrefixes[i];
		}
	}
	// The API is not supported in browser.
	return null;
}

// Get Browser Specific Hidden Property
function hiddenProperty(prefix) {
	if (prefix) {
		return prefix + 'Hidden';
	}
	return 'hidden';
}

// Get Browser Specific Visibility State
function visibilityState(prefix) {
	if (prefix) {
		return prefix + 'VisibilityState';
	}
	return 'visibilityState';
}

// Get Browser Specific Event
function visibilityEvent(prefix) {
	if (prefix) {
		return prefix + 'visibilitychange';
	}
	return 'visibilitychange';
}

/**
 * Entry point of the application
 *
 * @method SAGE2_init
 */
function SAGE2_init() {
	clientID = parseInt(getParameterByName("clientID")) || 0;
	console.log("clientID: " + clientID);

	wsio = new WebsocketIO();
	console.log("Connected to server: ", window.location.origin);

	// Detect the current browser
	SAGE2_browser();

	// Setup focus events
	setupFocusHandlers();

	isMaster = false;

	wsio.open(function() {
		console.log("Websocket opened");

		setupListeners();

		// Get the cookie for the session, if there's one
		var session = getCookie("session");
		appId = getParameterByName("appID");
		var clientDescription = {
			clientType: "standAloneApp",
			app: appId,
			requests: {
				config: true,
				version: true,
				time: true,
				console: false
			},
			browser: __SAGE2__.browser,
			session: session
		};
		wsio.emit('addClient', clientDescription);
		//interactor = new SAGE2_interaction(wsio);
	});

	// Socket close event (ie server crashed)
	wsio.on('close', function(evt) {
		window.close();
	});

	document.addEventListener('mousemove',  mouseCheck,   false);
	//document.addEventListener('touchstart', touchStart,   false);
	//document.addEventListener('touchend',   touchEnd,     false);
	//document.addEventListener('touchmove',  touchMove,    false);

	keyEvents = false;
	touchTime = 0;
	touchTapTime = 0;
	touchHold = null;
	touchMode = "";

	hasMouse = false;
}

/**
 * setupFocusHandlers
 *
 * @method setupFocusHandlers
 */
function setupFocusHandlers() {
	window.addEventListener("focus", function(evt) {
		if (window.__SAGE2__ && __SAGE2__.browser.isMobile) {
			location.reload();
		}
	}, false);
	window.addEventListener("blur", function(evt) {
		if (window.__SAGE2__ && __SAGE2__.browser.isMobile) {
			if (wsio !== undefined) {
				setTimeout(function() {
					wsio.close();
				}, 200);
				document.getElementById('background').style.display = 'none';
			}
		}
	}, false);

	// Get Browser Prefix
	var prefix   = getBrowserPrefix();
	var hidden   = hiddenProperty(prefix);
	// var visState = visibilityState(prefix);
	var visEvent = visibilityEvent(prefix);

	document.addEventListener(visEvent, function(event) {
		if (window.__SAGE2__ && __SAGE2__.browser.isMobile) {
			if (document[hidden]) {
				setTimeout(function() {
					wsio.close();
				}, 200);
				document.getElementById('background').style.display = 'none';
			} else {
				location.reload();
			}
		}
	});

	if (__SAGE2__.browser.isElectron) {
		// Display warning messages from the 'Main' Electron process
		require('electron').ipcRenderer.on('warning', function(event, message) {
			var problemDialog = ui.buildMessageBox('problemDialog', message);
			ui.main.appendChild(problemDialog);
			document.getElementById('problemDialog').style.display = "block";
			// close the warning after 2.5 second
			setTimeout(function() {
				deleteElement('problemDialog');
			}, 2500);
		});
	}
}

/**
 * First handler for mouse event: fiding out if device has a mouse
 *
 * @method mouseCheck
 * @param event {Event} event data
 */
function mouseCheck(event) {
	var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
	var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
	if (!__SAGE2__.browser.isSafari && !__SAGE2__.browser.isIE && (movementX === 0 && movementY === 0 ||
			(Date.now() - touchTime) < 1000)) {
		return;
	}
	if (__SAGE2__.browser.isSafari && __SAGE2__.browser.isIOS) {
		return;
	}
	if (__SAGE2__.browser.isIE && __SAGE2__.browser.isWinPhone) {
		return;
	}
	hasMouse = true;
	console.log("Detected as desktop device");

	/*document.removeEventListener('mousemove', mouseCheck, false);
	document.addEventListener('mousedown',  pointerPress,    false);
	document.addEventListener('click',      pointerClick,    false);
	document.addEventListener('mouseup',    pointerRelease,  false);*/
	if (standAloneApp) {
		document.addEventListener('mousemove', standAloneApp.pointerMove.bind(standAloneApp), false);
	} else {
		setTimeout(function() {
			document.addEventListener('mousemove', standAloneApp.pointerMove.bind(standAloneApp), false);
		}, 1000);
	}

	/*document.addEventListener('wheel',      pointerScroll,   false);

	document.addEventListener('dblclick',   pointerDblClick, false);*/


}



function setupListeners() {
	wsio.on('initialize', function(data) {
		var startTime  = new Date(data.start);

		// Global initialization
		SAGE2_initialize(startTime);

		//interactor.setInteractionId(data.UID);
		pointerDown = false;
		pointerX    = 0;
		pointerY    = 0;
		wsioID = data.UID;
	});


	wsio.on('broadcast', function(data) {
		if (data.app === standAloneApp.id) {
			var app = standAloneApp.application;
			if (app) {
				// Send the call to the application
				app.callback(data.func, data.data);
			} else {
				setTimeout(function() {
					if (app) {
						// Send the call to the application
						app.callback(data.func, data.data);
					}
				}, 500);
			}
		}

	});

	wsio.on('addScript', function(script_data) {
		var js = document.createElement('script');
		js.type = "text/javascript";
		js.src = script_data.source;
		document.head.appendChild(js);
	});



	wsio.on('setupDisplayConfiguration', function(json_cfg) {
		var i;
		var http_port;
		var https_port;

		http_port = json_cfg.port === 80 ? "" : ":" + json_cfg.port;
		https_port = json_cfg.secure_port === 443 ? "" : ":" + json_cfg.secure_port;
		hostAlias["http://"  + json_cfg.host + http_port]  = window.location.origin;
		hostAlias["https://" + json_cfg.host + https_port] = window.location.origin;
		for (i = 0; i < json_cfg.alternate_hosts.length; i++) {
			hostAlias["http://"  + json_cfg.alternate_hosts[i] + http_port]  = window.location.origin;
			hostAlias["https://" + json_cfg.alternate_hosts[i] + https_port] = window.location.origin;
		}

		standAloneApp = new StandAloneApp(appId, wsio);
		standAloneApp.setup(new UIBuilder(json_cfg, clientID));
		standAloneApp.user.id = wsioID;
		ui = standAloneApp.ui;
	});

	wsio.on('setItemPosition', function(position_data) {
		if (standAloneApp && position_data.elemId === standAloneApp.id) {
			standAloneApp.updateAppPositionAndSize(position_data);
		}
	});

	wsio.on('setItemPositionAndSize', function(position_data) {
		if (standAloneApp && position_data.elemId === standAloneApp.id) {
			standAloneApp.updateAppPositionAndSize(position_data);
		}
	});

	wsio.on('createSagePointer', function(pointer_data) {
		if (window.ui) {
			ui.createSagePointer(pointer_data);
			console.log(pointer_data);
		} else {
			setTimeout(function() {
				ui.createSagePointer(pointer_data);
			}, 1000);
		}
	});

	wsio.on('hideSagePointer', function(pointer_data) {
		SAGE2RemoteSitePointer.notifyAppsPointerIsHidden(pointer_data);
		standAloneApp.hideSagePointer(pointer_data);
	});

	wsio.on('updateSagePointerPosition', function(pointer_data) {
		if (standAloneApp) {
			standAloneApp.updateSagePointerPosition(pointer_data);
		}
	});


	wsio.on('loadApplicationState', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			standAloneApp.application.SAGE2Load(data.state, new Date(data.date));
		}
	});

	wsio.on('loadApplicationOptions', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			var app = standAloneApp.application;
			if (app !== undefined && app !== null) {
				app.SAGE2LoadOptions(data.options);
			}
		}
	});


	wsio.on('updateMediaStreamFrame', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			wsio.emit('receivedMediaStreamFrame', {id: data.id});
			standAloneApp.application.SAGE2Load(data.state, new Date(data.date));
		}
	});

	wsio.on('updateMediaBlockStreamFrame', function(data) {
		var appId     = byteBufferToString(data);
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			var blockIdx  = byteBufferToInt(data.subarray(appId.length + 1, appId.length + 3));
			var date      = byteBufferToInt(data.subarray(appId.length + 3, appId.length + 11));
			var yuvBuffer = data.subarray(appId.length + 11, data.length);
			standAloneApp.application.textureData(blockIdx, yuvBuffer);
			if (standAloneApp.application.receivedBlocks.every(isTrue) === true) {
				standAloneApp.application.refresh(new Date(date));
				standAloneApp.application.setValidBlocksFalse();
				wsio.emit('receivedMediaBlockStreamFrame', {id: appId});
			}
		}
	});

	wsio.on('updateVideoFrame', function(data) {
		var appId     = byteBufferToString(data);
		if (standAloneApp.application && appId === standAloneApp.application.id) {
			var blockIdx  = byteBufferToInt(data.subarray(appId.length + 1, appId.length + 3));
			var date      = byteBufferToInt(data.subarray(appId.length + 7, appId.length + 15));
			var yuvBuffer = data.subarray(appId.length + 15, data.length);
			standAloneApp.application.textureData(blockIdx, yuvBuffer);
			if (standAloneApp.application.receivedBlocks.every(isTrue) === true) {
				standAloneApp.application.refresh(new Date(date));
				standAloneApp.application.setValidBlocksFalse();
				wsio.emit('requestVideoFrame', {id: appId});
			}
		}
	});

	wsio.on('updateFrameIndex', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			standAloneApp.application.setVideoFrame(data.frameIdx);
		}
	});

	wsio.on('videoEnded', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			standAloneApp.application.videoEnded();
		}
	});

	wsio.on('updateValidStreamBlocks', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			standAloneApp.application.validBlocks = data.blockList;
			standAloneApp.application.setValidBlocksFalse();
		}
	});

	wsio.on('updateWebpageStreamFrame', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			wsio.emit('receivedWebpageStreamFrame', {id: data.id, client: clientID});

			var webpage = document.getElementById(data.id + "_webpage");
			webpage.src = "data:image/jpeg;base64," + data.src;
		}
	});

	wsio.on('createAppWindow', function(data) {
		if (standAloneApp.application === null) {
			document.title = "SAGE2: " + data.title;
			standAloneApp.createAppWindow(data);
		}
	});

	wsio.on('deleteElement', function(elem_data) {
		if (standAloneApp.id === elem_data.id) {
			window.close();
		}
	});

	wsio.on('animateCanvas', function(data) {
		if (standAloneApp.application && data.id === standAloneApp.application.id) {
			var date = new Date(data.date);
			standAloneApp.application.refresh(date);
			wsio.emit('finishedRenderingAppFrame', {id: data.id, fps: standAloneApp.application.maxFPS});
		}
	});

	wsio.on('eventInItem', function(event_data) {
		if (standAloneApp.application && event_data.id === standAloneApp.application.id) {
			var date = new Date(event_data.date);
			standAloneApp.application.SAGE2Event(event_data.type, event_data.position, event_data.user, event_data.data, date);
		}
	});

	wsio.on('setTitle', function(data) {
		if (data.id !== null && data.id !== undefined) {
			var titleDiv = document.getElementById(data.id + "_title");
			var pElement = titleDiv.getElementsByTagName("p");
			pElement[0].textContent = data.title;
		}
	});
}

