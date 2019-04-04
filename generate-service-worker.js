// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2016-18

/**
 * Generate a pre-caching service worker
 *
 * @class generate-service-worker
 * @module server
 * @submodule generate-service-worker.js`
 * @requires workbox-build
 */

"use strict";

var path = require('path');
const workboxBuild = require('workbox-build');

var rootDir = 'public/';

function generate() {
	workboxBuild.generateSW({
		swDest: path.join(rootDir, 'service-worker.js'),
		cacheId: "SAGE2",
		importWorkboxFrom: 'local',
		globDirectory: rootDir,
		globPatterns: [
			'favicon.ico',
			'css/*.css',
			'css/Arimo*.woff',
			'css/Arimo*.woff2',
			'images/blank.png',
			'images/*.svg',
			'images/ui/*.svg',
			'images/radialMenu/*.svg',
			'images/appUi/*.svg',
			'images/icons/*.png',
			// HTML pages
			'audioManager.html',
			'index.html',
			'display.html',
			'sageUI.html',
			// not caching session.html
			'lib/webix/webix.js',
			'lib/webix/webix.css',
			'lib/webix/skins/compact.css',
			'lib/moment.min.js',
			'src/*.js'
		],
	}).then(function(e) {
		let workerSize = e.size / (1000 * 1000);
		console.log('WebCache>	', 'Cache generated:', e.count, "files in", workerSize.toFixed(2), "MB");
	});
}

// Run the function if ran directly from node (instead of import)
if (require.main === module) {
	generate();
}

// Export the function
module.exports = generate;
