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

/* global wsio d3 */

let SAGE2_CodeSnippets = (function() {
	let self = {
		functions: {},
		functionCount: 0,

		isOpeningList: false,
		listApps: {},
		userInteractions: {},

		links: {},
		linkCount: 0,

		pendingDataLinks: [],
		pendingVisLinks: [],

		inputs: {},

		outputApps: {},

		config: {},
		loadingApps: {}
	};

	/**
	 * Initializer function for the SAGE2_CodeSnippets runtime
	 *
	 * @method init
	 * @param {Object} config - config for codesnippets from the experimental part of the SAGE2 config
	 */
	function init(config) {
		console.log("SAGE2_CodeSnippets initialized", config);
		self.config = config;

		// // preload settings icon SVG to prevent flicker
		let xhr = new XMLHttpRequest();
		xhr.open("GET", "../images/radialMenu/three115.svg", false);
		// Following line is just to be on the safe side;
		// not needed if your server delivers SVG with correct MIME type
		xhr.overrideMimeType("image/svg+xml");
		xhr.send("");

		self.inputsIcon = document.createElement("div")
			.appendChild(xhr.responseXML.documentElement);

		// save base64 encoding for easy embedding
		let imgSerial = new XMLSerializer().serializeToString(self.inputsIcon);
		self.inputsIconB64 = btoa(imgSerial);

		// load external dependencies
		if (self.config.external_dependencies) {
			for (let dependency of self.config.external_dependencies) {
				let script = document.createElement("script");
				script.type = "text/javascript";
				script.className = "snippets-dependency";
				script.async = false;
				script.src = dependency;

				document.head.appendChild(script);

				console.log("loaded", dependency);
			}
		}
	}

	/**
	 * Gets a new, unique snippet ID.
	 *
	 * @method getNewFunctionID
	 */
	function getNewFunctionID() {
		if (Object.keys(self.functions).length === 0) {
			return "codeSnippet-" + 0;
		}

		return "codeSnippet-" + (Math.max(...Object.keys(self.functions).map(id => id.split("-")[1])) + 1);
		// return "codeSnippet-" + self.functionCount++;
	}

	/**
	 * Aggregates the information necessary for the WebUI to correctly populate its
	 * SnippetEditor interface with information.
	 *
	 * @method getFunctionInfo
	 */
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

	/**
	 * Updates the definition of a function when a user saves a snippet.
	 *
	 * Note: This is called from WITHIN the dynamically loaded snippet file.
	 *
	 * @method updateFunctionDefinition
	 * @param {String} id - the id of the snippet
	 * @param {Object} definition - the new definition of the function
	 */
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

	}

	/**
	 * This function is used to save a new/edited code snippet, recreating the snippet body
	 * and reloading it into the display client.
	 *
	 * @method saveSnippet
	 * @param {String} uniqueID - SAGE uniqueID of user who is saving the snippet
	 * @param {String} code - the code (as a string)
	 * @param {String} desc - the snippet description (i.e. name)
	 * @param {String} type - the snippet type (gen, data, draw)
	 * @param {String} scriptID - the unique snippet id (codeSnippet-2)
	 */
	function saveSnippet(uniqueID, code, desc, type, scriptID) {
		var script = document.createElement("script");

		let links = [];
		let src = null;
		let state = {};

		if (scriptID !== "new") {
			let oldFunction = self.functions[scriptID];

			// save the links, remove the old script
			if (document.getElementById(scriptID)) {
				document.getElementById(scriptID).remove();
			}

			if (oldFunction) {
				links = oldFunction.links;
				src = oldFunction.src;
				state = oldFunction.state;
			}

			// clear any intervals remaining from a generator script
			if (oldFunction && oldFunction.interval) {
				clearInterval(oldFunction.interval);
			}
		}

		// create new script
		script.text = createScriptBody(uniqueID, code, desc, links, scriptID, type, src, state);
		script.charset = "utf-8";
		script.id = scriptID;
		document.body.appendChild(script);

		// open a snippet list if it isn't open already
		if (Object.values(self.listApps).length === 0) {
			createListApplication();
		}

		updateListApps();
	}

	/**
	 * Creates a copy of an existing snippet for a user
	 *
	 * @method cloneSnippet
	 * @param {String} uniqueID - the SAGE2 uniqueID of the user cloning the snippet
	 * @param {String} scriptID - the snippet to be cloned
	 */
	function cloneSnippet(uniqueID, scriptID) {
		let originalSnippet = self.functions[scriptID];

		let code = originalSnippet.text;
		let desc = originalSnippet.desc + " (copy)";
		let type = originalSnippet.type;

		saveSnippet(uniqueID, code, desc, type, "new");

		updateListApps();
	}

	/**
	 * Notification from the server specifying that a saved snippet's filename in the
	 * media browser has changed.
	 *
	 * @method sourceFileUpdated
	 * @param {String} scriptID - the id of the snippet
	 * @param {String} filename - the new filename
	 */
	function sourceFileUpdated(scriptID, filename) {
		// update scripts filename
		self.functions[scriptID].src = filename;
	}

	/**
	 * Loads a script from a static file
	 *
	 * @method loadFromFile
	 * @param {Object} func - the information about the funtion (code, desc, type)
	 * @param {String} filename - the name of the script file
	 */
	function loadFromFile(func, filename, id = "new") {

		var script = document.createElement("script");
		script.text = createScriptBody(null, func.text, func.desc, [], id, func.type, filename);
		script.charset = "utf-8";
		document.body.appendChild(script);

		console.log("loadFromFile", arguments);

		// only create a list application if there are none referenced
		// and the file is not reloading from state
		if (Object.values(self.listApps).length === 0 && id === "new") {
			createListApplication();
		}

		updateListApps();
	}

	/**
	 * Function to fill in a template string based on snippet function information with
	 * necessary wrapper code to properly curate the code.
	 *
	 * @method createScriptBody
	 */
	function createScriptBody(uniqueID, code, desc, links, scriptID, type, src, state) {

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
		// return startBlock + createFunctionBlock(type, code) + endBlock;
	}

	/**
	 * Create the funtion block for the new snippet. The user-defined code first put through a
	 * pseudo-compile process in order to append additional parameters to SAGE2 API functions,
	 * then wrapped in the necessary code to execute the snippet.
	 *
	 * @method createFunctionBlock
	 * @param {String} type - the type of the snippet (gen, draw, data)
	 * @param {String} code - the code which a user wrote, to be loaded
	 */
	function createFunctionBlock(type, code) {
		// replace special syntax pieces using RegExp
		let inputsRegex = new SnippetsInputRegExp(/SAGE2.SnippetInput\(({[\w,\W]*?})\)/, "gm");
		let visElemRegex = new SnippetsVisElementRegExp(/SAGE2.SnippetVisElement\(({[\w,\W]*?})\)/, "gm");
		let timeoutRegex = new SnippetsTimeoutRegExp(/SAGE2.SnippetTimeout\(({[\w,\W]*?})\)/, "gm");

		// "compile" code and replace/extract special syntax values
		let codeCompile_1 = code.replace(inputsRegex);
		let codeCompile_2 = codeCompile_1.replace(timeoutRegex);
		let codeCompile_final = codeCompile_2.replace(visElemRegex);

		let functionBlocks = {
			data: `(function (data, link) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here
				
				${codeCompile_final}

				/* END USER DEFINED CODE*/
			})`,
			draw: `(function (data, link) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here

				${codeCompile_final}
				
				/* END USER DEFINED CODE*/
		
			})`,
			gen: `(function (previousData, link) {
				// Promise to handle async
				return new Promise((resolve, reject) => {
					/* USER DEFINED CODE */
					// Code written by user will be inserted here

					${codeCompile_final}

				});
				/* END USER DEFINED CODE*/
			})`
		};

		return functionBlocks[type];
	}

	/**
	 * Handles sending a snippet to a WebUI which is requesting to load/edit a snippet.
	 *
	 * @method requestSnippetLoad
	 * @param {String} uniqueID - the SAGE2 uniqueID of the user who is requesting to edit the snippet
	 * @param {String} scriptID - the id of the snippet to be loaded
	 */
	function requestSnippetLoad(uniqueID, scriptID) {
		// send script to user
		if (self.functions[scriptID] && !self.functions[scriptID].editor) {
			self.functions[scriptID].editor = uniqueID;

			if (isMaster) {
				wsio.emit("snippetSendCodeOnLoad", {
					scriptID: scriptID,
					to: self.functions[scriptID].editor,
					text: self.functions[scriptID].text,
					type: self.functions[scriptID].type,
					desc: self.functions[scriptID].desc
				});
			}
		}

		// broadcast update of function states
		if (isMaster) {
			let functionState = getFunctionInfo();
			wsio.emit("snippetsStateUpdated", functionState);
		}

		updateListApps();
	}

	/**
	 * Handles updating the editor of a snippet when the user has closed it
	 *
	 * @method notifySnippetClosed
	 * @param {String} scriptID - the id of the snippet which was closed
	 */
	function notifySnippetClosed(scriptID) {
		self.functions[scriptID].editor = null;

		// broadcast update of function states
		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);

		updateListApps();
	}

	/**
	 * Send a request to open a Snippets_Data application, including the reference ID for
	 * the data application
	 *
	 * @method createDataApplication
	 * @param {String} snippetsID - the id of the data object for reference
	 */
	function createDataApplication(snippetsID) {
		if (isMaster) {
			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);
			// let minDim = Math.min(ui.width, ui.height * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_Data",
				color: '#ff0000',
				dimensions: [minDim / 4, minDim / 4],
				data: {
					snippetsID
				}
			});
		}
	}

	/**
	 * Send a request to open a Snippets_Vis application, including the reference ID for
	 * the vis application
	 *
	 * @method createVisApplication
	 * @param {String} snippetsID - the id of the vis object for reference
	 */
	function createVisApplication(snippetsID) {
		if (isMaster) {
			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_Vis",
				color: "#ff0000",
				dimensions: [minDim / 4, minDim / 4],
				data: {
					snippetsID
				}
			});
		}
	}

	/**
	 * Send a request to open a Snippets_List application to dislay loaded code
	 *
	 * @method createListApplication
	 */
	function createListApplication() {
		if (isMaster && !self.isOpeningList) {
			self.isOpeningList = true;

			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);
			// let minDim = Math.min(ui.width, ui.height * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_List",
				dimensions: [minDim / 8, minDim / 4],
				color: "#ff0000"
			});
		}
	}

	/**
	 * A utility function to calculate the path for the generic gen, data, and draw flowchart
	 * block paths.
	 *
	 * @method createBlockPath
	 * @param {String} type - the type of snippet block
	 * @param {Number} width - the width of the block
	 * @param {Number} height - the height of the block
	 * @param {Array} offset - the [x,y] offset to add to the path calculation
	 */
	function createBlockPath (type, width, height, offset) {
		let mult = [width, height];

		let points = {
			gen: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1]
			],
			data: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1],
				[0.075, 0.5]
			],
			draw: [
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 1],
				[0.075, 0.5]
			]
		};

		return "M " + points[type].map(point =>
			point.map((coord, i) =>
				(coord * mult[i]) + offset[i]
			).join(" ")).join(" L ") + " Z";
	}

	/**
	 * Function which is called from the Snippets_Data and Snippets_Vis applications
	 * to notify the SAGE2_CodeSnippets runtime that the display is ready to draw content.
	 *
	 * @method displayApplicationLoaded
	 * @param {String} id - the data/vis app id
	 * @param {Object} app - the reference to the application object
	 */
	function displayApplicationLoaded(id, app) {
		if (self.loadingApps[app.id]) {
			// resolve app load (from reloading state)
			console.log("App Loaded:", app.id);
			self.loadingApps[app.id]();
		} else {
			// handle a normal load (on normal interaction)
			handleLoadedApplication(app);
		}
	}

	function handleLoadedApplication(app) {
		// call required function, update reference
		if (app.application === "Snippets_Vis") {
			let primedLink = self.pendingVisLinks.pop();

			if (primedLink.getParent()) {
				primedLink.getParent().addChildLink(primedLink);
			}

			app.setParentLink(primedLink);

			primedLink.setChild(app);
			primedLink.update();

			// fix reference
			self.outputApps[app.id] = app;

		} else if (app.application === "Snippets_Data") {
			let primedLink = self.pendingDataLinks.pop();

			if (primedLink.getParent()) {
				primedLink.getParent().addChildLink(primedLink);
			}

			app.setParentLink(primedLink);

			primedLink.setChild(app);
			primedLink.update();

			// fix reference
			self.outputApps[app.id] = app;
		}


		updateSavedSnippetAssociations();
	}

	function updateSavedSnippetAssociations() {
		console.log("CurrentApps:", Object.keys(self.outputApps));

		wsio.emit("updateSnippetAssociationState", {
			apps: Object.keys(self.outputApps),
			links: convertLinksToIDForest()
		});
	}

	function handleReloadedSnippetAssociations(associations) {

		// start at root nodes, recursively handle children
		for (let root of associations.links) {
			handleLink(root, null);
		}

		function handleLink(link, parent) {
			let { linkID, appID, snippetID, children, inputs } = link;

			let newLink = new Link(
				parent ? applications[parent] : null,
				applications[appID],
				snippetID
			);

			self.links[linkID] = newLink;
			self.functions[snippetID].links.push(linkID);

			if (parent) {
				applications[parent].addChildLink(newLink);
			}

			applications[appID].setParentLink(newLink);
			self.outputApps[appID] = applications[appID];

			newLink.setInputInitialValues(inputs);
			newLink.update();

			for (let child of children) {
				handleLink(child, link.appID);
			}
		}

		// restore link index
		if (Object.keys(self.links).length) {
			self.linkCount = Math.max(...Object.keys(self.links).map(id => +id.split("-")[1])) + 1;
		} else {
			self.linkCount = 0;
		}
	}

	/**
	 * Utility function which takes an app and traverses the parent links in order to construct
	 * a list of functions (e.g. a pipeline).
	 *
	 * @method createVisApplication
	 * @param {Object} app - the reference to the app
	 */
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

	/**
	 * Takes an app's ancestry and draws it on an SVG based on height and width specification
	 *
	 * @method drawAppAncestry
	 * @param {Object} data - information about how to draw the ancestry {svg, width, height, ancestry, app}
	 */
	function drawAppAncestry(data) {
		// snippet color palette
		let lightColor = { gen: "#b3e2cd", data: "#cbd5e8", draw: "#fdcdac" };
		let darkColor = { gen: "#87d1b0", data: "#9db0d3", draw: "#fba76d" };

		let {svg, width, height, ancestry, app} = data;
		// calculate display width per snippet block
		let blockWidth = (width - height) / Math.max(ancestry.length, 3);

		// create input settings button/image if it doesn't exist
		if (app.parentLink &&
			Object.keys(app.parentLink.inputs).length &&
			!svg.selectAll(".inputSettingsButton").size()) {

			svg.append("rect")
				.attr("class", "inputSettingsButton")
				.attr("x", width - height)
				.attr("y", 0)
				.attr("width", height - 8)
				.attr("height", height - 8)
				.style("stroke", "black")
				.style("fill", app.state.inputsOpen ? "gold" : "white");

			// fix the use of image by href later (flashes on redraw)
			svg.append("image")
				.attr("class", "inputSettingsImage")
				.attr("href", "data:image/svg+xml;base64," + self.inputsIconB64)
				// .attr("href", "../images/radialMenu/three115.svg")
				.attr("width", height - 16)
				.attr("height", height - 16)
				.on("click", function() {
					console.log("Input Settings Click");
					if (!app.state.inputsOpen) {
						app.inputsClosedHeight = app.sage2_height;

						let newHeight = Math.max(app.sage2_height, app.inputs.clientHeight);

						app.state.inputsOpen = true;
						app.sendResize(app.sage2_width + 300, newHeight);
					} else {
						app.state.inputsOpen = false;
						app.sendResize(app.sage2_width - 300, app.inputsClosedHeight ? app.inputsClosedHeight : app.sage2_height);
					}
				});
		}

		svg.select(".inputSettingsButton")
			.attr("x", width - height)
			.attr("y", 0)
			.style("fill", app.state.inputsOpen ? "gold" : "white");

		svg.select(".inputSettingsImage")
			.attr("x", width - height + 4)
			.attr("y", 4);

		//show snippet ancestry
		svg.selectAll(".snippetFuncBlock").remove();

		svg.selectAll(".snippetFuncBlock")
			.data(ancestry)
			.enter().append("g")
			.attr("class", "snippetFuncBlock")
			.each(function (d, i) {
				let group = d3.select(this);
				let thisOffsetX = i === 0 ? 6 : (i * (0.925 * blockWidth - 6)) + 6;

				group.append("path")
					.attr("class", "snippetPath")
					.attr("d", createBlockPath(d.type, blockWidth - 12, height - 16, [thisOffsetX, 4]))
					.style("stroke-linejoin", "round")
					.style("fill", lightColor[d.type])
					.style("stroke-width", 2)
					.style("stroke", darkColor[d.type]);

				let label = group.append("text")
					.attr("class", "snippetName")
					.attr("x", thisOffsetX + (blockWidth * .5) - 6)
					.attr("y", height / 2)
					.style("text-anchor", "middle")
					.style("font-weight", "bold")
					.style("font-size", ui.titleBarHeight / 2 + "px")
					.style("font-family", "monospace")
					.style("fill", "black")
					.style("pointer-events", "none")
					.text(`cS-${d.id.split("-")[1]}: ${d.desc}`);

				if (label.node().getBBox().width > blockWidth * 0.925) {
					label.text(`${d.desc}`);
				}

				if (label.node().getBBox().width > blockWidth * 0.925) {
					label.text(`cS-${d.id.split("-")[1]}`);
				}

			});
	}

	/**
	 * Executes a code snippet by ID on a parent dataset, by ID
	 *
	 * @method executeCodeSnippet
	 * @param {String} snippetID - the ID of the code snippet
	 * @param {String} parentID - the SAGE2 ID of the app as the target
	 */
	function executeCodeSnippet(snippetID, parentID) {
		let snippet = self.functions[snippetID];

		let parent = parentID ? self.outputApps[parentID] : null;

		let linkIndex = Object.keys(self.links).findIndex((link) => {
			return self.links[link].getSnippetID() === snippetID && self.links[link].getParent() === parent;
		});

		if (linkIndex === -1 || Object.keys(Object.values(self.links)[linkIndex].inputs).length > 0) {

			// then this is a new link that must be created
			// OR if the snippet specifies input elements, since these can be inconsistent across calls
			let newLink = new Link(parent, null, snippetID);

			let linkID = "link-" + self.linkCount++;
			self.links[linkID] = newLink;

			self.functions[snippetID].links.push(linkID);

			if (snippet.type === "draw") {
				let snippetsID = "vis-" + self.visCount++;

				// get link ready for application finish
				self.pendingVisLinks.push(newLink);

				createVisApplication(snippetsID);
			} else {
				let snippetsID = "data-" + self.dataCount++;

				// get link ready for application finish
				self.pendingDataLinks.push(newLink);

				createDataApplication(snippetsID);
			}
		} else {
			self.links[Object.keys(self.links)[linkIndex]].update();
		}

	}

	/**
	 * Registers a Snippet_List app to receive updates for snippets
	 *
	 * @method registerSnippetListApp
	 * @param {String} id - the SAGE2 ID of the app
	 * @param {Object} app - the reference to the SAGE2 application
	 */
	function registerSnippetListApp(id, app) {
		console.log("SAGE2_CodeSnippets> Registered", id);

		self.listApps[id] = app;
		self.isOpeningList = false;
		app.updateFunctionBank(getFunctionInfo());
	}


	/**
	 * Unregisters a Snippet_List app on close
	 *
	 * @method unregisterSnippetListApp
	 * @param {String} id - the SAGE2 ID of the app
	 */
	function unregisterSnippetListApp(id) {
		console.log("SAGE2_CodeSnippets> Unregistered", id);

		delete self.listApps[id];
	}

	/**
	 * Updates all list apps based on current function information
	 *
	 * @method updateListApps
	 */
	function updateListApps() {
		let functionInfo = getFunctionInfo();

		for (let id of Object.keys(self.listApps)) {
			self.listApps[id].updateFunctionBank(functionInfo);
		}
	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime of a user selection on a function
	 * in the Snippet_List app. This is necessary to handle multi-click actions
	 *
	 * @method notifyUserListClick
	 * @param {Object} user - the SAGE2 user object
	 * @param {Object} func - the function information which was clicked on
	 */
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

			// update list apps because of new selectors
			updateListApps();
		}

	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime of a user selection on a Snippets_Data app.
	 * This is necessary to handle multi-click actions (invocation on data)
	 *
	 * @method notifyUserDataClick
	 * @param {Object} user - the SAGE2 user object
	 * @param {String} dataID - the unique data ID associated with the clicked app
	 */
	function notifyUserDataClick(user, dataID) {
		// if the user has queued up a function
		if (self.userInteractions[user.id]) {
			executeCodeSnippet(self.userInteractions[user.id].func.id, dataID);

			delete self.userInteractions[user.id];

			updateListApps();
		}
	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime when a data/vis app was closed so it can be
	 * deregistered from the system and links can be removed
	 *
	 * @method outputAppClosed
	 * @param {Object} app - the SAGE2 app reference
	 */
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

				// clear timeout if the app has one
				if (self.links[linkID].timeout) {
					clearTimeout(self.links[linkID].timeout);
				}

				delete self.links[linkID];
			}

		}

		updateSavedSnippetAssociations();
	}

	/**
	 * Packages and sends all relevant info to the WebUI of the user who requested to export the
	 * project to be downloaded.
	 *
	 * @method requestSnippetsProjectExport
	 * @param {String} uniqueID - the SAGE2 uniqueID for a user
	 */
	function requestSnippetsProjectExport(uniqueID) {

		// compile snippet function information
		let functionBodies = {};

		for (let id of Object.keys(self.functions)) {
			functionBodies[id] = createFunctionBlock(self.functions[id].type, self.functions[id].text);
		}

		let functionObject = Object.keys(functionBodies).map(
			key => ({
				id: key,
				type: self.functions[key].type,
				desc: self.functions[key].desc,
				text: self.functions[key].text,
				code: functionBodies[key]
			}));

		// create link hierarchy to send
		let links = convertLinksToIDForest();

		// send to WebUI
		wsio.emit("snippetsSendProjectExport", {
			to: uniqueID,
			functions: functionObject,
			links
		});
	}

	/**
	 * Utility function which converts the links saved (which include app references) into
	 * a data structure which is stringify compatible. This is necessary to include the
	 * relevant information to reconstruct the relations in the export project.
	 *
	 * @method convertLinksToIDForest
	 */
	function convertLinksToIDForest() {
		let rootIDs = Object.keys(self.links).filter(id => self.functions[self.links[id].getSnippetID()].type === "gen");

		let forest = rootIDs.map(id => createSubtree(self.links[id], id));

		return forest;

		// helper method
		function createSubtree(link, linkID) {
			let inputs = {};

			for (let input of Object.keys(link.inputs)) {
				inputs[input] = {
					drawn: false,
					state: link.inputs[input].state
				};
			}

			return {
				linkID,
				appID: link.getChild().id,
				snippetID: link.getSnippetID(),
				children: link.getChild().childLinks.map((child) => {
					return createSubtree(child, Object.keys(self.links).find(id => self.links[id] === child));
				}),
				inputs
			};
		}
	}


	function initializeSnippetAssociations(info) {
		console.log("initializing Snippets", info);

		let appPromises = [];

		for (let app of info.apps) {
			appPromises.push(new Promise(function(resolve, reject) {
				self.loadingApps[app] = resolve;
			}));
		}

		Promise.all(appPromises)
			.then(function() {
				console.log("all Snippets Apps loaded");
				handleReloadedSnippetAssociations(info);
			});
	}

	// Link class used by SAGE2_CodeSnippets
	const Link = (function() {
		let curator = self; // alias enclosing scope's 'self'

		return function(parent, child, transformID) {
			let self = {
				parent,
				child,
				transformID,

				inputs: {},
				inputInit: {}
			};

			let publicObject = {
				update,
				setParent,
				getParent,
				setChild,
				getChild,
				getSnippetID,
				setInputInitialValues,
				getInputInitialValues,

				// expose inputs object for now
				inputs: self.inputs
			};

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

			function setInputInitialValues(vals) {
				self.inputInit = vals;
			}

			function getInputInitialValues() {
				return self.inputInit;
			}

			/**
			 * Handles passing information between applications and calling functions based on
			 * the function type. This function is used to update all children of an app when the app is updated.
			 *
			 * @method update
			 */
			function update() {
				let p = self.parent;
				let c = self.child;
				let id = self.transformID;

				if (curator.functions[id].type === "data" && p) {
					// call function (calculates new dataset and updates child)
					try {
						let result = curator.functions[id].code.call(c, p.getDataset(), publicObject);
						c.updateDataset(result);
					} catch (err) {
						console.log(err);
						c.displayError(err);
					}
				} else if (curator.functions[id].type === "draw" && p) {
					// call function (plots data on svg)
					try {
						curator.functions[id].code.call(c, p.getDataset(), publicObject);
						c.updateAncestorTree();
					} catch (err) {
						console.log(err);
						c.displayError(err);
					}
				} else if (curator.functions[id].type === "gen") {
					// call function (this returns a promise)
					curator.functions[id]
						.code.call(c, c.getDataset(), publicObject)
						.then(function(data) {
							c.updateDataset(data);
						})
						.catch(err => {
							console.log(err);
							c.displayError(err);
						});
				}
			}

			return publicObject;
		};
	}());

	return {
		init,

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
		createBlockPath,

		displayApplicationLoaded,
		outputAppClosed,
		getAppAncestry,
		drawAppAncestry,
		executeCodeSnippet,

		registerSnippetListApp,
		unregisterSnippetListApp,
		notifyUserListClick,
		notifyUserDataClick,

		requestSnippetsProjectExport,
		convertLinksToIDForest,
		initializeSnippetAssociations,
		updateSavedSnippetAssociations
	};
}());

// Regular Expression which will find SAGE2.SnippetInput({ ... })
//	and add an extra link parameter to the calls
class SnippetsInputRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of link
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, link)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}

// Regular Expression which will find SAGE2.SnippetVisElement({ ... })
//	and add an extra app ('this') parameter to the calls
class SnippetsVisElementRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		// code replaced with new string
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of app reference
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, this)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}

// Regular Expression which will find SAGE2.SnippetTimeout({ ... })
//	and add an extra link parameter to the calls
class SnippetsTimeoutRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		// code replaced with new string
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of app reference
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, link)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}


