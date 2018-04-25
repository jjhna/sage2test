// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-17

"use strict";

let SnippetsManager = (function() {
	return function(communication, sysConfig) {
		// private
		let self = {
			comm: communication, // { broadcast, clients }
			config: (sysConfig.experimental && (sysConfig.experimental.codesnippets || {})) || {},

			loaded: []
		};

		function getDependencies() {
			return self.config.libraries || [];
		}

		function getLoadedSnippetInfo() {
			return self.loaded;
		}

		function addLoadedSnippet(info) {
			self.loaded.push(info);
		}

		function displayClientConnect(client) {

		}

		// public
		return {
			getDependencies,

			getLoadedSnippetInfo,
			addLoadedSnippet,
			displayClientConnect
		};
	};
}());

module.exports = SnippetsManager;
