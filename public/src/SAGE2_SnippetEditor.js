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

/* global ace displayUI wsio SAGE2_SnippetExporter */

let SAGE2_SnippetEditor = (function () {
	return function (targetID) {
		let self = {
			div: null,

			editorDiv: null,
			editor: null,

			saveButton: null,
			descInput: null,

			copyButton: null,
			loadButton: null,

			scriptSelect: null,
			snippetChanged: false,

			loadedSnippet: "new",
			loadedSnippetType: null,

			scriptStates: {}
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
			self.div.querySelector("#snippetEditorHide").onclick = hideEditor;
			self.div.querySelector("#snippetEditorClose").onclick = closeScript;

			// bind close action to click on overlay as well
			self.div.querySelector(".overlay").onclick = hideEditor;

			// bind save action
			self.saveButton = self.div.querySelector("#snippetEditorSave");
			self.saveButton.onclick = saveScript;

			self.descInput = self.div.querySelector("#snippetDescription");

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
			self.scriptSelect = self.div.querySelector("#snippetSelect");
			self.scriptSelect.onchange = scriptSelectorChanged;

			// bind load script button
			self.loadButton = self.div.querySelector("#snippetEditorLoad");
			self.loadButton.onclick = loadScript;

			// bind copy action
			self.copyButton = self.div.querySelector("#snippetEditorCopy");
			self.copyButton.onclick = saveCopy;

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
		function saveCopy() {
			// if -> script !== new, clone that script with any current changes in new file
			// then open new file in editor (will be sent through wsio)

			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorCloneSnippet', {
				scriptID: self.scriptSelect.value
			});
		}

		/**
		 * Releases control of a loaded snippet so other users may edit it
		 *
		 * @method unloadScript
		 */
		function unloadScript() {
			console.log("Unload script -- unlock for others to edit:", self.loadedSnippet);

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
		function loadScript() {

			console.log("Load script:", self.scriptSelect.value);

			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorSnippetLoadRequest', {
				scriptID: self.scriptSelect.value
			});

			self.loadedSnippet = self.scriptSelect.value;

			// you can't load what you just loaded
			self.loadButton.classList.add("disabled");
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

			// can load a different script now
			self.loadButton.classList.remove("disabled");

			self.loadedSnippet = "new";
			self.loadedSnippetType = type;

			self.descInput.value = '';
		}

		/**
		 * Updates the disabled states for the load button based on the selected snippet
		 *
		 * @method scriptSelectorChanged
		 */
		function scriptSelectorChanged() {
			let option = self.scriptSelect.options[self.scriptSelect.selectedIndex];

			let canLoad = option.value !== self.loadedSnippet;

			if (canLoad) {
				self.loadButton.classList.remove("disabled");
			} else {
				self.loadButton.classList.add("disabled");
			}
		}

		/**
		 * Updates selector with the existing snippets and their states
		 *
		 * @method updateSnippetStates
		 * @param {Object} scriptStates - The loaded snippet information, based on name, type, editors, etc.
		 */
		function updateSnippetStates(scriptStates) {
			console.log("scriptStates updated", scriptStates);

			self.scriptStates = scriptStates;
			self.scriptSelect.innerHTML = ''; // This works to remove options... real method removing one-by-one was failing

			for (let script of Object.values(scriptStates)) {
				let newOption = document.createElement("option");

				newOption.value = script.id;
				// newOption.innerHTML = `${script.type} - ${script.id.replace("codeSnippet", "cS")}`;
				newOption.innerHTML = `${script.id.replace("codeSnippet", "cS")} - ${script.desc}`;

				if (script.id === self.loadedSnippet) {
					newOption.classList.add("loaded");
				} else if (script.locked) {
					newOption.classList.add("locked");
				}

				self.scriptSelect.appendChild(newOption);
			}

			if (self.loadedSnippet !== "new") {
				self.scriptSelect.value = self.loadedSnippet;
				self.loadButton.classList.add("disabled");
			} else if (scriptStates[self.scriptSelect.value].locked) {
				self.loadButton.classList.add("disabled");
			} else {
				self.loadButton.classList.remove("disabled");
			}
		}

		/**
		 * Handles receiving a requested snippet and populating the editor
		 *
		 * @method receiveLoadedSnippet
		 * @param {Object} data - The snippet text, id, and type information
		 */
		function receiveLoadedSnippet(data) {

			self.editor.setValue(data.text);
			self.editor.clearSelection();

			self.descInput.value = data.desc;

			self.loadedSnippet = data.scriptID;
			self.loadedSnippetType = data.type;
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
			console.log("Editor receive Project Export", data);

			SAGE2_SnippetExporter.generateScriptFromWall(data.functions, data.links);
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
