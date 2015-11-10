// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization
// and Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-2015

/**
 * @module server
 */


// node mode
/* jshint node: true */

// how to deal with spaces and tabs
/* jshint smarttabs: false */

// Don't make functions within a loop
/* jshint -W083 */

/*global mediaFolders */

// require variables to be declared
'use strict';

// node: built-in
var fs            = require('fs');               // filesystem access
var http          = require('http');             // http server
var https         = require('https');            // https server
var os            = require('os');               // operating system access
var path          = require('path');             // file path management
var readline      = require('readline');         // to build an evaluation loop
var url           = require('url');              // parses urls
// var util          = require('util');          // node util

// npm: defined in package.json
var formidable    = require('formidable');       // upload processor
var gm            = require('gm');               // graphicsmagick
var imageMagick;                                 // derived from graphicsmagick
var json5         = require('json5');            // Relaxed JSON format
var qrimage       = require('qr-image');         // qr-code generation
var sprint        = require('sprint');           // pretty formating (sprintf)

var WebsocketIO   = require('websocketio');      // creates WebSocket server and clients

// custom node modules
var assets              = require('./src/node-assets');           // manages the list of files
var commandline         = require('./src/node-sage2commandline'); // handles command line parameters for SAGE2
var exiftool            = require('./src/node-exiftool');         // gets exif tags for images
var pixelblock          = require('./src/node-pixelblock');       // chops pixels buffers into square chunks
var sageutils           = require('./src/node-utils');            // provides the current version number
var md5                 = require('./src/md5');                   // return standard md5 hash of given param

var HttpServer          = require('./src/node-httpserver');       // creates web server
var InteractableManager = require('./src/node-interactable');     // handles geometry and determining which object a point is over
var Interaction         = require('./src/node-interaction');      // handles sage interaction (move, resize, etc.)
var Loader              = require('./src/node-itemloader');       // handles sage item creation
var Omicron             = require('./src/node-omicron');          // handles Omicron input events
var Radialmenu          = require('./src/node-radialmenu');       // radial menu
var Sage2ItemList       = require('./src/node-sage2itemlist');    // list of SAGE2 items
var Sagepointer         = require('./src/node-sagepointer');      // handles sage pointers (creation, location, etc.)
var StickyItems         = require('./src/node-stickyitems');
var registry            = require('./src/node-registry');        // Registry Manager


// Globals

// Session hash for security
global.__SESSION_ID    = null;

var sage2Server        = null;
var sage2ServerS       = null;
var wsioServer         = null;
var wsioServerS        = null;
var SAGE2_version      = sageutils.getShortVersion();
var platform           = os.platform() === "win32" ? "Windows" : os.platform() === "darwin" ? "Mac OS X" : "Linux";
var program            = commandline.initializeCommandLineParameters(SAGE2_version, emitLog);
var config             = loadConfiguration();
var imageMagickOptions = {imageMagick: true};
var ffmpegOptions      = {};
var hostOrigin         = "";
var SAGE2Items         = {};
var sharedApps         = {};
var users              = null;
var appLoader          = null;
var interactMgr        = new InteractableManager();
var mediaBlockSize     = 128;
var startTime          = Date.now();
var pressingAlt        = true;

// Global variable for all media folders
global.mediaFolders = {};
// System folder, defined within SAGE2 installation
mediaFolders.system =	{
	name: "system",
	path: "public/uploads/",
	url:  "/uploads",
	upload: false
};
// Home directory, defined as ~/Documents/SAGE2_Media or equivalent
mediaFolders.user =	{
	name: "user",
	path: path.join(sageutils.getHomeDirectory(), "Documents", "SAGE2_Media", "/"),
	url:  "/user",
	upload: true
};
// Add extra folders defined in the configuration file
if (config.folders) {
	config.folders.forEach(function(f) {
		// Add a new folder into the collection
		mediaFolders[f.name] = {};
		mediaFolders[f.name].name   = f.name;
		mediaFolders[f.name].path   = f.path;
		mediaFolders[f.name].url    = f.url;
		mediaFolders[f.name].upload = sageutils.isTrue(f.upload);
	});
}

var mainFolder       = mediaFolders.system;
var publicDirectory  = "public";
var uploadsDirectory = path.join(publicDirectory, "uploads");
var sessionDirectory = path.join(publicDirectory, "sessions");

// Validate all the media folders
for (var folder in mediaFolders) {
	var f = mediaFolders[folder];
	console.log(sageutils.header('Folders') + f.name + " " + f.path + " " + f.url);
	if (!sageutils.folderExists(f.path)) {
		sageutils.mkdirParent(f.path);
	}
	if (mediaFolders[f.name].upload) {
		mediaFolders.system.upload = false;
		// Update the main upload folder
		uploadsDirectory = f.path;
		mainFolder = f;
		sessionDirectory = path.join(uploadsDirectory, "sessions");
		if (!sageutils.folderExists(sessionDirectory)) {
			sageutils.mkdirParent(sessionDirectory);
		}
		console.log(sageutils.header('Folders') + 'upload to ' + f.path);
	}
	var newdirs = ["apps", "assets", "images", "pdfs", "tmp", "videos"];
	newdirs.forEach(function(d) {
		var newsubdir = path.join(mediaFolders[f.name].path, d);
		if (!sageutils.folderExists(newsubdir)) {
			sageutils.mkdirParent(newsubdir);
		}
	});
}

// Add back all the media folders to the configuration structure
config.folders = mediaFolders;

console.log(sageutils.header("SAGE2") + "Node Version: " + sageutils.getNodeVersion());
console.log(sageutils.header("SAGE2") + "Detected Server OS as:\t" + platform);
console.log(sageutils.header("SAGE2") + "SAGE2 Short Version:\t" + SAGE2_version);

// Initialize Server
initializeSage2Server();


function initializeSage2Server() {
	// Remove API keys from being investigated further
	// if (config.apis) delete config.apis;

	// Register with evl's server
	if (config.register_site) {
		sageutils.registerSAGE2(config);
	}

	// Check for missing packages
	//     pass parameter `true` for devel packages also
	if (process.arch !== 'arm') {
		// seems very slow to do on ARM processor (Raspberry PI)
		sageutils.checkPackages();
	}

	// Setup binaries path
	if (config.dependencies !== undefined) {
		if (config.dependencies.ImageMagick !== undefined) {
			imageMagickOptions.appPath = config.dependencies.ImageMagick;
		}
		if (config.dependencies.FFMpeg !== undefined) {
			ffmpegOptions.appPath = config.dependencies.FFMpeg;
		}
	}
	imageMagick = gm.subClass(imageMagickOptions);
	assets.initializeConfiguration(config);
	assets.setupBinaries(imageMagickOptions, ffmpegOptions);

	// Set default host origin for this server
	if (config.rproxy_port === undefined) {
		hostOrigin = "http://" + config.host + (config.index_port === 80 ? "" : ":" + config.index_port) + "/";
	}

	// Initialize sage2 item lists
	SAGE2Items.applications = new Sage2ItemList();
	SAGE2Items.portals      = new Sage2ItemList();
	SAGE2Items.pointers     = new Sage2ItemList();
	SAGE2Items.radialMenus  = new Sage2ItemList();
	SAGE2Items.widgets      = new Sage2ItemList();
	SAGE2Items.renderSync   = {};

	SAGE2Items.portals.interactMgr = {};

	// Initialize user interaction tracking
	if (program.trackUsers) {
		if (typeof program.trackUsers === "string" && sageutils.fileExists(program.trackUsers)) {
			users = json5.parse(fs.readFileSync(program.trackUsers));
		} else {
			users = {};
		}
		users.session = {};
		users.session.start = Date.now();

		setInterval(saveUserLog, 300000); // every 5 minutes
		if (!sageutils.folderExists("logs")) {
			fs.mkdirSync("logs");
		}
	}

	// Get full version of SAGE2 - git branch, commit, date
	sageutils.getFullVersion(function(version) {
		// fields: base commit branch date
		SAGE2_version = version;
		console.log(sageutils.header("SAGE2") + "Full Version:" + json5.stringify(SAGE2_version));
		broadcast('setupSAGE2Version', SAGE2_version);

		if (users !== null) {
			users.session.verison = SAGE2_version;
		}
	});

	// Generate a qr image that points to sage2 server
	var qr_png = qrimage.image(hostOrigin, { ec_level: 'M', size: 15, margin: 3, type: 'png' });
	var qr_out = path.join(uploadsDirectory, "images", "QR.png");
	qr_png.on('end', function() {
		console.log(sageutils.header("QR") + "image generated", qr_out);
	});
	qr_png.pipe(fs.createWriteStream(qr_out));

	// Setup tmp directory for SAGE2 server
	process.env.TMPDIR = path.join(__dirname, "tmp");
	console.log(sageutils.header("SAGE2") + "Temp folder: " + process.env.TMPDIR);
	if (!sageutils.folderExists(process.env.TMPDIR)) {
		fs.mkdirSync(process.env.TMPDIR);
	}

	// Setup tmp directory in uploads
	var uploadTemp = path.join(__dirname, "public", "uploads", "tmp");
	console.log(sageutils.header("SAGE2") + "Upload temp folder: " + uploadTemp);
	if (!sageutils.folderExists(uploadTemp)) {
		fs.mkdirSync(uploadTemp);
	}

	// Make sure sessions directory exists
	if (!sageutils.folderExists(sessionDirectory)) {
		fs.mkdirSync(sessionDirectory);
	}

	// Add a flag into the configuration to denote password status (used on display side)
	//   not protected by default
	config.passordProtected = false;
	// Check for the session password file
	var passwordFile = path.join("keys", "passwd.json");
	if (typeof program.password  === "string" && program.password.length > 0) {
		// Creating a new hash from the password
		global.__SESSION_ID = md5.getHash(program.password);
		console.log(sageutils.header("Secure") + "Using " + global.__SESSION_ID + " as the key for this session");
		// Saving the hash
		fs.writeFileSync(passwordFile, JSON.stringify({pwd: global.__SESSION_ID}));
		console.log(sageutils.header("Secure") + "Saved to file name " + passwordFile);
		// the session is protected
		config.passordProtected = true;
	} else if (sageutils.fileExists(passwordFile)) {
		// If a password file exists, load it
		var passwordFileJsonString = fs.readFileSync(passwordFile, 'utf8');
		var passwordFileJson       = JSON.parse(passwordFileJsonString);
		if (passwordFileJson.pwd !== null) {
			global.__SESSION_ID = passwordFileJson.pwd;
			console.log(sageutils.header("Secure") + "A sessionID was found: " + passwordFileJson.pwd);
			// the session is protected
			config.passordProtected = true;
		} else {
			console.log(sageutils.header("Secure") + "Invalid hash file " + passwordFile);
		}
	}

	// Monitoring some folders
	var listOfFolders = [];
	for (var lf in mediaFolders) {
		listOfFolders.push(mediaFolders[lf].path);
	}
	// try to exclude some folders from the monitoring
	var excludes = [ '.DS_Store', 'Thumbs.db', 'assets', 'apps', 'tmp' ];
	sageutils.monitorFolders(listOfFolders, excludes,
		function(change) {
			// console.log(sageutils.header("Monitor") + "Changes detected in", this.root);
			if (change.addedFiles.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Added files:    %j",   change.addedFiles);
				// broadcast the new file list
				// assets.refresh(this.root, function(count) {
				// 	broadcast('storedFileList', getSavedFilesList());
				// });
			}
			if (change.modifiedFiles.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Modified files: %j",   change.modifiedFiles);
			}
			if (change.removedFiles.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Removed files:  %j",   change.removedFiles);
			}
			if (change.addedFolders.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Added folders:    %j", change.addedFolders);
			}
			if (change.modifiedFolders.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Modified folders: %j", change.modifiedFolders);
			}
			if (change.removedFolders.length > 0) {
				// console.log(sageutils.header("Monitor") + "	Removed folders:  %j", change.removedFolders);
			}
		}
	);

	// Initialize assets folders
	assets.initialize(mainFolder, mediaFolders);

	// Initialize app loader
	appLoader = new Loader(mainFolder.path, hostOrigin, config, imageMagickOptions, ffmpegOptions);

	// Initialize interactable manager and layers
	interactMgr.addLayer("staticUI",     3);
	interactMgr.addLayer("radialMenus",  2);
	interactMgr.addLayer("widgets",      1);
	interactMgr.addLayer("applications", 0);
	interactMgr.addLayer("portals",      0);

	// Initialize the background for the display clients (image or color)
	setupDisplayBackground();

	// initialize dialog boxes
	setUpDialogsAsInteractableObjects();

	// Set up http and https servers
	var httpServerApp = new HttpServer(publicDirectory);
	httpServerApp.httpPOST('/upload', uploadForm); // receive newly uploaded files from SAGE Pointer / SAGE UI
	httpServerApp.httpGET('/config',  sendConfig); // send config object to client using http request
	var options  = setupHttpsOptions();            // create HTTPS options - sets up security keys
	sage2Server  = http.createServer(httpServerApp.onrequest);
	sage2ServerS = https.createServer(options, httpServerApp.onrequest);

	// Set up websocket servers - 2 way communication between server and all browser clients
	wsioServer  = new WebsocketIO.Server({server: sage2Server});
	wsioServerS = new WebsocketIO.Server({server: sage2ServerS});
	wsioServer.onconnection(openWebSocketClient);
	wsioServerS.onconnection(openWebSocketClient);
}

function setUpDialogsAsInteractableObjects() {
	var dialogGeometry = {
		x: config.totalWidth / 2 - 13 * config.ui.titleBarHeight,
		y: 2 * config.ui.titleBarHeight,
		w: 26 * config.ui.titleBarHeight,
		h: 8 * config.ui.titleBarHeight
	};

	var acceptGeometry = {
		x: dialogGeometry.x + 0.25 * config.ui.titleBarHeight,
		y: dialogGeometry.y + 4.75 * config.ui.titleBarHeight,
		w: 9 * config.ui.titleBarHeight,
		h: 3 * config.ui.titleBarHeight
	};

	var rejectCancelGeometry = {
		x: dialogGeometry.x + 16.75 * config.ui.titleBarHeight,
		y: dialogGeometry.y + 4.75 * config.ui.titleBarHeight,
		w: 9 * config.ui.titleBarHeight,
		h: 3 * config.ui.titleBarHeight
	};

	interactMgr.addGeometry("dataSharingWaitDialog",    "staticUI", "rectangle", dialogGeometry, false, 1, null);
	interactMgr.addGeometry("dataSharingRequestDialog", "staticUI", "rectangle", dialogGeometry, false, 1, null);
	interactMgr.addGeometry("acceptDataSharingRequest", "staticUI", "rectangle", acceptGeometry, false, 2, null);
	interactMgr.addGeometry("cancelDataSharingRequest", "staticUI", "rectangle", rejectCancelGeometry, false, 2, null);
	interactMgr.addGeometry("rejectDataSharingRequest", "staticUI", "rectangle", rejectCancelGeometry, false, 2, null);
}

function broadcast(name, data) {
	wsioServer.broadcast(name, data);
	wsioServerS.broadcast(name, data);
}

// Export the function to sub modules
exports.broadcast = broadcast;
exports.dirname   = path.join(__dirname, "node_modules");

function emitLog(data) {
	if (wsioServer === null || wsioServerS === null) {
		return;
	}
	broadcast('console', data);
}


// global variables to manage clients
var clients           = [];
var masterDisplay     = null;
var webBrowserClient  = null;
var sagePointers      = {};
var remoteInteraction = {};
var mediaBlockStreams = {};
var appUserColors     = {}; // a dict to keep track of app instance colors(for widget connectors)

// var remoteSharingRequestDialog = null;
var remoteSharingWaitDialog    = null;
var remoteSharingSessions      = {};

// Sticky items and window position for new clones
var stickyAppHandler     = new StickyItems();


function openWebSocketClient(wsio) {
	wsio.onclose(closeWebSocketClient);
	wsio.on('addClient', wsAddClient);
}

function closeWebSocketClient(wsio) {
	var i;
	var key;
	if (wsio.clientType === "display") {
		console.log(sageutils.header("Disconnect") + wsio.id + " (" + wsio.clientType + " " + wsio.clientID + ")");
	} else {
		console.log(sageutils.header("Disconnect") + wsio.id + " (" + wsio.clientType + ")");
	}

	addEventToUserLog(wsio.id, {type: "disconnect", data: null, time: Date.now()});

	// if client is a remote site, send disconnect message
	var remote = findRemoteSiteByConnection(wsio);
	if (remote !== null) {
		console.log("Remote site \"" + remote.name + "\" now offline");
		remote.connected = false;
		var site = {name: remote.name, connected: remote.connected};
		broadcast('connectedToRemoteSite', site);
	}

	if (wsio.clientType === "sageUI") {
		hidePointer(wsio.id);
		removeControlsForUser(wsio.id);
		delete sagePointers[wsio.id];
		delete remoteInteraction[wsio.id];
		for (key in remoteSharingSessions) {
			remoteSharingSessions[key].wsio.emit('stopRemoteSagePointer', {id: wsio.id});
		}
	} else if (wsio.clientType === "display") {
		for (key in SAGE2Items.renderSync) {
			if (SAGE2Items.renderSync.hasOwnProperty(key)) {
				// If the application had an animation timer, clear it
				if (SAGE2Items.renderSync[key].clients[wsio.id] &&
					SAGE2Items.renderSync[key].clients[wsio.id].animateTimer) {
					clearTimeout(SAGE2Items.renderSync[key].clients[wsio.id].animateTimer);
				}
				// Remove the object from the list
				delete SAGE2Items.renderSync[key].clients[wsio.id];
			}
		}
	} else if (wsio.clientType === "webBrowser") {
		webBrowserClient = null;
	} else {
		// if it's an application, assume it's a stream and try
		deleteApplication(wsio.id + '|0');
	}

	if (wsio === masterDisplay) {
		masterDisplay = null;
		for (i = 0; i < clients.length; i++) {
			if (clients[i].clientType === "display" && clients[i] !== wsio) {
				masterDisplay = clients[i];
				clients[i].emit('setAsMasterDisplay');
				break;
			}
		}
	}

	removeElement(clients, wsio);
}

function wsAddClient(wsio, data) {

	// Just making sure the data is valid JSON (one gets strings from C++)
	if (sageutils.isTrue(data.requests.config)) {
		data.requests.config = true;
	} else {
		data.requests.config = false;
	}
	if (sageutils.isTrue(data.requests.version)) {
		data.requests.version = true;
	} else {
		data.requests.version = false;
	}
	if (sageutils.isTrue(data.requests.time)) {
		data.requests.time = true;
	} else {
		data.requests.time = false;
	}
	if (sageutils.isTrue(data.requests.console)) {
		data.requests.console = true;
	} else {
		data.requests.console = false;
	}

	console.log("client:", data.host, data.port);
	wsio.updateRemoteAddress(data.host, data.port); // overwrite host and port if defined
	wsio.clientType = data.clientType;

	if (wsio.clientType === "display") {
		wsio.clientID = data.clientID;
		if (masterDisplay === null) {
			masterDisplay = wsio;
		}
		console.log(sageutils.header("Connect") + wsio.id + " (" + wsio.clientType + " " + wsio.clientID + ")");
	} else {
		wsio.clientID = -1;
		console.log(sageutils.header("Connect") + wsio.id + " (" + wsio.clientType + ")");
	}

	clients.push(wsio);
	initializeWSClient(wsio, data.requests.config, data.requests.version, data.requests.time, data.requests.console);

	// Check if there's a new pointer for a mobile client
	if (data.browser && data.browser.isMobile && remoteInteraction[wsio.id]) {
		// for mobile clients, default to window interaction mode
		remoteInteraction[wsio.id].previousMode = 0;
	}
}

function initializeWSClient(wsio, reqConfig, reqVersion, reqTime, reqConsole) {
	setupListeners(wsio);

	wsio.emit('initialize', {UID: wsio.id, time: Date.now(), start: startTime});
	if (wsio === masterDisplay) {
		wsio.emit('setAsMasterDisplay');
	}

	if (reqConfig) {
		wsio.emit('setupDisplayConfiguration', config);
	}
	if (reqVersion) {
		wsio.emit('setupSAGE2Version', SAGE2_version);
	}
	if (reqTime) {
		wsio.emit('setSystemTime', {date: Date.now()});
	}
	if (reqConsole) {
		wsio.emit('console', json5.stringify(config, null, 4));
	}

	if (wsio.clientType === "display") {
		initializeExistingSagePointers(wsio);
		initializeExistingApps(wsio);
		initializeRemoteServerInfo(wsio);
		setTimeout(initializeExistingControls, 6000, wsio); // why can't this be done immediately with the rest?
	} else if (wsio.clientType === "sageUI") {
		createSagePointer(wsio.id);
		var key;
		for (key in remoteSharingSessions) {
			remoteSharingSessions[key].wsio.emit('createRemoteSagePointer', {id: wsio.id, portal: {host: config.host, port: config.port}});
		}
		initializeExistingAppsPositionSizeTypeOnly(wsio);
	}

	var remote = findRemoteSiteByConnection(wsio);
	if (remote !== null) {
		remote.wsio = wsio;
		remote.connected = true;
		var site = {name: remote.name, connected: remote.connected};
		broadcast('connectedToRemoteSite', site);
	}

	if (wsio.clientType === "webBrowser") {
		webBrowserClient = wsio;
	}
}

function setupListeners(wsio) {
	wsio.on('registerInteractionClient',            wsRegisterInteractionClient);

	wsio.on('startSagePointer',                     wsStartSagePointer);
	wsio.on('stopSagePointer',                      wsStopSagePointer);

	wsio.on('pointerPress',                         wsPointerPress);
	wsio.on('pointerRelease',                       wsPointerRelease);
	wsio.on('pointerDblClick',                      wsPointerDblClick);
	wsio.on('pointerPosition',                      wsPointerPosition);
	wsio.on('pointerMove',                          wsPointerMove);
	wsio.on('pointerScrollStart',                   wsPointerScrollStart);
	wsio.on('pointerScroll',                        wsPointerScroll);
	wsio.on('pointerScrollEnd',                     wsPointerScrollEnd);
	wsio.on('pointerDraw',                          wsPointerDraw);
	wsio.on('keyDown',                              wsKeyDown);
	wsio.on('keyUp',                                wsKeyUp);
	wsio.on('keyPress',                             wsKeyPress);

	wsio.on('uploadedFile',                         wsUploadedFile);

	wsio.on('startNewMediaStream',                  wsStartNewMediaStream);
	wsio.on('updateMediaStreamFrame',               wsUpdateMediaStreamFrame);
	wsio.on('updateMediaStreamChunk',               wsUpdateMediaStreamChunk);
	wsio.on('stopMediaStream',                      wsStopMediaStream);
	wsio.on('startNewMediaBlockStream',             wsStartNewMediaBlockStream);
	wsio.on('updateMediaBlockStreamFrame',          wsUpdateMediaBlockStreamFrame);
	wsio.on('stopMediaBlockStream',                 wsStopMediaBlockStream);

	wsio.on('requestVideoFrame',                    wsRequestVideoFrame);
	wsio.on('receivedMediaStreamFrame',             wsReceivedMediaStreamFrame);
	wsio.on('receivedRemoteMediaStreamFrame',       wsReceivedRemoteMediaStreamFrame);
	wsio.on('receivedMediaBlockStreamFrame',        wsReceivedMediaBlockStreamFrame);
	wsio.on('receivedRemoteMediaBlockStreamFrame',  wsReceivedRemoteMediaBlockStreamFrame);

	wsio.on('finishedRenderingAppFrame',            wsFinishedRenderingAppFrame);
	wsio.on('updateAppState',                       wsUpdateAppState);
	wsio.on('updateStateOptions',                   wsUpdateStateOptions);
	wsio.on('appResize',                            wsAppResize);
	wsio.on('appFullscreen',                        wsFullscreen);
	wsio.on('broadcast',                            wsBroadcast);
	wsio.on('applicationRPC',                       wsApplicationRPC);

	wsio.on('requestAvailableApplications',         wsRequestAvailableApplications);
	wsio.on('requestStoredFiles',                   wsRequestStoredFiles);
	wsio.on('loadApplication',                      wsLoadApplication);
	wsio.on('loadFileFromServer',                   wsLoadFileFromServer);
	wsio.on('deleteElementFromStoredFiles',         wsDeleteElementFromStoredFiles);
	wsio.on('moveElementFromStoredFiles',           wsMoveElementFromStoredFiles);
	wsio.on('saveSesion',                           wsSaveSesion);
	wsio.on('clearDisplay',                         wsClearDisplay);
	wsio.on('tileApplications',                     wsTileApplications);

	// Radial menu should have its own message section? Just appended here for now.
	wsio.on('radialMenuClick',                      wsRadialMenuClick);
	wsio.on('radialMenuMoved',                      wsRadialMenuMoved);
	wsio.on('removeRadialMenu',                     wsRemoveRadialMenu);
	wsio.on('radialMenuWindowToggle',               wsRadialMenuThumbnailWindow);

	wsio.on('addNewWebElement',                     wsAddNewWebElement);

	wsio.on('openNewWebpage',                       wsOpenNewWebpage);

	wsio.on('playVideo',                            wsPlayVideo);
	wsio.on('pauseVideo',                           wsPauseVideo);
	wsio.on('stopVideo',                            wsStopVideo);
	wsio.on('updateVideoTime',                      wsUpdateVideoTime);
	wsio.on('muteVideo',                            wsMuteVideo);
	wsio.on('unmuteVideo',                          wsUnmuteVideo);
	wsio.on('loopVideo',                            wsLoopVideo);

	wsio.on('addNewElementFromRemoteServer',          wsAddNewElementFromRemoteServer);
	wsio.on('addNewSharedElementFromRemoteServer',    wsAddNewSharedElementFromRemoteServer);
	wsio.on('requestNextRemoteFrame',                 wsRequestNextRemoteFrame);
	wsio.on('updateRemoteMediaStreamFrame',           wsUpdateRemoteMediaStreamFrame);
	wsio.on('stopMediaStream',                        wsStopMediaStream);
	wsio.on('updateRemoteMediaBlockStreamFrame',      wsUpdateRemoteMediaBlockStreamFrame);
	wsio.on('stopMediaBlockStream',                   wsStopMediaBlockStream);
	wsio.on('requestDataSharingSession',              wsRequestDataSharingSession);
	wsio.on('cancelDataSharingSession',               wsCancelDataSharingSession);
	wsio.on('acceptDataSharingSession',               wsAcceptDataSharingSession);
	wsio.on('rejectDataSharingSession',               wsRejectDataSharingSession);
	wsio.on('createRemoteSagePointer',                wsCreateRemoteSagePointer);
	wsio.on('startRemoteSagePointer',                 wsStartRemoteSagePointer);
	wsio.on('stopRemoteSagePointer',                  wsStopRemoteSagePointer);
	wsio.on('remoteSagePointerPosition',              wsRemoteSagePointerPosition);
	wsio.on('remoteSagePointerToggleModes',           wsRemoteSagePointerToggleModes);
	wsio.on('remoteSagePointerHoverCorner',           wsRemoteSagePointerHoverCorner);
	wsio.on('addNewRemoteElementInDataSharingPortal', wsAddNewRemoteElementInDataSharingPortal);

	wsio.on('updateApplicationOrder',                 wsUpdateApplicationOrder);
	wsio.on('startApplicationMove',                   wsStartApplicationMove);
	wsio.on('startApplicationResize',                 wsStartApplicationResize);
	wsio.on('updateApplicationPosition',              wsUpdateApplicationPosition);
	wsio.on('updateApplicationPositionAndSize',       wsUpdateApplicationPositionAndSize);
	wsio.on('finishApplicationMove',                  wsFinishApplicationMove);
	wsio.on('finishApplicationResize',                wsFinishApplicationResize);
	wsio.on('deleteApplication',                      wsDeleteApplication);
	wsio.on('updateApplicationState',                 wsUpdateApplicationState);
	wsio.on('updateApplicationStateOptions',          wsUpdateApplicationStateOptions);

	wsio.on('addNewControl',                        wsAddNewControl);
	wsio.on('closeAppFromControl',                  wsCloseAppFromControl);
	wsio.on('hideWidgetFromControl',                wsHideWidgetFromControl);
	wsio.on('openRadialMenuFromControl',            wsOpenRadialMenuFromControl);
	wsio.on('recordInnerGeometryForWidget',			wsRecordInnerGeometryForWidget);

	wsio.on('createAppClone',                       wsCreateAppClone);

	wsio.on('sage2Log',                             wsPrintDebugInfo);
	wsio.on('command',                              wsCommand);

	wsio.on('createFolder',                         wsCreateFolder);
}

function initializeExistingControls(wsio) {
	var i;
	var uniqueID;
	var app;
	var zIndex;
	var data;
	var controlList = SAGE2Items.widgets.list;
	for (i in controlList) {
		if (controlList.hasOwnProperty(i) && SAGE2Items.applications.list.hasOwnProperty(controlList[i].appId)) {
			data = controlList[i];
			wsio.emit('createControl', data);
			zIndex = SAGE2Items.widgets.numItems;
			var radialGeometry = {
				x: data.left + (data.height / 2),
				y: data.top + (data.height / 2),
				r: data.height / 2
			};
			if (data.hasSideBar === true) {
				var shapeData = {
					radial: {
						type: "circle",
						visible: true,
						geometry: radialGeometry
					},
					sidebar: {
						type: "rectangle",
						visible: true,
						geometry: {
							x: data.left + data.height,
							y: data.top + (data.height / 2) - (data.barHeight / 2),
							w: data.width - data.height, h: data.barHeight
						}
					}
				};
				interactMgr.addComplexGeometry(data.id, "widgets", shapeData, zIndex, data);
			} else {
				interactMgr.addGeometry(data.id, "widgets", "circle", radialGeometry, true, zIndex, data);
			}
			SAGE2Items.widgets.addItem(data);
			uniqueID = data.id.substring(data.appId.length, data.id.lastIndexOf("_"));
			app = SAGE2Items.applications.list[data.appId];
			addEventToUserLog(uniqueID, {type: "widgetMenu",
					data: {action: "open", application: {id: app.id, type: app.application}},
					time: Date.now()});
		}
	}
}

