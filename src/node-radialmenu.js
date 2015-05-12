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
 * Radial menu for a given pointer
 *
 * @module server
 * @submodule radialmenu
 */

// require variables to be declared
"use strict";

// unused: var radialMenuCenter = { x: 210, y: 210 }; // scale applied in ctor
var radialMenuDefaultSize      = { x: 425, y: 425 }; // scale applied in ctor
var thumbnailWindowDefaultSize = { x: 1224, y: 860 };

/**
 * Class RadialMenu
 *
 * @class RadialMenu
 * @constructor
 */
function RadialMenu(id, ptrID, ui) {
	this.id        = id;
	this.pointerid = ptrID;
	this.label     = "";
	this.color     = [255, 255, 255];
	this.left      = 0;
	this.top       = 0;
	this.visible   = true;
	this.wsio      = undefined;
	this.thumbnailWindowOpen = false;

	// Default
	this.radialMenuScale     = ui.widgetControlSize * 0.03;
	this.radialMenuSize      = { x: radialMenuDefaultSize.x * this.radialMenuScale, y: radialMenuDefaultSize.y * this.radialMenuScale };
	this.thumbnailWindowSize = { x: thumbnailWindowDefaultSize.x * this.radialMenuScale, y: thumbnailWindowDefaultSize.y * this.radialMenuScale };
	this.activeEventIDs      = [];

	this.dragState = false;
	this.dragID = -1;
	this.dragPosition = { x: 0, y: 0 };

	// States
	this.thumbnailWindowState = 0; // 0 = closed, 1 = image, 2 = pdf, 3 = video, etc.
	this.thumbnailWindowScrollPosition = 0;

	this.buttonState = []; // idle, lit, over for every radial menu button
	
	this.radialButtons = [];
	
	this.buttonAngle = 36; // Degrees of separation between each radial button position
	
	// id - unique button id
	// icon - button icon
	// radialPosition - 0 = top of menu, 1 = buttonAngle degrees clockwise, 2 = buttonAngle*2 degrees clockwise, etc.
	this.radialButtons.push( "images", {id: 0, icon: "images/ui/images.svg", radialPosition: 0, radialLevel: 1, group: "radialMenu", action: "contentWindow", window: "images"} );
	this.radialButtons.push( "pdfs", {id: 1, icon: "images/ui/pdfs.svg", radialPosition: 1, radialLevel: 1, group: "radialMenu", action: "contentWindow", window: "pdfs"} );
	this.radialButtons.push( "videos", {id: 2, icon: "images/ui/videos.svg", radialPosition: 2, radialLevel: 1, group: "radialMenu", action: "contentWindow", window: "videos"} );
	this.radialButtons.push( "apps", {id: 3, icon: "images/ui/applauncher.svg", radialPosition: 3, radialLevel: 1, group: "radialMenu", action: "contentWindow", window: "applauncher"} );
	this.radialButtons.push( "loadSession", {id: 4, icon: "images/ui/loadsession.svg", radialPosition: 4, radialLevel: 1, group: "radialMenu", action: "contentWindow", window: "sessions"} );
	this.radialButtons.push( "saveSession", {id: 5, icon: "images/ui/savesession.svg", radialPosition: 5, radialLevel: 1, group: "radialMenu", action: "saveSession"} );
	this.radialButtons.push( "settings", {id: 6, icon: "images/ui/arrangement.svg", radialPosition: 6.5, radialLevel: 1, group: "radialMenu", action: "toggleRadial", radial: "settingsMenu"} );
	this.radialButtons.push( "closeMenu", {id: 7, icon: "images/ui/close.svg", radialPosition: 7.5, radialLevel: 1, group: "radialMenu", action: "close", window: "radialMenu"} );
	this.radialButtons.push( "tileContent", {id: 8, icon: "images/ui/tilecontent.svg", radialPosition: 7.175, radialLevel: 2, group: "settingsMenu", action: "tileContent"} );
	this.radialButtons.push( "clearContent", {id: 9, icon: "images/ui/clearcontent.svg", radialPosition: 7.875, radialLevel: 2, group: "settingsMenu", action: "clearAllContent"} );
}

/**
*
*
* @method getInfo
*/
RadialMenu.prototype.getInfo = function() {
	return {id: this.pointerid, x: this.left, y: this.top, radialMenuSize: this.radialMenuSize, thumbnailWindowSize: this.thumbnailWindowSize, radialMenuScale: this.radialMenuScale, visble: this.visible, layout: this.radialButtons };
};

/**
*
*
* @method setScale
*/
RadialMenu.prototype.setScale = function(value) {
	this.radialMenuScale     = value / 100;
	this.radialMenuSize      = { x: radialMenuDefaultSize.x * this.radialMenuScale, y: radialMenuDefaultSize.y * this.radialMenuScale };
	this.thumbnailWindowSize = { x: thumbnailWindowDefaultSize.x * this.radialMenuScale, y: thumbnailWindowDefaultSize.y * this.radialMenuScale };
};

/**
*
*
* @method start
*/
RadialMenu.prototype.start = function() {
	this.visible = true;
};

/**
*
*
* @method stop
*/
RadialMenu.prototype.stop = function() {
	this.visible = false;
};

/**
*
*
* @method openThumbnailWindow
*/
RadialMenu.prototype.openThumbnailWindow = function(data) {
	this.thumbnailWindowOpen = data.thumbnailWindowOpen;
};

