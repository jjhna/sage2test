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

			loaded: {},
			associations: {
				apps: [],
				links: []
			},
			status: []
		};

		function getDependencies() {
			return self.config.libraries || [];
		}

		function getLoadedSnippetInfo() {
			return self.loaded;
		}

		function addLoadedSnippet(info) {
			self.loaded[info.filename] = info;
		}

		function updateSnippetAssociations(associations) {
			self.associations = associations;
			console.log("self.associations:", associations);
		}

		function updateFunctionStatus(status) {
			self.status = status;
		}

		function displayClientConnect(wsio) {
			// load existing snippets
			for (let filename of Object.keys(self.loaded)) {
				wsio.emit("createSnippetFromFileWithID", self.loaded[filename]);
			}

			// send the snippet associations
			wsio.emit("initializeSnippetAssociations", self.associations);
		}

		function sageUIClientConnect(wsio) {
			wsio.emit("editorReceiveSnippetStates", self.status);
		}

		// public
		return {
			getDependencies,

			getLoadedSnippetInfo,
			addLoadedSnippet,

			updateSnippetAssociations,
			updateFunctionStatus,

			displayClientConnect,
			sageUIClientConnect
		};
	};
}());

module.exports = SnippetsManager;
