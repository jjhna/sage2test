function fsm() {

}

fsm.prototype.init = function(states, inputs) {
	var temp = new Array(states);
	var tempActions = new Array(states);
	for (var i = 0; i < temp.length; i++) {
		temp[i] = new Array(inputs);
		tempActions[i] = new Array(inputs);
	}
	this.transitionTable = temp;
	this.actionTable = tempActions;
	this.states = states;
	this.inputs = inputs;
	this.currentState = 0;
};

fsm.prototype.setActionContext = function(context) {
	this.actionContext = context;
};

fsm.prototype.defaultActionOnStateChange = function(action) {
	if (action && typeof action === 'string' && this.actionContext[action] instanceof Function) {
		this.defaultAction = action;
	}
};
	

fsm.prototype.copyTransitions = function(matrix) {
	for (var s = 0; s < this.states; s ++) {
		for (var i = 0; i < this.inputs; i ++) {
			if (matrix[s][i] < this.states) {
				this.transitionTable[s][i] = matrix[s][i];	
			} else {
				console.log("Invalid transition!");
			}
		}
	}
};

fsm.prototype.copyActions = function(matrix) {
	for (var s = 0; s < this.states; s ++) {
		for (var i = 0; i < this.inputs; i ++) {
			this.actionTable[s][i] = matrix[s][i];
		}
	}
};



fsm.prototype.setTransition = function(state, input, transition) {
	if (state < this.states && input < this.inputs && transition < this.states) {
		this.transitionTable[state][input] = transition;
	}
};


fsm.prototype.setAction = function(state, input, action) {
	if (state < this.states && input < this.inputs) {
		this.actionTable[state][input] = action;
	}
};

fsm.prototype.setInputMap = function(map) {
	this.inputMap = map;
};


fsm.prototype.transition = function(input) {
	try {
		if (this.inputMap.hasOwnProperty(input) === true && this.inputMap[input] !== undefined) {
			input = this.inputMap[input];
			var func = this.actionTable[this.currentState][input];
			if (this.transitionTable[this.currentState][input] === undefined) {
				console.log("transition not defined on " + this.currentState + "for " + input);
			}
			if (this.currentState !== this.transitionTable[this.currentState][input]) {
				console.log("going from " + this.currentState + " to " + this.transitionTable[this.currentState][input]);
			}
			var prevState = this.currentState;
			this.currentState = this.transitionTable[this.currentState][input];
			
			if (func && typeof func === 'string' && this.actionContext[func] instanceof Function) {
				this.actionContext[func]();
			} else if (Array.isArray(func) === true) {
				func.forEach(f => {
					if (typeof f === 'string' && this.actionContext[f] instanceof Function) {
						this.actionContext[f]();
					}
				})
			}
			if (this.defaultAction && prevState !== this.currentState) {
				this.actionContext[this.defaultAction]();
			}
		}
	} catch (error) {
		console.log("Failing to make a transition on state: " + this.currentState + "for input: " + input);
		console.log(error);
	}
	
};


fsm.prototype.connectToControlPanel = function(controlPanel) {
	this.controlPanel = controlPanel;
}

fsm.prototype.forceTransition = function(state) {
	this.currentState = state;
}