function initializeExistingSagePointers(wsio) {
	for (var key in sagePointers) {
		if (sagePointers.hasOwnProperty(key)) {
			wsio.emit('createSagePointer', sagePointers[key]);
			wsio.emit('changeSagePointerMode', {id: sagePointers[key].id, mode: remoteInteraction[key].interactionMode});
		}
	}
}

function initializeExistingApps(wsio) {
	var key;

	for (key in SAGE2Items.applications.list) {
		wsio.emit('createAppWindow', SAGE2Items.applications.list[key]);
		if (SAGE2Items.renderSync.hasOwnProperty(key)) {
			SAGE2Items.renderSync[key].clients[wsio.id] = {wsio: wsio, readyForNextFrame: false, blocklist: []};
			calculateValidBlocks(SAGE2Items.applications.list[key], mediaBlockSize, SAGE2Items.renderSync[key]);
		}
	}
	for (key in SAGE2Items.portals.list) {
		broadcast('initializeDataSharingSession', SAGE2Items.portals.list[key]);
	}

	var newOrder = interactMgr.getObjectZIndexList("applications", ["portals"]);
	wsio.emit('updateItemOrder', newOrder);
}

function initializeExistingAppsPositionSizeTypeOnly(wsio) {
	var key;
	for (key in SAGE2Items.applications.list) {
		wsio.emit('createAppWindowPositionSizeOnly', getAppPositionSize(SAGE2Items.applications.list[key]));
	}

	var newOrder = interactMgr.getObjectZIndexList("applications", ["portals"]);
	wsio.emit('updateItemOrder', newOrder);
}

function initializeRemoteServerInfo(wsio) {
	for (var i = 0; i < remoteSites.length; i++) {
		var site = {name: remoteSites[i].name, connected: remoteSites[i].connected, geometry: remoteSites[i].geometry};
		wsio.emit('addRemoteSite', site);
	}
}

// **************  Sage Pointer Functions *****************

function wsRegisterInteractionClient(wsio, data) {
	var key;
	if (program.trackUsers === true) {
		var newUser = true;
		for (key in users) {
			if (users[key].name === data.name && users[key].color.toLowerCase() === data.color.toLowerCase()) {
				users[key].ip = wsio.id;
				if (users[key].actions === undefined) {
					users[key].actions = [];
				}
				users[key].actions.push({type: "connect", data: null, time: Date.now()});
				newUser = false;
			}
		}
		if (newUser === true) {
			var id = getNewUserId();
			users[id] = {};
			users[id].name = data.name;
			users[id].color = data.color;
			users[id].ip = wsio.id;
			if (users[id].actions === undefined) {
				users[id].actions = [];
			}
			users[id].actions.push({type: "connect", data: null, time: Date.now()});
		}
	} else {
		for (key in users) {
			if (users[key].name === data.name && users[key].color.toLowerCase() === data.color.toLowerCase()) {
				users[key].ip = wsio.id;
				if (users[key].actions === undefined) {
					users[key].actions = [];
				}
				users[key].actions.push({type: "connect", data: null, time: Date.now()});
			}
		}
	}
}

function wsStartSagePointer(wsio, data) {
	// Switch interaction from window mode (on web) to app mode (wall)
	remoteInteraction[wsio.id].interactionMode = remoteInteraction[wsio.id].getPreviousMode();
	broadcast('changeSagePointerMode', {id: sagePointers[wsio.id].id, mode: remoteInteraction[wsio.id].getPreviousMode()});

	showPointer(wsio.id, data);

	addEventToUserLog(wsio.id, {type: "SAGE2PointerStart", data: null, time: Date.now()});
}

function wsStopSagePointer(wsio, data) {
	hidePointer(wsio.id);

	// return to window interaction mode after stopping pointer
	remoteInteraction[wsio.id].saveMode();
	if (remoteInteraction[wsio.id].appInteractionMode()) {
		remoteInteraction[wsio.id].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[wsio.id].id, mode: remoteInteraction[wsio.id].interactionMode});
	}

	var key;
	for (key in remoteSharingSessions) {
		remoteSharingSessions[key].wsio.emit('stopRemoteSagePointer', {id: wsio.id});
	}

	addEventToUserLog(wsio.id, {type: "SAGE2PointerEnd", data: null, time: Date.now()});
}

function wsPointerPress(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	pointerPress(wsio.id, pointerX, pointerY, data);
}

function wsPointerRelease(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	/*
	if (data.button === 'left')
		pointerRelease(wsio.id, pointerX, pointerY);
	else
		pointerReleaseRight(wsio.id, pointerX, pointerY);
	*/
	pointerRelease(wsio.id, pointerX, pointerY, data);
}

function wsPointerDblClick(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	pointerDblClick(wsio.id, pointerX, pointerY);
}

function wsPointerPosition(wsio, data) {
	pointerPosition(wsio.id, data);
}

function wsPointerMove(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	pointerMove(wsio.id, pointerX, pointerY, data);
}

function wsPointerScrollStart(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	pointerScrollStart(wsio.id, pointerX, pointerY);
}

function wsPointerScroll(wsio, data) {
	// Casting the parameters to correct type
	data.wheelDelta = parseInt(data.wheelDelta, 10);

	pointerScroll(wsio.id, data);
}

function wsPointerScrollEnd(wsio, data) {
	pointerScrollEnd(wsio.id);
}

function wsPointerDraw(wsio, data) {
	pointerDraw(wsio.id, data);
}

function wsKeyDown(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	keyDown(wsio.id, pointerX, pointerY, data);
}

function wsKeyUp(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	keyUp(wsio.id, pointerX, pointerY, data);
}

function wsKeyPress(wsio, data) {
	var pointerX = sagePointers[wsio.id].left;
	var pointerY = sagePointers[wsio.id].top;

	keyPress(wsio.id, pointerX, pointerY, data);
}

// **************  File Upload Functions *****************
function wsUploadedFile(wsio, data) {
	addEventToUserLog(wsio.id, {type: "fileUpload", data: data, time: Date.now()});
}

function wsRadialMenuClick(wsio, data) {
	if (data.button === "closeButton") {
		addEventToUserLog(data.user, {type: "radialMenu", data: {action: "close"}, time: Date.now()});
	} else if (data.button === "settingsButton" || data.button.indexOf("Window") >= 0) {
		var action = data.data.state === "opened" ? "open" : "close";
		addEventToUserLog(data.user, {type: "radialMenuAction", data: {button: data.button, action: action}, time: Date.now()});
	} else {
		addEventToUserLog(data.user, {type: "radialMenuAction", data: {button: data.button}, time: Date.now()});
	}
}

// **************  Media Stream Functions *****************

function wsStartNewMediaStream(wsio, data) {
	console.log("received new stream: ", data.id);

	var i;
	SAGE2Items.renderSync[data.id] = {clients: {}, chunks: []};
	for (i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			SAGE2Items.renderSync[data.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
		}
	}

	// forcing 'int' type for width and height
	data.width  = parseInt(data.width,  10);
	data.height = parseInt(data.height, 10);

	appLoader.createMediaStream(data.src, data.type, data.encoding, data.title, data.color, data.width, data.height,
		function(appInstance) {
			appInstance.id = data.id;
			handleNewApplication(appInstance, null);

			var eLogData = {
				application: {
					id: appInstance.id,
					type: appInstance.application
				}
			};
			addEventToUserLog(wsio.id, {type: "mediaStreamStart", data: eLogData, time: Date.now()});
		});
}

/**
 * Test if two rectangles overlap (axis-aligned)
 *
 * @method doOverlap
 * @param x_1 {Integer} x coordinate first rectangle
 * @param y_1 {Integer} y coordinate first rectangle
 * @param width_1 {Integer} width first rectangle
 * @param height_1 {Integer} height first rectangle
 * @param x_2 {Integer} x coordinate second rectangle
 * @param y_2 {Integer} y coordinate second rectangle
 * @param width_2 {Integer} width second rectangle
 * @param height_2 {Integer} height second rectangle
 * @return {Boolean} true if rectangles overlap
 */
function doOverlap(x_1, y_1, width_1, height_1, x_2, y_2, width_2, height_2) {
	return !(x_1 > x_2 + width_2 || x_1 + width_1 < x_2 || y_1 > y_2 + height_2 || y_1 + height_1 < y_2);
}

function wsUpdateMediaStreamFrame(wsio, data) {
	var key;
	// Reset the 'ready' flag for every display client
	for (key in SAGE2Items.renderSync[data.id].clients) {
		SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
	}
	// Get the application from the message
	var stream = SAGE2Items.applications.list[data.id];
	if (stream !== undefined && stream !== null) {
		stream.data = data.state;
	} else {
		// if can't find the application, it's being destroyed...
		return;
	}

	// Send the image to all display nodes
	// broadcast('updateMediaStreamFrame', data);

	// Create a copy of the frame object with dummy data (white 1x1 gif)
	var data_copy = {};
	data_copy.id             = data.id;
	data_copy.state          = {};
	data_copy.state.src      = "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";
	data_copy.state.type     = "image/gif";
	data_copy.state.encoding = "base64";

	// Iterate over all the clients of this app
	for (key in SAGE2Items.renderSync[data.id].clients) {
		var did = SAGE2Items.renderSync[data.id].clients[key].wsio.clientID;
		// Overview display
		if (did === -1) {
			// send the full frame to be displayed
			SAGE2Items.renderSync[data.id].clients[key].wsio.emit('updateMediaStreamFrame', data);
			continue;
		}
		var display = config.displays[did];
		// app coordinates
		var left    = stream.left;
		var top     = stream.top + config.ui.titleBarHeight;
		// tile coordinates
		var offsetX = config.resolution.width  * display.column;
		var offsetY = config.resolution.height * display.row;

		// If the app window and the display overlap
		if (doOverlap(left, top, stream.width, stream.height,
			offsetX, offsetY, config.resolution.width, config.resolution.height)) {
			// send the full frame to be displayed
			SAGE2Items.renderSync[data.id].clients[key].wsio.emit('updateMediaStreamFrame', data);
		} else {
			// otherwise send a dummy small image
			SAGE2Items.renderSync[data.id].clients[key].wsio.emit('updateMediaStreamFrame', data_copy);
		}
	}
}

function wsUpdateMediaStreamChunk(wsio, data) {
	if (SAGE2Items.renderSync[data.id].chunks.length === 0) {
		SAGE2Items.renderSync[data.id].chunks = initializeArray(data.total, "");
	}
	SAGE2Items.renderSync[data.id].chunks[data.piece] = data.state.src;
	if (allNonBlank(SAGE2Items.renderSync[data.id].chunks)) {
		wsUpdateMediaStreamFrame(wsio, {id: data.id, state: {
			src: SAGE2Items.renderSync[data.id].chunks.join(""),
			type: data.state.type,
			encoding: data.state.encoding}});
		SAGE2Items.renderSync[data.id].chunks = [];
	}
}

function wsStopMediaStream(wsio, data) {
	var stream = SAGE2Items.applications.list[data.id];
	if (stream !== undefined && stream !== null) {
		deleteApplication(stream.id);

		var eLogData = {
			application: {
				id: stream.id,
				type: stream.application
			}
		};
		addEventToUserLog(wsio.id, {type: "delete", data: eLogData, time: Date.now()});
	}

	// stop all clones in shared portals
	var key;
	for (key in SAGE2Items.portals.list) {
		stream = SAGE2Items.applications.list[data.id + "_" + key];
		if (stream !== undefined && stream !== null) {
			deleteApplication(stream.id);
		}
	}
}

function wsReceivedMediaStreamFrame(wsio, data) {
	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;
	if (allTrueDict(SAGE2Items.renderSync[data.id].clients, "readyForNextFrame")) {
		var i;
		var key;
		for (key in SAGE2Items.renderSync[data.id].clients) {
			SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
		}
		var sender = {wsio: null, serverId: null, clientId: null, streamId: null};
		var mediaStreamData = data.id.split("|");
		if (mediaStreamData.length === 2) { // local stream --> client | stream_id
			sender.clientId = mediaStreamData[0];
			sender.streamId = parseInt(mediaStreamData[1]);
			for (i = 0; i < clients.length; i++) {
				if (clients[i].id === sender.clientId) {
					sender.wsio = clients[i];
					break;
				}
			}
			if (sender.wsio !== null) {
				sender.wsio.emit('requestNextFrame', {streamId: sender.streamId});
			}
		} else if (mediaStreamData.length === 3) { // remote stream --> remote_server | client | stream_id
			sender.serverId = mediaStreamData[0];
			sender.clientId = mediaStreamData[1];
			sender.streamId = mediaStreamData[2];
			for (i = 0; i < clients.length; i++) {
				if (clients[i].id === sender.serverId) {
					sender.wsio = clients[i];
					break;
				}
			}
			if (sender.wsio !== null) {
				sender.wsio.emit('requestNextRemoteFrame', {id: sender.clientId + "|" + sender.streamId});
			}
		}
	}
}

// **************  Media Block Stream Functions *****************
function wsStartNewMediaBlockStream(wsio, data) {
	console.log("Starting media stream: ", data);
	// Forcing 'int' type for width and height
	//     for some reasons, messages from websocket lib from Linux send strings for ints
	data.width  = parseInt(data.width,  10);
	data.height = parseInt(data.height, 10);


	SAGE2Items.renderSync[data.id] = {chunks: [], clients: {}, width: data.width, height: data.height};
	for (var i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			SAGE2Items.renderSync[data.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: true, blocklist: []};
		}
	}

	appLoader.createMediaBlockStream(data.title, data.color, data.colorspace, data.width, data.height, function(appInstance) {
		appInstance.id = data.id;
		handleNewApplication(appInstance, null);
		calculateValidBlocks(appInstance, mediaBlockSize, SAGE2Items.renderSync[appInstance.id]);
	});
}

function wsUpdateMediaBlockStreamFrame(wsio, buffer) {
	var i;
	var key;
	var id = byteBufferToString(buffer);

	if (!SAGE2Items.applications.list.hasOwnProperty(id)) {
		return;
	}

	for (key in SAGE2Items.renderSync[id].clients) {
		SAGE2Items.renderSync[id].clients[key].readyForNextFrame = false;
	}

	var imgBuffer = buffer.slice(id.length + 1);

	var colorspace = SAGE2Items.applications.list[id].data.colorspace;
	var blockBuffers;
	if (colorspace === "RGBA") {
		blockBuffers = pixelblock.rgbaToPixelBlocks(imgBuffer, SAGE2Items.renderSync[id].width,
			SAGE2Items.renderSync[id].height, mediaBlockSize);
	} else if (colorspace === "YUV420p") {
		blockBuffers = pixelblock.yuv420ToPixelBlocks(imgBuffer, SAGE2Items.renderSync[id].width,
			SAGE2Items.renderSync[id].height, mediaBlockSize);
	}

	var pixelbuffer = [];
	var idBuffer = Buffer.concat([new Buffer(id), new Buffer([0])]);
	var dateBuffer = intToByteBuffer(Date.now(), 8);
	var blockIdxBuffer;
	for (i = 0; i < blockBuffers.length; i++) {
		blockIdxBuffer = intToByteBuffer(i, 2);
		pixelbuffer[i] = Buffer.concat([idBuffer, blockIdxBuffer, dateBuffer, blockBuffers[i]]);
	}

	for (key in SAGE2Items.renderSync[id].clients) {
		for (i = 0; i < pixelbuffer.length; i++) {
			if (SAGE2Items.renderSync[id].clients[key].blocklist.indexOf(i) >= 0) {
				SAGE2Items.renderSync[id].clients[key].wsio.emit('updateMediaBlockStreamFrame', pixelbuffer[i]);
			} else {
				// this client has no blocks, so it is ready for next frame!
				SAGE2Items.renderSync[id].clients[key].readyForNextFrame = true;
			}
		}
	}
}

function wsStopMediaBlockStream(wsio, data) {
	deleteApplication(data.id);
}

function wsReceivedMediaBlockStreamFrame(wsio, data) {
	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;

	if (allTrueDict(SAGE2Items.renderSync[data.id].clients, "readyForNextFrame")) {
		var i;
		var key;
		for (key in SAGE2Items.renderSync[data.id].clients) {
			SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
		}
		var sender = {wsio: null, serverId: null, clientId: null, streamId: null};
		var mediaBlockStreamData = data.id.split("|");
		if (mediaBlockStreamData.length === 2) { // local stream --> client | stream_id
			sender.clientId = mediaBlockStreamData[0];
			sender.streamId = parseInt(mediaBlockStreamData[1]);
			for (i = 0; i < clients.length; i++) {
				if (clients[i].id === sender.clientId) {
					sender.wsio = clients[i];
					break;
				}
			}
			if (sender.wsio !== null) {
				sender.wsio.emit('requestNextFrame', {streamId: sender.streamId});
			}
		} else if (mediaBlockStreamData.length === 3) { // remote stream --> remote_server | client | stream_id
			sender.serverId = mediaBlockStreamData[0];
			sender.clientId = mediaBlockStreamData[1];
			sender.streamId = mediaBlockStreamData[2];
			for (i = 0; i < clients.length; i++) {
				if (clients[i].id === sender.serverId) {
					sender.wsio = clients[i];
					break;
				}
			}
			if (sender.wsio !== null) {
				sender.wsio.emit('requestNextRemoteFrame', {id: sender.clientId + "|" + sender.streamId});
			}
		}
	}
}

// Print message from remote applications
function wsPrintDebugInfo(wsio, data) {
	// sprint for padding and pretty colors
	// console.log( sprint("Node %2d> ", data.node) + sprint("[%s] ", data.app), data.message);
	console.log(sageutils.header("Client") + "Node " + data.node + " [" + data.app + "] " + data.message);
}

function wsRequestVideoFrame(wsio, data) {
	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;
	handleNewClientReady(data.id);
}

// **************  Application Animation Functions *****************

function wsFinishedRenderingAppFrame(wsio, data) {
	if (wsio === masterDisplay) {
		SAGE2Items.renderSync[data.id].fps = data.fps;
	}

	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;
	if (allTrueDict(SAGE2Items.renderSync[data.id].clients, "readyForNextFrame")) {
		var key;
		for (key in SAGE2Items.renderSync[data.id].clients) {
			SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
		}
		var now = Date.now();
		var elapsed = now - SAGE2Items.renderSync[data.id].date;
		var fps = SAGE2Items.renderSync[data.id].fps || 30;
		var ticks = 1000 / fps;
		if (elapsed > ticks) {
			SAGE2Items.renderSync[data.id].date = now;
			broadcast('animateCanvas', {id: data.id, date: now});
		} else {
			var aTimer = setTimeout(function() {
				now = Date.now();
				SAGE2Items.renderSync[data.id].date = now;
				broadcast('animateCanvas', {id: data.id, date: now});
			}, ticks - elapsed);
			SAGE2Items.renderSync[data.id].clients[wsio.id].animateTimer = aTimer;
		}
	}
}

function wsUpdateAppState(wsio, data) {
	// Using updates only from master
	if (wsio === masterDisplay && SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var app = SAGE2Items.applications.list[data.id];

		mergeObjects(data.localState, app.data, ['doc_url', 'video_url', 'video_type', 'audio_url', 'audio_type']);

		if (data.updateRemote === true) {
			var ts;
			var portal = findApplicationPortal(app);
			if (portal !== undefined && portal !== null) {
				ts = Date.now() + remoteSharingSessions[portal.id].timeOffset;
				remoteSharingSessions[portal.id].wsio.emit('updateApplicationState', {id: data.id, state: data.remoteState, date: ts});
			} else if (sharedApps[data.id] !== undefined) {
				var i;
				for (i = 0; i < sharedApps[data.id].length; i++) {
					// var ts = Date.now() + remoteSharingSessions[portal.id].timeOffset;
					ts = Date.now();
					sharedApps[data.id][i].wsio.emit('updateApplicationState',
						{id: sharedApps[data.id][i].sharedId, state: data.remoteState, date: ts});
				}
			}
		}
	}
}

function wsUpdateStateOptions(wsio, data) {
	if (wsio === masterDisplay && SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		if (sharedApps[data.id] !== undefined) {
			var i;
			for (i = 0; i < sharedApps[data.id].length; i++) {
				// var ts = Date.now() + remoteSharingSessions[portal.id].timeOffset;
				var ts = Date.now();
				sharedApps[data.id][i].wsio.emit('updateApplicationStateOptions',
					{id: sharedApps[data.id][i].sharedId, options: data.options, date: ts});
			}
		}
	}
}

//
// Got a resize call for an application itself
//
function wsAppResize(wsio, data) {
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var app = SAGE2Items.applications.list[data.id];

		// Values in percent if smaller than 1
		if (data.width > 0 && data.width < 1) {
			data.width = Math.round(data.width * config.totalWidth);
		}
		if (data.height > 0 && data.height < 1) {
			data.height = Math.round(data.height * config.totalHeight);
		}

		// Update the width height and aspect ratio
		if (sageutils.isTrue(data.keepRatio)) {
			// we use the width as leading the calculation
			app.width  = data.width;
			app.height = data.width / app.aspect;
		} else {
			app.width  = data.width;
			app.height = data.height;
			app.aspect = app.width / app.height;
			app.native_width  = data.width;
			app.native_height = data.height;
		}
		// build the object to be sent
		var updateItem = {
			elemId: app.id,
			elemLeft: app.left,
			elemTop: app.top,
			elemWidth: app.width,
			elemHeight: app.height,
			force: true,
			date: Date.now()
		};
		moveAndResizeApplicationWindow(updateItem);
	}
}

//
// Move the application relative to its position
//
function wsAppMoveBy(wsio, data) {
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var app = SAGE2Items.applications.list[data.id];
		// Values in percent if smaller than 1
		if (data.dx > 0 && data.dx < 1) {
			data.dx = Math.round(data.dx * config.totalWidth);
		}
		if (data.dy > 0 && data.dy < 1) {
			data.dy = Math.round(data.dy * config.totalHeight);
		}
		app.left += data.dx;
		app.top  += data.dy;
		// build the object to be sent
		var updateItem = {
			elemId: app.id,
			elemLeft: app.left,
			elemTop: app.top,
			elemWidth: app.width,
			elemHeight: app.height,
			force: true,
			date: Date.now()
		};
		moveAndResizeApplicationWindow(updateItem);
	}
}

//
// Move the application relative to its position
//
function wsAppMoveTo(wsio, data) {
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var app = SAGE2Items.applications.list[data.id];
		// Values in percent if smaller than 1
		if (data.x > 0 && data.x < 1) {
			data.x = Math.round(data.x * config.totalWidth);
		}
		if (data.y > 0 && data.y < 1) {
			data.y = Math.round(data.y * config.totalHeight);
		}
		app.left = data.x;
		app.top  = data.y;
		// build the object to be sent
		var updateItem = {
			elemId: app.id,
			elemLeft: app.left,
			elemTop: app.top,
			elemWidth: app.width,
			elemHeight: app.height,
			force: true,
			date: Date.now()
		};
		moveAndResizeApplicationWindow(updateItem);
	}
}

//
// Application request fullscreen
//
function wsFullscreen(wsio, data) {
	var id = data.id;
	if (SAGE2Items.applications.list.hasOwnProperty(id)) {
		var item = SAGE2Items.applications.list[id];

		var wallRatio = config.totalWidth  / config.totalHeight;
		var iCenterX  = config.totalWidth  / 2.0;
		var iCenterY  = config.totalHeight / 2.0;
		var iWidth    = 1;
		var iHeight   = 1;
		var titleBar = config.ui.titleBarHeight;
		if (config.ui.auto_hide_ui === true) {
			titleBar = 0;
		}

		if (item.aspect > wallRatio) {
			// Image wider than wall
			iWidth  = config.totalWidth;
			iHeight = iWidth / item.aspect;
		} else {
			// Wall wider than image
			iHeight = config.totalHeight - (2 * titleBar);
			iWidth  = iHeight * item.aspect;
		}
		// back up values for restore
		item.previous_left   = item.left;
		item.previous_top    = item.top;
		item.previous_width  = item.width;
		item.previous_height = item.width / item.aspect;

		// calculate new values
		item.left   = iCenterX - (iWidth / 2);
		item.top    = iCenterY - (iHeight / 2);
		item.width  = iWidth;
		item.height = iHeight;

		// Shift by 'titleBarHeight' if no auto-hide
		if (config.ui.auto_hide_ui === true) {
			item.top = item.top - config.ui.titleBarHeight;
		}

		item.maximized = true;

		// build the object to be sent
		var updateItem = {elemId: item.id, elemLeft: item.left, elemTop: item.top,
				elemWidth: item.width, elemHeight: item.height, force: true,
				date: new Date()};

		moveAndResizeApplicationWindow(updateItem);
	}
}


//
// Broadcast data to all clients who need apps
//
function wsBroadcast(wsio, data) {
	broadcast('broadcast', data);
}

//
// RPC call from apps
//
function wsApplicationRPC(wsio, data) {
	var app = SAGE2Items.applications.list[data.app];
	if (app && app.plugin) {
		// Find the path to the app plugin
		var pluginFile = path.resolve(app.file, app.plugin);

		try {
			// Loading the plugin using builtin require function
			var rpcFunction = require(pluginFile);
			// Start the function inside the plugin
			rpcFunction(wsio, data, config);
		}
		catch (e) {
			// If something fails
			console.log("----------------------------");
			console.log(sageutils.header('RPC') + 'error in plugin ' + pluginFile);
			console.log(e);
			console.log("----------------------------");
		}
	} else {
		console.log(sageutils.header('RPC') + 'error no plugin found for ' + app.file);
	}

}


// **************  Session Functions *****************

function wsSaveSesion(wsio, data) {
	var sname = "";
	if (data) {
		// If a name is passed, use it
		sname = data;
	} else {
		// Otherwise use the date in the name
		var ad    = new Date();
		sname = sprint("session_%4d_%02d_%02d_%02d_%02d_%02s",
							ad.getFullYear(), ad.getMonth() + 1, ad.getDate(),
							ad.getHours(), ad.getMinutes(), ad.getSeconds());
	}
	saveSession(sname);
}

function printListSessions() {
	var thelist = listSessions();
	console.log("Sessions\n---------");
	for (var i = 0; i < thelist.length; i++) {
		console.log(sprint("%2d: Name: %s\tSize: %.0fKB\tDate: %s",
			i, thelist[i].exif.FileName, thelist[i].exif.FileSize / 1024.0, thelist[i].exif.FileDate
		));
	}
}

function listSessions() {
	var thelist = [];
	// Walk through the session files: sync I/Os to build the array
	var files = fs.readdirSync(sessionDirectory);
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		var filename = path.join(sessionDirectory, file);
		var stat = fs.statSync(filename);
		// is it a file
		if (stat.isFile()) {
			// doest it ends in .json
			if (filename.indexOf(".json", filename.length - 5) >= 0) {
				// use its change time (creation, update, ...)
				var ad = new Date(stat.mtime);
				var strdate = sprint("%4d/%02d/%02d %02d:%02d:%02s",
										ad.getFullYear(), ad.getMonth() + 1, ad.getDate(),
										ad.getHours(), ad.getMinutes(), ad.getSeconds());
				// Make it look like an exif data structure
				thelist.push({id: filename,
					sage2URL: '/uploads/' + file,
					exif: { FileName: file.slice(0, -5),
							FileSize: stat.size,
							FileDate: strdate,
							MIMEType: 'sage2/session'
						}
				});
			}
		}
	}
	return thelist;
}

function deleteSession(filename) {
	if (filename) {
		var fullpath = path.join(sessionDirectory, filename);
		// if it doesn't end in .json, add it
		if (fullpath.indexOf(".json", fullpath.length - 5) === -1) {
			fullpath += '.json';
		}
		fs.unlink(fullpath, function(err) {
			if (err) {
				console.log("Sessions> Could not delete session ", filename, err);
				return;
			}
			console.log("Sessions> Successfully deleted session", filename);
		});
	}
}

function saveSession(filename) {
	filename = filename || 'default.json';

	var key;
	var fullpath = path.join(sessionDirectory, filename);
	// if it doesn't end in .json, add it
	if (fullpath.indexOf(".json", fullpath.length - 5) === -1) {
		fullpath += '.json';
	}

	var states     = {};
	states.apps    = [];
	states.numapps = 0;
	states.date    = Date.now();
	for (key in SAGE2Items.applications.list) {
		var a = SAGE2Items.applications.list[key];
		// Ignore media streaming applications for now (desktop sharing)
		if (a.application !== 'media_stream' && a.application !== 'media_block_stream') {
			states.apps.push(a);
			states.numapps++;
		}
	}

	try {
		fs.writeFileSync(fullpath, JSON.stringify(states, null, 4));
		console.log(sageutils.header("Session") + "saved session file to " + fullpath);
	}
	catch (err) {
		console.log(sageutils.header("Session") + "error saving", err);
	}
}

function saveUserLog(filename) {
	if (users !== null) {
		filename = filename || "user-log_" + formatDateToYYYYMMDD_HHMMSS(new Date(startTime)) + ".json";

		users.session.end = Date.now();
		var userLogName = path.join("logs", filename);
		if (sageutils.fileExists(userLogName)) {
			fs.unlinkSync(userLogName);
		}
		var ignoreIP = function(key, value) {
			if (key === "ip") {
				return undefined;
			} else {
				return value;
			}
		};

		fs.writeFileSync(userLogName, json5.stringify(users, ignoreIP, 4));
		console.log(sageutils.header("LOG") + "saved log file to " + userLogName);
	}
}

