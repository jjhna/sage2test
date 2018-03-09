"use strict";
// get a reference to a globally defined SAGE2 Object
var SAGE2 = SAGE2 || {};

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

		if(!link.inputs[specification.name]) {
			// create new input element if this doesn't exist
			let newInput = CodeSnippetInput.create(specification);
			link.inputs[specification.name]= newInput;
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

}());
