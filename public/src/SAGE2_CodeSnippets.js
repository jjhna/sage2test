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

/* wsio */

let SAGE2_CodeSnippets = (function() {
	let self = {
		functions: {},
		functionCount: 0,

		links: {},
		linkCount: 0,

		datasets: [],
		drawings: []

	};

	init();

	function init() {
		console.log("SAGE2_CodeSnippets initialized");

		// open app for snippets?
	}

	function getNewFunctionID() {
		return "codeSnippet-" + self.functionCount++;
	}

	function getFunctionInfo() {
		let functionInfo = {};

		Object.keys(self.functions).forEach(id => {
			functionInfo[id] = {
				id,
				type: self.functions[id].type,
				src: self.functions[id].src,
				desc: self.functions[id].desc,
				locked: self.functions[id].editor !== null
			};
		});

		return functionInfo;
	}

	function updateFunctionDefinition(id, definition) {
		// update the saved function definition
		let func = self.functions[id] = definition;

		// update links which use this function
		if (func.links) {
			for (let linkID of func.links) {
				self.links[linkID].update();
			}
		}

		// send info for user who saved code to load
		wsio.emit("snippetSendCodeOnLoad", {
			scriptID: id,
			to: definition.editor,
			text: definition.text,
			type: definition.type
		});

		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);
	}

	function saveSnippet(uniqueID, code, desc, type, scriptID) {
		var script = document.createElement("script");

		let links;

		if (scriptID !== "new") {
			let oldFunction = self.functions[scriptID];

			// save the links, remove the old script
			document.getElementById(scriptID).remove();
			links = oldFunction.links;

			// clear any intervals remaining from a generator script
			if (oldFunction.interval) {
				clearInterval(oldFunction.interval);
			}
		} else {
			links = [];
		}

		script.text = createScriptBody(uniqueID, code, desc, links, scriptID, type);

		script.charset = "utf-8";

		console.log("Appending script text");
		document.body.appendChild(script);
	}

	function createScriptBody(uniqueID, code, desc, links, scriptID, type) {
		let startBlock = `(function() {
			console.log('Sandbox script Loading');
			// check if script with same src exists

			let key;
			let srcLoadedIn;

			let allFunctionInfo = SAGE2_CodeSnippets.getFunctionInfo();

			// check for scripts loaded from .js file
			if (document.currentScript.src !== "") {
				srcLoadedIn = Object.keys(functionInfo).find(f => {
					return functionInfo[f].src === document.currentScript.src
				});
			}

			if (srcLoadedIn) {
				key = srcLoadedIn;

				document.getElementById(key).remove();
			} else {
				key = "${scriptID}" === "new" ? SAGE2_CodeSnippets.getNewFunctionID() : "${scriptID}";
			}

			// loaded from script
			let functionDefinition = {
				src: document.currentScript.src !== "" ? document.currentScript.src : "user-defined",
				type: "${type}",
				desc: "${desc}",
				editor: "${uniqueID}",
				links: JSON.parse("${links ? JSON.stringify(links) : []}"),
				text: \`${code.replace(/`/gi, "\\`")}\`,
				code: `;

		let endBlock = `
			}

			// update Snippet Curator with new information
			SAGE2_CodeSnippets.updateFunctionDefinition(key, functionDefinition);

			// set ID of the script in order to remove old script on update
			document.currentScript.id = key;

		})();`;

		return startBlock + createFunctionBlock(type, code) + endBlock;
	}

	function createFunctionBlock(type, code) {
		let functionBlocks = {
			data: `(function (data) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here
				
				${code}

				/* END USER DEFINED CODE*/
			})`,
			draw: `(function (data, svg) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here

				${code}
				
				/* END USER DEFINED CODE*/
		
			})`,
			gen: `(function (previousData) {
				// Promise to handle async
				return new Promise(function(resolve, reject) {
					/* USER DEFINED CODE */
					// Code written by user will be inserted here

					${code}

				});
				/* END USER DEFINED CODE*/
			})`
		};

		return functionBlocks[type];
	}

	function requestSnippetLoad(uniqueID, scriptID) {
		// send script to user
		if (self.functions[scriptID] && !self.functions[scriptID].editor) {
			self.functions[scriptID].editor = uniqueID;

			wsio.emit("snippetSendCodeOnLoad", {
				scriptID: scriptID,
				to: self.functions[scriptID].editor,
				text: self.functions[scriptID].text,
				type: self.functions[scriptID].type
			});
		}

		// broadcast update of function states
		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);
	}

	function notifySnippetClosed(uniqueID, scriptID) {
		self.functions[scriptID].editor = null;

		// broadcast update of function states
		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);
	}

	return {
		getNewFunctionID,
		updateFunctionDefinition,

		getFunctionInfo,
		saveSnippet,

		requestSnippetLoad,
		notifySnippetClosed
	};
}());

