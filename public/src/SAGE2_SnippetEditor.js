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

/* global ace displayUI */

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

			loadedSnippet: null,
			loadedSnippetType: null
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
			// save script into current file, or create new file if one does not exist
			console.log("save:", self.editor.getValue());
		}

		function saveCopy() {
			// if -> script in dropdown !== current, clone that script in new file
			// else -> save changes of current script into new file
			// then open new file in editor
			console.log("copy:", self.scriptSelect.value);

		}

		function unloadScript() {
			console.log("Unload script -- unlock for others to edit:", self.loadedSnippet);

			self.loadedSnippet = null;
		}

		function loadScript() {
			if (self.loadedSnippet) {
				unloadScript();
			}

			console.log("Load script -- lock out editing:", self.scriptSelect.value);
			self.loadedSnippet = self.scriptSelect.value;



			// use this to update buttons
			scriptSelectorChanged();
		}

		function startNewScript(type) {
			// d3.select("#script-select").node().value = "new";
			// let type = d3.select("#type-select").node().value;

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

			self.editor.clearSelection();

			self.loadedSnippet = "new";
			self.loadedSnippetType = type;
		}

		function scriptSelectorChanged() {
			let option = self.scriptSelect.options[self.scriptSelect.selectedIndex];

			let canLoad = option.value !== self.loadedSnippet && !option.classList.contains("locked");

			if (canLoad) {
				self.loadButton.classList.remove("disabled");
			} else {
				self.loadButton.classList.add("disabled");
			}
		}

		function updateScriptSelectorList(scriptStates) {

			/*{
					id: {
						type: ,
						locked:
					},
					...
				}*/
		}

		return {
			open: openEditor,
			hide: hideEditor,
			updateScriptSelectorList
		};
	};
}());
