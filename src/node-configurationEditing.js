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


module.exports.configUpdateBackgroundImage = configUpdateBackgroundImage;
module.exports.recheckConfiguration = recheckConfiguration;
