/* global React, ReactDOM, SAGE2_App_Spec */

class SAGE2_ReactApp {
	constructor() {
		Object.assign(this, SAGE2_App_Spec);
		this.setters = {};

		this.construct();
	}

	init(data) {
		console.log('SAGE2_ReactApp> init');
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'black';

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";
		this.passSAGE2PointerAsMouseEvents = true;

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;
	}

	load(date) {
		console.log('SAGE2_ReactApp> Load with state: ', this.state);
		this.refresh(date);
	}

	draw(date) {
		// console.log('SAGE2_ReactApp> Draw with state', this.state);

		let Component = this.render;

		ReactDOM.render(React.createElement(Component, {
			useStateSAGE2: this.useState.bind(this),
			width: this.sage2_width,
			height: this.sage2_height
		}), this.element);
	}

	resize(date) {
		// Called when window is resized
		// this.img.style.width = this.sage2_width + "px";
		// this.img.style.height = this.sage2_height + "px";

		// this.refresh(date);
		this.draw();
	}

	move(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	}

	quit() {
		// Make sure to delete stuff (timers, ...)
	}

	useState(name) {
		let stateValue = this.state[name];
		let [state, setState] = React.useState(stateValue);

		// save the setter function to trigger rerender in other places
		this.setters[name] = (setter) => {
			if (setter instanceof Function) {
				this.state[name] = setter(stateValue);
			} else {
				this.state[name] = setter;
			}

			this.SAGE2Sync();
			setState(this.state[name]);
		};

		return [state, this.setters[name]];
	}

	setState(name, exp) {
		this.setters[name](exp);
	}

	event(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
		} else if (eventType === "pointerMove" && this.dragging) {
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.refresh(date);
			}
		}
	}
}