function createAppFromDescription(app, callback) {
	console.log(sageutils.header("Session") + "App", app.id);

	if (app.application === "media_stream" || app.application === "media_block_stream") {
		callback(JSON.parse(JSON.stringify(app)), null);
		return;
	}

	var cloneApp = function(appInstance, videohandle) {
		appInstance.left            = app.left;
		appInstance.top             = app.top;
		appInstance.width           = app.width;
		appInstance.height          = app.height;
		appInstance.previous_left   = app.previous_left;
		appInstance.previous_top    = app.previous_top;
		appInstance.previous_width  = app.previous_width;
		appInstance.previous_height = app.previous_height;
		appInstance.maximized       = app.maximized;
		mergeObjects(app.data, appInstance.data, ['doc_url', 'video_url', 'video_type', 'audio_url', 'audio_type']);

		callback(appInstance, videohandle);
	};

	var appURL = url.parse(app.url);

	if (appURL.hostname === config.host) {
		if (app.application === "image_viewer" || app.application === "pdf_viewer" || app.application === "movie_player") {
			appLoader.loadFileFromLocalStorage({application: app.application, filename: appURL.path}, cloneApp);
		} else {
			appLoader.loadFileFromLocalStorage({application: "custom_app", filename: appURL.path}, cloneApp);
		}
	} else {
		if (app.application === "image_viewer" || app.application === "pdf_viewer" || app.application === "movie_player") {
			appLoader.loadFileFromWebURL({url: app.url, type: app.type}, cloneApp);
		} else {
			appLoader.loadApplicationFromRemoteServer(app, cloneApp);
		}
	}
}

function loadSession(filename) {
	filename = filename || 'default.json';

	var fullpath;
	if (sageutils.fileExists(path.resolve(filename))) {
		fullpath = filename;
	} else {
		fullpath = path.join(sessionDirectory, filename);
	}

	// if it doesn't end in .json, add it
	if (fullpath.indexOf(".json", fullpath.length - 5) === -1) {
		fullpath += '.json';
	}

	fs.readFile(fullpath, function(err, data) {
		if (err) {
			console.log(sageutils.header("SAGE2") + "error reading session", err);
		} else {
			console.log(sageutils.header("SAGE2") + "reading session from " + fullpath);

			var session = JSON.parse(data);
			console.log(sageutils.header("Session") + "number of applications", session.numapps);

			session.apps.forEach(function(element, index, array) {
				createAppFromDescription(element, function(appInstance, videohandle) {
					appInstance.id = getUniqueAppId();
					if (appInstance.animation) {
						var i;
						SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
						for (i = 0; i < clients.length; i++) {
							if (clients[i].clientType === "display") {
								SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i],
									readyForNextFrame: false, blocklist: []};
							}
						}
					}

					handleNewApplication(appInstance, videohandle);
				});
			});
		}
	});
}

// **************  Information Functions *****************

function listClients() {
	var i;
	console.log("Clients (%d)\n------------", clients.length);
	for (i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			if (clients[i] === masterDisplay) {
				console.log(sprint("%2d: %s (%s %s) master", i, clients[i].id, clients[i].clientType, clients[i].clientID));
			} else {
				console.log(sprint("%2d: %s (%s %s)", i, clients[i].id, clients[i].clientType, clients[i].clientID));
			}
		} else {
			console.log(sprint("%2d: %s (%s)", i, clients[i].id, clients[i].clientType));
		}
	}
}

function listMediaStreams() {
	var i, c, key;
	console.log("Block streams (%d)\n------------", Object.keys(mediaBlockStreams).length);
	i = 0;
	for (key in mediaBlockStreams) {
		var numclients = Object.keys(mediaBlockStreams[key].clients).length;
		console.log(sprint("%2d: %s ready:%s clients:%d", i, key, mediaBlockStreams[key].ready, numclients));
		var cstr = " ";
		for (c in mediaBlockStreams[key].clients) {
			cstr += c + "(" + mediaBlockStreams[key].clients[c] + ") ";
		}
		console.log("\t", cstr);
		i++;
	}

	console.log("Media streams\n------------");
	for (key in SAGE2Items.applications.list) {
		var app = SAGE2Items.applications.list[key];
		if (app.application === "media_stream") {
			console.log(sprint("%2d: %s %s %s",
				i, app.id, app.application, app.title));
			i++;
		}
	}
}

function listMediaBlockStreams() {
	listMediaStreams();
}

function listApplications() {
	var i = 0;
	var key;
	console.log("Applications\n------------");
	for (key in SAGE2Items.applications.list) {
		var app = SAGE2Items.applications.list[key];
		console.log(sprint("%2d: %s %s [%dx%d +%d+%d] %s (v%s) by %s",
			i, app.id, app.application,
			app.width, app.height,
			app.left,  app.top,
			app.title, app.metadata.version,
			app.metadata.author));
		i++;
	}
}


// **************  Tiling Functions *****************

//
//
// From Ratko's DIM in SAGE
//   adapted to use all the tiles
//   and center of gravity

function averageWindowAspectRatio() {
	var num = SAGE2Items.applications.numItems;

	if (num === 0) {
		return 1.0;
	}

	var totAr = 0.0;
	var key;
	for (key in SAGE2Items.applications.list) {
		totAr += (SAGE2Items.applications.list[key].width / SAGE2Items.applications.list[key].height);
	}
	return (totAr / num);
}

function fitWithin(app, x, y, width, height, margin) {
	var titleBar = config.ui.titleBarHeight;
	if (config.ui.auto_hide_ui === true) {
		titleBar = 0;
	}

	// take buffer into account
	x += margin;
	y += margin;
	width  = width  - 2 * margin;
	height = height - 2 * margin;

	var widthRatio  = (width - titleBar)  / app.width;
	var heightRatio = (height - titleBar) / app.height;
	var maximizeRatio;
	if (widthRatio > heightRatio) {
		maximizeRatio = heightRatio;
	} else {
		maximizeRatio = widthRatio;
	}

	// figure out the maximized app size (w/o the widgets)
	var newAppWidth  = Math.round(maximizeRatio * app.width);
	var newAppHeight = Math.round(maximizeRatio * app.height);

	// figure out the maximized app position (with the widgets)
	var postMaxX = Math.round(width / 2.0 - newAppWidth / 2.0);
	var postMaxY = Math.round(height / 2.0 - newAppHeight / 2.0);

	// the new position of the app considering the maximized state and
	// all the widgets around it
	var newAppX = x + postMaxX;
	var newAppY = y + postMaxY;

	return [newAppX, newAppY, newAppWidth, newAppHeight];
}

// Calculate the square of euclidian distance between two objects with .x and .y fields
function distanceSquared2D(p1, p2) {
	var dx = p2.x - p1.x;
	var dy = p2.y - p1.y;
	return (dx * dx + dy * dy);
}

function findMinimum(arr) {
	var val = Number.MAX_VALUE;
	var idx = 0;
	for (var i = 0; i < arr.length; i++) {
		if (arr[i] < val) {
			val = arr[i];
			idx = i;
		}
	}
	return idx;
}

function tileApplications() {
	var app;
	var i, c, r, key;
	var numCols, numRows, numCells;

	var displayAr  = config.totalWidth / config.totalHeight;
	var arDiff     = displayAr / averageWindowAspectRatio();
	var numWindows = SAGE2Items.applications.numItems;

	// 3 scenarios... windows are on average the same aspect ratio as the display
	if (arDiff >= 0.7 && arDiff <= 1.3) {
		numCols = Math.ceil(Math.sqrt(numWindows));
		numRows = Math.ceil(numWindows / numCols);
	} else if (arDiff < 0.7) {
		// windows are much wider than display
		c = Math.round(1 / (arDiff / 2.0));
		if (numWindows <= c) {
			numRows = numWindows;
			numCols = 1;
		} else {
			numCols = Math.max(2, Math.round(numWindows / c));
			numRows = Math.round(Math.ceil(numWindows / numCols));
		}
	} else {
		// windows are much taller than display
		c = Math.round(arDiff * 2);
		if (numWindows <= c) {
			numCols = numWindows;
			numRows = 1;
		} else {
			numRows = Math.max(2, Math.round(numWindows / c));
			numCols = Math.round(Math.ceil(numWindows / numRows));
		}
	}
	numCells = numRows * numCols;

	// determine the bounds of the tiling area
	var titleBar = config.ui.titleBarHeight;
	if (config.ui.auto_hide_ui === true) {
		titleBar = 0;
	}
	var areaX = 0;
	var areaY = Math.round(1.5 * titleBar); // keep 0.5 height as margin
	if (config.ui.auto_hide_ui === true) {
		areaY = -config.ui.titleBarHeight;
	}

	var areaW = config.totalWidth;
	var areaH = config.totalHeight - (1.0 * titleBar);

	var tileW = Math.floor(areaW / numCols);
	var tileH = Math.floor(areaH / numRows);

	var padding = 4;
	// if only one application, no padding, i.e maximize
	if (numWindows === 1) {
		padding = 0;
	}

	var centroidsApps  = {};
	var centroidsTiles = [];

	// Caculate apps centers
	for (key in SAGE2Items.applications.list) {
		app = SAGE2Items.applications.list[key];
		centroidsApps[key] = {x: app.left + app.width / 2.0, y: app.top + app.height / 2.0};
	}
	// Caculate tiles centers
	for (i = 0; i < numCells; i++) {
		c = i % numCols;
		r = Math.floor(i / numCols);
		centroidsTiles.push({x: (c * tileW + areaX) + tileW / 2.0, y: (r * tileH + areaY) + tileH / 2.0});
	}

	// Calculate distances
	var distances = {};
	for (key in centroidsApps) {
		distances[key] = [];
		for (i = 0; i < numCells; i++) {
			var d = distanceSquared2D(centroidsApps[key], centroidsTiles[i]);
			distances[key].push(d);
		}
	}

	for (key in SAGE2Items.applications.list) {
		// get the application
		app = SAGE2Items.applications.list[key];
		// pick a cell
		var cellid = findMinimum(distances[key]);
		// put infinite value to disable the chosen cell
		for (i in SAGE2Items.applications.list) {
			distances[i][cellid] = Number.MAX_VALUE;
		}

		// calculate new dimensions
		c = cellid % numCols;
		r = Math.floor(cellid / numCols);
		var newdims = fitWithin(app, c * tileW + areaX, r * tileH + areaY, tileW, tileH, padding);

		// update the data structure
		app.left = newdims[0];
		app.top = newdims[1] - titleBar;
		app.width = newdims[2];
		app.height = newdims[3];
		var updateItem = {
			elemId: app.id,
			elemLeft: app.left,
			elemTop: app.top,
			elemWidth: app.width,
			elemHeight: app.height,
			force: true,
			date: Date.now()
		};

		broadcast('startMove', {id: updateItem.elemId, date: updateItem.date});
		broadcast('startResize', {id: updateItem.elemId, date: updateItem.date});

		moveAndResizeApplicationWindow(updateItem);

		broadcast('finishedMove', {id: updateItem.elemId, date: updateItem.date});
		broadcast('finishedResize', {id: updateItem.elemId, date: updateItem.date});
	}
}

// Remove all applications
function clearDisplay() {
	var i;
	var all = Object.keys(SAGE2Items.applications.list);
	for (i = 0; i < all.length; i++) {
		deleteApplication(all[i]);
	}
}


// handlers for messages from UI
function wsClearDisplay(wsio, data) {
	clearDisplay();

	addEventToUserLog(wsio.id, {type: "clearDisplay", data: null, time: Date.now()});
}

function wsTileApplications(wsio, data) {
	tileApplications();

	addEventToUserLog(wsio.id, {type: "tileApplications", data: null, time: Date.now()});
}


// **************  Server File Functions *****************

function wsRequestAvailableApplications(wsio, data) {
	var apps = getApplications();
	wsio.emit('availableApplications', apps);
}

function wsRequestStoredFiles(wsio, data) {
	var savedFiles = getSavedFilesList();
	wsio.emit('storedFileList', savedFiles);
}

function wsLoadApplication(wsio, data) {
	var appData = {application: "custom_app", filename: data.application};
	appLoader.loadFileFromLocalStorage(appData, function(appInstance) {
		appInstance.id = getUniqueAppId();

		if (appInstance.animation) {
			var i;
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		}

		// Get the drop position and convert it to wall coordinates
		var position = data.position || [0, 0];
		if (position[0] > 1) {
			// value in pixels, used as origin
			appInstance.left = position[0];
		} else {
			// value in percent
			position[0] = Math.round(position[0] * config.totalWidth);
			// Use the position as center of drop location
			appInstance.left = position[0] - appInstance.width / 2;
			if (appInstance.left < 0) {
				appInstance.left = 0;
			}
		}
		if (position[1] > 1) {
			// value in pixels, used as origin
			appInstance.top = position[1];
		} else {
			// value in percent
			position[1] = Math.round(position[1] * config.totalHeight);
			// Use the position as center of drop location
			appInstance.top  = position[1] - appInstance.height / 2;
			if (appInstance.top < 0) {
				appInstance.top = 0;
			}
		}

		handleNewApplication(appInstance, null);

		addEventToUserLog(data.user, {type: "openApplication", data:
			{application: {id: appInstance.id, type: appInstance.application}}, time: Date.now()});
	});
}

function wsLoadFileFromServer(wsio, data) {
	if (data.application === "load_session") {
		// if it's a session, then load it
		loadSession(data.filename);

		addEventToUserLog(wsio.id, {type: "openFile", data: {name: data.filename,
			application: {id: null, type: "session"}}, time: Date.now()});
	} else {
		appLoader.loadFileFromLocalStorage(data, function(appInstance, videohandle) {
			// Get the drop position and convert it to wall coordinates
			var position = data.position || [0, 0];
			if (position[0] > 1) {
				// value in pixels, used as origin
				appInstance.left = position[0];
			} else {
				// value in percent
				position[0] = Math.round(position[0] * config.totalWidth);
				// Use the position as center of drop location
				appInstance.left = position[0] - appInstance.width / 2;
				if (appInstance.left < 0) {
					appInstance.left = 0;
				}
			}
			if (position[1] > 1) {
				// value in pixels, used as origin
				appInstance.top = position[1];
			} else {
				// value in percent
				position[1] = Math.round(position[1] * config.totalHeight);
				// Use the position as center of drop location
				appInstance.top  = position[1] - appInstance.height / 2;
				if (appInstance.top < 0) {
					appInstance.top = 0;
				}
			}

			appInstance.id = getUniqueAppId();
			handleNewApplication(appInstance, videohandle);

			addEventToUserLog(data.user, {type: "openFile", data:
				{name: data.filename, application: {id: appInstance.id, type: appInstance.application}}, time: Date.now()});
		});
	}
}

function initializeLoadedVideo(appInstance, videohandle) {
	if (appInstance.application !== "movie_player" || videohandle === null) {
		return;
	}

	var i;
	var horizontalBlocks = Math.ceil(appInstance.native_width / mediaBlockSize);
	var verticalBlocks = Math.ceil(appInstance.native_height / mediaBlockSize);
	var videoBuffer = new Array(horizontalBlocks * verticalBlocks);

	videohandle.on('error', function(err) {
		console.log("VIDEO ERROR: " + err);
	});
	videohandle.on('start', function() {
		broadcast('videoPlaying', {id: appInstance.id});
	});
	videohandle.on('end', function() {
		broadcast('videoEnded', {id: appInstance.id});
		if (SAGE2Items.renderSync[appInstance.id].loop === true) {
			SAGE2Items.renderSync[appInstance.id].decoder.seek(0.0, function() {
				SAGE2Items.renderSync[appInstance.id].decoder.play();
			});
			broadcast('updateVideoItemTime', {id: appInstance.id, timestamp: 0.0, play: false});
		}
	});
	videohandle.on('frame', function(frameIdx, buffer) {
		SAGE2Items.renderSync[appInstance.id].frameIdx = frameIdx;
		var blockBuffers = pixelblock.yuv420ToPixelBlocks(buffer, appInstance.data.width, appInstance.data.height, mediaBlockSize);

		var idBuffer = Buffer.concat([new Buffer(appInstance.id), new Buffer([0])]);
		var frameIdxBuffer = intToByteBuffer(frameIdx,   4);
		var dateBuffer = intToByteBuffer(Date.now(), 8);
		for (i = 0; i < blockBuffers.length; i++) {
			var blockIdxBuffer = intToByteBuffer(i, 2);
			SAGE2Items.renderSync[appInstance.id].pixelbuffer[i] = Buffer.concat([idBuffer, blockIdxBuffer,
				frameIdxBuffer, dateBuffer, blockBuffers[i]]);
		}

		handleNewVideoFrame(appInstance.id);
	});

	SAGE2Items.renderSync[appInstance.id] = {decoder: videohandle, frameIdx: null, loop: false,
		pixelbuffer: videoBuffer, newFrameGenerated: false, clients: {}};
	for (i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
		}
	}

	calculateValidBlocks(appInstance, mediaBlockSize, SAGE2Items.renderSync[appInstance.id]);

	// initialize based on state
	SAGE2Items.renderSync[appInstance.id].loop = appInstance.data.looped;
	if (appInstance.data.frame !== 0) {
		var ts = appInstance.data.frame / appInstance.data.framerate;
		SAGE2Items.renderSync[appInstance.id].decoder.seek(ts, function() {
			if (appInstance.data.paused === false) {
				SAGE2Items.renderSync[appInstance.id].decoder.play();
			}
		});
		broadcast('updateVideoItemTime', {id: appInstance.id, timestamp: ts, play: false});
	} else {
		if (appInstance.data.paused === false) {
			SAGE2Items.renderSync[appInstance.id].decoder.play();
		}
	}
	if (appInstance.data.muted === true) {
		broadcast('videoMuted', {id: appInstance.id});
	}
}

// move this function elsewhere
function handleNewVideoFrame(id) {
	var videohandle = SAGE2Items.renderSync[id];

	videohandle.newFrameGenerated = true;
	if (!allTrueDict(videohandle.clients, "readyForNextFrame")) {
		return false;
	}

	updateVideoFrame(id);
	return true;
}

// move this function elsewhere
function handleNewClientReady(id) {
	var videohandle = SAGE2Items.renderSync[id];

	// if no new frame is generate or not all display clients have finished rendering previous frame - return
	if (videohandle.newFrameGenerated !== true || !allTrueDict(videohandle.clients, "readyForNextFrame")) {
		return false;
	}

	updateVideoFrame(id);
	return true;
}

function updateVideoFrame(id) {
	var i;
	var key;
	var videohandle = SAGE2Items.renderSync[id];

	videohandle.newFrameGenerated = false;
	for (key in videohandle.clients) {
		videohandle.clients[key].wsio.emit('updateFrameIndex', {id: id, frameIdx: videohandle.frameIdx});
		var hasBlock = false;
		for (i = 0; i < videohandle.pixelbuffer.length; i++) {
			if (videohandle.clients[key].blocklist.indexOf(i) >= 0) {
				hasBlock = true;
				videohandle.clients[key].wsio.emit('updateVideoFrame', videohandle.pixelbuffer[i]);
			}
		}
		if (hasBlock === true) {
			videohandle.clients[key].readyForNextFrame = false;
		}
	}
}

// move this function elsewhere
function calculateValidBlocks(app, blockSize, renderhandle) {
	if (app.application !== "movie_player" && app.application !== "media_block_stream") {
		return;
	}

	var i;
	var j;
	var key;

	var portalX = 0;
	var portalY = 0;
	var portalScale = 1;
	var titleBarHeight = config.ui.titleBarHeight;
	var portal = findApplicationPortal(app);
	if (portal !== undefined && portal !== null) {
		portalX = portal.data.left;
		portalY = portal.data.top;
		portalScale = portal.data.scale;
		titleBarHeight = portal.data.titleBarHeight;
	}

	var horizontalBlocks = Math.ceil(app.data.width / blockSize);
	var verticalBlocks   = Math.ceil(app.data.height / blockSize);

	var renderBlockWidth  = (blockSize * app.width / app.data.width) * portalScale;
	var renderBlockHeight = (blockSize * app.height / app.data.height) * portalScale;

	for (key in renderhandle.clients) {
		renderhandle.clients[key].blocklist = [];
		for (i = 0; i < verticalBlocks; i++) {
			for (j = 0; j < horizontalBlocks; j++) {
				var blockIdx = i * horizontalBlocks + j;

				if (renderhandle.clients[key].wsio.clientID < 0) {
					renderhandle.clients[key].blocklist.push(blockIdx);
				} else {
					var display = config.displays[renderhandle.clients[key].wsio.clientID];
					var left = j * renderBlockWidth  + (app.left * portalScale + portalX);
					var top  = i * renderBlockHeight + ((app.top + titleBarHeight) * portalScale + portalY);
					var offsetX = config.resolution.width  * display.column;
					var offsetY = config.resolution.height * display.row;

					if ((left + renderBlockWidth) >= offsetX && left <= (offsetX + config.resolution.width) &&
						(top + renderBlockHeight) >= offsetY && top  <= (offsetY + config.resolution.height)) {
						renderhandle.clients[key].blocklist.push(blockIdx);
					}
				}
			}
		}
		renderhandle.clients[key].wsio.emit('updateValidStreamBlocks', {id: app.id, blockList: renderhandle.clients[key].blocklist});
	}
}

function wsDeleteElementFromStoredFiles(wsio, data) {
	assets.deleteAsset(data.filename);

	if (data.application === "load_session") {
		// if it's a session
		deleteSession(data.filename);
	}
	// } else if (data.application === 'custom_app') {
	// 	// an app
	// 	// NYI
	// 	return;
	// } else if (data.application === 'image_viewer') {
	// 	// an image
	// 	assets.deleteImage(data.filename);
	// } else if (data.application === 'movie_player') {
	// 	// a movie
	// 	assets.deleteVideo(data.filename);
	// } else if (data.application === 'pdf_viewer') {
	// 	// an pdf
	// 	assets.deletePDF(data.filename);
	// } else {
	// 	// I dont know
	// 	return;
	// }
}

function wsMoveElementFromStoredFiles(wsio, data) {
	var destinationURL = data.url;
	var destinationFile;

	// calculate the new destination filename
	for (var folder in mediaFolders) {
		var f = mediaFolders[folder];
		if (destinationURL.indexOf(f.url) === 0) {
			var splits = destinationURL.split(f.url);
			var subdir = splits[1];
			destinationFile = path.join(f.path, subdir, path.basename(data.filename));
		}
	}

	// Do the move and reprocess the asset
	if (destinationFile) {
		assets.moveAsset(data.filename, destinationFile, function(err) {
			if (err) {
				console.log(sageutils.header('Assets') + 'Error moving ' + data.filename);
			} else {
				// if all good, send the new list of files
				wsRequestStoredFiles(wsio);
			}
		});
	}
}


// **************  Adding Web Content (URL) *****************

function wsAddNewWebElement(wsio, data) {
	appLoader.loadFileFromWebURL(data, function(appInstance, videohandle) {

		// Get the drop position and convert it to wall coordinates
		var position = data.position || [0, 0];
		position[0] = Math.round(position[0] * config.totalWidth);
		position[1] = Math.round(position[1] * config.totalHeight);

		// Use the position from the drop location
		if (position[0] !== 0 || position[1] !== 0) {
			appInstance.left = position[0] - appInstance.width / 2;
			if (appInstance.left < 0) {
				appInstance.left = 0;
			}
			appInstance.top  = position[1] - appInstance.height / 2;
			if (appInstance.top < 0) {
				appInstance.top = 0;
			}
		}

		appInstance.id = getUniqueAppId();
		handleNewApplication(appInstance, videohandle);

		if (appInstance.animation) {
			var i;
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		}
	});
}

// **************  Folder management     *****************

function wsCreateFolder(wsio, data) {
	// Create a folder as needed
	for (var folder in mediaFolders) {
		var f = mediaFolders[folder];
		// if it starts with the sage root
		if (data.root.indexOf(f.url) === 0) {
			var subdir = data.root.split(f.url)[1];
			var toCreate = path.join(f.path, subdir, data.path);
			if (!sageutils.folderExists(toCreate)) {
				sageutils.mkdirParent(toCreate);
				console.log(sageutils.header('Folder') + toCreate + ' created');
			}
		}
	}
}


// **************  Command line          *****************

function wsCommand(wsio, data) {
	// send the command to the REPL interpreter
	processInputCommand(data);
}

// **************  Launching Web Browser *****************

function wsOpenNewWebpage(wsio, data) {
	// Check if the web-browser is connected
	if (webBrowserClient !== null) {
		// then emit the command
		console.log("Browser> new page", data.url);
		webBrowserClient.emit('openWebBrowser', {url: data.url});
	}
}


// **************  Video / Audio Synchonization *****************

function wsPlayVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	SAGE2Items.renderSync[data.id].decoder.play();
}

function wsPauseVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	SAGE2Items.renderSync[data.id].decoder.pause(function() {
		broadcast('videoPaused', {id: data.id});
	});
}

function wsStopVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	SAGE2Items.renderSync[data.id].decoder.stop(function() {
		broadcast('videoPaused', {id: data.id});
		broadcast('updateVideoItemTime', {id: data.id, timestamp: 0.0, play: false});
		broadcast('updateFrameIndex', {id: data.id, frameIdx: 0});
	});
}

function wsUpdateVideoTime(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	SAGE2Items.renderSync[data.id].decoder.seek(data.timestamp, function() {
		if (data.play === true) {
			SAGE2Items.renderSync[data.id].decoder.play();
		}
	});
	broadcast('updateVideoItemTime', data);
}

function wsMuteVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	broadcast('videoMuted', {id: data.id});
}

function wsUnmuteVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	broadcast('videoUnmuted', {id: data.id});
}

function wsLoopVideo(wsio, data) {
	if (SAGE2Items.renderSync[data.id] === undefined || SAGE2Items.renderSync[data.id] === null) {
		return;
	}

	SAGE2Items.renderSync[data.id].loop = data.loop;
}

// **************  Remote Server Content *****************

function wsAddNewElementFromRemoteServer(wsio, data) {
	console.log("add element from remote server");
	var i;

	appLoader.loadApplicationFromRemoteServer(data, function(appInstance, videohandle) {
		console.log("Remote App: " + appInstance.title + " (" + appInstance.application + ")");
		if (appInstance.application === "media_stream" || appInstance.application === "media_block_stream") {
			appInstance.id = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port + "|" + appInstance.id;
			SAGE2Items.renderSync[appInstance.id] = {chunks: [], clients: {}};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		} else {
			appInstance.id = getUniqueAppId();
		}

		mergeObjects(data.data, appInstance.data, ['video_url', 'video_type', 'audio_url', 'audio_type']);

		handleNewApplication(appInstance, videohandle);

		if (appInstance.animation) {
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		}
	});
}

function wsAddNewSharedElementFromRemoteServer(wsio, data) {
	console.log("add shared element from remote server");
	var i;

	appLoader.loadApplicationFromRemoteServer(data.application, function(appInstance, videohandle) {
		console.log("Remote App: " + appInstance.title + " (" + appInstance.application + ")");

		if (appInstance.application === "media_stream" || appInstance.application === "media_block_stream") {
			appInstance.id = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port + "|" + data.id;
			SAGE2Items.renderSync[appInstance.id] = {chunks: [], clients: {}};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					console.log("render client: " + clients[i].id);
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		} else {
			appInstance.id = data.id;
		}

		mergeObjects(data.application.data, appInstance.data, ['video_url', 'video_type', 'audio_url', 'audio_type']);

		handleNewApplication(appInstance, videohandle);

		if (appInstance.animation) {
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		}

		sharedApps[appInstance.id] = [{wsio: wsio, sharedId: data.remoteAppId}];

		SAGE2Items.applications.editButtonVisibilityOnItem(appInstance.id, "syncButton", true);
		broadcast('setAppSharingFlag', {id: appInstance.id, sharing: true});
	});
}

function wsRequestNextRemoteFrame(wsio, data) {
	var originId;
	var portalCloneIdx = data.id.indexOf("_");
	if (portalCloneIdx >= 0) {
		originId = data.id.substring(0, portalCloneIdx);
	} else {
		originId = data.id;
	}
	var remote_id = config.host + ":" + config.port + "|" + data.id;

	if (SAGE2Items.applications.list.hasOwnProperty(originId)) {
		var stream = SAGE2Items.applications.list[originId];
		wsio.emit('updateRemoteMediaStreamFrame', {id: remote_id, state: stream.data});
	} else {
		wsio.emit('stopMediaStream', {id: remote_id});
	}
}

function wsUpdateRemoteMediaStreamFrame(wsio, data) {
	if (!SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		return;
	}

	var key;
	for (key in SAGE2Items.renderSync[data.id].clients) {
		SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
	}
	var stream = SAGE2Items.applications.list[data.id];
	stream.data = data.data;

	broadcast('updateMediaStreamFrame', data);
}

function wsReceivedRemoteMediaStreamFrame(wsio, data) {
	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;
	if (allTrueDict(SAGE2Items.renderSync[data.id].clients, "readyForNextFrame")) {
		var i;
		var mediaStreamData = data.id.substring(6).split("|");
		var sender = {wsio: null, serverId: mediaStreamData[0], clientId: mediaStreamData[1], streamId: null};
		for (i = 0; i < clients.length; i++) {
			if (clients[i].id === sender.serverId) {
				sender.wsio = clients[i];
				break;
			}
		}
		if (sender.wsio !== null) {
			sender.wsio.emit('requestNextRemoteFrame', {id: sender.clientId});
		}
	}
}

// XXX - Remote block streaming not tested
function wsRequestNextRemoteBlockFrame(wsio, data) {
	var remote_id = config.host + ":" + config.port + "|" + data.id;
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var stream = SAGE2Items.applications.list[data.id];
		wsio.emit('updateRemoteMediaBlockStreamFrame', {id: remote_id, state: stream.data});
	} else {
		wsio.emit('stopMediaBlockStream', {id: remote_id});
	}
}

function wsUpdateRemoteMediaBlockStreamFrame(wsio, data) {
	if (!SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		return;
	}

	var key;
	for (key in SAGE2Items.renderSync[data.id].clients) {
		SAGE2Items.renderSync[data.id].clients[key].readyForNextFrame = false;
	}
	var stream = SAGE2Items.applications.list[data.id];
	stream.data = data.data;

	broadcast('updateMediaBlockStreamFrame', data);
}

function wsReceivedRemoteMediaBlockStreamFrame(wsio, data) {
	SAGE2Items.renderSync[data.id].clients[wsio.id].readyForNextFrame = true;
	if (allTrueDict(SAGE2Items.renderSync[data.id].clients, "readyForNextFrame")) {
		var i;
		var mediaBlockStreamData = data.id.substring(6).split("|");
		var sender = {wsio: null, serverId: mediaBlockStreamData[0], clientId: mediaBlockStreamData[1], streamId: null};
		for (i = 0; i < clients.length; i++) {
			if (clients[i].id === sender.serverId) {
				sender.wsio = clients[i];
				break;
			}
		}
		if (sender.wsio !== null) {
			sender.wsio.emit('requestNextRemoteFrame', {id: sender.clientId});
		}
	}
}

