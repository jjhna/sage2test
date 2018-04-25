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
			links: {},
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

			console.log(Object.values(self.loaded).map(i => i.snippetID));
		}

		function updateSnippetAssociations(topology) {

		}

		function updateFunctionStatus(status) {
			self.status = status;
		}

		function displayClientConnect(wsio) {
			for (let filename of Object.keys(self.loaded)) {
				wsio.emit("createSnippetFromFileWithID", self.loaded[filename]);
			}
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
