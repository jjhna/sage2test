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

			self.div.querySelector("#exportProject").onclick = requestProjectExport;

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

		function requestProjectExport() {
			wsio.emit("editorRequestSnippetsExport");
		}

		function receiveProjectExport(data) {
			console.log("Editor receive Project Export", data);

			generateScriptFromWall(data.functions, data.links);
		}

		// function to create script from wall which can be run/developed on personal computer
		function generateScriptFromWall(functions, links) {
			console.log(functions, links);

			let newWindow = window.open();
			let newDocument = newWindow.document;

			let scripts = {
				gen: newDocument.createElement("script"),
				data: newDocument.createElement("script"),
				draw: newDocument.createElement("script")
			};

			let mainScript = newDocument.createElement("script");
			let downloadScript = newDocument.createElement("script");

			for (let type of Object.keys(scripts)) {
				scripts[type].text = createTypedScriptText(
					functions.filter(f => f.type === type)
				);

				scripts[type].id = "codeSnippets-" + type;
				scripts[type].async = false;
			}

			mainScript.text = createMainScriptText(links);

			mainScript.id = "codeSnippets-main";
			mainScript.async = false;

			downloadScript.text = createDownloadScriptText();

			// add d3 to new page
			let d3Script = newDocument.createElement("script");
			d3Script.src = "https://d3js.org/d3.v4.min.js";

			d3Script.onload = function() {
				newDocument.body.appendChild(downloadScript);

				newDocument.head.appendChild(scripts.gen);
				newDocument.head.appendChild(scripts.data);
				newDocument.head.appendChild(scripts.draw);

				newDocument.head.appendChild(mainScript);
			};

			newDocument.head.appendChild(d3Script);

			// ======================================================
			// helper functions for creating scripts

			function createTypedScriptText(functions) {
				let scriptText = `
				var functions = functions || {};
				console.log(document.currentScript.id, "Loaded");
				`.replace(/\t\t\t/gi, "");

				for (let func of functions) {
					scriptText += `\n
					functions["${func.id}"] = {
						type: "${func.type}",
						desc: "${func.desc}",
						code: ${func.code}
					}`.replace(/\t\t\t\t/gi, "");
				}

				return scriptText;
			}

			function createMainScriptText(links) {
				return `
					var functions = functions || {};
					let linkForest;
					console.log(document.currentScript.id, "Loaded");

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
						linkForest = ${JSON.stringify(links)};

						console.log("Init Done", functions);
						run();
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
					}`.replace(/\t\t\t\t/gi, "");

				// replace is to unindent the code and make it readable in the output
				// since string template preserves extra 4 tab indentation from this file's src
			}

			function createDownloadScriptText() {
				return `
					let downloadWrapper = document.createElement("div");
					let downloadButton = document.createElement("input");

					downloadButton.type = "button";
					downloadButton.value = "Download Page";
					downloadButton.id = "downloadButton";
					downloadButton.onclick = download;

					downloadWrapper.appendChild(downloadButton);
					document.body.appendChild(downloadWrapper);

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
					}`.replace(/\t\t\t\t/gi, "");
			}
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