function wsRequestDataSharingSession(wsio, data) {
	var known_site = findRemoteSiteByConnection(wsio);
	if (known_site !== null) {
		data.config.name = known_site.name;
	}
	if (data.config.name === undefined || data.config.name === null) {
		data.config.name = "Unknown";
	}

	console.log("Data-sharing request from " + data.config.name + " (" + data.config.host + ":" + data.config.port + ")");
	broadcast('requestedDataSharingSession', {name: data.config.name, host: data.config.host, port: data.config.port});
	remoteSharingRequestDialog = {wsio: wsio, config: data.config};
	showRequestDialog(true);
}

function wsCancelDataSharingSession(wsio, data) {
	console.log("Data-sharing request cancelled");
	broadcast('closeRequestDataSharingDialog', null, 'requiresFullApps');
	remoteSharingRequestDialog = null;
	showRequestDialog(false);
}

function wsAcceptDataSharingSession(wsio, data) {
	var myMin = Math.min(config.totalWidth, config.totalHeight - config.ui.titleBarHeight);
	var sharingScale = (0.9 * myMin) / Math.min(data.width, data.height);
	console.log("Data-sharing request accepted: " + data.width + "x" + data.height + ", scale: " + sharingScale);
	broadcast('closeDataSharingWaitDialog', null);
	createNewDataSharingSession(remoteSharingWaitDialog.name, remoteSharingWaitDialog.wsio.remoteAddress.address,
		remoteSharingWaitDialog.wsio.remoteAddress.port, remoteSharingWaitDialog.wsio,
		new Date(data.date), data.width, data.height, sharingScale, data.titleBarHeight, true);
	remoteSharingWaitDialog = null;
	showWaitDialog(false);
}

function wsRejectDataSharingSession(wsio, data) {
	console.log("Data-sharing request rejected");
	broadcast('closeDataSharingWaitDialog', null, 'requiresFullApps');
	remoteSharingWaitDialog = null;
	showWaitDialog(false);
}

function wsCreateRemoteSagePointer(wsio, data) {
	var key;
	var portalId = null;
	for (key in remoteSharingSessions) {
		if (remoteSharingSessions[key].portal.host === data.portal.host &&
			remoteSharingSessions[key].portal.port === data.portal.port) {
			portalId = key;
		}
	}
	createSagePointer(data.id, portalId);
}

function wsStartRemoteSagePointer(wsio, data) {
	sagePointers[data.id].left = data.left;
	sagePointers[data.id].top  = data.top;

	showPointer(data.id, data);
}

function wsStopRemoteSagePointer(wsio, data) {
	hidePointer(data.id, data);

	// return to window interaction mode after stopping pointer
	if (remoteInteraction[data.id].appInteractionMode()) {
		remoteInteraction[data.id].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[data.id].id, mode: remoteInteraction[data.id].interactionMode });
	}
}

function wsRecordInnerGeometryForWidget(wsio, data) {
	// var center = data.innerGeometry.center;
	var buttons = data.innerGeometry.buttons;
	var textInput = data.innerGeometry.textInput;
	var slider = data.innerGeometry.slider;
	// SAGE2Items.widgets.addButtonToItem(data.instanceID, "center", "circle", {x:center.x, y: center.y, r:center.r}, 0);
	for (var i = 0; i < buttons.length; i++) {
		SAGE2Items.widgets.addButtonToItem(data.instanceID, buttons[i].id, "circle",
			{x: buttons[i].x, y: buttons[i].y, r: buttons[i].r}, 0);
	}
	if (textInput !== null) {
		SAGE2Items.widgets.addButtonToItem(data.instanceID, textInput.id, "rectangle",
			{x: textInput.x, y: textInput.y, w: textInput.w, h: textInput.h}, 0);
	}
	if (slider !== null) {
		SAGE2Items.widgets.addButtonToItem(data.instanceID, slider.id, "rectangle",
			{x: slider.x, y: slider.y, w: slider.w, h: slider.h}, 0);
	}
}

function wsCreateAppClone(wsio, data) {
	var app = SAGE2Items.applications.list[data.id];

	createAppFromDescription(app, function(appInstance, videohandle) {
		appInstance.id = getUniqueAppId();
		if (appInstance.animation) {
			var i;
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
		}

		handleNewApplication(appInstance, videohandle);
	});
}

function wsRemoteSagePointerPosition(wsio, data) {
	if (sagePointers[data.id] === undefined) {
		return;
	}

	sagePointers[data.id].left = data.left;
	sagePointers[data.id].top = data.top;

	broadcast('updateSagePointerPosition', sagePointers[data.id]);
}

function wsRemoteSagePointerToggleModes(wsio, data) {
	// remoteInteraction[data.id].toggleModes();
	remoteInteraction[data.id].interactionMode = data.mode;
	broadcast('changeSagePointerMode', {id: sagePointers[data.id].id, mode: remoteInteraction[data.id].interactionMode});
}

function wsRemoteSagePointerHoverCorner(wsio, data) {
	var appId = data.appHoverCorner.elemId;
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(appId)) {
		app = SAGE2Items.applications.list[appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + appId)) {
		data.appHoverCorner.elemId = wsio.id + "|" + appId;
		appId = data.appHoverCorner.elemId;
		app = SAGE2Items.applications.list[appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	broadcast('hoverOverItemCorner', data.appHoverCorner);
}

function wsAddNewRemoteElementInDataSharingPortal(wsio, data) {
	var key;
	var remote = null;
	for (key in remoteSharingSessions) {
		if (remoteSharingSessions[key].wsio.id === wsio.id) {
			remote = remoteSharingSessions[key];
			break;
		}
	}
	console.log("adding element from remote server:");
	if (remote !== null) {
		createAppFromDescription(data, function(appInstance, videohandle) {
			if (appInstance.application === "media_stream" || appInstance.application === "media_block_stream") {
				appInstance.id = wsio.remoteAddress.address + ":" + wsio.remoteAddress.port + "|" + data.id;
			} else {
				appInstance.id = data.id;
			}
			appInstance.left = data.left;
			appInstance.top = data.top;
			appInstance.width = data.width;
			appInstance.height = data.height;

			remoteSharingSessions[remote.portal.id].appCount++;

			var i;
			SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
			for (i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
				}
			}
			handleNewApplicationInDataSharingPortal(appInstance, videohandle, remote.portal.id);
		});
	}
}

function wsUpdateApplicationOrder(wsio, data) {
	// should check timestamp first (data.date)
	broadcast('updateItemOrder', data.order);
}

