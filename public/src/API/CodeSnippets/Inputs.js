"use strict";
let CodeSnippetInput = (function () {

	/*
	 * SnippetInput base-class
	 */
	class SnippetInput {
		constructor(specification) {
			this._spec = specification;
			this._state = new SnippetInputState(this.defaultValue);

			console.log("Creating:", this.constructor.name);
		}

		get state() {
			return this._state.value;
		}

		get spec() {
			return this._spec;
		}

		set spec (newSpec) {
			this.updateStateFromSpec(newSpec);

			this._spec = newSpec;
		}

		/*
		 * SnippetInput abstract methods -- must be implemented to avoid Error
		 */
		get defaultValue() {
			throw new Error(`get defaultValue() method must be implemented in ${this.spec.type} SnippetInput`);
		}

		updateStateFromSpec(newSpec) {
			throw new Error(`updateStateFromSpec() method must be implemented in ${this.spec.type} SnippetInput`);
		}
	}

	/*
	 * SnippetInput State class
	 */
	class SnippetInputState {
		constructor(defaultVal) {
			this._value = defaultVal;
		}

		set value(newState) {
			// check if the state has changed
			if (this.newState !== this._value) {
				// perform updates on state change

			}
			this._value = newState;
		}

		get value() {
			return this._value;
		}
	}

	/*
	 * Sub-classes extending SnippetInput per input type
	 */

	/*
	 * Range slider input for Code Snippets
	 * Specification: { name, type, range, step }
	 */
	class SnippetRange extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			// default input value is the first value in the range
			return this._spec.range[0];
		}

		updateStateFromSpec(newSpec) {
			// clamp value into new range
			if (this._state.value < newSpec.range[0]) {
        this._state.value = newSpec.range[0];
      } else if (this._state.value > newSpec.range[1]) {
        this._state.value = newSpec.range[1];
			}
			// TODO: round state value to step size (?)
		}
	}

	/*
	 * Checkbox input for Code Snippets
	 * Specification: { name, type }
	 */
	class SnippetCheckbox extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			return false;
		}

		updateStateFromSpec(newSpec) {
			// no merge required for SnippetText
			// --> state and spec never deviate
		}
	}

	/*
	 * Radio buttons input for Code Snippets
	 * Specification: { name, type, options }
	 */
	class SnippetRadio extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			return this.spec.options[0];
		}

		updateStateFromSpec(newSpec) {
			return !newSpec.options.includes(this._state.value);
		}
	}

	/*
	 * Text field input for Code Snippets
	 * Specification: { name, type }
	 */
	class SnippetText extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			return "";
		}

		updateStateFromSpec(newSpec) {
			// no merge required for SnippetText
			// --> state and spec never deviate
		}
	}

	/*
	 * SnippetInputFactory class
	 */
	return {
		_typeMap: {
			range: SnippetRange,
			checkbox: SnippetCheckbox,
			radio: SnippetRadio,
			text: SnippetText
		},
		create: function(specification) {
			// console.log(specification);
			return new this._typeMap[specification.type](specification);
		}
	};
}());