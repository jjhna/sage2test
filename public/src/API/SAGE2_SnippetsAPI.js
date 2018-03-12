"use strict";
// get a reference to a globally defined SAGE2 Object
var SAGE2 = SAGE2 || {};

/* global d3 CodeSnippetInput */

// IIFE to instantiate SAGE2 snippets API calls
(function() {
	// console.log(CodeSnippetInput.create({type: "text", name: "textField"}));
	// console.log(CodeSnippetInput.create({type: "checkbox", name: "checkboxBool"}));
	/*
	 * SAGE2.SnippetInput API
	 *
	 * Break parameters for the function into input specification and link
	 *
	 */
	SAGE2.SnippetInput = function(specification, link) {
		console.log("SnippetInput link:", link);

		// throw error if name or type is missing
		if (!specification.name) {
			throw new ReferenceError("'name' not found in SAGE2.SnippetInput specification");
		}
		if (!specification.type) {
			throw new ReferenceError("'type' not found in SAGE2.SnippetInput specification");
		}

		if (!link.inputs[specification.name]) {
			// create new input element if this doesn't exist
			let newInput = CodeSnippetInput.create(specification);
			link.inputs[specification.name] = newInput;
		} else {
			// otherwise, update existing element if it does exist

			// throw error if input of a certain name changes type
			if (link.inputs[specification.name].spec.type !== specification.type) {
				throw new TypeError("'type' of SAGE2.SnippetInput is immutable");
			}

			link.inputs[specification.name].spec = specification;
		}

		console.log(link.inputs);

		return link.inputs[specification.name].state;
	};

	/*
	 * SAGE2.SnippetVisElement API
	 *
	 * Break parameters for the function into outputElement specification and parent element
	 *
	 */
	SAGE2.SnippetVisElement = function(specification, app) {
		let {type} = specification;

		console.log("SnippetVisElement", type, app);

		if (app.snippetVisElement && app.snippetsVisElement.tagName !== type) {
			app.snippetsVisElement.remove();
			delete app.snippetsVisElement;
		}

		// if the app doesn't have a vis element, create one
		if (!app.snippetsVisElement) {
			app.snippetsVisElement = d3.select(app.element)
				.append(type)
				.style("position", "absolute")
				.style("top", "32px")
				.style("background", "white")
				.style("box-sizing", "border-box").node();
		}
		// in all cases, reset the size of the vis element
		d3.select(app.snippetsVisElement).each(function() {
			if (type === "svg") {
				d3.select(this)
					.attr("width", app.sage2_width)
					.attr("height", app.sage2_height - 32);
			} else {
				d3.select(this)
					.style("width", (app.sage2_width) + "px")
					.style("height", (app.sage2_height - 32) + "px");
			}
		});



		return {
			elem: app.snippetsVisElement,
			width: app.sage2_width,
			height: app.sage2_height - 32
		};
	};
}());
