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

let SAGE2_SnippetEditor = (function() {
	return function(targetID) {
		let self = {
			div: null,

			editorDiv: null,
			editor: null,

			saveButton: null,
			copyButton: null,
			loadButton: null,

			scriptSelect: null,
			snippetChanged: false,

			loadedSnippet: null,
			loadedSnippetType: null,

			// scriptStates: {},
			// test values for now
			scriptStates: {
				"codeSnippet-0": {
					locked: false
				},
				"codeSnippet-1": {
					locked: false
				},
				"codeSnippet-2": {
					locked: true
				},
				"codeSnippet-3": {
					locked: false
				}
			}
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

			// bind hide and close button
			self.div.querySelector("#snippetEditorHide").onclick = hideEditor;
			self.div.querySelector("#snippetEditorClose").onclick = closeScript;

			// bind close action to click on overlay as well
			self.div.querySelector(".overlay").onclick = hideEditor;

			// bind save and save copy actions
			self.saveButton = self.div.querySelector("#snippetEditorSave");
			self.saveButton.onclick = saveScript;

			self.copyButton = self.div.querySelector("#snippetEditorCopy");
			self.copyButton.onclick = saveCopy;

			// bind new script type buttons
			self.div.querySelector("#newSnippetGen").onclick = function() {
				startNewScript("gen");
			};
			self.div.querySelector("#newSnippetData").onclick = function() {
				startNewScript("data");
			};
			self.div.querySelector("#newSnippetDraw").onclick = function() {
				startNewScript("draw");
			};

			// ready script selector dropdown
			self.scriptSelect = self.div.querySelector("#snippetSelect");
			self.scriptSelect.onchange = scriptSelectorChanged;

			// bind load script button
			self.loadButton = self.div.querySelector("#snippetEditorLoad");
			self.loadButton.onclick = loadScript;
		}

		function openEditor() {
			self.div.classList.add("open");
		}

		function hideEditor() {
			self.div.classList.remove("open");
		}

		function closeScript() {
			unloadScript();
			hideEditor();
		}

		function saveScript() {
			// save script into current file, or create new file if one does not exist (new)
			console.log("save:", self.editor.getValue());

			wsio.emit('editorSaveSnippet', {
				text: self.editor.getValue(),
				scriptID: self.loadedSnippet
			});
		}

		function saveCopy() {
			// if -> script !== new, clone that script with any current changes in new file
			// then open new file in editor (will be sent through wsio)

			console.log("copy:", self.scriptSelect.value);
			wsio.emit('editorSaveSnippet', {
				text: self.editor.getValue(),
				scriptID: "new"
			});
		}

		function unloadScript() {
			console.log("Unload script -- unlock for others to edit:", self.loadedSnippet);

			wsio.emit('editorSnippetCloseNotify', { scriptID: self.loadedSnippet });

			self.loadedSnippet = null;
		}

		function loadScript() {
			if (self.loadedSnippet) {
				unloadScript();
			}

			console.log("Load script:", self.scriptSelect.value);

			wsio.emit('editorSnippetLoadRequest', {
				scriptID: self.scriptSelect.value
			});

			self.loadedSnippet = self.scriptSelect.value;

			if (self.scriptStates[self.loadedSnippet] && self.scriptStates[self.loadedSnippet].locked) {
				// script is uneditable & unsaveable
				self.editor.setReadOnly(true);
				self.saveButton.classList.add("disabled");
			} else {
				// otherwise, it is fine to edit
				self.editor.setReadOnly(false);
				self.saveButton.classList.remove("disabled");
			}

			// you can always copy a script you loaded (since it's not new)
			self.copyButton.classList.remove("disabled");
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
	let newData;
	
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

			// can't copy something which isn't saved
			self.copyButton.classList.add("disabled");

			self.loadedSnippet = "new";
			self.loadedSnippetType = type;
		}

		function scriptSelectorChanged() {
			let option = self.scriptSelect.options[self.scriptSelect.selectedIndex];

			// *** you can always load a script, but it won't necessarily be editable
			let canLoad = option.value !== self.loadedSnippet;

			if (canLoad) {
				self.loadButton.classList.remove("disabled");
			} else {
				self.loadButton.classList.add("disabled");
			}

		}

		function updateScriptSelectorList(scriptStates) {
			self.scriptStates = scriptStates;
		}

		return {
			open: openEditor,
			hide: hideEditor,


			updateScriptSelectorList
		};
	};
}());