/**
*
*
* @method setPosition
*/
RadialMenu.prototype.setPosition = function(data) {
	this.left = data.x;
	this.top  = data.y;
	//console.log("node-radialMenu:setPosition() " + data.x + " " + data.y);
};

/**
*
*
* @method getThumbnailWindowPosition
*/
RadialMenu.prototype.getThumbnailWindowPosition = function(data) {
	return { x: this.left + this.radialMenuSize.x/2, y: this.top - this.radialMenuSize.y/2};
};

/**
*
*
* @method hasEventID
*/
RadialMenu.prototype.hasEventID = function(id) {
	if (this.activeEventIDs.indexOf(id) === -1)
		return false;
	else
		return true;
};

/**
*
*
* @method isEventOnMenu
*/
RadialMenu.prototype.isEventOnMenu = function(data) {
	if (this.visible === true) {
		// If over radial menu bounding box
		if ((data.x > this.left - this.radialMenuSize.x/2) && (data.x < this.left - this.radialMenuSize.x/2 + this.radialMenuSize.x) &&
			(data.y > this.top  - this.radialMenuSize.y/2) && (data.y < this.top - this.radialMenuSize.y/2  + this.radialMenuSize.y) ) {
			return true;
		}
		// Else if over thumbnail window bounding box
		else if ((data.x > this.left + this.radialMenuSize.x/2) && (data.x < this.left + this.radialMenuSize.x/2 + this.thumbnailWindowSize.x) &&
				(data.y > this.top - this.radialMenuSize.y/2)  && (data.y < this.top - this.radialMenuSize.y/2  + this.thumbnailWindowSize.y) ) {
			if (this.thumbnailWindowOpen === true) {
				return true;
			}
		}
	}
	return false;
};

/**
*
*
* @method onEvent
*/
RadialMenu.prototype.onEvent = function(data) {
	var idIndex = this.activeEventIDs.indexOf(data.id);
	if (idIndex !== -1 && data.type === "pointerRelease")
		this.activeEventIDs.splice(idIndex);

	if (this.visible === true) {
		// Press over radial menu, drag menu
		//console.log((this.left - this.radialMenuSize.x/2), " < ", position.x, " < ", (this.left - this.radialMenuSize.x/2 + this.radialMenuSize.x) );
		//console.log((this.top - this.radialMenuSize.y/2), " < ", position.y, " < ", (this.top - this.radialMenuSize.y/2 + this.radialMenuSize.y) );

		// If over radial menu bounding box
		if ((data.x > this.left - this.radialMenuSize.x/2) && (data.x < this.left - this.radialMenuSize.x/2 + this.radialMenuSize.x) &&
			(data.y > this.top  - this.radialMenuSize.y/2) && (data.y < this.top - this.radialMenuSize.y/2  + this.radialMenuSize.y) ) {
			//this.windowInteractionMode = false;

			if (this.visible === true && data.type === "pointerPress")
				this.activeEventIDs.push(data.id);

			return true;
		}
		// Else if over thumbnail window bounding box
		else if (this.thumbnailWindowOpen === true && (data.x > this.left + this.radialMenuSize.x/2) && (data.x < this.left + this.radialMenuSize.x/2 + this.thumbnailWindowSize.x) &&
				(data.y > this.top - this.radialMenuSize.y/2)  && (data.y < this.top - this.radialMenuSize.y/2  + this.thumbnailWindowSize.y) ) {
			//this.windowInteractionMode = false;

			if (this.visible === true && data.type === "pointerPress")
				this.activeEventIDs.push(data.id);
			return true;
		}
		else if (this.activeEventIDs.indexOf(data.id) !== -1) {
			return true;
		}
	}
	return false;
};

/**
*
*
* @method onPress
*/
RadialMenu.prototype.onPress = function(id) {
	this.activeEventIDs.push(id);
};

/**
*
*
* @method onMove
*/
RadialMenu.prototype.onMove = function(id) {
	//console.log( this.hasEventID(id) );
};

/**
*
*
* @method onRelease
*/
RadialMenu.prototype.onRelease = function(id) {
	//console.log("node-RadialMenu.onRelease()");
	this.activeEventIDs.splice(this.activeEventIDs.indexOf(id), 1);
	//console.log("drag state "+ this.dragID + " " + id);
	if (this.dragState === true && this.dragID === id) {
		this.dragState = false;
	}
};

/**
* Initializes the radial menu's drag state
*
* @method onStartDrag
* @param id {Integer} input ID initiating the drag
* @param localPos {x: Float, y: Float} initial drag position
*/
RadialMenu.prototype.onStartDrag = function(id, localPos) {
	if (this.dragState === false) {
		this.dragID       = id;
		this.dragState    = true;
		this.dragPosition = localPos;
	}
};

/**
* Checks if an input ID is dragging the menu
*
* @method isDragging
* @param id {Integer} input ID
* @param localPos {x: Float, y: Float} input position
* @return dragPos {x: Float, y: Float}
*/
RadialMenu.prototype.getDragOffset = function(id, localPos) {
	var offset = {x: 0, y: 0 };
	if (this.dragState === true && this.dragID === id) {
		// If this ID is dragging the menu, return the drag offset
		offset = { x: localPos.x - this.dragPosition.x, y: localPos.y - this.dragPosition.y };
		this.dragPosition = localPos;
	}
	return offset;
};


module.exports = RadialMenu;
