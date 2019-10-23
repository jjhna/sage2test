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


var crypto  = require('crypto');              // https encryption
var exec    = require('child_process').exec;  // execute external application
var fs      = require('fs');                  // filesystem access
var path    = require('path');                // resolve directory paths
var tls     = require('tls');                 // https encryption

var querystring = require('querystring');     // utilities for dealing with URL

// npm external modules
var request   = require('request');           // http requests
var semver    = require('semver');            // parse version numbers
var fsmonitor = require('fsmonitor');         // file system monitoring
var sanitizer = require('sanitizer');         // Caja's HTML Sanitizer as a Node.js module
var chalk     = require('chalk');             // colorize console output
var stripansi = require('strip-ansi');        // remove ANSI color codes
var rimraf    = require('rimraf');            // command rm -rf for node



function knockSend(data, remoteSites) {

	console.log("TODO, try knock on the remote site using data:", data);

	for (let i = 0; i < remoteSites.length; i++) {
		if (remoteSites[i].name === data.name) {
			console.log("Matching remote site found", remoteSites[i].name);
			remoteSites[i].wsio.emit("remoteConnection", {
				status: "refused",
				reason: "Unavailable by user choice",
			});
			return;
		}
	}
	console.log("No match found");
}

function makeUnavailable(data, remoteSites) {
	console.log("TODO, become unavailable. Is there an exception?", data);
	for (let i = 0; i < remoteSites.length; i++) {
		if ((remoteSites[i].connected === "on") 
			|| (remoteSites[i].connected === "locked")){
				if (data && (remoteSites[i].name === data.name)) {
					console.log("Matching remote site found, wont ignore ", remoteSites[i].name);
				} else {
					console.log("Becoming unavailable to:" + remoteSites[i].name);
					remoteSites[i].wsio.emit("remoteConnection", {
						status: "refused",
						reason: "Unavailable by user choice",
					});
				}
		}
	}
}





module.exports.knockSend      = knockSend;
module.exports.makeUnavailable    = makeUnavailable;
