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

/* global ace displayUI wsio */

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

		// setup editor, loadscript, newscript controls
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
			// self.descInput.text = "New Snippet";
			console.log(self.descInput.value);

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

			startNewScript("gen");
		}

		function openEditor() {
			self.div.classList.add("open");
		}

		function hideEditor() {
			self.div.classList.remove("open");
		}

		function closeScript() {
			unloadScript();
			startNewScript(self.loadedSnippetType);
			hideEditor();
		}

		function saveScript() {
			// save script into current file, or create new file if one does not exist (new)

			wsio.emit('editorSaveSnippet', {
				text: self.editor.getValue(),
				type: self.loadedSnippetType,
				desc: self.descInput.value ? self.descInput.value : self.loadedSnippetType + " snippet",
				scriptID: self.loadedSnippet
			});
		}

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

		function unloadScript() {
			console.log("Unload script -- unlock for others to edit:", self.loadedSnippet);

			if (self.loadedSnippet !== "new") {
				wsio.emit('editorSnippetCloseNotify', {
					scriptID: self.loadedSnippet
				});
			}
		}

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

		function startNewScript(type) {


			if (type === "draw") {
				self.editor.setValue(`// function drawSnippet (data, svg) {
	// write your code here:\n\tsvg = d3.select(svg);
	
	let width = +svg.attr("width"),
		height = +svg.attr("height");
		
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

		function scriptSelectorChanged() {
			let option = self.scriptSelect.options[self.scriptSelect.selectedIndex];

			// *** you can always load a script, but it won't necessarily be editable (?)
			let canLoad = option.value !== self.loadedSnippet;

			if (canLoad) {
				self.loadButton.classList.remove("disabled");
			} else {
				self.loadButton.classList.add("disabled");
			}
		}

		function updateSnippetStates(scriptStates) {
			console.log("scriptStates updated", scriptStates);

			self.scriptStates = scriptStates;
			self.scriptSelect.innerHTML = ''; // This works to remove options... real method removing one-by-one was failing

			for (let script of Object.values(scriptStates)) {
				let newOption = document.createElement("option");

				newOption.value = script.id;
				newOption.innerHTML = `${script.type} - ${script.id.replace("codeSnippet", "cS")}`;

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

		function receiveLoadedSnippet(data) {

			self.editor.setValue(data.text);
			self.editor.clearSelection();

			self.descInput.value = data.desc;

			self.loadedSnippet = data.scriptID;
			self.loadedSnippetType = data.type;
		}

		function browserClose() {
			if (self.loadedSnippet !== "new") {
				unloadScript();
			}
		}

		return {
			open: openEditor,
			hide: hideEditor,

			updateSnippetStates,
			receiveLoadedSnippet,

			browserClose
		};
	};
}());
