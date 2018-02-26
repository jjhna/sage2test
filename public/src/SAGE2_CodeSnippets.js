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

		// set string to null value
		if (func.editor === "null") {
			func.editor = null;
		}

		if (isMaster) {
			// loadable script defitition in server
			// let savedScriptBody = createScriptBody(null, func.text, func.desc, [], "new", func.type, func.src);

			wsio.emit("snippetSaveIntoServer", {
				text: func.text,
				type: func.type,
				desc: func.desc,
				snippetID: id,
				filename: func.src ? func.src : null
			});
		}

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
		let src = null;

		if (scriptID !== "new") {
			let oldFunction = self.functions[scriptID];

			// save the links, remove the old script
			document.getElementById(scriptID).remove();
			links = oldFunction.links;
			src = oldFunction.src;

			// clear any intervals remaining from a generator script
			if (oldFunction.interval) {
				clearInterval(oldFunction.interval);
			}
		} else {
			links = [];
		}

		script.text = createScriptBody(uniqueID, code, desc, links, scriptID, type, src);

		script.charset = "utf-8";

		console.log("Appending script text");
		document.body.appendChild(script);

		if (Object.values(self.listApps).length === 0) {
			createListApplication();
		}

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

	function sourceFileUpdated(scriptID, filename) {
		console.log(scriptID, filename);
		self.functions[scriptID].src = filename;

		console.log(self.functions[scriptID]);
	}

	function loadFromFile(func, filename) {

		var script = document.createElement("script");
		script.text = createScriptBody(null, func.text, func.desc, [], "new", func.type, filename);
		script.charset = "utf-8";
		document.body.appendChild(script);

		if (Object.values(self.listApps).length === 0) {
			createListApplication();
		}

		updateListApps();
	}

	function createScriptBody(uniqueID, code, desc, links, scriptID, type, src) {
		let startBlock = `(function() {
			console.log('Sandbox script Loading');
			// check if script with same src exists

			let key;
			let srcLoadedIn;

			let functionInfo = SAGE2_CodeSnippets.getFunctionInfo();

			// check for scripts loaded from .js file
			if ("${src}" !== "null") {
				srcLoadedIn = Object.keys(functionInfo).find(f => {
					return functionInfo[f].src === "${src}"
				});
			}

			if (srcLoadedIn) {
				key = srcLoadedIn;
			} else {
				key = "${scriptID}" === "new" ? SAGE2_CodeSnippets.getNewFunctionID() : "${scriptID}";
			}

			// loaded from script
			let functionDefinition = {
				// src: document.currentScript.src !== "" ? document.currentScript.src : "user-defined",
				src: "${src}",
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
		if (isMaster) {
			wsio.emit("loadApplication", {
				application: '/home/andrew/Documents/Dev/sage2/public/uploads/apps/Snippets_Data',
				color: '#ff0000',
				data: {
					snippetsID
				}
			});
		}
	}

	function createVisApplication(snippetsID) {
		if (isMaster) {
			wsio.emit("loadApplication", {
				application:
					"/home/andrew/Documents/Dev/sage2/public/uploads/apps/Snippets_Vis",
				color: "#ff0000",
				data: {
					snippetsID
				}
			});
		}
	}

	function createListApplication() {
		if (isMaster) {
			wsio.emit("loadApplication", {
				application:
					"/home/andrew/Documents/Dev/sage2/public/uploads/apps/Snippets_List",
				color: "#ff0000"
			});
		}
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

	function unregisterSnippetListApp(id) {
		console.log("SAGE2_CodeSnippets> Unregistered", id);

		delete self.listApps[id];
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
					self.links[linkID].setParent(null);

					child.updateAncestorTree();
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

	// function to create script from wall which can be run on personal computer
	function generateScriptFromWall() {
		let functionBodies = {};

		for (let id of Object.keys(self.functions)) {
			functionBodies[id] = createFunctionBlock(self.functions[id].type, self.functions[id].text);
		}

		let newWindow = window.open();
		let newDocument = newWindow.document;

		let script = newDocument.createElement("script");
		script.text = createScriptText(
			createInitBody(
				createFunctionObject(functionBodies),
				convertLinksToIDForest()
			),
			""
		);
		script.id = "codeSnippetsScript";
		script.async = false;

		// add d3 to new page
		let d3Script = newDocument.createElement("script");
		d3Script.src = "https://d3js.org/d3.v4.min.js";

		d3Script.onload = function() {
			newDocument.head.appendChild(script);
		};

		newDocument.head.appendChild(d3Script);


		let downloadWrapper = newDocument.createElement("div");
		let downloadButton = newDocument.createElement("input");

		downloadButton.type = "button";
		downloadButton.value = "Download Page";
		downloadButton.id = "downloadButton";

		downloadWrapper.appendChild(downloadButton);
		newDocument.body.appendChild(downloadWrapper);

		// ======================================================
		// helper functions for creating script
		function createFunctionObject(functionBodies) {
			let startText = `functions = {\n\t`;
			let endText = `\n};`;

			let keyFunctionPairs = Object.keys(functionBodies).map(
				key => `"${key}": {
					type: "${self.functions[key].type}",
					desc: "${self.functions[key].desc}",
					code: ${functionBodies[key]}
				}`.replace(/\t\t\t\t/, ""));

			return startText + keyFunctionPairs.join(",\n\t") + endText;
		}

		function createInitBody(functionObject, links) {
			return `
				${functionObject}

				linkForest = ${JSON.stringify(links)};
				`.replace(/\t\t\t\t/gi, "");
		}

		function createScriptText(initBody, runBody) {
			return `
				let functions;
				let linkForest;

				let runFunction = {
					gen: function (input, link) {
						let func = functions[link.snippetID];

						// call function
						func.code(input)
							.then(function(result) {
								invokeChildFunctions(result, link.children, [link.snippetID]);
							})
					},
					data: function(input, link, prevFunctions) {
						let func = functions[link.snippetID];
						let result = func.code(input);

						invokeChildFunctions(result, link.children, prevFunctions.concat(link.snippetID));

					},
					draw: function(input, link, prevFunctions) {
						let func = functions[link.snippetID];

						let funcOrder = prevFunctions.concat(link.snippetID).map(f => functions[f].desc);
						console.log(funcOrder);

						// add svg and supplementary info
						let div = d3.select("body").append("div")
							.style("display", "inline-block")

						div.append("div")
							.style("text-align", "center")
							.style("font-family", "sans-serif")
							.style("font-weight", "bold")
							.text(funcOrder.join(" -> "));

						let svg = div.append("svg")
							.attr("width", 600).attr("height", 300)
							.style("margin", "10px")
							.node();

						func.code(input, svg);
					}
				}

				init();

				function init() {
					${initBody}

					if (document.getElementById("downloadButton")) {
						document.getElementById("downloadButton").onclick = download;
					}

					console.log("Init Done", functions);
					run();
				}

				function download() {
					// create dom clone in order to clear body for download
					let domCopy = document.documentElement.cloneNode(true);
					let body = domCopy.getElementsByTagName("body")[0];
					body.innerHTML = "";
					body.onload = "run";

					var element = document.createElement('a');
					element.setAttribute('href', 'data:text/html;charset=utf-8,' 
					+ encodeURIComponent(domCopy.outerHTML));
					element.setAttribute('download', "snippetsOutput.html");

					element.style.display = 'none';
					document.body.appendChild(element);

					element.click();

					document.body.removeChild(element);
					domCopy.remove();
				}

				function invokeChildFunctions(data, children, prevFunctions) {
					for (let child of children) {
						let { type } = functions[child.snippetID];

						runFunction[type](data, child, prevFunctions);
					}
				}

				function run() {
					// for each root, invoke the function
					for (let root of linkForest) {
						let { type } = functions[root.snippetID];

						runFunction[type](null, root);
					}

					${runBody}
				}`.replace(/\t\t\t\t/gi, "");

			// replace is to unindent the code and make it readable in the output
			// since string template preserves extra 4 tab indentation from this file's src
		}
	}

	function convertLinksToIDForest() {
		let rootIDs = Object.keys(self.links).filter(id => self.functions[self.links[id].getSnippetID()].type === "gen");

		let forest = rootIDs.map(id => createSubtree(self.links[id], id));

		return forest;

		// helper method
		function createSubtree(link/*, linkID*/) {
			return {
				// linkID,
				snippetID: link.getSnippetID(),
				children: link.getChild().childLinks.map(createSubtree)
			};
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

			function setParent(parent) {
				self.parent = parent;
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

				if (curator.functions[id].type === "data" && p) {
					// call function (calculates new dataset and updates child)
					try {
						let result = curator.functions[id].code(p.getDataset());
						c.updateDataset(result);
					} catch (err) {
						c.displayError(err);
					}
				} else if (curator.functions[id].type === "draw" && p) {
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

			return { update, setParent, getParent, setChild, getChild, getSnippetID };
		};
	}());

	return {
		getNewFunctionID,
		updateFunctionDefinition,

		getFunctionInfo,
		saveSnippet,
		cloneSnippet,
		loadFromFile,
		sourceFileUpdated,

		requestSnippetLoad,
		notifySnippetClosed,

		createDataApplication,
		createVisApplication,

		displayApplicationLoaded,
		outputAppClosed,
		getAppAncestry,
		executeCodeSnippet,

		registerSnippetListApp,
		unregisterSnippetListApp,
		notifyUserListClick,
		notifyUserDataClick,

		generateScriptFromWall
	};
}());

