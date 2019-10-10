//
// SAGE2 application: remoteSiteControls
// by: Dylan Kobayashi <dylank@hawaii.edu>
//
// Copyright (c) 2018
//

"use strict";

// Please see https://bitbucket.org/sage2/sage2/wiki/SAGE2%20Webview%20Container for instructions


var remoteSiteControls = sage2_webview_appCoreV01_extendWebview({
	webpageAppSettings: {
		setSageAppBackgroundColor: true,  // Web pages without background values will be transparent.
		backgroundColor: "white",         // Used if above is true, can also use rgb and hex strings
		enableRightClickNewWindow: false, // If true, right clicking on images or links open new webview
		printConsoleOutputFromPage: true, // If true, when web page uses console.log, container will console.log that value in display client

		// If you want your context entries to appear before or after the default
		putAdditionalContextMenuEntriesBeforeDefaultEntries: true,
		// The following will include the default Webview context menu entry if set to true.
		enableUiContextMenuEntries: {
			navigateBack:       false, // alt left-arrow
			navigateForward:    false, // alt right-arrow
			reload:             true, // alt r
			autoRefresh:        false, // must be selected from UI context menu
			consoleViewToggle:  false, // must be selected from UI context menu
			zoomIn:             true, // alt up-arrow
			zoomOut:            true, // alt down-arrow
			urlTyping:          false, // must be typed from UI context menu
			copyUrlToClipboard: false, // must be typed from UI context menu
		},
	},
	init: function(data) {
		// Will be called after initial SAGE2 init()
		// this.element will refer to the webview tag
		this.resizeEvents = "continuous"; // Recommended not to change. Options: never, continuous, onfinish

		// Path / URL of the page you want to show
		this.changeURL(this.resrcPath + "/webpage/index.html", false);
		this.thereCanOnlyBeOne();
	},
	load: function(date) {
		// OPTIONAL
		// The state will be automatically passed to your webpage through the handler you gave to SAGE2_AppState
		// Use this if you want to alter the state BEFORE it is passed to your webpage. Access with this.state
	},
	draw: function(date) {
		// OPTIONAL
		// Your webpage will be in charge of its view
		// Use this if you want to so something within the SAGE2 Display variables
		// Be sure to set 'this.maxFPS' within init() if this is desired.
		// FPS only works if instructions sets animation true
	},
	resize: function() {
		// OPTIONAL
	},
	getContextEntries: function() {
		// OPTIONAL
		// This can be used to allow UI interaction to your webpage
		// Entires are added after entries of enableUiContextMenuEntries 
		var entries = [];
		// entries.push({
		// 	description: "This text is seen in the UI",
		// 	callback: "makeAFunctionMatchingThisString", // The string will specify which function to activate
		// 	parameters: {},
		// 	// The called function will be passed an Object.
		// 	// Each of the parameter properties will be in that object
		// 	// Some properties are reserved and may be automatically filled in.
		// });
		return entries;
	},
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// Support functions
	thereCanOnlyBeOne: function() {
		// the newest one is the survivor
		let allas = applications;
		let ids = Object.keys(allas);
		let app = null;
		for (let i = 0; i < ids.length; i++) {
			app = allas[ids[i]];
			if (app.application == "remoteSiteControls") {
				if (app.id != this.id) {
					wsio.emit("deleteApplication", {appId: app.id});
				} 
			}
		}
	},

	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// Functions that interact with webpage

	// Functions can be called from the webpage, see the webpage/main.js file for example
	consolePrint: function (value) {
		console.log(value);
	},

	webpageRequestingUiSize: function(params) {
		this.callFunctionInWebpage("handlerForUiSize", ui.titleTextSize);
		this.callFunctionInWebpage("handleSiteNotification", this.state.remoteSiteInformation);
	},
	



});