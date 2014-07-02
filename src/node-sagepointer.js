// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/**
 @module sagepointer
 */


function sagepointer(id) {
	this.id = id;
	this.label = "";
	this.color = [255, 255, 255];
	this.left = 0;
	this.top = 0;
	this.visible = false;
}

sagepointer.prototype.start = function(label, color) {
	this.label = label;
	this.color = color;
	this.left = 0;
	this.top = 0;
	this.visible = true;
};

sagepointer.prototype.stop = function() {
	this.visible = false;
};


module.exports = sagepointer;
