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

		listApps: {},
		userInteractions: {},

		links: {},
		linkCount: 0,

		datasets: {},
		dataCount: 0,
		drawings: {},
		visCount: 0
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
				locked: self.functions[id].editor !== null,
				editor: self.functions[id].editor,
				selectors: []
			};
		});

		Object.keys(self.userInteractions).forEach(userID => {
			let operation = self.userInteractions[userID];
			functionInfo[operation.func.id].selectors.push(operation.user);
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

		console.log(definition);

		// send info for user who saved code to load
		wsio.emit("snippetSendCodeOnLoad", {
			scriptID: id,
			to: definition.editor,
			text: definition.text,
			type: definition.type,
			desc: definition.desc
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

		updateListApps();
	}

	function cloneSnippet(uniqueID, scriptID) {
		let originalSnippet = self.functions[scriptID];

		let code = originalSnippet.text;
		let desc = originalSnippet.desc + " (copy)";
		let type = originalSnippet.type;

		saveSnippet(uniqueID, code, desc, type, "new");

		updateListApps();
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
				links: JSON.parse(\`${links ? JSON.stringify(links) : []}\`),
				text: \`${code.replace(/`/gi, "\\`").replace(/\$/gi, "\\$")}\`,
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
				type: self.functions[scriptID].type,
				desc: self.functions[scriptID].desc
			});
		}

		// broadcast update of function states
		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);

		updateListApps();
	}

	function notifySnippetClosed(scriptID) {
		self.functions[scriptID].editor = null;

		// broadcast update of function states
		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);

		updateListApps();
	}

	function createDataApplication(snippetsID) {
		wsio.emit("loadApplication", {
			application: '/home/andrew/Documents/Dev/sage2/public/uploads/apps/Snippets_Data',
			color: '#ff0000',
			data: {
				snippetsID
			}
		});
	}

	function createVisApplication(snippetsID) {
		wsio.emit("loadApplication", {
			application:
				"/home/andrew/Documents/Dev/sage2/public/uploads/apps/Snippets_Vis",
			color: "#ff0000",
			data: {
				snippetsID
			}
		});
	}

	function displayApplicationLoaded(id, app) {
		// call required function, update reference
		if (app.application === "Snippets_Vis") {
			let primedLink = self.drawings[id];

			if (primedLink.getParent()) {
				primedLink.getParent().addChildLink(primedLink);
			}

			primedLink.setChild(app);
			primedLink.update();

			app.setParentLink(primedLink);

			// fix reference
			self.drawings[id] = app;

		} else if (app.application === "Snippets_Data") {
			let primedLink = self.datasets[id];

			if (primedLink.getParent()) {
				primedLink.getParent().addChildLink(primedLink);
			}

			primedLink.setChild(app);
			primedLink.update();

			app.setParentLink(primedLink);

			// fix reference
			self.datasets[id] = app;
		}
	}

	function getAppAncestry(app) {
		let idAncestry = [];

		let currentApp = app;

		while (currentApp && currentApp.parentLink) {
			let link = currentApp.parentLink;

			idAncestry.unshift(link.getSnippetID());
			currentApp = link.getParent();
		}

		let ancestry = idAncestry.map(id => {
			return {
				desc: self.functions[id].desc,
				type: self.functions[id].type,
				id
			};
		});

		return ancestry;
	}

	function executeCodeSnippet(snippetID, parentID) {
		let snippet = self.functions[snippetID];

		let parent = parentID ? self.datasets[parentID] : null;

		let linkIndex = Object.keys(self.links).findIndex((link) => {
			return self.links[link].getSnippetID() === snippetID && self.links[link].getParent() === parent;
		});

		if (linkIndex === -1) {
			// then this is a new link that must be created
			let newLink = new Link(parent, null, snippetID);

			let linkID = "link-" + self.linkCount++;
			self.links[linkID] = newLink;

			self.functions[snippetID].links.push(linkID);

			if (snippet.type === "draw") {
				let snippetsID = "vis-" + self.visCount++;

				// get link ready for application finish
				self.drawings[snippetsID] = newLink;

				createVisApplication(snippetsID);
			} else {

				let snippetsID = "data-" + self.dataCount++;

				// get link ready for application finish
				self.datasets[snippetsID] = newLink;

				createDataApplication(snippetsID);
			}

		} else {
			self.links[Object.keys(self.links)[linkIndex]].update();
		}

	}

	function registerSnippetListApp(id, app) {
		console.log("SAGE2_CodeSnippets> Registered", id);

		self.listApps[id] = app;
		app.updateFunctionBank(getFunctionInfo());
	}

	function updateListApps() {
		let functionInfo = getFunctionInfo();

		for (let id of Object.keys(self.listApps)) {
			self.listApps[id].updateFunctionBank(functionInfo);
		}
	}

	function notifyUserListClick(user, func) {
		if (func.type === "gen") {
			// run gen functions without parent selection
			executeCodeSnippet(func.id, null);
		} else {
			if (self.userInteractions[user.id] && self.userInteractions[user.id].func.id === func.id) {
				// allow users to toggle selection
				delete self.userInteractions[user.id];
			} else {
				// otherwise, save function selection and user for dataset selection
				self.userInteractions[user.id] = {
					user,
					func
				};
			}


			updateListApps();
		}

	}

	function notifyUserDataClick(user, dataID) {
		// if the user has queued up a function
		if (self.userInteractions[user.id]) {
			executeCodeSnippet(self.userInteractions[user.id].func.id, dataID);

			delete self.userInteractions[user.id];

			updateListApps();
		}
	}

	function outputAppClosed(app) {
		console.log("App Closed", app);
		for (let linkID of Object.keys(self.links)) {
			let parent = self.links[linkID].getParent();
			let child = self.links[linkID].getChild();
			let func = self.functions[self.links[linkID].getSnippetID()];

			if (child === app || parent === app) {
				if (parent === app) {
					child.removeParentLink();
				} else if (parent !== null) {
					parent.removeChildLink(self.links[linkID]);
				}

				console.log("Removing Link:", self.links[linkID]);

				// remove ID from function's links
				let funcLinkIndex = func.links.indexOf(linkID);
				func.links.splice(funcLinkIndex, 1);

				delete self.links[linkID];
			}

		}
	}

	// Link class used by SAGE2_CodeSnippets
	const Link = (function() {
		let curator = self; // alias enclosing scope's 'self'

		return function(parent, child, transformID) {
			let self = { parent, child, transformID };

			init();

			function init() {
				// update();
			}

			function getParent() {
				return self.parent;
			}

			function getChild() {
				return self.child;
			}

			function setChild(child) {
				self.child = child;
			}

			function getSnippetID() {
				return self.transformID;
			}

			function update() {
				let p = self.parent;
				let c = self.child;
				let id = self.transformID;

				if (curator.functions[id].type === "data") {
					// call function (calculates new dataset and updates child)
					try {
						let result = curator.functions[id].code(p.getDataset());
						c.updateDataset(result);
					} catch (err) {
						c.displayError(err);
					}
				} else if (curator.functions[id].type === "draw") {
					// call function (plots data on svg)
					try {
						curator.functions[id].code(p.getDataset(), c.getElement());
					} catch (err) {
						c.displayError(err);
					}
				} else if (curator.functions[id].type === "gen") {
					// call function (this returns a promise)

					curator.functions[id]
						.code(c.getDataset())
						.then(function(data) {
							c.updateDataset(data);
						})
						.catch(err => {
							c.displayError(err);
						});
				}
			}

			return { update, getParent, setChild, getChild, getSnippetID };
		};
	}());

	return {
		getNewFunctionID,
		updateFunctionDefinition,

		getFunctionInfo,
		saveSnippet,
		cloneSnippet,

		requestSnippetLoad,
		notifySnippetClosed,

		createDataApplication,
		createVisApplication,

		displayApplicationLoaded,
		outputAppClosed,
		getAppAncestry,
		executeCodeSnippet,

		registerSnippetListApp,
		notifyUserListClick,
		notifyUserDataClick
	};
}());