function wsStartApplicationMove(wsio, data) {
	// should check timestamp first (data.date)
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
		app = SAGE2Items.applications.list[data.appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + data.appId)) {
		data.appId = wsio.id + "|" + data.appId;
		app = SAGE2Items.applications.list[data.appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	broadcast('startMove', {id: data.appId, date: Date.now()});

	var eLogData = {
		type: "move",
		action: "start",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(data.id, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function wsStartApplicationResize(wsio, data) {
	// should check timestamp first (data.date)
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
		app = SAGE2Items.applications.list[data.appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + data.appId)) {
		data.appId = wsio.id + "|" + data.appId;
		app = SAGE2Items.applications.list[data.appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	broadcast('startResize', {id: data.appId, date: Date.now()});

	var eLogData = {
		type: "resize",
		action: "start",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(data.id, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function wsUpdateApplicationPosition(wsio, data) {
	// should check timestamp first (data.date)
	var appId = data.appPositionAndSize.elemId;
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(appId)) {
		app = SAGE2Items.applications.list[appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + appId)) {
		data.appPositionAndSize.elemId = wsio.id + "|" + appId;
		appId = data.appPositionAndSize.elemId;
		app = SAGE2Items.applications.list[appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	var titleBarHeight = config.ui.titleBarHeight;
	if (data.portalId !== undefined && data.portalId !== null) {
		titleBarHeight = remoteSharingSessions[data.portalId].portal.titleBarHeight;
	}
	app.left = data.appPositionAndSize.elemLeft;
	app.top = data.appPositionAndSize.elemTop;
	app.width = data.appPositionAndSize.elemWidth;
	app.height = data.appPositionAndSize.elemHeight;
	var im = findInteractableManager(data.appPositionAndSize.elemId);
	im.editGeometry(app.id, "applications", "rectangle", {x: app.left, y: app.top, w: app.width, h: app.height + titleBarHeight});
	broadcast('setItemPosition', data.appPositionAndSize);
	if (SAGE2Items.renderSync.hasOwnProperty(app.id)) {
		calculateValidBlocks(app, mediaBlockSize, SAGE2Items.renderSync[app.id]);
		if (app.id in SAGE2Items.renderSync && SAGE2Items.renderSync[app.id].newFrameGenerated === false) {
			handleNewVideoFrame(app.id);
		}
	}
}

function wsUpdateApplicationPositionAndSize(wsio, data) {
	// should check timestamp first (data.date)
	var appId = data.appPositionAndSize.elemId;
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(appId)) {
		app = SAGE2Items.applications.list[appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + appId)) {
		data.appPositionAndSize.elemId = wsio.id + "|" + appId;
		appId = data.appPositionAndSize.elemId;
		app = SAGE2Items.applications.list[appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	var titleBarHeight = config.ui.titleBarHeight;
	if (data.portalId !== undefined && data.portalId !== null) {
		titleBarHeight = remoteSharingSessions[data.portalId].portal.titleBarHeight;
	}
	app.left = data.appPositionAndSize.elemLeft;
	app.top = data.appPositionAndSize.elemTop;
	app.width = data.appPositionAndSize.elemWidth;
	app.height = data.appPositionAndSize.elemHeight;
	var im = findInteractableManager(data.appPositionAndSize.elemId);
	im.editGeometry(app.id, "applications", "rectangle", {x: app.left, y: app.top, w: app.width, h: app.height + titleBarHeight});
	handleApplicationResize(app.id);
	broadcast('setItemPositionAndSize', data.appPositionAndSize);
	if (SAGE2Items.renderSync.hasOwnProperty(app.id)) {
		calculateValidBlocks(app, mediaBlockSize, SAGE2Items.renderSync[app.id]);
		if (app.id in SAGE2Items.renderSync && SAGE2Items.renderSync[app.id].newFrameGenerated === false) {
			handleNewVideoFrame(app.id);
		}
	}
}

function wsFinishApplicationMove(wsio, data) {
	// should check timestamp first (data.date)
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
		app = SAGE2Items.applications.list[data.appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + data.appId)) {
		data.appId = wsio.id + "|" + data.appId;
		app = SAGE2Items.applications.list[data.appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	broadcast('finishedMove', {id: data.appId, date: Date.now()});

	var eLogData = {
		type: "move",
		action: "end",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(data.id, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function wsFinishApplicationResize(wsio, data) {
	// should check timestamp first (data.date)
	var app = null;
	if (SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
		app = SAGE2Items.applications.list[data.appId];
	} else if (SAGE2Items.applications.list.hasOwnProperty(wsio.id + "|" + data.appId)) {
		data.appId = wsio.id + "|" + data.appId;
		app = SAGE2Items.applications.list[data.appId];
	}
	if (app === undefined || app === null) {
		return;
	}

	broadcast('finishedResize', {id: data.appId, date: Date.now()});

	var eLogData = {
		type: "resize",
		action: "end",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(data.id, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function wsDeleteApplication(wsio, data) {
	deleteApplication(data.appId);

	// Is that diffent ?
	// if (SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
	// 	SAGE2Items.applications.removeItem(data.appId);
	// 	var im = findInteractableManager(data.appId);
	// 	im.removeGeometry(data.appId, "applications");
	// 	broadcast('deleteElement', {elemId: data.appId});
	// }
}

function wsUpdateApplicationState(wsio, data) {
	// should check timestamp first (data.date)
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		var app = SAGE2Items.applications.list[data.id];

		// hang on to old values if movie player
		var oldTs;
		var oldPaused;
		var oldMuted;
		if (app.application === "movie_player") {
			oldTs = app.data.frame / app.data.framerate;
			oldPaused = app.data.paused;
			oldMuted = app.data.muted;
		}

		var modified = mergeObjects(data.state, app.data, ['doc_url', 'video_url', 'video_type', 'audio_url', 'audio_type']);
		if (modified === true) {
			// update video demuxer based on state
			if (app.application === "movie_player") {
				console.log("received state from remote site:", data.state);

				SAGE2Items.renderSync[app.id].loop = app.data.looped;

				var ts = app.data.frame / app.data.framerate;
				if (app.data.paused === true && ts !== oldTs) {
					SAGE2Items.renderSync[app.id].decoder.seek(ts, function() {
						// do nothing
					});
					broadcast('updateVideoItemTime', {id: app.id, timestamp: ts, play: false});
				} else {
					if (app.data.paused === true && oldPaused === false) {
						SAGE2Items.renderSync[app.id].decoder.pause(function() {
							broadcast('videoPaused', {id: app.id});
						});
					}
					if (app.data.paused === false && oldPaused === true) {
						SAGE2Items.renderSync[app.id].decoder.play();
					}
				}
				if (app.data.muted === true && oldMuted === false) {
					broadcast('videoMuted', {id: app.id});
				}
				if (app.data.muted === false && oldMuted === true) {
					broadcast('videoUnmuted', {id: app.id});
				}
			}

			// for all apps - send new state to app
			broadcast('loadApplicationState', {id: app.id, state: app.data, date: Date.now()});
		}
	}
}

function wsUpdateApplicationStateOptions(wsio, data) {
	// should check timestamp first (data.date)
	if (SAGE2Items.applications.list.hasOwnProperty(data.id)) {
		broadcast('loadApplicationOptions', {id: data.id, options: data.options});
	}
}


// **************  Widget Control Messages *****************

function wsAddNewControl(wsio, data) {
	if (!SAGE2Items.applications.list.hasOwnProperty(data.appId)) {
		return;
	}
	if (SAGE2Items.widgets.list.hasOwnProperty(data.id)) {
		return;
	}

	broadcast('createControl', data);

	var zIndex = SAGE2Items.widgets.numItems;
	var radialGeometry = {
		x: data.left + (data.height / 2),
		y: data.top + (data.height / 2),
		r: data.height / 2
	};

	if (data.hasSideBar === true) {
		var shapeData = {
			radial: {
				type: "circle",
				visible: true,
				geometry: radialGeometry
			},
			sidebar: {
				type: "rectangle",
				visible: true,
				geometry: {
					x: data.left + data.height,
					y: data.top + (data.height / 2) - (data.barHeight / 2),
					w: data.width - data.height, h: data.barHeight
				}
			}
		};
		interactMgr.addComplexGeometry(data.id, "widgets", shapeData, zIndex, data);
	} else {
		interactMgr.addGeometry(data.id, "widgets", "circle", radialGeometry, true, zIndex, data);
	}
	SAGE2Items.widgets.addItem(data);
	var uniqueID = data.id.substring(data.appId.length, data.id.lastIndexOf("_"));
	var app = SAGE2Items.applications.list[data.appId];
	addEventToUserLog(uniqueID, {type: "widgetMenu", data: {action: "open", application:
		{id: app.id, type: app.application}}, time: Date.now()});
}


function wsCloseAppFromControl(wsio, data) {
	deleteApplication(data.appId);
}

function wsHideWidgetFromControl(wsio, data) {
	var ctrl = SAGE2Items.widgets.list[data.instanceID];
	hideControl(ctrl);
}

function wsOpenRadialMenuFromControl(wsio, data) {
	console.log("radial menu");
	var ctrl = SAGE2Items.widgets.list[data.id];
	createRadialMenu(wsio.id, ctrl.left, ctrl.top);
}


function loadConfiguration() {
	var configFile = null;

	if (program.configuration) {
		configFile = program.configuration;
	} else {
		// Read config.txt - if exists and specifies a user defined config, then use it
		if (sageutils.fileExists("config.txt")) {
			var lines = fs.readFileSync("config.txt", 'utf8').split("\n");
			for (var i = 0; i < lines.length; i++) {
				var text = "";
				var comment = lines[i].indexOf("//");
				if (comment >= 0) {
					text = lines[i].substring(0, comment).trim();
				} else {
					text = lines[i].trim();
				}

				if (text !== "") {
					configFile = text;
					console.log(sageutils.header("SAGE2") + "Found configuration file: " + configFile);
					break;
				}
			}
		}
	}

	// If config.txt does not exist or does not specify any files, look for a config with the hostname
	if (configFile === null) {
		var hn  = os.hostname();
		var dot = hn.indexOf(".");
		if (dot >= 0) {
			hn = hn.substring(0, dot);
		}
		configFile = path.join("config", hn + "-cfg.json");
		if (sageutils.fileExists(configFile)) {
			console.log(sageutils.header("SAGE2") + "Found configuration file: " + configFile);
		} else {
			if (platform === "Windows") {
				configFile = path.join("config", "defaultWin-cfg.json");
			} else {
				configFile = path.join("config", "default-cfg.json");
			}
			console.log(sageutils.header("SAGE2") + "Using default configuration file: " + configFile);
		}
	}

	if (!sageutils.fileExists(configFile)) {
		console.log("\n----------");
		console.log(sageutils.header("SAGE2") + "Cannot find configuration file: " + configFile);
		console.log("----------\n\n");
		process.exit(1);
	}

	// Read the specified configuration file
	var json_str   = fs.readFileSync(configFile, 'utf8');
	// Parse it using JSON5 syntax (more lax than strict JSON)
	var userConfig = json5.parse(json_str);

	// compute extra dependent parameters
	userConfig.totalWidth  = userConfig.resolution.width  * userConfig.layout.columns;
	userConfig.totalHeight = userConfig.resolution.height * userConfig.layout.rows;

	var minDim = Math.min(userConfig.totalWidth, userConfig.totalHeight);
	var maxDim = Math.max(userConfig.totalWidth, userConfig.totalHeight);

	if (userConfig.ui.titleBarHeight) {
		userConfig.ui.titleBarHeight = parseInt(userConfig.ui.titleBarHeight, 10);
	} else {
		userConfig.ui.titleBarHeight = Math.round(0.025 * minDim);
	}

	if (userConfig.ui.widgetControlSize) {
		userConfig.ui.widgetControlSize = parseInt(userConfig.ui.widgetControlSize, 10);
	} else {
		userConfig.ui.widgetControlSize = Math.round(0.020 * minDim);
	}

	if (userConfig.ui.titleTextSize) {
		userConfig.ui.titleTextSize = parseInt(userConfig.ui.titleTextSize, 10);
	} else {
		userConfig.ui.titleTextSize  = Math.round(0.015 * minDim);
	}

	if (userConfig.ui.pointerSize) {
		userConfig.ui.pointerSize = parseInt(userConfig.ui.pointerSize, 10);
	} else {
		userConfig.ui.pointerSize = Math.round(0.08 * minDim);
	}

	if (userConfig.ui.minWindowWidth) {
		userConfig.ui.minWindowWidth = parseInt(userConfig.ui.minWindowWidth, 10);
	} else {
		userConfig.ui.minWindowWidth  = Math.round(0.08 * minDim);  // 8%
	}
	if (userConfig.ui.minWindowHeight) {
		userConfig.ui.minWindowHeight = parseInt(userConfig.ui.minWindowHeight, 10);
	} else {
		userConfig.ui.minWindowHeight = Math.round(0.08 * minDim); // 8%
	}

	if (userConfig.ui.maxWindowWidth) {
		userConfig.ui.maxWindowWidth = parseInt(userConfig.ui.maxWindowWidth, 10);
	} else {
		userConfig.ui.maxWindowWidth  = Math.round(1.2 * maxDim);  // 120%
	}
	if (userConfig.ui.maxWindowHeight) {
		userConfig.ui.maxWindowHeight = parseInt(userConfig.ui.maxWindowHeight, 10);
	} else {
		userConfig.ui.maxWindowHeight = Math.round(1.2 * maxDim); // 120%
	}

	// Check the borders settings (for hidding the borders)
	if (userConfig.dimensions === undefined) {
		userConfig.dimensions = {};
	}
	if (userConfig.dimensions.tile_borders === undefined) {
		// set default values to 0
		// first for pixel sizes
		userConfig.resolution.borders = { left: 0, right: 0, bottom: 0, top: 0};
		// then for dimensions
		userConfig.dimensions.tile_borders = { left: 0.0, right: 0.0, bottom: 0.0, top: 0.0};
	} else {
		var borderLeft, borderRight, borderBottom, borderTop, tileWidth;
		// make sure the values are valid floats
		borderLeft   = parseFloat(userConfig.dimensions.tile_borders.left)   || 0.0;
		borderRight  = parseFloat(userConfig.dimensions.tile_borders.right)  || 0.0;
		borderBottom = parseFloat(userConfig.dimensions.tile_borders.bottom) || 0.0;
		borderTop    = parseFloat(userConfig.dimensions.tile_borders.top)    || 0.0;
		tileWidth    = parseFloat(userConfig.dimensions.tile_width) || 0.0;
		// calculate pixel density (ppm) based on width
		var pixelsPerMeter = userConfig.resolution.width / tileWidth;
		// calculate values in pixel now
		userConfig.resolution.borders = {};
		userConfig.resolution.borders.left   = Math.round(pixelsPerMeter * borderLeft)   || 0;
		userConfig.resolution.borders.right  = Math.round(pixelsPerMeter * borderRight)  || 0;
		userConfig.resolution.borders.bottom = Math.round(pixelsPerMeter * borderBottom) || 0;
		userConfig.resolution.borders.top    = Math.round(pixelsPerMeter * borderTop)    || 0;
	}

	// Set default values if missing
	if (userConfig.port === undefined) {
		userConfig.port = 443;
	} else {
		userConfig.port = parseInt(userConfig.port, 10); // to make sure it's a number
	}
	if (userConfig.index_port === undefined) {
		userConfig.index_port = 80;
	} else {
		userConfig.index_port = parseInt(userConfig.index_port, 10);
	}

	// Set the display clip value if missing (true by default)
	if (userConfig.background.clip !== undefined) {
		userConfig.background.clip = sageutils.isTrue(userConfig.background.clip);
	} else {
		userConfig.background.clip = true;
	}

	// Registration to EVL's server (sage.evl.uic.edu), true by default
	if (userConfig.register_site === undefined) {
		userConfig.register_site = true;
	} else {
		// test for a true value: true, on, yes, 1, ...
		if (sageutils.isTrue(userConfig.register_site)) {
			userConfig.register_site = true;
		} else {
			userConfig.register_site = false;
		}
	}

	return userConfig;
}


var getUniqueAppId = (function() {
	var count = 0;
	return function() {
		var id = "app_" + count.toString();
		count++;
		return id;
	};
})();

var getNewUserId = (function() {
	var count = 0;
	return function() {
		var id = "usr_" + count.toString();
		count++;
		return id;
	};
})();

function getUniqueDataSharingId(remoteHost, remotePort, caller) {
	var id;
	if (caller === true) {
		id = config.host + ":" + config.port + "+" + remoteHost + ":" + remotePort;
	} else {
		id = remoteHost + ":" + remotePort + "+" + config.host + ":" + config.port;
	}
	return "portal_" + id;
}

function getUniqueSharedAppId(portalId) {
	return "app_" + remoteSharingSessions[portalId].appCount + "_" + portalId;
}

function getApplications() {
	var uploadedApps = assets.listApps();

	// Remove 'viewer' apps
	var i = uploadedApps.length;
	while (i--) {
		if (uploadedApps[i].exif.metadata.fileTypes &&
			uploadedApps[i].exif.metadata.fileTypes.length > 0) {
			uploadedApps.splice(i, 1);
		}
	}
	// Sort the list of apps
	uploadedApps.sort(sageutils.compareTitle);

	return uploadedApps;
}

function getSavedFilesList() {
	// Build lists of assets
	var uploadedImages = assets.listImages();
	var uploadedVideos = assets.listVideos();
	var uploadedPdfs   = assets.listPDFs();
	var savedSessions  = listSessions();
	var uploadedApps   = getApplications();

	// Sort independently of case
	uploadedImages.sort(sageutils.compareFilename);
	uploadedVideos.sort(sageutils.compareFilename);
	uploadedPdfs.sort(sageutils.compareFilename);
	savedSessions.sort(sageutils.compareFilename);

	var list = {images: uploadedImages, videos: uploadedVideos, pdfs: uploadedPdfs,
				sessions: savedSessions, applications: uploadedApps};

	return list;
}

function setupDisplayBackground() {
	var tmpImg, imgExt;

	// background image
	if (config.background.image !== undefined && config.background.image.url !== undefined) {
		var bg_file = path.join(publicDirectory, config.background.image.url);

		if (config.background.image.style === "tile") {
			// do nothing
			return;
		} else if (config.background.image.style === "fit") {
			exiftool.file(bg_file, function(err1, data) {
				if (err1) {
					console.log("Error processing background image:", bg_file, err1);
					console.log(" ");
					process.exit(1);
				}
				var bg_info = data;

				if (bg_info.ImageWidth === config.totalWidth && bg_info.ImageHeight === config.totalHeight) {
					sliceBackgroundImage(bg_file, bg_file);
				} else {
					tmpImg = path.join(publicDirectory, "images", "background", "tmp_background.png");
					var out_res  = config.totalWidth.toString() + "x" + config.totalHeight.toString();

					imageMagick(bg_file).noProfile().command("convert").in("-gravity", "center").in("-background", "rgba(0,0,0,0)")
						.in("-extent", out_res).write(tmpImg, function(err2) {
							if (err2) {
								throw err2;
							}
							sliceBackgroundImage(tmpImg, bg_file);
						});
				}
			});
		} else {
			config.background.image.style = "stretch";
			imgExt = path.extname(bg_file);
			tmpImg = path.join(publicDirectory, "images", "background", "tmp_background" + imgExt);

			imageMagick(bg_file).resize(config.totalWidth, config.totalHeight, "!").write(tmpImg, function(err) {
				if (err) {
					throw err;
				}

				sliceBackgroundImage(tmpImg, bg_file);
			});
		}
	}
}

function sliceBackgroundImage(fileName, outputBaseName) {
	for (var i = 0; i < config.displays.length; i++) {
		var x = config.displays[i].column * config.resolution.width;
		var y = config.displays[i].row * config.resolution.height;
		var output_dir  = path.dirname(outputBaseName);
		var input_ext   = path.extname(outputBaseName);
		var output_ext  = path.extname(fileName);
		var output_base = path.basename(outputBaseName, input_ext);
		var output = path.join(output_dir, output_base + "_" + i.toString() + output_ext);
		imageMagick(fileName).crop(config.resolution.width, config.resolution.height, x, y).write(output, function(err) {
			if (err) {
				console.log("error slicing image", err); // throw err;
			}
		});
	}
}

function setupHttpsOptions() {
	// build a list of certs to support multi-homed computers
	var certs = {};

	// file caching for the main key of the server
	var server_key = null;
	var server_crt = null;
	var server_ca  = [];

	// add the default cert from the hostname specified in the config file
	try {
		// first try the filename based on the hostname-server.key
		if (sageutils.fileExists(path.join("keys", config.host + "-server.key"))) {
			// Load the certificate files
			console.log(sageutils.header("Certificate") + "Loading certificate " + config.host + "-server.key");
			server_key = fs.readFileSync(path.join("keys", config.host + "-server.key"));
			server_crt = fs.readFileSync(path.join("keys", config.host + "-server.crt"));
			server_ca  = sageutils.loadCABundle(path.join("keys", config.host + "-ca.crt"));
			// Build the crypto
			certs[config.host] = sageutils.secureContext(server_key, server_crt, server_ca);
		} else {
			// remove the hostname from the FQDN and search for wildcard certificate
			//    syntax: _.rest.com.key or _.rest.bigger.com.key
			var domain = '_.' + config.host.split('.').slice(1).join('.');
			console.log(sageutils.header("Certificate") + "Loading domain certificate " + domain + ".key");
			server_key = fs.readFileSync(path.join("keys", domain + ".key"));
			server_crt = fs.readFileSync(path.join("keys", domain + ".crt"));
			server_ca  = sageutils.loadCABundle(path.join("keys", domain + "-ca.crt"));
			certs[config.host] = sageutils.secureContext(server_key, server_crt, server_ca);
		}
	}
	catch (e) {
		console.log("\n----------");
		console.log("Cannot open certificate for default host:");
		console.log(" \"" + config.host + "\" needs file: " + e.path);
		console.log(" --> Please generate the appropriate certificate in the 'keys' folder");
		console.log("----------\n\n");
		process.exit(1);
	}

	for (var h in config.alternate_hosts) {
		try {
			var alth = config.alternate_hosts[h];
			certs[ alth ] = sageutils.secureContext(
				fs.readFileSync(path.join("keys", alth + "-server.key")),
				fs.readFileSync(path.join("keys", alth + "-server.crt")),
				sageutils.loadCABundle(path.join("keys", alth + "-ca.crt"))
			);
		}
		catch (e) {
			console.log("\n----------");
			console.log("Cannot open certificate for the alternate host: ", config.alternate_hosts[h]);
			console.log(" needs file: \"" + e.path + "\"");
			console.log(" --> Please generate the appropriate certificates in the 'keys' folder");
			console.log(" Ignoring alternate host: ", config.alternate_hosts[h]);
			console.log("----------\n");
		}
	}

	var httpsOptions;

	if (sageutils.nodeVersion === 10) {
		httpsOptions = {
			// server default keys
			key:  server_key,
			cert: server_crt,
			ca:   server_ca,
			// If true the server will request a certificate from clients that connect and attempt to verify that certificate
			requestCert: false,
			rejectUnauthorized: false,
			// callback to handle multi-homed machines
			SNICallback: function(servername) {
				if (certs.hasOwnProperty(servername)) {
					return certs[servername];
				} else {
					console.log(sageutils.header("SNI") + "Unknown host, cannot find a certificate for ", servername);
					return null;
				}
			}
		};
	} else {
		httpsOptions = {
			// server default keys
			key:  server_key,
			cert: server_crt,
			ca:   server_ca,
			// If true the server will request a certificate from clients that connect and attempt to verify that certificate
			requestCert: false,
			rejectUnauthorized: false,
			// callback to handle multi-homed machines
			SNICallback: function(servername, cb) {
				if (certs.hasOwnProperty(servername)) {
					cb(null, certs[servername]);
				} else {
					console.log(sageutils.header("SNI") + "Unknown host, cannot find a certificate for ", servername);
					cb("SNI Unknown host", null);
				}
			}
		};
	}

	return httpsOptions;
}

function sendConfig(req, res) {
	res.writeHead(200, {"Content-Type": "text/plain"});
	// Adding the calculated version into the data structure
	config.version = SAGE2_version;
	res.write(JSON.stringify(config));
	res.end();
}

function uploadForm(req, res) {
	var form     = new formidable.IncomingForm();
	var position = [ 0, 0 ];
	// Limits the amount of memory all fields together (except files) can allocate in bytes.
	//    set to 4MB.
	form.maxFieldsSize = 4 * 1024 * 1024;
	form.type          = 'multipart';
	form.multiples     = true;

	form.on('fileBegin', function(name, file) {
		// console.log(sageutils.header("Upload") + 'begin ' + name + ' ' + file.name + ' ' + file.type);
	});

	form.on('field', function(field, value) {
		// convert value [0 to 1] to wall coordinate from drop location
		if (field === 'dropX') {
			position[0] = parseInt(parseFloat(value) * config.totalWidth,  10);
		}
		if (field === 'dropY') {
			position[1] = parseInt(parseFloat(value) * config.totalHeight, 10);
		}
	});

	form.parse(req, function(err, fields, files) {
		if (err) {
			res.writeHead(500, {"Content-Type": "text/plain"});
			res.write(err + "\n\n");
			res.end();
		}
		// build the reply to the upload
		res.writeHead(200, {'Content-Type': 'application/json'});
		// For webix uploader: status: server
		fields.done = true;

		// Get the file (only one even if multiple drops, it comes one by one)
		var file = files[ Object.keys(files)[0] ];
		var app = registry.getDefaultApp(file.name);
		if (app === undefined || app === "") {
			fields.good = false;
		} else {
			fields.good = true;
		}
		// Send the reply
		res.end(JSON.stringify({status: 'server',
			fields: fields, files: files}));
	});

	form.on('end', function() {
		// saves files in appropriate directory and broadcasts the items to the displays
		manageUploadedFiles(this.openedFiles, position);
	});
}

function manageUploadedFiles(files, position) {
	var fileKeys = Object.keys(files);
	fileKeys.forEach(function(key) {
		var file = files[key];
		appLoader.manageAndLoadUploadedFile(file, function(appInstance, videohandle) {

			if (appInstance === null) {
				console.log(sageutils.header("Upload") + 'unrecognized file type: ' + file.name + ' ' + file.type);
				return;
			}

			// Use the position from the drop location
			if (position[0] !== 0 || position[1] !== 0) {
				appInstance.left = position[0] - appInstance.width / 2;
				if (appInstance.left < 0) {
					appInstance.left = 0;
				}
				appInstance.top  = position[1] - appInstance.height / 2;
				if (appInstance.top < 0) {
					appInstance.top = 0;
				}
			}

			appInstance.id = getUniqueAppId();
			if (appInstance.animation) {
				var i;
				SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
				for (i = 0; i < clients.length; i++) {
					if (clients[i].clientType === "display") {
						SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
					}
				}
			}
			handleNewApplication(appInstance, videohandle);

			// send the update file list
			broadcast('storedFileList', getSavedFilesList());
		});
	});
}


// **************  Remote Site Collaboration *****************

var remoteSites = [];
if (config.remote_sites) {
	remoteSites = new Array(config.remote_sites.length);
	config.remote_sites.forEach(function(element, index, array) {
		var protocol = (element.secure === true) ? "wss" : "ws";
		var wsURL = protocol + "://" + element.host + ":" + element.port.toString();

		var remote = createRemoteConnection(wsURL, element, index);

		var rGeom = {};
		rGeom.w = Math.min((0.5 * config.totalWidth) / remoteSites.length, config.ui.titleBarHeight * 6)
			- (0.16 * config.ui.titleBarHeight);
		rGeom.h = 0.84 * config.ui.titleBarHeight;
		rGeom.x = (0.5 * config.totalWidth) + ((rGeom.w + (0.16 * config.ui.titleBarHeight)) * (index - (remoteSites.length / 2)))
			+ (0.08 * config.ui.titleBarHeight);
		rGeom.y = 0.08 * config.ui.titleBarHeight;

		remoteSites[index] = {name: element.name, wsio: remote, connected: false, geometry: rGeom};
		interactMgr.addGeometry("remote_" + index, "staticUI", "rectangle", rGeom,  true, index, remoteSites[index]);

		// attempt to connect every 15 seconds, if connection failed
		setInterval(function() {
			if (!remoteSites[index].connected) {
				var rem = createRemoteConnection(wsURL, element, index);
				remoteSites[index].wsio = rem;
			}
		}, 15000);
	});
}

function createRemoteConnection(wsURL, element, index) {
	var remote = new WebsocketIO(wsURL, false, function() {
		console.log(sageutils.header("Remote") + "Connected to " + element.name);
		remote.updateRemoteAddress(element.host, element.port);
		var clientDescription = {
			clientType: "remoteServer",
			host: config.host,
			port: config.port,
			requests: {
				config: false,
				version: false,
				time: false,
				console: false
			}
		};
		remote.clientType = "remoteServer";

		remote.onclose(function() {
			console.log("Remote site \"" + config.remote_sites[index].name + "\" now offline");
			remoteSites[index].connected = false;
			var delete_site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
			broadcast('connectedToRemoteSite', delete_site);
			removeElement(clients, remote);
		});

		remote.on('addClient',                              wsAddClient);
		remote.on('addNewElementFromRemoteServer',          wsAddNewElementFromRemoteServer);
		remote.on('addNewSharedElementFromRemoteServer',    wsAddNewSharedElementFromRemoteServer);
		remote.on('requestNextRemoteFrame',                 wsRequestNextRemoteFrame);
		remote.on('updateRemoteMediaStreamFrame',           wsUpdateRemoteMediaStreamFrame);
		remote.on('stopMediaStream',                        wsStopMediaStream);
		remote.on('requestNextRemoteBlockFrame',            wsRequestNextRemoteBlockFrame);
		remote.on('updateRemoteMediaBlockStreamFrame',      wsUpdateRemoteMediaBlockStreamFrame);
		remote.on('stopMediaBlockStream',                   wsStopMediaBlockStream);
		remote.on('requestDataSharingSession',              wsRequestDataSharingSession);
		remote.on('cancelDataSharingSession',               wsCancelDataSharingSession);
		remote.on('acceptDataSharingSession',               wsAcceptDataSharingSession);
		remote.on('rejectDataSharingSession',               wsRejectDataSharingSession);
		remote.on('createRemoteSagePointer',                wsCreateRemoteSagePointer);
		remote.on('startRemoteSagePointer',                 wsStartRemoteSagePointer);
		remote.on('stopRemoteSagePointer',                  wsStopRemoteSagePointer);
		remote.on('remoteSagePointerPosition',              wsRemoteSagePointerPosition);
		remote.on('remoteSagePointerToggleModes',           wsRemoteSagePointerToggleModes);
		remote.on('remoteSagePointerHoverCorner',           wsRemoteSagePointerHoverCorner);
		remote.on('addNewRemoteElementInDataSharingPortal', wsAddNewRemoteElementInDataSharingPortal);

		remote.on('updateApplicationOrder',                 wsUpdateApplicationOrder);
		remote.on('startApplicationMove',                   wsStartApplicationMove);
		remote.on('startApplicationResize',                 wsStartApplicationResize);
		remote.on('updateApplicationPosition',              wsUpdateApplicationPosition);
		remote.on('updateApplicationPositionAndSize',       wsUpdateApplicationPositionAndSize);
		remote.on('finishApplicationMove',                  wsFinishApplicationMove);
		remote.on('finishApplicationResize',                wsFinishApplicationResize);
		remote.on('deleteApplication',                      wsDeleteApplication);
		remote.on('updateApplicationState',                 wsUpdateApplicationState);
		remote.on('updateApplicationStateOptions',          wsUpdateApplicationStateOptions);

		remote.emit('addClient', clientDescription);
		remoteSites[index].connected = true;
		var new_site = {name: remoteSites[index].name, connected: remoteSites[index].connected};
		broadcast('connectedToRemoteSite', new_site);
		clients.push(remote);
	});

	return remote;
}

// **************  System Time - Updated Every Minute *****************
var cDate = new Date();
setTimeout(function() {
	setInterval(function() {
		broadcast('setSystemTime', {date: Date.now()});
	}, 60000);

	broadcast('setSystemTime', {date: Date.now()});
}, (61 - cDate.getSeconds()) * 1000);


// ***************************************************************************************

// Place callback for success in the 'listen' call for HTTPS

sage2ServerS.on('listening', function(e) {
	// Success
	console.log(sageutils.header("SAGE2") + "Serving secure clients at https://" + config.host + ":" + config.port);
	console.log(sageutils.header("SAGE2") + "Web console at https://" + config.host + ":" + config.port + "/admin/console.html");
});

// Place callback for errors in the 'listen' call for HTTP
sage2Server.on('error', function(e) {
	if (e.code === 'EACCES') {
		console.log(sageutils.header("HTTP_Server") + "You are not allowed to use the port: ", config.index_port);
		console.log(sageutils.header("HTTP_Server") + "  use a different port or get authorization (sudo, setcap, ...)");
		console.log(" ");
		process.exit(1);
	} else if (e.code === 'EADDRINUSE') {
		console.log(sageutils.header("HTTP_Server") + "The port is already in use by another process:", config.index_port);
		console.log(sageutils.header("HTTP_Server") + "  use a different port or stop the offending process");
		console.log(" ");
		process.exit(1);
	} else {
		console.log(sageutils.header("HTTP_Server") + "Error in the listen call: ", e.code);
		console.log(" ");
		process.exit(1);
	}
});

// Place callback for success in the 'listen' call for HTTP
sage2Server.on('listening', function(e) {
	// Success
	var ui_url = "http://" + config.host + ":" + config.index_port;
	var dp_url = "http://" + config.host + ":" + config.index_port + "/display.html?clientID=0";
	var am_url = "http://" + config.host + ":" + config.index_port + "/audioManager.html";
	if (global.__SESSION_ID) {
		ui_url = "http://" + config.host + ":" + config.index_port + "/session.html?hash=" + global.__SESSION_ID;
		dp_url = "http://" + config.host + ":" + config.index_port + "/session.html?page=display.html?clientID=0&hash="
			+ global.__SESSION_ID;
		am_url = "http://" + config.host + ":" + config.index_port + "/session.html?page=audioManager.html&hash="
			+ global.__SESSION_ID;
	}
	console.log(sageutils.header("SAGE2") + "Serving web UI at " + ui_url);
	console.log(sageutils.header("SAGE2") + "Display 0 at "      + dp_url);
	console.log(sageutils.header("SAGE2") + "Audio manager at "  + am_url);
});

// KILL intercept
process.on('SIGTERM', quitSAGE2);
// CTRL-C intercept
process.on('SIGINT',  quitSAGE2);


// Start the HTTP server (listen for IPv4 addresses 0.0.0.0)
sage2Server.listen(config.index_port, "0.0.0.0");
// Start the HTTPS server (listen for IPv4 addresses 0.0.0.0)
sage2ServerS.listen(config.port, "0.0.0.0");


// ***************************************************************************************

// Load session file if specified on the command line (-s)
if (program.session) {
	setTimeout(function() {
		// if -s specified without argument
		if (program.session === true) {
			loadSession();
		} else {
			// if argument specified
			loadSession(program.session);
		}
	}, 1000);
}

function getSAGE2Path(getName) {
	// pathname: result of the search
	var pathname = null;
	// walk through the list of folders
	for (var f in mediaFolders) {
		// Get the folder object
		var folder = mediaFolders[f];
		// Look for the folder url in the request
		var pubdir = getName.split(folder.url);
		if (pubdir.length === 2) {
			// convert the URL into a path
			var suburl = path.join('.', pubdir[1]);
			pathname   = url.resolve(folder.path, suburl);
			pathname   = decodeURIComponent(pathname);
			break;
		}
	}
	// if everything fails, look in the default public folder
	if (!pathname) {
		pathname = getName;
	}
	return pathname;
}


function processInputCommand(line) {
	// split the command line at whitespace(s)
	var command = line.trim().split(/[\s]+/);
	switch (command[0]) {
		case '': {
			// ignore
			break;
		}
		case 'help': {
			console.log('help\t\tlist commands');
			console.log('kill\t\tclose application: appid');
			console.log('apps\t\tlist running applications');
			console.log('clients\t\tlist connected clients');
			console.log('streams\t\tlist media streams');
			console.log('clear\t\tclose all running applications');
			console.log('tile\t\tlayout all running applications');
			console.log('fullscreen\tmaximize one application: appid');
			console.log('save\t\tsave state of running applications into a session');
			console.log('load\t\tload a session and restore applications');
			console.log('open\t\topen a file: open file_url [0.5, 0.5]');
			console.log('resize\t\tresize a window: appid width height');
			console.log('moveby\t\tshift a window: appid dx dy');
			console.log('moveto\t\tmove a window: appid x y');
			console.log('assets\t\tlist the assets in the file library');
			console.log('regenerate\tregenerates the assets');
			console.log('hideui\t\thide/show/delay the user interface');
			console.log('sessions\tlist the available sessions');
			console.log('update\t\trun a git update');
			console.log('version\t\tprint SAGE2 version');
			console.log('exit\t\tstop SAGE2');
			break;
		}
		case 'version': {
			console.log(sageutils.header("Version") + 'base:', SAGE2_version.base, ' branch:', SAGE2_version.branch,
					' commit:', SAGE2_version.commit, SAGE2_version.date);
			break;
		}
		case 'update': {
			if (SAGE2_version.branch.length > 0) {
				sageutils.updateWithGIT(SAGE2_version.branch, function(error, success) {
					if (error) {
						console.log(sageutils.header('GIT') + 'Update error - ' + error);
					} else {
						console.log(sageutils.header('GIT') + 'Update success - ' + success);
					}
				});
			} else {
				console.log(sageutils.header("Update") + "failed: not linked to any repository");
			}
			break;
		}
		case 'save': {
			if (command[1] !== undefined) {
				saveSession(command[1]);
			} else {
				saveSession();
			}
			break;
		}
		case 'load': {
			if (command[1] !== undefined) {
				loadSession(command[1]);
			} else {
				loadSession();
			}
			break;
		}
		case 'open': {
			if (command[1] !== undefined) {
				var pos  = [0.0, 0.0];
				var file = command[1];
				if (command.length === 4) {
					pos = [parseFloat(command[2]), parseFloat(command[3])];
				}
				var mt = assets.getMimeType(getSAGE2Path(file));
				if (mt === "application/custom") {
					wsLoadApplication(null,
						{application: file,
						user: "127.0.0.1:42",
						position: pos});
				} else {
					wsLoadFileFromServer(null, {application: "something",
						filename: file,
						user: "127.0.0.1:42",
						position: pos});
				}
			} else {
				console.log(sageutils.header("Command") + "should be: open /user/file.pdf [0.5 0.5]");
			}
			break;
		}
		case 'sessions': {
			printListSessions();
			break;
		}
		case 'moveby': {
			// command: moveby appid dx dy (relative, in pixels)
			if (command.length === 4) {
				var dx = parseFloat(command[2]);
				var dy = parseFloat(command[3]);
				wsAppMoveBy(null, {id: command[1], dx: dx, dy: dy});
			} else {
				console.log(sageutils.header("Command") + "should be: moveby app_0 10 10");
			}
			break;
		}
		case 'moveto': {
			// command: moveti appid x y (absolute, in pixels)
			if (command.length === 4) {
				var xx = parseFloat(command[2]);
				var yy = parseFloat(command[3]);
				wsAppMoveTo(null, {id: command[1], x: xx, y: yy});
			} else {
				console.log(sageutils.header("Command") + "should be: moveto app_0 100 100");
			}
			break;
		}
		case 'resize': {
			var ww, hh;
			// command: resize appid width height (force exact resize)
			// command: resize appid width  (keep aspect ratio)
			if (command.length === 4) {
				ww = parseFloat(command[2]);
				hh = parseFloat(command[3]);
				wsAppResize(null, {id: command[1], width: ww, height: hh, keepRatio: false});
				console.log(sageutils.header("Command") + "resizing exactly to " + ww + "x" + hh);
			} else if (command.length === 3) {
				ww = parseFloat(command[2]);
				hh = 0;
				wsAppResize(null, {id: command[1], width: ww, height: hh, keepRatio: true});
			} else {
				console.log(sageutils.header("Command") + "should be: resize app_0 800 600");
			}
			break;
		}
		case 'hideui': {
			// if argument provided, used as auto_hide delay in second
			//   otherwise, it flips a switch
			if (command[1] !== undefined) {
				broadcast('hideui', {delay: parseInt(command[1], 10)});
			} else {
				broadcast('hideui', null);
			}
			break;
		}
		case 'close':
		case 'delete':
		case 'kill': {
			if (command.length > 1 && typeof command[1] === "string") {
				deleteApplication(command[1]);
			}
			break;
		}
		case 'fullscreen': {
			if (command.length > 1 && typeof command[1] === "string") {
				wsFullscreen(null, {id: command[1]});
			} else {
				console.log(sageutils.header("Command") + "should be: fullscreen app_0");
			}
			break;
		}
		case 'clear': {
			clearDisplay();
			break;
		}
		case 'assets': {
			assets.listAssets();
			break;
		}
		case 'regenerate': {
			assets.regenerateAssets();
			break;
		}
		case 'tile': {
			tileApplications();
			break;
		}
		case 'clients': {
			listClients();
			break;
		}
		case 'apps': {
			listApplications();
			break;
		}
		case 'streams': {
			listMediaStreams();
			break;
		}
		case 'blockStreams': {
			listMediaBlockStreams();
			break;
		}
		case 'exit':
		case 'quit':
		case 'bye': {
			quitSAGE2();
			break;
		}
		default: {
			console.log('Say what? I might have heard `' + line.trim() + '`');
			break;
		}
	}
}

// Command loop: reading input commands - SHOULD MOVE LATER: INSIDE CALLBACK AFTER SERVER IS LISTENING
if (program.interactive) {
	// Create line reader for stdin and stdout
	var shell = readline.createInterface({
		input:  process.stdin, output: process.stdout
	});

	// Set the prompt
	shell.setPrompt("> ");

	// Callback for each line
	shell.on('line', function(line) {
		processInputCommand(line);
		shell.prompt();
	}).on('close', function() {
		// Saving stuff
		quitSAGE2();
	});
}


// ***************************************************************************************

function formatDateToYYYYMMDD_HHMMSS(date) {
	var year   = date.getFullYear();
	var month  = date.getMonth() + 1;
	var day    = date.getDate();
	var hour   = date.getHours();
	var minute = date.getMinutes();
	var second = date.getSeconds();

	year   = year.toString();
	month  = month >= 10 ? month.toString() : "0" + month.toString();
	day    = day >= 10 ? day.toString() : "0" + day.toString();
	hour   = hour >= 10 ? hour.toString() : "0" + hour.toString();
	minute = minute >= 10 ? minute.toString() : "0" + minute.toString();
	second = second >= 10 ? second.toString() : "0" + second.toString();

	return year + "-" + month + "-" + day + "_" + hour + "-" + minute + "-" + second;
}

function quitSAGE2() {
	if (config.register_site) {
		// de-register with EVL's server
		sageutils.deregisterSAGE2(config, function() {
			saveUserLog();
			saveSession();
			assets.saveAssets();
			if (omicronRunning) {
				omicronManager.disconnect();
			}
			process.exit(0);
		});
	} else {
		saveUserLog();
		saveSession();
		assets.saveAssets();
		if (omicronRunning) {
			omicronManager.disconnect();
		}
		process.exit(0);
	}
}

function findRemoteSiteByConnection(wsio) {
	var remoteIdx = -1;
	for (var i = 0; i < config.remote_sites.length; i++) {
		if (wsio.remoteAddress.address === config.remote_sites[i].host &&
			wsio.remoteAddress.port === config.remote_sites[i].port) {
			remoteIdx = i;
		}
	}
	if (remoteIdx >= 0) {
		return remoteSites[remoteIdx];
	} else {
		return null;
	}
}

function hideControl(ctrl) {
	if (ctrl.show === true) {
		ctrl.show = false;
		broadcast('hideControl', {id: ctrl.id, appId: ctrl.appId});
		interactMgr.editVisibility(ctrl.id, "widgets", false);
	}
}

function removeControlsForUser(uniqueID) {
	var widgets = SAGE2Items.widgets.list;
	for (var w in widgets) {
		if (widgets.hasOwnProperty(w) && widgets[w].id.indexOf(uniqueID) > -1) {
			interactMgr.removeGeometry(widgets[w].id, "widgets");
			SAGE2Items.widgets.removeItem(widgets[w].id);
		}
	}
	broadcast('removeControlsForUser', {user_id: uniqueID});
}

function showControl(ctrl, uniqueID, pointerX, pointerY) {
	if (ctrl.show === false) {
		ctrl.show = true;
		interactMgr.editVisibility(ctrl.id, "widgets", true);
		moveControlToPointer(ctrl, uniqueID, pointerX, pointerY);
		broadcast('showControl', {id: ctrl.id, appId: ctrl.appId,
			user_color: sagePointers[uniqueID] ? sagePointers[uniqueID].color: null});
	}
}

function moveControlToPointer(ctrl, uniqueID, pointerX, pointerY) {
	var dt = new Date();
	var rightMargin = config.totalWidth - ctrl.width;
	var bottomMargin = config.totalHeight - ctrl.height;
	ctrl.left = (pointerX > rightMargin) ? rightMargin : pointerX - ctrl.height / 2;
	ctrl.top = (pointerY > bottomMargin) ? bottomMargin : pointerY - ctrl.height / 2;
	var radialGeometry = {
		x: ctrl.left + (ctrl.height / 2),
		y: ctrl.top + (ctrl.height / 2),
		r: ctrl.height / 2
	};
	if (ctrl.hasSideBar === true) {
		var shapeData = {
			radial: {
				type: "circle",
				visible: true,
				geometry: radialGeometry
			},
			sidebar: {
				type: "rectangle",
				visible: true,
				geometry: {
					x: ctrl.left + ctrl.height,
					y: ctrl.top + (ctrl.height / 2) - (ctrl.barHeight / 2),
					w: ctrl.width - ctrl.height, h: ctrl.barHeight
				}
			}
		};
		interactMgr.editComplexGeometry(ctrl.id, "widgets", shapeData);
	} else {
		interactMgr.editGeometry(ctrl.id, "widgets", "circle", radialGeometry);
	}

	var app = SAGE2Items.applications.list[ctrl.appId];
	var appPos = (app === null)? null : getAppPositionSize(app);
	broadcast('setControlPosition', {date: dt, elemId: ctrl.id, elemLeft: ctrl.left, elemTop: ctrl.top,
		elemHeight: ctrl.height, appData: appPos});
}

function initializeArray(size, val) {
	var arr = new Array(size);
	for (var i = 0; i < size; i++) {
		arr[i] = val;
	}
	return arr;
}

function allNonBlank(arr) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i] === "") {
			return false;
		}
	}
	return true;
}

function allTrueDict(dict, property) {
	var key;
	for (key in dict) {
		if (property === undefined && dict[key] !== true) {
			return false;
		} else {
			if (property !== undefined && dict[key][property] !== true) {
				return false;
			}
		}
	}
	return true;
}

function removeElement(list, elem) {
	if (list.indexOf(elem) >= 0) {
		moveElementToEnd(list, elem);
		list.pop();
	}
}

function moveElementToEnd(list, elem) {
	var i;
	var pos = list.indexOf(elem);
	if (pos < 0) {
		return;
	}
	for (i = pos; i < list.length - 1; i++) {
		list[i] = list[i + 1];
	}
	list[list.length - 1] = elem;
}

function intToByteBuffer(aInt, bytes) {
	var buf = new Buffer(bytes);
	var byteVal;
	var num = aInt;
	for (var i = 0; i < bytes; i++) {
		byteVal = num & 0xff;
		buf[i] = byteVal;
		num = (num - byteVal) / 256;
	}

	return buf;
}

function byteBufferToString(buf) {
	var str = "";
	var i = 0;

	while (buf[i] !== 0 && i < buf.length) {
		str += String.fromCharCode(buf[i]);
		i++;
	}

	return str;
}

function mergeObjects(a, b, ignore) {
	var ig = ignore || [];
	var modified = false;
	// test in case of old sessions
	if (a === undefined || b === undefined) {
		return modified;
	}
	for (var key in b) {
		if (a[key] !== undefined && ig.indexOf(key) < 0) {
			var aRecurse = (a[key] === null || a[key] instanceof Array || typeof a[key] !== "object") ? false : true;
			var bRecurse = (b[key] === null || b[key] instanceof Array || typeof b[key] !== "object") ? false : true;
			if (aRecurse && bRecurse) {
				modified = mergeObjects(a[key], b[key]) || modified;
			} else if (!aRecurse && !bRecurse && a[key] !== b[key]) {
				b[key] = a[key];
				modified = true;
			}
		}
	}
	return modified;
}

function addEventToUserLog(id, data) {
	var key;
	for (key in users) {
		if (users[key].ip && users[key].ip === id) {
			users[key].actions.push(data);
		}
	}
}

function getAppPositionSize(appInstance) {
	return {
		id:          appInstance.id,
		application: appInstance.application,
		left:        appInstance.left,
		top:         appInstance.top,
		width:       appInstance.width,
		height:      appInstance.height,
		icon:        appInstance.icon || null,
		title:       appInstance.title,
		color:       appInstance.color || null
	};
}

// **************  Pointer Functions *****************

function createSagePointer(uniqueID, portal) {
	// From addClient type == sageUI
	sagePointers[uniqueID] = new Sagepointer(uniqueID + "_pointer");
	sagePointers[uniqueID].portal = portal;
	remoteInteraction[uniqueID] = new Interaction(config);
	remoteInteraction[uniqueID].local = portal ? false : true;

	broadcast('createSagePointer', sagePointers[uniqueID]);
}

function showPointer(uniqueID, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	console.log(sageutils.header("Pointer") + "starting: " + uniqueID);

	if (data.sourceType === undefined) {
		data.sourceType = "Pointer";
	}

	sagePointers[uniqueID].start(data.label, data.color, data.sourceType);
	broadcast('showSagePointer', sagePointers[uniqueID]);
}

function hidePointer(uniqueID) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	console.log(sageutils.header("Pointer") + "stopping: " + uniqueID);

	sagePointers[uniqueID].stop();
	var prevInteractionItem = remoteInteraction[uniqueID].getPreviousInteractionItem();
	if (prevInteractionItem !== null) {
		showOrHideWidgetLinks({uniqueID: uniqueID, show: false, item: prevInteractionItem});
		remoteInteraction[uniqueID].setPreviousInteractionItem(null);
	}
	broadcast('hideSagePointer', sagePointers[uniqueID]);
}


function globalToLocal(globalX, globalY, type, geometry) {
	var local = {};
	if (type === "circle") {
		local.x = globalX - (geometry.x - geometry.r);
		local.y = globalY - (geometry.y - geometry.r);
	} else {
		local.x = globalX - geometry.x;
		local.y = globalY - geometry.y;
	}

	return local;
}

function pointerPress(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	// Middle click changes interaction mode
	if (data.button === "middle") {
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode});
	}

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

	if (obj === null) {
		pointerPressOnOpenSpace(uniqueID, pointerX, pointerY, data);
		return;
	}
	var prevInteractionItem = remoteInteraction[uniqueID].getPreviousInteractionItem();
	var color = sagePointers[uniqueID]? sagePointers[uniqueID].color : null;
	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);

	switch (obj.layerId) {
		case "staticUI": {
			pointerPressOnStaticUI(uniqueID, pointerX, pointerY, data, obj, localPt);
			break;
		}
		case "radialMenus": {
			pointerPressOnRadialMenu(uniqueID, pointerX, pointerY, data, obj, localPt, color);
			break;
		}
		case "widgets": {
			if (prevInteractionItem === null) {
				remoteInteraction[uniqueID].pressOnItem(obj);
				showOrHideWidgetLinks({uniqueID: uniqueID, item: obj, user_color: color, show: true});
			}
			pointerPressOrReleaseOnWidget(uniqueID, pointerX, pointerY, data, obj, localPt, "press");
			break;
		}
		case "applications": {
			if (prevInteractionItem === null) {
				remoteInteraction[uniqueID].pressOnItem(obj);
				showOrHideWidgetLinks({uniqueID: uniqueID, item: obj, user_color: color, show: true});
			}
			pointerPressOnApplication(uniqueID, pointerX, pointerY, data, obj, localPt, null);
			break;
		}
		case "portals": {
			pointerPressOnDataSharingPortal(uniqueID, pointerX, pointerY, data, obj, localPt);
			break;
		}
	}
}

function pointerPressOnOpenSpace(uniqueID, pointerX, pointerY, data) {
	if (data.button === "right") {
		// Right click opens the radial menu
		createRadialMenu(uniqueID, pointerX, pointerY);
	}
}

function pointerPressOnStaticUI(uniqueID, pointerX, pointerY, data, obj, localPt) {
	// don't allow data-pushing

	/*
	switch (obj.id) {
		case "dataSharingRequestDialog": {
			break;
		}
		case "dataSharingWaitDialog": {
			break;
		}
		case "acceptDataSharingRequest": {
			console.log("Accepting Data-Sharing Request");
			broadcast('closeRequestDataSharingDialog', null);
			var sharingMin = Math.min(remoteSharingRequestDialog.config.totalWidth,
					remoteSharingRequestDialog.config.totalHeight - remoteSharingRequestDialog.config.ui.titleBarHeight);
			var myMin = Math.min(config.totalWidth, config.totalHeight - config.ui.titleBarHeight);
			var sharingSize = parseInt(0.45 * (sharingMin + myMin), 10);
			var sharingScale = (0.9 * myMin) / sharingSize;
			var sharingTitleBarHeight = (remoteSharingRequestDialog.config.ui.titleBarHeight + config.ui.titleBarHeight) / 2;
			remoteSharingRequestDialog.wsio.emit('acceptDataSharingSession',
				{width: sharingSize, height: sharingSize, titleBarHeight: sharingTitleBarHeight, date: Date.now()});
			createNewDataSharingSession(remoteSharingRequestDialog.config.name,
				remoteSharingRequestDialog.config.host, remoteSharingRequestDialog.config.port,
				remoteSharingRequestDialog.wsio, null, sharingSize, sharingSize, sharingScale,
				sharingTitleBarHeight, false);
			remoteSharingRequestDialog = null;
			showRequestDialog(false);
			break;
		}
		case "rejectDataSharingRequest": {
			console.log("Rejecting Data-Sharing Request");
			broadcast('closeRequestDataSharingDialog', null);
			remoteSharingRequestDialog.wsio.emit('rejectDataSharingSession', null);
			remoteSharingRequestDialog = null;
			showRequestDialog(false);
			break;
		}
		case "cancelDataSharingRequest": {
			console.log("Canceling Data-Sharing Request");
			broadcast('closeDataSharingWaitDialog', null);
			remoteSharingWaitDialog.wsio.emit('cancelDataSharingSession', null);
			remoteSharingWaitDialog = null;
			showWaitDialog(false);
			break;
		}
		default: {
			// remote site icon
			requestNewDataSharingSession(obj.data);
		}
	}
	*/
}

function createNewDataSharingSession(remoteName, remoteHost, remotePort, remoteWSIO, remoteTime,
	sharingWidth, sharingHeight, sharingScale, sharingTitleBarHeight, caller) {
	var zIndex = SAGE2Items.applications.numItems + SAGE2Items.portals.numItems;
	var dataSession = {
		id: getUniqueDataSharingId(remoteHost, remotePort, caller),
		name: remoteName,
		host: remoteHost,
		port: remotePort,
		left: config.ui.titleBarHeight,
		top: 1.5 * config.ui.titleBarHeight,
		width: sharingWidth * sharingScale,
		height: sharingHeight * sharingScale,
		previous_left: config.ui.titleBarHeight,
		previous_top: 1.5 * config.ui.titleBarHeight,
		previous_width: sharingWidth * sharingScale,
		previous_height: sharingHeight * sharingScale,
		natural_width: sharingWidth,
		natural_height: sharingHeight,
		aspect: sharingWidth / sharingHeight,
		scale: sharingScale,
		titleBarHeight: sharingTitleBarHeight,
		zIndex: zIndex
	};

	console.log("New Data Sharing Session: " + dataSession.id);

	var geometry = {
		x: dataSession.left,
		y: dataSession.top,
		w: dataSession.width,
		h: dataSession.height + config.ui.titleBarHeight
	};

	var cornerSize   = 0.2 * Math.min(geometry.w, geometry.h);
	var oneButton    = Math.round(config.ui.titleBarHeight) * (300 / 235);
	var buttonsPad   = 0.1 * oneButton;
	var startButtons = geometry.w - Math.round(2 * oneButton + buttonsPad);
	/*
	var buttonsWidth = (config.ui.titleBarHeight-4) * (324.0/111.0);
	var buttonsPad   = (config.ui.titleBarHeight-4) * ( 10.0/111.0);
	var oneButton    = buttonsWidth / 2; // two buttons
	var startButtons = geometry.w - buttonsWidth;
	*/

	interactMgr.addGeometry(dataSession.id, "portals", "rectangle", geometry, true, zIndex, dataSession);

	SAGE2Items.portals.addItem(dataSession);
	SAGE2Items.portals.addButtonToItem(dataSession.id, "titleBar", "rectangle",
		{x: 0, y: 0, w: geometry.w, h: config.ui.titleBarHeight}, 0);
	SAGE2Items.portals.addButtonToItem(dataSession.id, "fullscreenButton", "rectangle",
		{x: startButtons + buttonsPad, y: 0, w: oneButton, h: config.ui.titleBarHeight}, 1);
	SAGE2Items.portals.addButtonToItem(dataSession.id, "closeButton", "rectangle",
		{x: startButtons + buttonsPad + oneButton, y: 0, w: oneButton, h: config.ui.titleBarHeight}, 1);
	SAGE2Items.portals.addButtonToItem(dataSession.id, "dragCorner", "rectangle",
		{x: geometry.w - cornerSize, y: geometry.h + config.ui.titleBarHeight - cornerSize, w: cornerSize, h: cornerSize}, 2);

	SAGE2Items.portals.interactMgr[dataSession.id] = new InteractableManager();
	SAGE2Items.portals.interactMgr[dataSession.id].addLayer("radialMenus",  2);
	SAGE2Items.portals.interactMgr[dataSession.id].addLayer("widgets",      1);
	SAGE2Items.portals.interactMgr[dataSession.id].addLayer("applications", 0);

	broadcast('initializeDataSharingSession', dataSession);
	var key;
	for (key in sagePointers) {
		remoteWSIO.emit('createRemoteSagePointer', {id: key, portal: {host: config.host, port: config.port}});
	}
	var to = caller ? remoteTime.getTime() - Date.now() : 0;
	remoteSharingSessions[dataSession.id] = {portal: dataSession, wsio: remoteWSIO, appCount: 0, timeOffset: to};

}

// Disabling data sharing portal for now
/*
function requestNewDataSharingSession(remote) {
	return;

	if (remote.connected) {
		console.log("Requesting data-sharing session with " + remote.name);

		remoteSharingWaitDialog = remote;
		broadcast('dataSharingConnectionWait', {name: remote.name, host: remote.wsio.remoteAddress.address,
			port: remote.wsio.remoteAddress.port});
		remote.wsio.emit('requestDataSharingSession', {config: config, secure: false});

		showWaitDialog(true);
	} else {
		console.log("Remote site " + remote.name + " is not currently connected");
	}
}
*/

function showWaitDialog(flag) {
	interactMgr.editVisibility("dataSharingWaitDialog", "staticUI", flag);
	interactMgr.editVisibility("cancelDataSharingRequest", "staticUI", flag);
}

function showRequestDialog(flag) {
	interactMgr.editVisibility("dataSharingRequestDialog", "staticUI", flag);
	interactMgr.editVisibility("acceptDataSharingRequest", "staticUI", flag);
	interactMgr.editVisibility("rejectDataSharingRequest", "staticUI", flag);
}

function pointerPressOnRadialMenu(uniqueID, pointerX, pointerY, data, obj, localPt, color) {
	var existingRadialMenu = obj.data;

	if (obj.id.indexOf("menu_radial_button") !== -1) {
		// Pressing on radial menu button
		var menuStateChange = existingRadialMenu.onButtonEvent(obj.id, uniqueID, "pointerPress", color);
		if (menuStateChange !== undefined) {
			radialMenuEvent({type: "stateChange", menuID: existingRadialMenu.id, menuState: menuStateChange });
		}
	} else if (obj.id.indexOf("menu_thumbnail") !== -1) {
		// Pressing on thumbnail window
		// console.log("Pointer press on thumbnail window");
		data = { button: data.button, color: sagePointers[uniqueID].color };
		radialMenuEvent({type: "pointerPress", id: uniqueID, x: pointerX, y: pointerY, data: data});
	} else {
		// Not on a button
		// Drag Content Browser only from radial menu
		if (data.button === "left" && obj.type !== 'rectangle') {
			obj.data.onStartDrag(uniqueID, {x: pointerX, y: pointerY});
		}
	}
}

function pointerPressOrReleaseOnWidget(uniqueID, pointerX, pointerY, data, obj, localPt, pressRelease) {
	var id = obj.data.id;
	if (data.button === "left") {
		var sidebarPoint = {x: obj.geometry.x - obj.data.left + localPt.x, y: obj.geometry.y - obj.data.top + localPt.y};
		var btn = SAGE2Items.widgets.findButtonByPoint(id, localPt) || SAGE2Items.widgets.findButtonByPoint(id, sidebarPoint);
		var ctrlData = {ctrlId: btn?btn.id:null, appId: obj.data.appId, instanceID: id};
		var regTI = /textInput/;
		var regSl = /slider/;
		var regButton = /button/;
		var lockedControl = null;
		var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

		if (pressRelease === "press") {
			// var textInputOrSlider = SAGE2Items.widgets.findButtonByPoint(id, sidebarPoint);
			if (btn === null) {// && textInputOrSlider===null) {
				remoteInteraction[uniqueID].selectMoveControl(obj.data, pointerX, pointerY);
			} else {
				remoteInteraction[uniqueID].releaseControl();
				lockedControl = remoteInteraction[uniqueID].lockedControl();
				if (lockedControl) {
					// If a text input widget was locked, drop it
					broadcast('deactivateTextInputControl', lockedControl);
					remoteInteraction[uniqueID].dropControl();
				}

				remoteInteraction[uniqueID].lockControl(ctrlData);
				if (regSl.test(btn.id)) {
					broadcast('sliderKnobLockAction', {ctrl: ctrlData, x: pointerX, user: eUser, date: Date.now()});
				} else if (regTI.test(btn.id)) {
					broadcast('activateTextInputControl', {prevTextInput: lockedControl, curTextInput: ctrlData, date: Date.now()});
				}
			}
		} else {
			lockedControl = remoteInteraction[uniqueID].lockedControl();
			if (lockedControl !== null && btn !== null && regButton.test(btn.id) && lockedControl.ctrlId === btn.id) {
				remoteInteraction[uniqueID].dropControl();
				broadcast('executeControlFunction', {ctrl: ctrlData, user: eUser, date: Date.now()}, 'receivesWidgetEvents');

				var app = SAGE2Items.applications.list[ctrlData.appId];
				if (app) {
					if (btn.id.indexOf("buttonCloseApp") >= 0) {
						addEventToUserLog(data.addr, {type: "delete", data: {application:
							{id: app.id, type: app.application}}, time: Date.now()});
					} else if (btn.id.indexOf("buttonCloseWidget") >= 0) {
						addEventToUserLog(data.addr, {type: "widgetMenu", data: {action: "close", application:
							{id: app.id, type: app.application}}, time: Date.now()});
					} else if (btn.id.indexOf("buttonShareApp") >= 0) {
						console.log("sharing app");
					} else {
						addEventToUserLog(data.addr, {type: "widgetAction", data: {application:
							data.appId, widget: data.ctrlId}, time: Date.now()});
					}
				}
			}
			remoteInteraction[uniqueID].releaseControl();
		}
	} else {
		if (obj.data.show === true && pressRelease === "press") {
			hideControl(obj.data);
			var app2 = SAGE2Items.applications.list[obj.data.appId];
			if (app2 !== null) {
				addEventToUserLog(uniqueID, {type: "widgetMenu", data: {action: "close", application:
					{id: app2.id, type: app2.application}}, time: Date.now()});
			}
		}
	}
}

function releaseSlider(uniqueID) {
	var ctrlData = remoteInteraction[uniqueID].lockedControl();
	if (/slider/.test(ctrlData.ctrlId) === true) {
		remoteInteraction[uniqueID].dropControl();
		var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};
		broadcast('executeControlFunction', {ctrl: ctrlData, user: eUser}, 'receivesWidgetEvents');
	}
}


function pointerPressOnApplication(uniqueID, pointerX, pointerY, data, obj, localPt, portalId) {
	var im = findInteractableManager(obj.data.id);
	im.moveObjectToFront(obj.id, "applications", ["portals"]);
	var stickyList = stickyAppHandler.getStickingItems(obj.id);
	for (var idx in stickyList) {
		im.moveObjectToFront(stickyList[idx].id, obj.layerId);
	}
	var newOrder = im.getObjectZIndexList("applications", ["portals"]);
	broadcast('updateItemOrder', newOrder);

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('updateApplicationOrder', {order: newOrder, date: ts});
	}

	var btn = SAGE2Items.applications.findButtonByPoint(obj.id, localPt);

	// pointer press on app window
	if (btn === null) {
		if (remoteInteraction[uniqueID].appInteractionMode()) {
			if (data.button === "right") {
				var elemCtrl = SAGE2Items.widgets.list[obj.id + uniqueID + "_controls"];
				if (!elemCtrl) {
					broadcast('requestNewControl', {elemId: obj.id, user_id: uniqueID,
						user_label: sagePointers[uniqueID]? sagePointers[uniqueID].label : "", x: pointerX, y: pointerY, date: Date.now() });
				} else if (elemCtrl.show === false) {
					showControl(elemCtrl, uniqueID, pointerX, pointerY);
					addEventToUserLog(uniqueID, {type: "widgetMenu", data: {action: "open", application:
						{id: obj.id, type: obj.data.application}}, time: Date.now()});
				} else {
					moveControlToPointer(elemCtrl, uniqueID, pointerX, pointerY);
				}
			} else {
				sendPointerPressToApplication(uniqueID, obj.data, pointerX, pointerY, data);
			}
		} else {
			selectApplicationForMove(uniqueID, obj.data, pointerX, pointerY, portalId);
		}
		return;
	}

	switch (btn.id) {
		case "titleBar":
			selectApplicationForMove(uniqueID, obj.data, pointerX, pointerY, portalId);
			break;
		case "dragCorner":
			if (remoteInteraction[uniqueID].windowManagementMode()) {
				selectApplicationForResize(uniqueID, obj.data, pointerX, pointerY, portalId);
			} else if (remoteInteraction[uniqueID].appInteractionMode()) {
				sendPointerPressToApplication(uniqueID, obj.data, pointerX, pointerY, data);
			}
			break;
		case "syncButton":
			broadcast('toggleSyncOptions', {id: obj.data.id});
			break;
		case "fullscreenButton":
			toggleApplicationFullscreen(uniqueID, obj.data, portalId);
			break;
		case "closeButton":
			deleteApplication(obj.data.id, portalId);
			break;
	}
}

function pointerPressOnDataSharingPortal(uniqueID, pointerX, pointerY, data, obj, localPt) {
	interactMgr.moveObjectToFront(obj.id, "portals", ["applications"]);
	var newOrder = interactMgr.getObjectZIndexList("portals", ["applications"]);
	broadcast('updateItemOrder', newOrder);

	var btn = SAGE2Items.portals.findButtonByPoint(obj.id, localPt);

	// pointer press inside portal window
	if (btn === null) {
		var scaledPt = {x: localPt.x / obj.data.scale, y: (localPt.y - config.ui.titleBarHeight) / obj.data.scale};
		pointerPressInDataSharingArea(uniqueID, obj.data.id, scaledPt, data);
		return;
	}

	switch (btn.id) {
		case "titleBar": {
			selectPortalForMove(uniqueID, obj.data, pointerX, pointerY);
			break;
		}
		case "dragCorner": {
			if (remoteInteraction[uniqueID].windowManagementMode()) {
				selectPortalForResize(uniqueID, obj.data, pointerX, pointerY);
			}
			break;
		}
		case "fullscreenButton": {
			// toggleApplicationFullscreen(uniqueID, obj.data);
			break;
		}
		case "closeButton": {
			// deleteApplication(obj.data.id);
			break;
		}
	}
}

function pointerPressInDataSharingArea(uniqueID, portalId, scaledPt, data) {
	var pObj = SAGE2Items.portals.interactMgr[portalId].searchGeometry(scaledPt);
	if (pObj === null) {
		// pointerPressOnOpenSpace(uniqueID, pointerX, pointerY, data);
		return;
	}

	var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
	switch (pObj.layerId) {
		case "radialMenus": {
			// pointerPressOnRadialMenu(uniqueID, pointerX, pointerY, data, pObj, pLocalPt);
			break;
		}
		case "widgets": {
			// pointerPressOnWidget(uniqueID, pointerX, pointerY, data, pObj, pLocalPt);
			break;
		}
		case "applications": {
			pointerPressOnApplication(uniqueID, scaledPt.x, scaledPt.y, data, pObj, pLocalPt, portalId);
			break;
		}
	}
	return;
}

function selectApplicationForMove(uniqueID, app, pointerX, pointerY, portalId) {
	remoteInteraction[uniqueID].selectMoveItem(app, pointerX, pointerY);
	broadcast('startMove', {id: app.id, date: Date.now()});

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('startApplicationMove', {id: uniqueID, appId: app.id, date: ts});
	}

	var eLogData = {
		type: "move",
		action: "start",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function selectApplicationForResize(uniqueID, app, pointerX, pointerY, portalId) {
	remoteInteraction[uniqueID].selectResizeItem(app, pointerX, pointerY);
	broadcast('startResize', {id: app.id, date: Date.now()});

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('startApplicationResize', {id: uniqueID, appId: app.id, date: ts});
	}

	var eLogData = {
		type: "resize",
		action: "start",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function sendPointerPressToApplication(uniqueID, app, pointerX, pointerY, data) {
	var ePosition = {x: pointerX - app.left, y: pointerY - (app.top + config.ui.titleBarHeight)};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	var event = {
		id: app.id,
		type: "pointerPress",
		position: ePosition,
		user: eUser,
		data: data,
		date: Date.now()
	};

	broadcast('eventInItem', event);

	var eLogData = {
		type: "pointerPress",
		application: {
			id: app.id,
			type: app.application
		},
		position: {
			x: parseInt(ePosition.x, 10),
			y: parseInt(ePosition.y, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "applicationInteraction", data: eLogData, time: Date.now()});
}

function selectPortalForMove(uniqueID, portal, pointerX, pointerY) {
	remoteInteraction[uniqueID].selectMoveItem(portal, pointerX, pointerY);

	var eLogData = {
		type: "move",
		action: "start",
		portal: {
			id: portal.id,
			name: portal.name,
			host: portal.host,
			port: portal.port
		},
		location: {
			x: parseInt(portal.left, 10),
			y: parseInt(portal.top, 10),
			width: parseInt(portal.width, 10),
			height: parseInt(portal.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function selectPortalForResize(uniqueID, portal, pointerX, pointerY) {
	remoteInteraction[uniqueID].selectResizeItem(portal, pointerX, pointerY);

	var eLogData = {
		type: "resize",
		action: "start",
		portal: {
			id: portal.id,
			name: portal.name,
			host: portal.host,
			port: portal.port
		},
		location: {
			x: parseInt(portal.left, 10),
			y: parseInt(portal.top, 10),
			width: parseInt(portal.width, 10),
			height: parseInt(portal.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function pointerMove(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	// Trick: press ALT key while moving switches interaction mode
	if (sagePointers[uniqueID] && remoteInteraction[uniqueID].ALT && pressingAlt) {
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode});
		pressingAlt = false;
	} else if (sagePointers[uniqueID] && !remoteInteraction[uniqueID].ALT && !pressingAlt) {
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode});
		pressingAlt = true;
	}

	sagePointers[uniqueID].updatePointerPosition(data, config.totalWidth, config.totalHeight);
	pointerX = sagePointers[uniqueID].left;
	pointerY = sagePointers[uniqueID].top;

	updatePointerPosition(uniqueID, pointerX, pointerY, data);
}

function pointerPosition(uniqueID, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	sagePointers[uniqueID].updatePointerPosition(data, config.totalWidth, config.totalHeight);
	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;

	updatePointerPosition(uniqueID, pointerX, pointerY, data);
}

function updatePointerPosition(uniqueID, pointerX, pointerY, data) {
	broadcast('updateSagePointerPosition', sagePointers[uniqueID]);

	var localPt;
	var scaledPt;
	var moveAppPortal = findApplicationPortal(remoteInteraction[uniqueID].selectedMoveItem);
	var resizeAppPortal = findApplicationPortal(remoteInteraction[uniqueID].selectedResizeItem);
	var updatedMoveItem;
	var updatedResizeItem;
	var updatedControl;

	if (moveAppPortal !== null) {
		localPt = globalToLocal(pointerX, pointerY, moveAppPortal.type, moveAppPortal.geometry);
		scaledPt = {x: localPt.x / moveAppPortal.data.scale, y: (localPt.y - config.ui.titleBarHeight) / moveAppPortal.data.scale};
		remoteSharingSessions[moveAppPortal.id].wsio.emit('remoteSagePointerPosition',
			{id: uniqueID, left: scaledPt.x, top: scaledPt.y});
		updatedMoveItem = remoteInteraction[uniqueID].moveSelectedItem(scaledPt.x, scaledPt.y);
		moveApplicationWindow(uniqueID, updatedMoveItem, moveAppPortal.id);
		return;
	} else if (resizeAppPortal !== null) {
		localPt = globalToLocal(pointerX, pointerY, resizeAppPortal.type, resizeAppPortal.geometry);
		scaledPt = {x: localPt.x / resizeAppPortal.data.scale, y: (localPt.y - config.ui.titleBarHeight) / resizeAppPortal.data.scale};
		remoteSharingSessions[resizeAppPortal.id].wsio.emit('remoteSagePointerPosition',
			{id: uniqueID, left: scaledPt.x, top: scaledPt.y});
		updatedResizeItem = remoteInteraction[uniqueID].resizeSelectedItem(scaledPt.x, scaledPt.y);
		moveAndResizeApplicationWindow(updatedResizeItem, resizeAppPortal.id);
		return;
	}

	// update radial menu position if dragged outside radial menu
	updateRadialMenuPointerPosition(uniqueID, pointerX, pointerY);

	// update app position and size if currently modifying a window
	updatedMoveItem = remoteInteraction[uniqueID].moveSelectedItem(pointerX, pointerY);
	updatedResizeItem = remoteInteraction[uniqueID].resizeSelectedItem(pointerX, pointerY);
	updatedControl = remoteInteraction[uniqueID].moveSelectedControl(pointerX, pointerY);
	if (updatedMoveItem !== null) {
		if (SAGE2Items.portals.list.hasOwnProperty(updatedMoveItem.elemId)) {
			moveDataSharingPortalWindow(updatedMoveItem);
		} else {
			moveApplicationWindow(uniqueID, updatedMoveItem, null);
		}
		return;
	} else if (updatedResizeItem !== null) {
		if (SAGE2Items.portals.list.hasOwnProperty(updatedResizeItem.elemId)) {
			moveAndResizeDataSharingPortalWindow(updatedResizeItem);
		} else {
			moveAndResizeApplicationWindow(updatedResizeItem, null);
		}
		return;
	} else if (updatedControl !== null) {
		moveWidgetControls(uniqueID, updatedControl);
		return;
	}

	var prevInteractionItem = remoteInteraction[uniqueID].getPreviousInteractionItem();

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});
	if (obj === null) {
		removeExistingHoverCorner(uniqueID);
		if (remoteInteraction[uniqueID].portal !== null) {
			remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('stopRemoteSagePointer', {id: uniqueID});
			remoteInteraction[uniqueID].portal = null;
		}
		if (prevInteractionItem !== null) {
			showOrHideWidgetLinks({uniqueID: uniqueID, item: prevInteractionItem, show: false});
		}
	}	else {
		var color = sagePointers[uniqueID]? sagePointers[uniqueID].color : null;
		if (prevInteractionItem !== obj) {
			if (prevInteractionItem !== null) {
				showOrHideWidgetLinks({uniqueID: uniqueID, item: prevInteractionItem, show: false});
			}
			showOrHideWidgetLinks({uniqueID: uniqueID, item: obj, user_color: color, show: true});
		} else {
			var appId = obj.id;
			if (obj.data !== undefined && obj.data !== null && obj.data.appId !== undefined) {
				appId = obj.data.appId;
			}
			if (appUserColors[appId] !== color) {
				showOrHideWidgetLinks({uniqueID: uniqueID, item: prevInteractionItem, show: false});
				showOrHideWidgetLinks({uniqueID: uniqueID, item: obj, user_color: color, show: true});
			}
		}
		localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
		switch (obj.layerId) {
			case "staticUI": {
				removeExistingHoverCorner(uniqueID);
				if (remoteInteraction[uniqueID].portal !== null) {
					remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('stopRemoteSagePointer', {id: uniqueID});
					remoteInteraction[uniqueID].portal = null;
				}
				break;
			}
			case "radialMenus": {
				pointerMoveOnRadialMenu(uniqueID, pointerX, pointerY, data, obj, localPt, color);
				removeExistingHoverCorner(uniqueID);
				if (remoteInteraction[uniqueID].portal !== null) {
					remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('stopRemoteSagePointer', {id: uniqueID});
					remoteInteraction[uniqueID].portal = null;
				}
				break;
			}
			case "widgets": {
				pointerMoveOnWidgets(uniqueID, pointerX, pointerY, data, obj, localPt);
				removeExistingHoverCorner(uniqueID);
				if (remoteInteraction[uniqueID].portal !== null) {
					remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('stopRemoteSagePointer', {id: uniqueID});
					remoteInteraction[uniqueID].portal = null;
				}
				break;
			}
			case "applications": {
				pointerMoveOnApplication(uniqueID, pointerX, pointerY, data, obj, localPt, null);
				if (remoteInteraction[uniqueID].portal !== null) {
					remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('stopRemoteSagePointer', {id: uniqueID});
					remoteInteraction[uniqueID].portal = null;
				}
				break;
			}
			case "portals": {
				pointerMoveOnDataSharingPortal(uniqueID, pointerX, pointerY, data, obj, localPt);
				break;
			}
		}
	}

	remoteInteraction[uniqueID].setPreviousInteractionItem(obj);
}

function pointerMoveOnRadialMenu(uniqueID, pointerX, pointerY, data, obj, localPt, color) {
	var existingRadialMenu = obj.data;

	if (obj.id.indexOf("menu_radial_button") !== -1) {
		// Pressing on radial menu button
		// console.log("over radial button: " + obj.id);
		// data = { buttonID: obj.id, button: data.button, color: sagePointers[uniqueID].color };
		// radialMenuEvent({type: "pointerMove", id: uniqueID, x: pointerX, y: pointerY, data: data});
		var menuStateChange = existingRadialMenu.onButtonEvent(obj.id, uniqueID, "pointerMove", color);
		if (menuStateChange !== undefined) {
			radialMenuEvent({type: "stateChange", menuID: existingRadialMenu.id, menuState: menuStateChange });
		}
	} else if (obj.id.indexOf("menu_thumbnail") !== -1) {
		// PointerMove on thumbnail window
		// console.log("Pointer move on thumbnail window");
		data = { button: data.button, color: sagePointers[uniqueID].color };
		radialMenuEvent({type: "pointerMove", id: uniqueID, x: pointerX, y: pointerY, data: data});
	} else {
		// Not on a button
		var menuButtonState = existingRadialMenu.onMenuEvent(uniqueID);
		if (menuButtonState !== undefined) {
			radialMenuEvent({type: "stateChange", menuID: existingRadialMenu.id, menuState: menuButtonState });
		}
		// Drag Content Browser only from radial menu
		if (existingRadialMenu.dragState === true && obj.type !== 'rectangle') {
			var offset = existingRadialMenu.getDragOffset(uniqueID, {x: pointerX, y: pointerY});
			moveRadialMenu(existingRadialMenu.id, offset.x, offset.y);
			radialMenuEvent({type: "pointerMove", id: uniqueID, x: pointerX, y: pointerY, data: data});
		}
	}
}

function pointerMoveOnWidgets(uniqueID, pointerX, pointerY, data, obj, localPt) {
	// widgets
	var lockedControl = remoteInteraction[uniqueID].lockedControl();
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	if (lockedControl && /slider/.test(lockedControl.ctrlId)) {
		broadcast('moveSliderKnob', {ctrl: lockedControl, x: pointerX, user: eUser, date: Date.now()});
		return;
	}
	// showOrHideWidgetConnectors(uniqueID, obj.data, "move");
	// Widget connector show logic ends

}

function pointerMoveOnApplication(uniqueID, pointerX, pointerY, data, obj, localPt, portalId) {
	var btn = SAGE2Items.applications.findButtonByPoint(obj.id, localPt);

	// pointer move on app window
	if (btn === null) {
		removeExistingHoverCorner(uniqueID, portalId);
		if (remoteInteraction[uniqueID].appInteractionMode()) {
			sendPointerMoveToApplication(uniqueID, obj.data, pointerX, pointerY, data);
		}
		return;
	}

	var ts;
	switch (btn.id) {
		case "titleBar": {
			removeExistingHoverCorner(uniqueID, portalId);
			break;
		}
		case "dragCorner": {
			if (remoteInteraction[uniqueID].hoverCornerItem === null) {
				remoteInteraction[uniqueID].setHoverCornerItem(obj.data);
				broadcast('hoverOverItemCorner', {elemId: obj.data.id, flag: true});
				if (portalId !== undefined && portalId !== null) {
					ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
					remoteSharingSessions[portalId].wsio.emit('remoteSagePointerHoverCorner',
						{appHoverCorner: {elemId: obj.data.id, flag: true}, date: ts});
				}
			} else if (remoteInteraction[uniqueID].hoverCornerItem.id !== obj.data.id) {
				broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false});
				if (portalId !== undefined && portalId !== null) {
					ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
					remoteSharingSessions[portalId].wsio.emit('remoteSagePointerHoverCorner',
						{appHoverCorner: {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, date: ts});
				}
				remoteInteraction[uniqueID].setHoverCornerItem(obj.data);
				broadcast('hoverOverItemCorner', {elemId: obj.data.id, flag: true});
				if (portalId !== undefined && portalId !== null) {
					ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
					remoteSharingSessions[portalId].wsio.emit('remoteSagePointerHoverCorner',
						{appHoverCorner: {elemId: obj.data.id, flag: true}, date: ts});
				}
			}
			break;
		}
		case "fullscreenButton": {
			removeExistingHoverCorner(uniqueID, portalId);
			break;
		}
		case "closeButton": {
			removeExistingHoverCorner(uniqueID, portalId);
			break;
		}
	}
}

function pointerMoveOnDataSharingPortal(uniqueID, pointerX, pointerY, data, obj, localPt) {
	var scaledPt = {x: localPt.x / obj.data.scale, y: (localPt.y - config.ui.titleBarHeight) / obj.data.scale};

	if (remoteInteraction[uniqueID].portal === null || remoteInteraction[uniqueID].portal.id !== obj.data.id) {
		remoteInteraction[uniqueID].portal = obj.data;
		var rPointer = {
			id: uniqueID,
			left: scaledPt.x,
			top: scaledPt.y,
			label: sagePointers[uniqueID].label,
			color: sagePointers[uniqueID].color
		};
		remoteSharingSessions[remoteInteraction[uniqueID].portal.id].wsio.emit('startRemoteSagePointer', rPointer);
	}
	remoteSharingSessions[obj.data.id].wsio.emit('remoteSagePointerPosition', {id: uniqueID, left: scaledPt.x, top: scaledPt.y});

	var btn = SAGE2Items.portals.findButtonByPoint(obj.id, localPt);

	// pointer move on portal window
	if (btn === null) {
		var pObj = SAGE2Items.portals.interactMgr[obj.data.id].searchGeometry(scaledPt);
		if (pObj === null) {
			removeExistingHoverCorner(uniqueID, obj.data.id);
			return;
		}

		var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
		switch (pObj.layerId) {
			case "radialMenus": {
				removeExistingHoverCorner(uniqueID, obj.data.id);
				break;
			}
			case "widgets": {
				removeExistingHoverCorner(uniqueID, obj.data.id);
				break;
			}
			case "applications": {
				pointerMoveOnApplication(uniqueID, scaledPt.x, scaledPt.y, data, pObj, pLocalPt, obj.data.id);
				break;
			}
		}
		return;
	}

	switch (btn.id) {
		case "titleBar": {
			removeExistingHoverCorner(uniqueID, obj.data.id);
			break;
		}
		case "dragCorner": {
			if (remoteInteraction[uniqueID].windowManagementMode()) {
				if (remoteInteraction[uniqueID].hoverCornerItem === null) {
					remoteInteraction[uniqueID].setHoverCornerItem(obj.data);
					broadcast('hoverOverItemCorner', {elemId: obj.data.id, flag: true});
				} else if (remoteInteraction[uniqueID].hoverCornerItem.id !== obj.data.id) {
					broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false});
					var ts = Date.now() + remoteSharingSessions[obj.data.id].timeOffset;
					remoteSharingSessions[obj.data.id].wsio.emit('remoteSagePointerHoverCorner',
						{appHoverCorner: {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, date: ts});
					remoteInteraction[uniqueID].setHoverCornerItem(obj.data);
					broadcast('hoverOverItemCorner', {elemId: obj.data.id, flag: true});
				}
			} else if (remoteInteraction[uniqueID].appInteractionMode()) {
				// sendPointerMoveToApplication(uniqueID, obj.data, pointerX, pointerY, data);
			}
			break;
		}
		case "fullscreenButton": {
			removeExistingHoverCorner(uniqueID, obj.data.id);
			break;
		}
		case "closeButton": {
			removeExistingHoverCorner(uniqueID, obj.data.id);
			break;
		}
	}
}

function removeExistingHoverCorner(uniqueID, portalId) {
	// remove hover corner if exists
	if (remoteInteraction[uniqueID].hoverCornerItem !== null) {
		broadcast('hoverOverItemCorner', {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false});
		if (portalId !== undefined && portalId !== null) {
			var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
			remoteSharingSessions[portalId].wsio.emit('remoteSagePointerHoverCorner',
				{appHoverCorner: {elemId: remoteInteraction[uniqueID].hoverCornerItem.id, flag: false}, date: ts});
		}
		remoteInteraction[uniqueID].setHoverCornerItem(null);
	}
}

function moveApplicationWindow(uniqueID, moveApp, portalId) {
	var app = SAGE2Items.applications.list[moveApp.elemId];

	var titleBarHeight = config.ui.titleBarHeight;
	if (portalId !== undefined && portalId !== null) {
		titleBarHeight = remoteSharingSessions[portalId].portal.titleBarHeight;
	}
	var im = findInteractableManager(moveApp.elemId);
	if (im) {
		var backgroundObj = im.searchGeometry({x: moveApp.elemLeft - 1, y: moveApp.elemTop - 1});
		if (backgroundObj !== null) {
			if (SAGE2Items.applications.list.hasOwnProperty(backgroundObj.data.id)) {
				attachAppIfSticky(backgroundObj.data, moveApp.elemId);
			}
		}
		im.editGeometry(moveApp.elemId, "applications", "rectangle",
			{x: moveApp.elemLeft, y: moveApp.elemTop, w: moveApp.elemWidth, h: moveApp.elemHeight + titleBarHeight});
		broadcast('setItemPosition', moveApp);
		if (SAGE2Items.renderSync.hasOwnProperty(moveApp.elemId)) {
			calculateValidBlocks(app, mediaBlockSize, SAGE2Items.renderSync[app.id]);
			if (app.id in SAGE2Items.renderSync && SAGE2Items.renderSync[app.id].newFrameGenerated === false) {
				handleNewVideoFrame(app.id);
			}
		}

		if (portalId !== undefined && portalId !== null) {
			var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
			remoteSharingSessions[portalId].wsio.emit('updateApplicationPosition',
				{appPositionAndSize: moveApp, portalId: portalId, date: ts});
		}

		var updatedStickyItems = stickyAppHandler.moveItemsStickingToUpdatedItem(moveApp);

		for (var idx = 0; idx < updatedStickyItems.length; idx++) {
			var stickyItem = updatedStickyItems[idx];
			im.editGeometry(stickyItem.elemId, "applications", "rectangle",
				{x: stickyItem.elemLeft, y: stickyItem.elemTop,
				w: stickyItem.elemWidth, h: stickyItem.elemHeight + config.ui.titleBarHeight});
			broadcast('setItemPosition', updatedStickyItems[idx]);
		}
	}
}

function moveAndResizeApplicationWindow(resizeApp, portalId) {
	// Shift position up and left by one pixel to take border into account
	//    visible in hide-ui mode
	resizeApp.elemLeft = resizeApp.elemLeft - 1;
	resizeApp.elemTop  = resizeApp.elemTop  - 1;

	var app = SAGE2Items.applications.list[resizeApp.elemId];

	var titleBarHeight = config.ui.titleBarHeight;
	if (portalId !== undefined && portalId !== null) {
		titleBarHeight = remoteSharingSessions[portalId].portal.titleBarHeight;
	}
	var im = findInteractableManager(resizeApp.elemId);
	im.editGeometry(resizeApp.elemId, "applications", "rectangle",
		{x: resizeApp.elemLeft, y: resizeApp.elemTop, w: resizeApp.elemWidth, h: resizeApp.elemHeight + titleBarHeight});
	handleApplicationResize(resizeApp.elemId);
	broadcast('setItemPositionAndSize', resizeApp);
	if (SAGE2Items.renderSync.hasOwnProperty(resizeApp.elemId)) {
		calculateValidBlocks(app, mediaBlockSize, SAGE2Items.renderSync[app.id]);
		if (app.id in SAGE2Items.renderSync && SAGE2Items.renderSync[app.id].newFrameGenerated === false) {
			handleNewVideoFrame(app.id);
		}
	}

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('updateApplicationPositionAndSize',
			{appPositionAndSize: resizeApp, portalId: portalId, date: ts});
	}
}

function moveDataSharingPortalWindow(movePortal) {
	interactMgr.editGeometry(movePortal.elemId, "portals", "rectangle",
		{x: movePortal.elemLeft, y: movePortal.elemTop,
		w: movePortal.elemWidth, h: movePortal.elemHeight + config.ui.titleBarHeight});
	broadcast('setItemPosition', movePortal);
}

function moveAndResizeDataSharingPortalWindow(resizePortal) {
	interactMgr.editGeometry(resizePortal.elemId, "portals", "rectangle",
		{x: resizePortal.elemLeft, y: resizePortal.elemTop,
			w: resizePortal.elemWidth, h: resizePortal.elemHeight + config.ui.titleBarHeight});
	handleDataSharingPortalResize(resizePortal.elemId);
	broadcast('setItemPositionAndSize', resizePortal);
}

function moveWidgetControls(uniqueID, moveControl) {
	var app = SAGE2Items.applications.list[moveControl.appId];
	if (app) {
		moveControl.appData = getAppPositionSize(app);
		broadcast('setControlPosition', moveControl);
		var radialGeometry =  {
			x: moveControl.elemLeft + (moveControl.elemHeight / 2),
			y: moveControl.elemTop + (moveControl.elemHeight / 2),
			r: moveControl.elemHeight / 2
		};
		var barGeometry = {
			x: moveControl.elemLeft + moveControl.elemHeight,
			y: moveControl.elemTop + (moveControl.elemHeight / 2) - (moveControl.elemBarHeight / 2),
			w: moveControl.elemWidth - moveControl.elemHeight, h: moveControl.elemBarHeight
		};

		if (moveControl.hasSideBar === true) {
			var shapeData = {
				radial: {
					type: "circle",
					visible: true,
					geometry: radialGeometry
				},
				sidebar: {
					type: "rectangle",
					visible: true,
					geometry: barGeometry
				}
			};
			interactMgr.editComplexGeometry(moveControl.elemId, "widgets", shapeData);
		} else {
			interactMgr.editGeometry(moveControl.elemId, "widgets", "circle", radialGeometry);
		}
		/*interactMgr.editGeometry(moveControl.elemId+"_radial", "widgets", "circle", circle);
		if(moveControl.hasSideBar === true) {
			interactMgr.editGeometry(moveControl.elemId+"_sidebar", "widgets", "rectangle", bar );
		}*/
	}
}

function sendPointerMoveToApplication(uniqueID, app, pointerX, pointerY, data) {
	var ePosition = {x: pointerX - app.left, y: pointerY - (app.top + config.ui.titleBarHeight)};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	var event = {
		id: app.id,
		type: "pointerMove",
		position: ePosition,
		user: eUser,
		data: data,
		date: Date.now()
	};

	broadcast('eventInItem', event);
}

function pointerRelease(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	// If obj is undefined (as in this case, will search for radial menu using uniqueID
	pointerReleaseOnRadialMenu(uniqueID, pointerX, pointerY, data);

	if (remoteInteraction[uniqueID].lockedControl() !== null) {
		releaseSlider(uniqueID);
	}

	var prevInteractionItem = remoteInteraction[uniqueID].releaseOnItem();
	if (prevInteractionItem) {
		showOrHideWidgetLinks({uniqueID: uniqueID, item: prevInteractionItem, show: false});
	}
	var obj;
	var selectedApp = remoteInteraction[uniqueID].selectedMoveItem || remoteInteraction[uniqueID].selectedResizeItem;
	var portal = {id: null};

	if (selectedApp !== undefined && selectedApp !== null) {
		obj = interactMgr.searchGeometry({x: pointerX, y: pointerY}, null, [selectedApp.id]);
		portal = findApplicationPortal(selectedApp) || {id: null};
	}	else {
		obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});
	}
	if (obj === null) {
		dropSelectedItem(uniqueID, true, portal.id);
		return;
	}

	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
	switch (obj.layerId) {
		case "staticUI": {
			if (portal.id !== null) {
				dropSelectedItem(uniqueID, true, portal.id);
			}
			pointerReleaseOnStaticUI(uniqueID, pointerX, pointerY, obj, portal.id);
			break;
		}
		case "radialMenus": {
			pointerReleaseOnRadialMenu(uniqueID, pointerX, pointerY, data, obj);
			dropSelectedItem(uniqueID, true, portal.id);
			break;
		}
		case "applications": {
			if (dropSelectedItem(uniqueID, true, portal.id) === null) {
				if (remoteInteraction[uniqueID].appInteractionMode()) {
					sendPointerReleaseToApplication(uniqueID, obj.data, pointerX, pointerY, data);
				}
			}
			break;
		}
		case "portals": {
			pointerReleaseOnPortal(uniqueID, obj.data.id, localPt, data);
			break;
		}
		case "widgets": {
			pointerPressOrReleaseOnWidget(uniqueID, pointerX, pointerY, data, obj, localPt, "release");
			dropSelectedItem(uniqueID, true, portal.id);
			break;
		}
		default: {
			dropSelectedItem(uniqueID, true, portal.id);
		}
	}
}

function pointerReleaseOnStaticUI(uniqueID, pointerX, pointerY, obj) {
	// don't allow data-pushing
	// dropSelectedItem(uniqueID, true);

	/*
	var remote = obj.data;
	var app = dropSelectedItem(uniqueID, false, null);
	if (app !== null && SAGE2Items.applications.list.hasOwnProperty(app.application.id) && remote.connected) {
		remote.wsio.emit('addNewElementFromRemoteServer', app.application);

		var eLogData = {
			host: remote.wsio.remoteAddress.address,
			port: remote.wsio.remoteAddress.port,
			application: {
				id: app.application.id,
				type: app.application.application
			}
		};
		addEventToUserLog(uniqueID, {type: "shareApplication", data: eLogData, time: Date.now()});
	}
	*/

	var remote = obj.data;
	var app = dropSelectedItem(uniqueID, false, null);
	if (app !== null && SAGE2Items.applications.list.hasOwnProperty(app.application.id) && remote.connected) {
		var sharedId = app.application.id + "_" + config.host + ":" + config.port + "+" + remote.wsio.id;
		if (sharedApps[app.application.id] === undefined) {
			sharedApps[app.application.id] = [{wsio: remote.wsio, sharedId: sharedId}];
		} else {
			sharedApps[app.application.id].push({wsio: remote.wsio, sharedId: sharedId});
		}

		SAGE2Items.applications.editButtonVisibilityOnItem(app.application.id, "syncButton", true);

		remote.wsio.emit('addNewSharedElementFromRemoteServer',
			{application: app.application, id: sharedId, remoteAppId: app.application.id});
		broadcast('setAppSharingFlag', {id: app.application.id, sharing: true});

		var eLogData = {
			host: remote.wsio.remoteAddress.address,
			port: remote.wsio.remoteAddress.port,
			application: {
				id: app.application.id,
				type: app.application.application
			}
		};
		addEventToUserLog(uniqueID, {type: "shareApplication", data: eLogData, time: Date.now()});
	}
}

function pointerReleaseOnPortal(uniqueID, portalId, localPt, data) {
	var obj = interactMgr.getObject(portalId, "portals");

	var selectedApp = remoteInteraction[uniqueID].selectedMoveItem || remoteInteraction[uniqueID].selectedResizeItem;
	if (selectedApp) {
		var portal = findApplicationPortal(selectedApp);
		if (portal !== undefined && portal !== null && portal.id === portalId) {
			dropSelectedItem(uniqueID, true, portalId);
			return;
		} else {
			var app = dropSelectedItem(uniqueID, false, null);
			localPt = globalToLocal(app.previousPosition.left, app.previousPosition.top, obj.type, obj.geometry);
			var remote = remoteSharingSessions[obj.id];
			createAppFromDescription(app.application, function(appInstance, videohandle) {
				if (appInstance.application === "media_stream" || appInstance.application === "media_block_stream") {
					appInstance.id = app.application.id + "_" + obj.data.id;
				} else {
					appInstance.id = getUniqueSharedAppId(obj.data.id);
				}

				appInstance.left = localPt.x / obj.data.scale;
				appInstance.top = (localPt.y - config.ui.titleBarHeight) / obj.data.scale;
				appInstance.width = app.previousPosition.width / obj.data.scale;
				appInstance.height = app.previousPosition.height / obj.data.scale;

				remoteSharingSessions[obj.data.id].appCount++;

				// if (SAGE2Items.renderSync.hasOwnProperty(app.id) {
				var i;
				SAGE2Items.renderSync[appInstance.id] = {clients: {}, date: Date.now()};
				for (i = 0; i < clients.length; i++) {
					if (clients[i].clientType === "display") {
						SAGE2Items.renderSync[appInstance.id].clients[clients[i].id] = {wsio: clients[i], readyForNextFrame: false, blocklist: []};
					}
				}
				handleNewApplicationInDataSharingPortal(appInstance, videohandle, obj.data.id);

				remote.wsio.emit('addNewRemoteElementInDataSharingPortal', appInstance);

				var eLogData = {
					host: remote.portal.host,
					port: remote.portal.port,
					application: {
						id: appInstance.id,
						type: appInstance.application
					}
				};
				addEventToUserLog(uniqueID, {type: "shareApplication", data: eLogData, time: Date.now()});
			});
		}
	} else {
		// console.log("pointer release on portal (no app selected):",
		// 	remoteInteraction[uniqueID].windowManagementMode(),
		// 	remoteInteraction[uniqueID].appInteractionMode());
		if (remoteInteraction[uniqueID].appInteractionMode()) {
			var scaledPt = {x: localPt.x / obj.data.scale, y: (localPt.y - config.ui.titleBarHeight) / obj.data.scale};
			var pObj = SAGE2Items.portals.interactMgr[portalId].searchGeometry(scaledPt);
			if (pObj === null) {
				return;
			}

			// var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
			switch (pObj.layerId) {
				case "radialMenus": {
					break;
				}
				case "widgets": {
					break;
				}
				case "applications": {
					sendPointerReleaseToApplication(uniqueID, pObj.data, scaledPt.x, scaledPt.y, data);
					break;
				}
			}
		}
	}
}

function pointerReleaseOnRadialMenu(uniqueID, pointerX, pointerY, data, obj) {
	if (obj === undefined) {
		for (var key in SAGE2Items.radialMenus.list) {
			radialMenu = SAGE2Items.radialMenus.list[key];
			// console.log(data.id+"_menu: " + radialMenu);
			if (radialMenu !== undefined) {
				radialMenu.onRelease(uniqueID);
			}
		}
		// If pointer release is outside window, use the pointerRelease type to end the
		// scroll event, but don't trigger any clicks because of a 'null' button (clicks expects a left/right)
		data = { button: "null", color: sagePointers[uniqueID].color };
		radialMenuEvent({type: "pointerRelease", id: uniqueID, x: pointerX, y: pointerY, data: data});
	} else {
		var radialMenu = obj.data;
		if (obj.id.indexOf("menu_radial_button") !== -1) {
			// Pressing on radial menu button
			// console.log("pointer release on radial button: " + obj.id);
			radialMenu.onRelease(uniqueID);
			var menuState = radialMenu.onButtonEvent(obj.id, uniqueID, "pointerRelease");
			if (menuState !== undefined) {
				radialMenuEvent({type: "stateChange", menuID: radialMenu.id, menuState: menuState });
			}
		}  else if (obj.id.indexOf("menu_thumbnail") !== -1) {
			// PointerRelease on thumbnail window
			// console.log("Pointer release on thumbnail window");
			data = { button: data.button, color: sagePointers[uniqueID].color };
			radialMenuEvent({type: "pointerRelease", id: uniqueID, x: pointerX, y: pointerY, data: data});
		} else {
			// Not on a button
			radialMenu = obj.data.onRelease(uniqueID);
		}
	}
}

function dropSelectedItem(uniqueID, valid, portalId) {
	var item;
	var list;
	var position;
	if (remoteInteraction[uniqueID].selectedMoveItem !== null) {
		list = (SAGE2Items.portals.list.hasOwnProperty(remoteInteraction[uniqueID].selectedMoveItem.id)) ? "portals" : "applications";
		item = SAGE2Items[list].list[remoteInteraction[uniqueID].selectedMoveItem.id];
		if (item) {
			position = {left: item.left, top: item.top, width: item.width, height: item.height};
			dropMoveItem(uniqueID, item, valid, portalId);
			return {application: item, previousPosition: position};
		}
	} else if (remoteInteraction[uniqueID].selectedResizeItem !== null) {
		list = (SAGE2Items.portals.list.hasOwnProperty(remoteInteraction[uniqueID].selectedResizeItem.id)) ? "portals" : "applications";
		item = SAGE2Items[list].list[remoteInteraction[uniqueID].selectedResizeItem.id];
		if (item) {
			position = {left: item.left, top: item.top, width: item.width, height: item.height};
			dropResizeItem(uniqueID, item, portalId);
			return {application: item, previousPosition: position};
		}
	}
	return null;
}

function dropMoveItem(uniqueID, app, valid, portalId) {
	if (valid !== false) {
		valid = true;
	}
	var updatedItem = remoteInteraction[uniqueID].releaseItem(valid);
	if (updatedItem !== null) {
		moveApplicationWindow(uniqueID, updatedItem, portalId);
	}

	broadcast('finishedMove', {id: app.id, date: Date.now()});

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('finishApplicationMove', {id: uniqueID, appId: app.id, date: ts});
	}

	var eLogData = {
		type: "move",
		action: "end",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function dropResizeItem(uniqueID, app, portalId) {
	remoteInteraction[uniqueID].releaseItem(true);

	broadcast('finishedResize', {id: app.id, date: Date.now()});

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('finishApplicationResize', {id: uniqueID, appId: app.id, date: ts});
	}

	var eLogData = {
		type: "resize",
		action: "end",
		application: {
			id: app.id,
			type: app.application
		},
		location: {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		}
	};
	addEventToUserLog(uniqueID, {type: "windowManagement", data: eLogData, time: Date.now()});
}

function sendPointerReleaseToApplication(uniqueID, app, pointerX, pointerY, data) {
	var ePosition = {x: pointerX - app.left, y: pointerY - (app.top + config.ui.titleBarHeight)};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	var event = {
		id: app.id,
		type: "pointerRelease",
		position: ePosition,
		user: eUser,
		data: data,
		date: Date.now()
	};

	broadcast('eventInItem', event);
}

function pointerDblClick(uniqueID, pointerX, pointerY) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});
	if (obj === null) {
		return;
	}

	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
	switch (obj.layerId) {
		case "applications": {
			pointerDblClickOnApplication(uniqueID, pointerX, pointerY, obj, localPt);
			break;
		}
		case "portals": {
			break;
		}
	}
}

function pointerDblClickOnApplication(uniqueID, pointerX, pointerY, obj, localPt) {
	var btn = SAGE2Items.applications.findButtonByPoint(obj.id, localPt);

	// pointer press on app window
	if (btn === null) {
		if (remoteInteraction[uniqueID].windowManagementMode()) {
			toggleApplicationFullscreen(uniqueID, obj.data);
		}
		return;
	}

	switch (btn.id) {
		case "titleBar": {
			toggleApplicationFullscreen(uniqueID, obj.data);
			break;
		}
		case "dragCorner": {
			break;
		}
		case "fullscreenButton": {
			break;
		}
		case "closeButton": {
			break;
		}
	}
}

function pointerScrollStart(uniqueID, pointerX, pointerY) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

	if (obj === null) {
		return;
	}

	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
	switch (obj.layerId) {
		case "staticUI": {
			break;
		}
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			pointerScrollStartOnApplication(uniqueID, pointerX, pointerY, obj, localPt);
			break;
		}
		case "portals": {
			break;
		}
	}
}

function pointerScrollStartOnApplication(uniqueID, pointerX, pointerY, obj, localPt) {
	var btn = SAGE2Items.applications.findButtonByPoint(obj.id, localPt);

	interactMgr.moveObjectToFront(obj.id, obj.layerId);
	var newOrder = interactMgr.getObjectZIndexList("applications", ["portals"]);
	broadcast('updateItemOrder', newOrder);

	// pointer scroll on app window
	if (btn === null) {
		if (remoteInteraction[uniqueID].windowManagementMode()) {
			selectApplicationForScrollResize(uniqueID, obj.data, pointerX, pointerY);
		} else if (remoteInteraction[uniqueID].appInteractionMode()) {
			remoteInteraction[uniqueID].selectWheelItem = obj.data;
			remoteInteraction[uniqueID].selectWheelDelta = 0;
		}
		return;
	}

	switch (btn.id) {
		case "titleBar": {
			selectApplicationForScrollResize(uniqueID, obj.data, pointerX, pointerY);
			break;
		}
		case "dragCorner": {
			if (remoteInteraction[uniqueID].windowManagementMode()) {
				selectApplicationForScrollResize(uniqueID, obj.data, pointerX, pointerY);
			} else if (remoteInteraction[uniqueID].appInteractionMode()) {
				remoteInteraction[uniqueID].selectWheelItem = obj.data;
				remoteInteraction[uniqueID].selectWheelDelta = 0;
			}
			break;
		}
		case "fullscreenButton": {
			selectApplicationForScrollResize(uniqueID, obj.data, pointerX, pointerY);
			break;
		}
		case "closeButton": {
			selectApplicationForScrollResize(uniqueID, obj.data, pointerX, pointerY);
			break;
		}
	}
}

function selectApplicationForScrollResize(uniqueID, app, pointerX, pointerY) {
	remoteInteraction[uniqueID].selectScrollItem(app);

	broadcast('startMove', {id: app.id, date: Date.now()});
	broadcast('startResize', {id: app.id, date: Date.now()});

	var a = {
		id: app.id,
		type: app.application
	};
	var l = {
		x: parseInt(app.left, 10),
		y: parseInt(app.top, 10),
		width: parseInt(app.width, 10),
		height: parseInt(app.height, 10)
	};

	addEventToUserLog(uniqueID, {type: "windowManagement", data:
		{type: "move", action: "start", application: a, location: l}, time: Date.now()});
	addEventToUserLog(uniqueID, {type: "windowManagement", data:
		{type: "resize", action: "start", application: a, location: l}, time: Date.now()});
}

function pointerScroll(uniqueID, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var pointerX = sagePointers[uniqueID].left;
	var pointerY = sagePointers[uniqueID].top;

	var scale = 1.0 + Math.abs(data.wheelDelta) / 512;
	if (data.wheelDelta > 0) {
		scale = 1.0 / scale;
	}

	var updatedResizeItem = remoteInteraction[uniqueID].scrollSelectedItem(scale);
	if (updatedResizeItem !== null) {
		moveAndResizeApplicationWindow(updatedResizeItem);
	} else {
		var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

		if (obj === null) {
			return;
		}

		// var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
		switch (obj.layerId) {
			case "staticUI": {
				break;
			}
			case "radialMenus": {
				sendPointerScrollToRadialMenu(uniqueID, obj, pointerX, pointerY, data);
				break;
			}
			case "widgets": {
				break;
			}
			case "applications": {
				sendPointerScrollToApplication(uniqueID, obj.data, pointerX, pointerY, data);
				break;
			}
		}
	}
}

function sendPointerScrollToRadialMenu(uniqueID, obj, pointerX, pointerY, data) {
	if (obj.id.indexOf("menu_thumbnail") !== -1) {
		var event = { button: data.button, color: sagePointers[uniqueID].color, wheelDelta: data.wheelDelta };
		radialMenuEvent({type: "pointerScroll", id: uniqueID, x: pointerX, y: pointerY, data: event});
	}
	remoteInteraction[uniqueID].selectWheelDelta += data.wheelDelta;
}

function sendPointerScrollToApplication(uniqueID, app, pointerX, pointerY, data) {
	var ePosition = {x: pointerX - app.left, y: pointerY - (app.top + config.ui.titleBarHeight)};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	var event = {id: app.id, type: "pointerScroll", position: ePosition, user: eUser, data: data, date: Date.now()};

	broadcast('eventInItem', event);

	remoteInteraction[uniqueID].selectWheelDelta += data.wheelDelta;
}

function pointerScrollEnd(uniqueID) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var updatedResizeItem = remoteInteraction[uniqueID].selectedScrollItem;
	if (updatedResizeItem !== null) {
		broadcast('finishedMove', {id: updatedResizeItem.id, date: Date()});
		broadcast('finishedResize', {id: updatedResizeItem.id, date: Date.now()});

		var a = {
			id: updatedResizeItem.id,
			type: updatedResizeItem.application
		};
		var l = {
			x: parseInt(updatedResizeItem.left, 10),
			y: parseInt(updatedResizeItem.top, 10),
			width: parseInt(updatedResizeItem.width, 10),
			height: parseInt(updatedResizeItem.height, 10)
		};

		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "move", action: "end", application: a, location: l}, time: Date.now()});
		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "resize", action: "end", application: a, location: l}, time: Date.now()});

		remoteInteraction[uniqueID].selectedScrollItem = null;
	} else {
		if (remoteInteraction[uniqueID].appInteractionMode()) {
			var app = remoteInteraction[uniqueID].selectWheelItem;
			if (app !== undefined && app !== null) {
				var eLogData = {
					type: "pointerScroll",
					application: {
						id: app.id,
						type: app.application
					},
					wheelDelta: remoteInteraction[uniqueID].selectWheelDelta
				};
				addEventToUserLog(uniqueID, {type: "applicationInteraction", data: eLogData, time: Date.now()});
			}
		}
	}
}

