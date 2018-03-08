// get a reference to a globally defined SAGE2 Object

var SAGE2 = SAGE2 || {};

// IIFE to instantiate SAGE2 snippets API calls
(function() {

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

		// let inputStateValue = link.getInputState(specification.name);
		console.log(SnippetInputTypes[specification.type]);

		return 10;
	};

	// functions to create input objects
	let SnippetInputTypes = {

		/* { name, type, range, step } */
		range: function(inputSpec) {

		},

		/* { name, type, range, step } */
		checkbox: function(inputSpec) {

		},

		/* { name, type, options } */
		radio: function(inputSpec) {

		},

		/* { name, type } */
		text: function(inputSpec) {

		}
	};

}());
