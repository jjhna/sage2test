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

/* global ace displayUI interactor wsio SAGE2_SnippetExporter */

let SAGE2_SnippetEditor = (function () {
	// api examples to be inserted in the editor
	let apiExamples = {
		SnippetVisElement: `let { elem, width, height } = SAGE2.SnippetVisElement({ type: "svg" });`,
		SnippetInput: {
			Checkbox: `let checkbox = SAGE2.SnippetInput({
		name: "my_checkbox", // name your input element
		type: "checkbox",
		defaultVal: false // an *optional* default value for the input
	});`,
			Text: `let textfield = SAGE2.SnippetInput({
		name: "my_textInput", // name your input element
		type: "text",
		defaultVal: "foo" // an *optional* default value for the input
	});`,
			Radio: `let radiogroup = SAGE2.SnippetInput({
		name: "my_radio", // name your input element
		type: "radio",
		options: ['one', 'two', 'three'],
		defaultVal: 'one' // an *optional* default value for the input
	});`,
			Range: `let slider = SAGE2.SnippetInput({
		name: "my_slider", // name your input element
		range: [1, 20],
		step: 1,
		defaultVal: 1 // an *optional* default value for the input
	});`
		},
		SnippetTimeout: `SAGE2.SnippetTimeout({time: 500}); // 500ms timeout`
	};

	return function (targetID, config) {
		let self = {
			config: config.experimental && config.experimental.codesnippets ? config.experimental.codesnippets : {},
			div: null,

			editorDiv: null,
			editor: null,

			saveButton: null,
			descInput: null,

			copyButton: null,
			loadButton: null,

			scriptDropdown: null,

			loadedSnippet: "new",
			loadedSnippetType: null,

			scriptStates: {},

			apiHelper: null
		};

		init();

		/**
		 * Sets up editor, loadscript, newscript controls
		 *
		 * @method init
		 */
		function init() {
			// get overall wrapper div
			self.div = document.getElementById(targetID);

			// set up editor
			self.editorDiv = self.div.querySelector("#snippetEditor");
			self.editor = ace.edit(self.editorDiv);

			self.editor.setOptions({
				printMargin: false,
				fontSize: "16px"
			});

			// set style and javascript syntax
			self.editor.setTheme("ace/theme/monokai");
			self.editor.getSession().setMode("ace/mode/javascript");

			self.editor.commands.addCommand({
				name: "saveFile",
				bindKey: {
					win: "Ctrl-S",
					mac: "Command-S",
					sender: "editor|cli"
				},
				exec: function(env, args, request) {
					saveScript();
				}
			});

			// bind hide and close button
			// self.div.querySelector("#snippetEditorHide").onclick = hideEditor; // remove hide function
			self.div.querySelector("#snippetEditorClose").onclick = closeScript;

			// bind hide action to click on overlay
			self.div.querySelector(".overlay").onclick = hideEditor;

			// bind save action
			self.saveButton = self.div.querySelector("#snippetEditorSave");
			self.saveButton.onclick = saveScript;

			// script name entry, save on Enter
			self.descInput = self.div.querySelector("#snippetDescription");
			self.descInput.onkeyup = function(e) {
				if (e.keyCode === 13) {
					saveScript();
				}
			};

			// bind new script type buttons
			self.div.querySelector("#newSnippetGen").onclick = function () {
				unloadScript();
				startNewScript("gen");
			};
			self.div.querySelector("#newSnippetData").onclick = function () {
				unloadScript();
				startNewScript("data");
			};
			self.div.querySelector("#newSnippetDraw").onclick = function () {
				unloadScript();
				startNewScript("draw");
			};

			// ready script selector dropdown
			self.scriptDropdown = self.div.querySelector("#loadSnippetOptions");

			// api helper element
			self.apiHelper = self.div.querySelector("#snippetApiOptions");
			addApiHelperOptions(apiExamples, self.apiHelper);

			self.div.querySelector("#exportProject").onclick = requestProjectExport;

			startNewScript("gen");
		}

		// handles editor visibility
		function openEditor() {
			self.div.classList.add("open");
		}

		function hideEditor() {
			self.div.classList.remove("open");
		}

		/**
		 * Handles unloading a script when the close button is clicked
		 *
		 * @method closeScript
		 */
		function closeScript() {
			unloadScript();
			startNewScript(self.loadedSnippetType);
			hideEditor();
		}

		/**
		 * Sends snippet information to the display client to be reloaded and updated
		 *
		 * @method saveScript
		 */
		function saveScript() {
			// save script into current file, or create new file if one does not exist (new)

			wsio.emit('editorSaveSnippet', {
				author: interactor.user.label,
				text: self.editor.getValue(),
				type: self.loadedSnippetType,
				desc: self.descInput.value ? self.descInput.value : self.loadedSnippetType + " snippet",
				scriptID: self.loadedSnippet
			});
		}

		/**
		 * Requests a copy be made of the selected snippet
		 *
		 * @method saveCopy
		 */
		function saveCopy(id) {
			// if -> script !== new, clone that script with any current changes in new file
			// then open new file in editor (will be sent through wsio)

			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorCloneSnippet', {
				author: interactor.user.label,
				scriptID: id
			});
		}

		/**
		 * Releases control of a loaded snippet so other users may edit it
		 *
		 * @method unloadScript
		 */
		function unloadScript() {
			// unlock script for others
			if (self.loadedSnippet !== "new") {
				wsio.emit('editorSnippetCloseNotify', {
					scriptID: self.loadedSnippet
				});
			}
		}

		/**
		 * Requests the snippet load based on the script selector and handles unload of current snippet
		 *
		 * @method loadScript
		 */
		function loadScript(id) {
			// make sure to unload a snippet if another is already loaded
			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorSnippetLoadRequest', {
				scriptID: id
			});
		}

		/**
		 * Loads the starter code for each script type into the editor
		 *
		 * @method startNewScript
		 * @param {String} type - gen, data, or draw snippet type
		 */
		function startNewScript(type) {


			if (type === "draw") {
				self.editor.setValue(`// function drawSnippet (data) {
	// write your code here:\n\tlet { elem, width, height } = SAGE2.SnippetVisElement({ type: "svg" });
		
		
//}`);
			} else if (type === "gen") {
				self.editor.setValue(`// function generatorSnippet (resolve, reject, previousData) {
	// write your code here:
	let newData = [];
	
	resolve(newData);
//}`);
			} else {
				self.editor.setValue(`// function dataSnippet (data) {
	// write your code here:
	let newData = data;
	
	return newData;
//}`);
			}

			self.editor.setReadOnly(false);
			self.editor.clearSelection();

			// can save a new script
			self.saveButton.classList.remove("disabled");

			self.loadedSnippet = "new";
			self.loadedSnippetType = type;

			self.descInput.value = '';
		}

		/**
		 * Populate the API dropdown with the template names
		 *
		 * @method addApiHelperOptions
		 */
		function addApiHelperOptions(examples, parent) {
			for (let key of Object.keys(examples)) {
				let newOption = document.createElement("div");
				let name = document.createElement("span");

				newOption.className = "dropdownOption";

				console.log(examples, key);

				if (typeof examples[key] === "string") {
					newOption.onclick = function() {
						insertApiCall(examples[key]);
					};

				} else { // recurse if it finds an object
					let optionList = document.createElement("div");
					optionList.className = "dropdownOptionList right";

					newOption.classList.add("controlDropdown");

					addApiHelperOptions(examples[key], optionList);

					newOption.appendChild(optionList);
				}

				name.innerHTML = key;

				newOption.appendChild(name);
				parent.appendChild(newOption);
			}
		}

		/**
		 * Loads the starter code for each script type into the editor
		 *
		 * @method insertApiCall
		 * @param {String} type - Helper control to add a SAGE2 Snippets API Call at the cursor
		 */
		function insertApiCall(text) {
			self.editor.insert(text);
		}

		/**
		 * Updates selector with the existing snippets and their states
		 *
		 * @method updateSnippetStates
		 * @param {Object} scriptStates - The loaded snippet information, based on name, type, editors, etc.
		 */
		function updateSnippetStates(scriptStates) {
			// update saved states and clear existing options
			self.scriptStates = scriptStates;
			self.scriptDropdown.innerHTML = ""; // This works to remove options... real method removing one-by-one was failing

			for (let script of Object.values(scriptStates)) {
				// populate Dropdown
				let newOption = document.createElement("div");
				let typeBadge = document.createElement("div");
				let name = document.createElement("span");

				newOption.className = "dropdownOption";
				typeBadge.className = "colorBadge " + script.type + "SnippetColor";

				newOption.onclick = function() {
					if (script.locked && script.id !== self.loadedSnippet) {
						saveCopy(script.id);
					} else if (script.id !== self.loadedSnippet) {
						loadScript(script.id);
					}
				};

				name.innerHTML = `${script.id.replace("codeSnippet", "cS")} - ${script.desc}`;

				if (script.id === self.loadedSnippet) {
					newOption.disabled = true;
					newOption.classList.add("loaded");
				} else if (script.locked) {
					newOption.disabled = true;
					newOption.classList.add("locked");
				}

				newOption.appendChild(typeBadge);
				newOption.appendChild(name);
				self.scriptDropdown.appendChild(newOption);
			}
		}

		/**
		 * Handles receiving a requested snippet and populating the editor
		 *
		 * @method receiveLoadedSnippet
		 * @param {Object} data - The snippet text, id, and type information
		 */
		function receiveLoadedSnippet(data) {

			// next cursor position
			let cursorPosition = {row: 0, column: 0};

			// retain position if the loaded snippet is the same as the current
			if (data.scriptID === self.loadedSnippet) {
				cursorPosition = self.editor.getCursorPosition();
			}

			self.editor.setValue(data.text);
			self.editor.moveCursorToPosition(cursorPosition);
			self.editor.clearSelection();

			self.descInput.value = data.desc;

			self.loadedSnippet = data.scriptID;
			self.loadedSnippetType = data.type;

			// if the editor is closed, open it
			openEditor();
		}

		/**
		 * Releases control of a snippet for when the page is navigated away from
		 *
		 * @method browserClose
		 */
		function browserClose() {
			if (self.loadedSnippet !== "new") {
				unloadScript();
			}
		}

		function requestProjectExport() {
			wsio.emit("editorRequestSnippetsExport");
		}

		/**
		 * Passes project export information into the SnippetExporter for download
		 *
		 * @method receiveProjectExport
		 * @param {Object} data - The project export information (functions and links)
		 */
		function receiveProjectExport(data) {
			// hand off project information to exporter
			SAGE2_SnippetExporter.generateScriptFromWall(
				data.functions,
				data.links,
				self.config.external_dependencies || []
			);
		}

		return {
			open: openEditor,
			hide: hideEditor,

			updateSnippetStates,
			receiveLoadedSnippet,
			receiveProjectExport,

			browserClose
		};
	};
}());