function checkForSpecialKeys(uniqueID, code, flag) {
	switch (code) {
		case 16: {
			remoteInteraction[uniqueID].SHIFT = flag;
			break;
		}
		case 17: {
			remoteInteraction[uniqueID].CTRL = flag;
			break;
		}
		case 18: {
			remoteInteraction[uniqueID].ALT = flag;
			break;
		}
		case 20: {
			remoteInteraction[uniqueID].CAPS = flag;
			break;
		}
		case 91:
		case 92:
		case 93: {
			remoteInteraction[uniqueID].CMD = flag;
			break;
		}
	}
}

function keyDown(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	checkForSpecialKeys(uniqueID, data.code, true);

	if (remoteInteraction[uniqueID].appInteractionMode()) {
		var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

		if (obj === null) {
			return;
		}

		var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
		switch (obj.layerId) {
			case "staticUI": {
				break;
			}
			case "radialMenus": {
				break;
			}
			case "widgets": {
				break;
			}
			case "applications": {
				sendKeyDownToApplication(uniqueID, obj.data, localPt, data);
				break;
			}
			case "portals": {
				keyDownOnPortal(uniqueID, obj.data.id, localPt, data);
				break;
			}
		}
	}
}

function sendKeyDownToApplication(uniqueID, app, localPt, data) {
	var portal = findApplicationPortal(app);
	var titleBarHeight = config.ui.titleBarHeight;
	if (portal !== undefined && portal !== null) {
		titleBarHeight = portal.data.titleBarHeight;
	}

	var ePosition = {x: localPt.x, y: localPt.y - titleBarHeight};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};
	var eData =  {code: data.code, state: "down"};

	var event = {id: app.id, type: "specialKey", position: ePosition, user: eUser, data: eData, date: Date.now()};
	broadcast('eventInItem', event);

	var eLogData = {
		type: "specialKey",
		application: {
			id: app.id,
			type: app.application
		},
		code: eData.code,
		state: eData.state
	};
	addEventToUserLog(uniqueID, {type: "applicationInteraction", data: eLogData, time: Date.now()});
}

