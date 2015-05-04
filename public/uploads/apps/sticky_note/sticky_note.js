// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014
Array.prototype.diff = function(num){
	return this.map(function(x){
		return x - num;
	});
}

var sticky_note = SAGE2_App.extend( {
	construct: function() {
		arguments.callee.superClass.construct.call(this);

		this.resizeEvents = "continuous"; // "onfinish";

		this.svg  = null;
		this.obj  = null;
		this.text = null;
		this.textLines = [];
		this.enableControls = true;
		this.cloneable = true;
	},

	init: function(data) {
		// call super-class 'init'
		arguments.callee.superClass.init.call(this, "div", data);

		// application specific 'init'

		this.element.id = "div" + data.id;

		// Set refresh once every 2 sec.
		//this.maxFPS = 1/2;

		var _myself = this;

		// Make the SVG element fill the app
		this.svg = Snap("100%","100%");
		this.element.appendChild(this.svg.node);
		this.vh = 1000*data.width/data.height;
		this.vw = 1000;
		this.margin = 0.05*this.vw;
		this.svg.attr("viewBox", "0,0," + this.vw + "," + this.vh);
		this.backColor = [175,175,200];

		this.lineColor = this.backColor.diff(60);
		//console.log(this.lineColor);
		
		var rectbg = this.svg.rect(0, 0, this.vw, this.vh);
		rectbg.attr({ fill: "rgba(" + this.backColor.join(",") + ",1.0)", strokeWidth: 0 });

		this.numberOfLines = 12;
		this.lineHeight = this.vh/(this.numberOfLines+1);

		for (var i=1;i<=this.numberOfLines;i++){
			var rule = this.svg.line(this.margin,i*this.lineHeight,this.vw-this.margin,i*this.lineHeight);
			rule.attr({
				stroke:"rgba(" + this.lineColor.join(",") + ",1.0)",
				fill:"none",
				strokeWidth:2
				//style:"shape-rendering:crispEdges;"
			});
			var start = this.margin;
			if (i === 1)
				start = this.margin * 3;
			var lineText = this.svg.text(start,(i-0.2)*this.lineHeight,"");
			lineText.attr({
				style:"font-family: sans-serif; font-size: 3.2em;"
			})
			this.textLines.push(lineText);
		}
	},

	// get messages from the server through a broadcast call
	onMessage: function(data) {

	},

	wrapText: function(text){
		this.text = text;
		//list.push(text.slice(0,n-4));
		var regex = /\b/g;
		var list = text.split(regex);
		//var seperators = text.match(regex);
		var rightEnd = this.vw-this.margin;

		//list.push.apply(list,text.slice(n-4).match(regex));
		var wordCount = 0;
		var lineNumber = 0;
		var right = 0;
		str = "";

		while(wordCount < list.length){
			//console.log("Compare:",rightEnd,(this.textLines[lineNumber]).getBBox().x2);
			this.textLines[lineNumber].attr("text",str+list[wordCount]);
			right = this.textLines[lineNumber].getBBox().x2;
			if (right < rightEnd){
				str = str + list[wordCount];
			}
			else{
				this.textLines[lineNumber].attr("text",str);
				lineNumber = lineNumber + 1;
				if (lineNumber >= this.textLines.length)
					break;
				right = this.textLines[lineNumber].attr("x");
				str = list[wordCount];
			}
			wordCount = wordCount + 1;
		}
		lineNumber = lineNumber+1;
		while(lineNumber < this.textLines.length){
			this.textLines[lineNumber].attr("text","");
			lineNumber = lineNumber + 1;
		}
	},

	load: function(state, date) {
		var text = "Enter note";
		if (state){
			state.loadData = state.loadData || "";
			if (state.loadData.length > 0){
				this.wrapText(state.loadData);
				text = state.loadData;
			}
				
		}
		this.controls.addTextInput({defaultText: text, id:"TextInput", action:this.wrapText.bind(this)});
		this.controls.addButton({type:"duplicate",sequenceNo:3, id:"DuplicateNote"});
		this.controls.addButton({type:"new",sequenceNo:5, id:"NewNote"});
		this.controls.finishedAddingControls();
	},

	draw: function(date) {
		// Update the text: instead of storing a variable, querying the SVG graph to retrieve the element
		//this.svg.select("#mytext").attr({ text: date});
	},

	resize: function(date) {
		// no need, it's SVG!
	},

	event: function(eventType, position, user_id, data, date) {

		if (eventType === "pointerPress" && (data.button === "left")) {
			// Move the circle when I click
			this.obj.attr({ cx: Math.round(Math.random()*100), cy:Math.round(Math.random()*100)});
		}
		else if (eventType === "pointerRelease" && (data.button === "left")) {
		}

		else if (eventType === "keyboard") {
			if(data.character === "m") {
			}
			else if (data.character === "t") {
			}
			else if (data.character === "w") {
			}			
		}

		else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") { // left arrow
			}
			else if (data.code === 38 && data.state === "down") { // up arrow
			}
			else if (data.code === 39 && data.state === "down") { // right arrow
			}
			else if (data.code === 40 && data.state === "down") { // down arrow
			}			
		}
		else if (eventType === "widgetEvent"){
			switch(data.ctrlId){
				case "DuplicateNote":
					this.requestForClone = true;
					this.cloneData = this.text;
					break;
				case "NewNote":
					this.requestForClone = true;
					this.cloneData = "";
					break;
				case "TextInput":
					this.wrapText(data.text);
					break;
				default:
					console.log("No handler for:", data.ctrlId);
					break;
			}
		}
	},
	quit: function(){
		
	}

});
