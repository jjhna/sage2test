// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

// require variables to be declared
"use strict";


// Built in
var fs            = require('fs');               // filesystem access
// Defined in package.json
var json5         = require('json5');            // Relaxed JSON format




/**
 * Function to handle background Image update
 * @param url {String} URL of image
 * @param config {Object} Current configuration file
 * @param clients {Array} all clients array
 */
function configUpdateBackgroundImage(url, config, clients) {

	// // Update and keep changes made to the configuration file.
	// var json_str   = fs.readFileSync(configLocation, "utf8");
	// // Parse it using JSON5 syntax (more lax than strict JSON)
	// var userConfig = json5.parse(json_str);

	// Ensure an entry for background.image exists
	if (!config.background.image) {
		config.background.image = {};
	}
	config.background.image.url = url;

	console.log("erase me, configUpdateBackgroundImage config check ", config);

	// Write file to keep changes.
	// TODO enable this after sure it works
	// fs.writeFileSync(pathToSageUiPwdFile, jsonString);

	// Send to each display client an updated value for the background image
	for (let i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			clients[i].emit("updateDisplayConfiguration", config);
		}
	}

}

/**
 * For rechecking the config file after updated
 *
 * @param pathToConfigFile {String} Path to the config file
 * @param config {Object} Current configuration that was read (file might have changes)
 * @param clients {Array} all clients array
 */
function recheckConfiguration(pathToConfigFile, currentConfig, clients,
	initializeRemoteSites) {
	console.log("TODO implmenent recheckConfiguration");


	console.log("TODO: remove debugging: remotesites recheck");

	// Read the specified configuration file
	var json_str   = fs.readFileSync(pathToConfigFile, 'utf8');
	// Parse it using JSON5 syntax (more lax than strict JSON)
	var userConfig = json5.parse(json_str);


	// Manual update of the remote sites
	currentConfig.remote_sites = userConfig.remote_sites;

	// Must now recheck
	initializeRemoteSites();
}

/**
 * Pass back appropriate configuration file data
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function handlerForRequestCurrentConfigurationFile(currentConfig, wsio) {
	// For minimal changes the tips property needs to be filled out.
	var tips = {};
	tips.layoutWidth  = "";
	tips.layoutHeight = "";
	tips.resolutionWidth  = "";
	tips.resolutionHeight = "";

	currentConfig.tips = tips;

	// Must now recheck
	wsio.emit('requestConfigAndTipsResponse', currentConfig);
}

/**
 * Pass back appropriate configuration file data
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function handlerForAssistedConfigSend(wsio, submittedConfig, currentConfig) {
	// For minimal changes the tips property needs to be filled out.
	console.log("erase me, server received config from assistedConfig. btw submitted config:", submittedConfig);
	let diff = determineDifferentFields(submittedConfig, currentConfig);


	console.log("erase me, adding starter entry {} to differences for formatting");
	diff.splice(0, 0, {});
	console.log("erase me, ", diff);
}
// -------------------------------------------------------------------------------------------------

/**
 * Will return a description of changes.
 *
 * @param submittedConfig {Object} Config submitted that might have changes
 * @param currentConfig {Object} Current config known by server
 */
function determineDifferentFields(submittedConfig, currentConfig) {
	let scKeys = Object.keys(submittedConfig);
	let ccKeys = Object.keys(currentConfig);
	let differences = [];
	let n1, n2;

	// First go through submitted config
	for (let i = 0; i < scKeys.length; i++) {
		if (ccKeys.includes(scKeys[i])) {
			// Basic check, if property is an object, then use basic comparison with string
			if (typeof submittedConfig[scKeys[i]] === "object") {
				n1 = JSON.stringify(submittedConfig[scKeys[i]]);
				n2 = JSON.stringify(currentConfig[scKeys[i]]);
				if (n1 !== n2) {
					n1 = {};
					n1["sc_" + scKeys[i]] = JSON.stringify(submittedConfig[scKeys[i]]);
					n1["cc_" + scKeys[i]] = JSON.stringify(currentConfig[scKeys[i]]);
					differences.push(n1);
				} // For non-object, basic comparison is enough just to detect difference.
			} else if (submittedConfig[scKeys[i]] !== currentConfig[scKeys[i]]) {
				n1 = {};
				n1["sc_" + scKeys[i]] = submittedConfig[scKeys[i]];
				n1["cc_" + scKeys[i]] = currentConfig[scKeys[i]];
				differences.push(n1);
			}
		} else { // entries unique to the submitted
			n1 = {};
			n1[scKeys[i]] = submittedConfig[scKeys[i]];
			n1.uniqueToSubmitted = true;
			differences.push(n1);
		}
	}
	// Find entries only within the current
	for (let i = 0; i < ccKeys.length; i++) {
		if (!scKeys.includes(ccKeys[i])) {
			n1 = {};
			n1[ccKeys[i]] = (typeof currentConfig[ccKeys[i]] === "object") ?
				JSON.stringify(currentConfig[ccKeys[i]]) : currentConfig[ccKeys[i]];
			n1.uniqueToCurrent = true;
			differences.push(n1);
		}
	}
	return differences;
}


// -------------------------------------------------------------------------------------------------

module.exports.configUpdateBackgroundImage = configUpdateBackgroundImage;
module.exports.recheckConfiguration = recheckConfiguration;
module.exports.handlerForRequestCurrentConfigurationFile = handlerForRequestCurrentConfigurationFile;
module.exports.handlerForAssistedConfigSend = handlerForAssistedConfigSend;