function keyDownOnPortal(uniqueID, portalId, localPt, data) {
	checkForSpecialKeys(uniqueID, data.code, true);

	var portal = SAGE2Items.portals.list[portalId];
	var scaledPt = {x: localPt.x / portal.scale, y: (localPt.y - config.ui.titleBarHeight) / portal.scale};
	if (remoteInteraction[uniqueID].local && remoteInteraction[uniqueID].portal !== null) {
		var rData = {
			id: uniqueID,
			left: scaledPt.x,
			top: scaledPt.y,
			code: data.code
		};
		remoteSharingSessions[portalId].wsio.emit('remoteSageKeyDown', rData);
	}

	var pObj = SAGE2Items.portals.interactMgr[portalId].searchGeometry(scaledPt);

	if (pObj === null) {
		return;
	}

	// var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
	switch (pObj.layerId) {
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			sendKeyDownToApplication(uniqueID, pObj.data, scaledPt, data);
			break;
		}
	}
}

function keyUp(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	checkForSpecialKeys(uniqueID, data.code, false);

	if (remoteInteraction[uniqueID].modeChange !== undefined && (data.code === 9 || data.code === 16)) {
		return;
	}

	var lockedControl = remoteInteraction[uniqueID].lockedControl();

	if (lockedControl !== null) {
		var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label,
			color: sagePointers[uniqueID].color};
		var event = {code: data.code, printable: false, state: "up", ctrlId: lockedControl.ctrlId,
			appId: lockedControl.appId, instanceID: lockedControl.instanceID, user: eUser};
		broadcast('keyInTextInputWidget', event);
		if (data.code === 13) {
			// Enter key
			remoteInteraction[uniqueID].dropControl();
		}
		return;
	}

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

	if (obj === null) {
		return;
	}

	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
	switch (obj.layerId) {
		case "staticUI": {
			break;
		}
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			// if (remoteInteraction[uniqueID].windowManagementMode()) {
			// 	if (data.code === 8 || data.code === 46) { // backspace or delete
			// 		deleteApplication(obj.data.id);

			// 		var eLogData = {
			// 			application: {
			// 				id: obj.data.id,
			// 				type: obj.data.application
			// 			}
			// 		};
			// 		addEventToUserLog(uniqueID, {type: "delete", data: eLogData, time: Date.now()});
			// 	}
			// } else if (remoteInteraction[uniqueID].appInteractionMode()) {
			// 	sendKeyUpToApplication(uniqueID, obj.data, localPt, data);
			// }
			if (data.code === 8 || data.code === 46) { // backspace or delete
				deleteApplication(obj.data.id);

				var eLogData = {
					application: {
						id: obj.data.id,
						type: obj.data.application
					}
				};
				addEventToUserLog(uniqueID, {type: "delete", data: eLogData, time: Date.now()});
			} else {
				sendKeyUpToApplication(uniqueID, obj.data, localPt, data);
			}
			break;
		}
		case "portals": {
			keyUpOnPortal(uniqueID, obj.data.id, localPt, data);
			break;
		}
	}
}

