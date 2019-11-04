class fsm3D {
	constructor() {
		fsm3D.blocked = null;
	}
	static block(id) {
		if (fsm3D.blocked === null) {
			fsm3D.blocked = id;	
		}
	}
	static isBlocked(id) {
		return (fsm3D.blocked !== id && fsm3D.blocked !== null);
	}
	static unBlock(id) {
		if (fsm3D.blocked === id) {
			fsm3D.blocked = null;
		}
	}

}

fsm3D.prototype.init = function(id, states, inputs) {
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
	this.id = id;
	this.currentState = 0;
};

fsm3D.prototype.setActionContext = function(context) {
	this.actionContext = context;
};

fsm3D.prototype.copyInputMap = function(inputMap) {
	this.inputMap = Object.assign({}, inputMap);
}

fsm3D.prototype.copyTransitions = function(matrix) {
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

fsm3D.prototype.copyActions = function(matrix) {
	for (var s = 0; s < this.states; s ++) {
		for (var i = 0; i < this.inputs; i ++) {
			this.actionTable[s][i] = matrix[s][i];
		}
	}
};

fsm3D.prototype.clone = function(id) {
	var temp = new fsm3D();
	temp.init(id, this.states, this.inputs);
	temp.copyInputMap(this.inputMap);
	temp.copyTransitions(this.transitionTable);
	temp.copyActions(this.actionTable);
	temp.setActionContext(this.actionContext);
	temp.currentState = this.currentState;
	return temp;
};

fsm3D.prototype.setTransition = function(state, input, transition) {
	if (state < this.states && input < this.inputs && transition < this.states) {
		this.transitionTable[state][input] = transition;
	}
};


fsm3D.prototype.setAction = function(state, input, action) {
	if (state < this.states && input < this.inputs) {
		this.actionTable[state][input] = action;
	}
};

fsm3D.prototype.setInputMap = function(map) {
	this.inputMap = map;
};


fsm3D.prototype.transition = function(input) {
	try {
		if (fsm3D.isBlocked(this.id) === false) {
			if (this.inputMap.hasOwnProperty(input) === true && this.inputMap[input] !== undefined) {
				var smInput = input;
				input = this.inputMap[input];
				var func = this.actionTable[this.currentState][input];
				if (this.transitionTable[this.currentState][input] === undefined) {
					console.log("transition not defined on " + this.currentState + "for " + input);
				}
				console.log("going from " + this.currentState + " to " + this.transitionTable[this.currentState][input]);
				this.currentState = this.transitionTable[this.currentState][input];
				
				if (func && typeof func === 'string' && this.actionContext[func] instanceof Function) {
					this.actionContext[func](this.id, smInput);
				} else if (Array.isArray(func) === true) {
					func.forEach(f => {
						if (typeof f === 'string' && this.actionContext[f] instanceof Function) {
							this.actionContext[f](this.id, smInput);
						}
					});
				}
			}
		}
		
	} catch (error) {
		console.log("Failing to make a transition on state: " + this.currentState + "for input: " + input);
		console.log(error);
	}
	
};


fsm3D.prototype.connectToControlPanel = function(controlPanel) {
	this.controlPanel = controlPanel;
}

fsm3D.prototype.forceTransition = function(state) {
	this.currentState = state;
}