function sendKeyUpToApplication(uniqueID, app, localPt, data) {
	var portal = findApplicationPortal(app);
	var titleBarHeight = config.ui.titleBarHeight;
	if (portal !== undefined && portal !== null) {
		titleBarHeight = portal.data.titleBarHeight;
	}

	var ePosition = {x: localPt.x, y: localPt.y - titleBarHeight};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};
	var eData =  {code: data.code, state: "up"};

	var event = {id: app.id, type: "specialKey", position: ePosition, user: eUser, data: eData, date: Date.now()};
	broadcast('eventInItem', event);

	var eLogData = {
		type: "specialKey",
		application: {
			id: app.id,
			type: app.application
		},
		code: eData.code,
		state: eData.state
	};
	addEventToUserLog(uniqueID, {type: "applicationInteraction", data: eLogData, time: Date.now()});
}

function keyUpOnPortal(uniqueID, portalId, localPt, data) {
	checkForSpecialKeys(uniqueID, data.code, false);

	var portal = SAGE2Items.portals.list[portalId];
	var scaledPt = {x: localPt.x / portal.scale, y: (localPt.y - config.ui.titleBarHeight) / portal.scale};
	if (remoteInteraction[uniqueID].local && remoteInteraction[uniqueID].portal !== null) {
		var rData = {
			id: uniqueID,
			left: scaledPt.x,
			top: scaledPt.y,
			code: data.code
		};
		remoteSharingSessions[portalId].wsio.emit('remoteSageKeyUp', rData);
	}

	var pObj = SAGE2Items.portals.interactMgr[portalId].searchGeometry(scaledPt);

	if (pObj === null) {
		return;
	}

	// var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
	switch (pObj.layerId) {
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			sendKeyUpToApplication(uniqueID, pObj.data, scaledPt, data);
			break;
		}
	}
}

function keyPress(uniqueID, pointerX, pointerY, data) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var modeSwitch = false;
	if (data.code === 9 && remoteInteraction[uniqueID].SHIFT && sagePointers[uniqueID].visible) {
		// shift + tab
		remoteInteraction[uniqueID].toggleModes();
		broadcast('changeSagePointerMode', {id: sagePointers[uniqueID].id, mode: remoteInteraction[uniqueID].interactionMode});

		if (remoteInteraction[uniqueID].modeChange !== undefined) {
			clearTimeout(remoteInteraction[uniqueID].modeChange);
		}
		remoteInteraction[uniqueID].modeChange = setTimeout(function() {
			delete remoteInteraction[uniqueID].modeChange;
		}, 500);

		modeSwitch = true;
	}
	var lockedControl = remoteInteraction[uniqueID].lockedControl();

	if (lockedControl !== null) {
		var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label,
					color: sagePointers[uniqueID].color};
		var event = {code: data.code, printable: true, state: "press", ctrlId: lockedControl.ctrlId,
					appId: lockedControl.appId, instanceID: lockedControl.instanceID, user: eUser};
		broadcast('keyInTextInputWidget', event);
		if (data.code === 13) {
			// Enter key
			remoteInteraction[uniqueID].dropControl();
		}
		return;
	}

	var obj = interactMgr.searchGeometry({x: pointerX, y: pointerY});

	if (obj === null) {
		return;
	}

	var localPt = globalToLocal(pointerX, pointerY, obj.type, obj.geometry);
	switch (obj.layerId) {
		case "staticUI": {
			break;
		}
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			if (modeSwitch === false && remoteInteraction[uniqueID].appInteractionMode()) {
				sendKeyPressToApplication(uniqueID, obj.data, localPt, data);
			}
			break;
		}
		case "portals": {
			if (modeSwitch === true) {
				remoteSharingSessions[obj.data.id].wsio.emit('remoteSagePointerToggleModes',
					{id: uniqueID, mode: remoteInteraction[uniqueID].interactionMode});
			} else if (remoteInteraction[uniqueID].appInteractionMode()) {
				keyPressOnPortal(uniqueID, obj.data.id, localPt, data);
			}
			break;
		}
	}
}

function sendKeyPressToApplication(uniqueID, app, localPt, data) {
	var portal = findApplicationPortal(app);
	var titleBarHeight = config.ui.titleBarHeight;
	if (portal !== undefined && portal !== null) {
		titleBarHeight = portal.data.titleBarHeight;
	}

	var ePosition = {x: localPt.x, y: localPt.y - titleBarHeight};
	var eUser = {id: sagePointers[uniqueID].id, label: sagePointers[uniqueID].label, color: sagePointers[uniqueID].color};

	var event = {id: app.id, type: "keyboard", position: ePosition, user: eUser, data: data, date: Date.now()};
	broadcast('eventInItem', event);

	var eLogData = {
		type: "keyboard",
		application: {
			id: app.id,
			type: app.application
		},
		code: data.code,
		character: data.character
	};
	addEventToUserLog(uniqueID, {type: "applicationInteraction", data: eLogData, time: Date.now()});
}

function keyPressOnPortal(uniqueID, portalId, localPt, data) {
	var portal = SAGE2Items.portals.list[portalId];
	var scaledPt = {x: localPt.x / portal.scale, y: (localPt.y - config.ui.titleBarHeight) / portal.scale};
	if (remoteInteraction[uniqueID].local && remoteInteraction[uniqueID].portal !== null) {
		var rData = {
			id: uniqueID,
			left: scaledPt.x,
			top: scaledPt.y,
			code: data.code,
			character: data.character
		};
		remoteSharingSessions[portalId].wsio.emit('remoteSageKeyPress', rData);
	}

	var pObj = SAGE2Items.portals.interactMgr[portalId].searchGeometry(scaledPt);

	if (pObj === null) {
		return;
	}

	// var pLocalPt = globalToLocal(scaledPt.x, scaledPt.y, pObj.type, pObj.geometry);
	switch (pObj.layerId) {
		case "radialMenus": {
			break;
		}
		case "widgets": {
			break;
		}
		case "applications": {
			sendKeyPressToApplication(uniqueID, pObj.data, scaledPt, data);
			break;
		}
	}
}


function toggleApplicationFullscreen(uniqueID, app) {
	var resizeApp;
	if (app.maximized !== true) { // maximize
		resizeApp = remoteInteraction[uniqueID].maximizeSelectedItem(app);
	} else { // restore to previous
		resizeApp = remoteInteraction[uniqueID].restoreSelectedItem(app);
	}
	if (resizeApp !== null) {
		broadcast('startMove', {id: resizeApp.elemId, date: Date.now()});
		broadcast('startResize', {id: resizeApp.elemId, date: Date.now()});

		var a = {
			id: app.id,
			type: app.application
		};
		var l = {
			x: parseInt(app.left, 10),
			y: parseInt(app.top, 10),
			width: parseInt(app.width, 10),
			height: parseInt(app.height, 10)
		};

		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "move", action: "start", application: a, location: l}, time: Date.now()});
		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "resize", action: "start", application: a, location: l}, time: Date.now()});

		moveAndResizeApplicationWindow(resizeApp);

		broadcast('finishedMove', {id: resizeApp.elemId, date: Date.now()});
		broadcast('finishedResize', {id: resizeApp.elemId, date: Date.now()});

		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "move", action: "end", application: a, location: l}, time: Date.now()});
		addEventToUserLog(uniqueID, {type: "windowManagement",
			data: {type: "resize", action: "end", application: a, location: l}, time: Date.now()});
	}
}

function deleteApplication(appId, portalId) {
	if (!SAGE2Items.applications.list.hasOwnProperty(appId)) {
		return;
	}
	var app = SAGE2Items.applications.list[appId];
	var application = app.application;
	if (application === "media_stream" || application === "media_block_stream") {
		var i;
		var mediaStreamData = appId.split("|");
		var sender = {wsio: null, clientId: mediaStreamData[0], streamId: parseInt(mediaStreamData[1], 10)};
		for (i = 0; i < clients.length; i++) {
			if (clients[i].id === sender.clientId) {
				sender.wsio = clients[i];
			}
		}
		if (sender.wsio !== null) {
			sender.wsio.emit('stopMediaCapture', {streamId: sender.streamId});
		}
	}

	SAGE2Items.applications.removeItem(appId);
	var im = findInteractableManager(appId);
	im.removeGeometry(appId, "applications");
	var widgets = SAGE2Items.widgets.list;
	for (var w in widgets) {
		if (widgets.hasOwnProperty(w) && widgets[w].appId === appId) {
			im.removeGeometry(widgets[w].id, "widgets");
			SAGE2Items.widgets.removeItem(widgets[w].id);
		}
	}

	stickyAppHandler.removeElement(app);
	broadcast('deleteElement', {elemId: appId});

	if (portalId !== undefined && portalId !== null) {
		var ts = Date.now() + remoteSharingSessions[portalId].timeOffset;
		remoteSharingSessions[portalId].wsio.emit('deleteApplication', {appId: appId, date: ts});
	}
}


function pointerDraw(uniqueID, data) {
	var ePos  = {x: 0, y: 0};
	var eUser = {id: null, label: 'drawing', color: [220, 10, 10]};
	var now   = Date.now();

	var key;
	var app;
	var event;
	for (key in SAGE2Items.applications.list) {
		app = SAGE2Items.applications.list[key];
		// Send the drawing events only to whiteboard apps
		if (app.application === 'whiteboard') {
			event = {id: app.id, type: "pointerDraw", position: ePos, user: eUser, data: data, date: now};
			broadcast('eventInItem', event);
		}
	}
}


function pointerCloseGesture(uniqueID, pointerX, pointerY, time, gesture) {
	if (sagePointers[uniqueID] === undefined) {
		return;
	}

	var elem = null;
	if (elem !== null) {
		if (elem.closeGestureID === undefined && gesture === 0) { // gesture: 0 = down, 1 = hold/move, 2 = up
			elem.closeGestureID = uniqueID;
			elem.closeGestureTime = time + closeGestureDelay; // Delay in ms
		} else if (elem.closeGestureTime <= time && gesture === 1) { // Held long enough, remove
			deleteApplication(elem);
		} else if (gesture === 2) { // Released, reset timer
			elem.closeGestureID = undefined;
		}
	}
}

function handleNewApplication(appInstance, videohandle) {
	broadcast('createAppWindow', appInstance);
	broadcast('createAppWindowPositionSizeOnly', getAppPositionSize(appInstance));

	var zIndex = SAGE2Items.applications.numItems + SAGE2Items.portals.numItems;
	interactMgr.addGeometry(appInstance.id, "applications", "rectangle", {
		x: appInstance.left, y: appInstance.top,
		w: appInstance.width, h: appInstance.height + config.ui.titleBarHeight},
		true, zIndex, appInstance);

	var cornerSize   = 0.2 * Math.min(appInstance.width, appInstance.height);
	var oneButton    = Math.round(config.ui.titleBarHeight) * (300 / 235);
	var buttonsPad   = 0.1 * oneButton;
	var startButtons = appInstance.width - Math.round(3 * oneButton + 2 * buttonsPad);
	/*
	var buttonsWidth = config.ui.titleBarHeight * (324.0/111.0);
	var buttonsPad   = config.ui.titleBarHeight * ( 10.0/111.0);
	var oneButton    = buttonsWidth / 2; // two buttons
	var startButtons = appInstance.width - buttonsWidth;
	*/

	SAGE2Items.applications.addItem(appInstance);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "titleBar", "rectangle",
		{x: 0, y: 0, w: appInstance.width, h: config.ui.titleBarHeight}, 0);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "syncButton", "rectangle",
		{x: startButtons, y: 0, w: oneButton, h: config.ui.titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "fullscreenButton", "rectangle",
		{x: startButtons + (1 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: config.ui.titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "closeButton", "rectangle",
		{x: startButtons + (2 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: config.ui.titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "dragCorner", "rectangle",
		{x: appInstance.width - cornerSize,
		y: appInstance.height + config.ui.titleBarHeight - cornerSize, w: cornerSize, h: cornerSize}, 2);
	SAGE2Items.applications.editButtonVisibilityOnItem(appInstance.id, "syncButton", false);

	initializeLoadedVideo(appInstance, videohandle);
}

function handleNewApplicationInDataSharingPortal(appInstance, videohandle, portalId) {
	broadcast('createAppWindowInDataSharingPortal', {portal: portalId, application: appInstance});

	var zIndex = remoteSharingSessions[portalId].appCount;
	var titleBarHeight = SAGE2Items.portals.list[portalId].titleBarHeight;
	SAGE2Items.portals.interactMgr[portalId].addGeometry(appInstance.id, "applications", "rectangle",
		{x: appInstance.left, y: appInstance.top,
		w: appInstance.width, h: appInstance.height + titleBarHeight},
		true, zIndex, appInstance);

	var cornerSize = 0.2 * Math.min(appInstance.width, appInstance.height);
	var oneButton    = Math.round(titleBarHeight) * (300 / 235);
	var buttonsPad   = 0.1 * oneButton;
	var startButtons = appInstance.width - Math.round(3 * oneButton + 2 * buttonsPad);
	/*
	var buttonsWidth = titleBarHeight * (324.0/111.0);
	var buttonsPad   = titleBarHeight * ( 10.0/111.0);
	var oneButton    = buttonsWidth / 2; // two buttons
	var startButtons = appInstance.width - buttonsWidth;
	*/

	SAGE2Items.applications.addItem(appInstance);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "titleBar", "rectangle",
		{x: 0, y: 0, w: appInstance.width, h: titleBarHeight}, 0);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "syncButton", "rectangle",
		{x: startButtons, y: 0, w: oneButton, h: titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "fullscreenButton", "rectangle",
		{x: startButtons + (1 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "closeButton", "rectangle",
		{x: startButtons + (2 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: titleBarHeight}, 1);
	SAGE2Items.applications.addButtonToItem(appInstance.id, "dragCorner", "rectangle",
		{x: appInstance.width - cornerSize, y: appInstance.height + titleBarHeight - cornerSize, w: cornerSize, h: cornerSize}, 2);
	SAGE2Items.applications.editButtonVisibilityOnItem(appInstance.id, "syncButton", false);

	initializeLoadedVideo(appInstance, videohandle);
}

function handleApplicationResize(appId) {
	if (SAGE2Items.applications.list[appId] === undefined) {
		return;
	}

	var app = SAGE2Items.applications.list[appId];
	var portal = findApplicationPortal(app);
	var titleBarHeight = config.ui.titleBarHeight;
	if (portal !== undefined && portal !== null) {
		titleBarHeight = portal.data.titleBarHeight;
	}

	var cornerSize = 0.2 * Math.min(app.width, app.height);
	var oneButton    = Math.round(titleBarHeight) * (300 / 235);
	var buttonsPad   = 0.1 * oneButton;
	var startButtons = app.width - Math.round(3 * oneButton + 2 * buttonsPad);
	/*
	var buttonsWidth = titleBarHeight * (324.0/111.0);
	var buttonsPad   = titleBarHeight * ( 10.0/111.0);
	var oneButton    = buttonsWidth / 2; // two buttons
	var startButtons = app.width - buttonsWidth;
	*/

	SAGE2Items.applications.editButtonOnItem(appId, "titleBar", "rectangle",
		{x: 0, y: 0, w: app.width, h: titleBarHeight});
	SAGE2Items.applications.editButtonOnItem(appId, "syncButton", "rectangle",
		{x: startButtons, y: 0, w: oneButton, h: titleBarHeight});
	SAGE2Items.applications.editButtonOnItem(appId, "fullscreenButton", "rectangle",
		{x: startButtons + (1 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: titleBarHeight});
	SAGE2Items.applications.editButtonOnItem(appId, "closeButton", "rectangle",
		{x: startButtons + (2 * (buttonsPad + oneButton)), y: 0, w: oneButton, h: titleBarHeight});
	SAGE2Items.applications.editButtonOnItem(appId, "dragCorner", "rectangle",
		{x: app.width - cornerSize, y: app.height + titleBarHeight - cornerSize, w: cornerSize, h: cornerSize});
}

function handleDataSharingPortalResize(portalId) {
	if (SAGE2Items.portals.list[portalId] === undefined) {
		return;
	}

	SAGE2Items.portals.list[portalId].scale = SAGE2Items.portals.list[portalId].width /
											SAGE2Items.portals.list[portalId].natural_width;
	var portalWidth = SAGE2Items.portals.list[portalId].width;
	var portalHeight = SAGE2Items.portals.list[portalId].height;

	var cornerSize   = 0.2 * Math.min(portalWidth, portalHeight);
	var oneButton    = Math.round(config.ui.titleBarHeight) * (300 / 235);
	var buttonsPad   = 0.1 * oneButton;
	var startButtons = portalWidth - Math.round(2 * oneButton + buttonsPad);
	/*
	var buttonsWidth = (config.ui.titleBarHeight-4) * (324.0/111.0);
	var buttonsPad   = (config.ui.titleBarHeight-4) * ( 10.0/111.0);
	var oneButton    = buttonsWidth / 2; // two buttons
	var startButtons = portalWidth - buttonsWidth;
	*/

	SAGE2Items.portals.editButtonOnItem(portalId, "titleBar", "rectangle",
		{x: 0, y: 0, w: portalWidth, h: config.ui.titleBarHeight});
	SAGE2Items.portals.editButtonOnItem(portalId, "fullscreenButton", "rectangle",
		{x: startButtons, y: 0, w: oneButton, h: config.ui.titleBarHeight});
	SAGE2Items.portals.editButtonOnItem(portalId, "closeButton", "rectangle",
		{x: startButtons + buttonsPad + oneButton, y: 0, w: oneButton, h: config.ui.titleBarHeight});
	SAGE2Items.portals.editButtonOnItem(portalId, "dragCorner", "rectangle",
		{x: portalWidth - cornerSize, y: portalHeight + config.ui.titleBarHeight - cornerSize, w: cornerSize, h: cornerSize});
}

function findInteractableManager(appId) {
	if (interactMgr.hasObjectWithId(appId) === true) {
		return interactMgr;
	}

	var key;
	for (key in SAGE2Items.portals.interactMgr) {
		if (SAGE2Items.portals.interactMgr[key].hasObjectWithId(appId) === true) {
			return SAGE2Items.portals.interactMgr[key];
		}
	}

	return null;
}

function findApplicationPortal(app) {
	if (app === undefined || app === null) {
		return null;
	}

	var portalIdx = app.id.indexOf("_portal");
	if (portalIdx < 0) {
		return null;
	}

	var portalId = app.id.substring(portalIdx + 1, app.id.length);
	return interactMgr.getObject(portalId, "portals");
}


// **************  Omicron section *****************
var omicronRunning = false;
if (config.experimental && config.experimental.omicron && config.experimental.omicron.enable === true) {
	var omicronManager = new Omicron(config);

	var closeGestureDelay = 1500;

	if (config.experimental.omicron.closeGestureDelay !== undefined) {
		closeGestureDelay = config.experimental.omicron.closeGestureDelay;
	}

	omicronManager.setCallbacks(
		sagePointers,
		createSagePointer,
		showPointer,
		pointerPress,
		pointerMove,
		pointerPosition,
		hidePointer,
		pointerRelease,
		pointerScrollStart,
		pointerScroll,
		pointerDblClick,
		pointerCloseGesture,
		keyDown,
		keyUp,
		keyPress,
		createRadialMenu
	);
	omicronManager.runTracker();
	omicronRunning = true;
}

/* ****** Radial Menu section ************************************************************** */
// createMediabrowser();

function createRadialMenu(uniqueID, pointerX, pointerY) {
	var validLocation = true;
	var newMenuPos = {x: pointerX, y: pointerY};
	var existingRadialMenu = null;
	// Make sure there's enough distance from other menus
	for (var key in SAGE2Items.radialMenus.list) {
		existingRadialMenu = SAGE2Items.radialMenus.list[key];
		var prevMenuPos = {x: existingRadialMenu.left, y: existingRadialMenu.top };
		var distance = Math.sqrt(Math.pow(Math.abs(newMenuPos.x - prevMenuPos.x), 2) +
						Math.pow(Math.abs(newMenuPos.y - prevMenuPos.y), 2));
		if (existingRadialMenu.visible && distance < existingRadialMenu.radialMenuSize.x) {
			// validLocation = false;
			// console.log("Menu is too close to existing menu");
		}
	}

	if (validLocation && SAGE2Items.radialMenus.list[uniqueID + "_menu"] === undefined) {
		var newRadialMenu = new Radialmenu(uniqueID, uniqueID, config);
		newRadialMenu.generateGeometry(interactMgr, SAGE2Items.radialMenus);
		newRadialMenu.setPosition(newMenuPos);

		SAGE2Items.radialMenus.list[uniqueID + "_menu"] = newRadialMenu;

		// Open a 'media' radial menu
		broadcast('createRadialMenu', newRadialMenu.getInfo());
	} else if (validLocation && SAGE2Items.radialMenus.list[uniqueID + "_menu"] !== undefined) {
		setRadialMenuPosition(uniqueID, pointerX, pointerY);
		broadcast('updateRadialMenu', existingRadialMenu.getInfo());
	}
	updateRadialMenu(uniqueID);
}

/**
* Translates position of a radial menu by an offset
*
* @method moveRadialMenu
* @param uniqueID {Integer} radial menu ID
* @param pointerX {Float} offset x position
* @param pointerY {Float} offset y position
*/
function moveRadialMenu(uniqueID, pointerX, pointerY) {
	var existingRadialMenu = SAGE2Items.radialMenus.list[uniqueID + "_menu"];

	if (existingRadialMenu) {

		existingRadialMenu.setPosition({x: existingRadialMenu.left + pointerX, y: existingRadialMenu.top + pointerY});
		existingRadialMenu.visible = true;

		broadcast('updateRadialMenu', existingRadialMenu.getInfo());
	}
}

/**
* Sets the absolute position of a radial menu
*
* @method setRadialMenuPosition
* @param uniqueID {Integer} radial menu ID
* @param pointerX {Float} x position
* @param pointerY {Float} y position
*/
function setRadialMenuPosition(uniqueID, pointerX, pointerY) {
	var existingRadialMenu = SAGE2Items.radialMenus.list[uniqueID + "_menu"];

	// Sets the position and visibility
	existingRadialMenu.setPosition({x: pointerX, y: pointerY});

	// Update the interactable geometry
	interactMgr.editGeometry(uniqueID + "_menu_radial", "radialMenus", "circle",
			{x: existingRadialMenu.left, y: existingRadialMenu.top, r: existingRadialMenu.radialMenuSize.y / 2});
	showRadialMenu(uniqueID);
	// Send the updated radial menu state to the display clients (and set menu visible)
	broadcast('updateRadialMenu', existingRadialMenu.getInfo());
}

/**
* Shows radial menu and enables interactivity
*
* @method showRadialMenu
* @param uniqueID {Integer} radial menu ID
*/
function showRadialMenu(uniqueID) {
	var radialMenu = SAGE2Items.radialMenus.list[uniqueID + "_menu"];

	if (radialMenu !== undefined) {
		radialMenu.visible = true;
		interactMgr.editVisibility(uniqueID + "_menu_radial", "radialMenus", true);
		interactMgr.editVisibility(uniqueID + "_menu_thumbnail", "radialMenus", false);
	}
}

/**
* Hides radial menu and enables interactivity
*
* @method hideRadialMenu
* @param uniqueID {Integer} radial menu ID
*/
function hideRadialMenu(uniqueID) {
	var radialMenu = SAGE2Items.radialMenus.list[uniqueID + "_menu"];
	if (radialMenu !== undefined) {
		radialMenu.hide();
	}
}

function updateRadialMenu(uniqueID) {
	var list = getSavedFilesList();

	broadcast('updateRadialMenuDocs', {id: uniqueID, fileList: list});
}

// Sends button state update messages to display
function radialMenuEvent(data) {
	if (data.type === "stateChange") {
		broadcast('radialMenuEvent', data);

		if (data.menuState.action !== undefined && data.menuState.action.type === "saveSession") {
			var ad    = new Date();
			var sname = sprint("session_%4d_%02d_%02d_%02d_%02d_%02s",
							ad.getFullYear(), ad.getMonth() + 1, ad.getDate(),
							ad.getHours(), ad.getMinutes(), ad.getSeconds());
			saveSession(sname);
		} else if (data.menuState.action !== undefined && data.menuState.action.type === "tileContent") {
			tileApplications();
		} else if (data.menuState.action !== undefined && data.menuState.action.type === "clearAllContent") {
			clearDisplay();
		}
	} else {
		broadcast('radialMenuEvent', data);
	}
}

// Check for pointer move events that are dragging a radial menu (but outside the menu)
function updateRadialMenuPointerPosition(uniqueID, pointerX, pointerY) {
	for (var key in SAGE2Items.radialMenus.list) {
		var radialMenu = SAGE2Items.radialMenus.list[key];
		// console.log(data.id+"_menu: " + radialMenu);
		if (radialMenu !== undefined && radialMenu.dragState === true) {
			var offset = radialMenu.getDragOffset(uniqueID, {x: pointerX, y: pointerY});
			moveRadialMenu(radialMenu.id, offset.x, offset.y);
		}
	}
}

function wsRemoveRadialMenu(wsio, data) {
	hideRadialMenu(data.id);
}

function wsRadialMenuThumbnailWindow(wsio, data) {
	var radialMenu = SAGE2Items.radialMenus.list[data.id + "_menu"];

	if (radialMenu !== undefined) {
		radialMenu.openThumbnailWindow(data);

		var thumbnailWindowPos = radialMenu.getThumbnailWindowPosition();
		interactMgr.editGeometry(data.id + "_menu_thumbnail", "radialMenus", "rectangle",
				{x: thumbnailWindowPos.x, y: thumbnailWindowPos.y,
				w: radialMenu.thumbnailWindowSize.x,
				h: radialMenu.thumbnailWindowSize.y});
		interactMgr.editVisibility(data.id + "_menu_thumbnail", "radialMenus", data.thumbnailWindowOpen);
	}
}

function wsRadialMenuMoved(wsio, data) {
	var radialMenu = SAGE2Items.radialMenus.list[data.uniqueID + "_menu"];
	if (radialMenu !== undefined) {
		radialMenu.setPosition(data);
	}
}


function attachAppIfSticky(backgroundItem, appId) {
	var app = SAGE2Items.applications.list[appId];
	if (app === null || app.sticky !== true) {
		return;
	}
	stickyAppHandler.detachStickyItem(app);
	if (backgroundItem !== null) {
		stickyAppHandler.attachStickyItem(backgroundItem, app);
	}
}


function showOrHideWidgetLinks(data) {
	var obj = data.item;
	var appId = obj.id;
	if (obj.data !== undefined && obj.data !== null && obj.data.appId !== undefined) {
		appId = obj.data.appId;
	}
	var app = SAGE2Items.applications.list[appId];
	if (app !== null && app !== undefined) {
		app = getAppPositionSize(app);
		app.user_id = data.uniqueID;
		if (data.show === true) {
			app.user_color = data.user_color;
			if (app.user_color !== null) {
				appUserColors[appId] = app.user_color;
			}
			broadcast('showWidgetToAppConnector', app);
		} else {
			broadcast('hideWidgetToAppConnector', app);
		}
	}
}
