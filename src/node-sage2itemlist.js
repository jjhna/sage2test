// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2015

/**
 * object to check for intersections on interactable geometry
 *
 * @module server
 * @submodule SAGE2ItemList
 */

// require variables to be declared
"use strict";

/**
 * SAGE2ItemList object
 *
 * @class SAGE2ItemList
 * @constructor
 */
function SAGE2ItemList() {
	this.list = {};
}

/**
* Add new item to list
*
* @method addItem
* @param item {Object} item to be added into list (must have property id)
*/
SAGE2ItemList.prototype.addItem = function(item) {
	this.list[item.id] = item;
};

/**
* Remove item from list
*
* @method removeItem
* @param id {String} id of item to be removed from list
*/
SAGE2ItemList.prototype.removeItem = function(item) {
	delete this.list[id];
};

/**
* Edit item in list
*
* @method editItem
* @param id {String} id of item to be edited
* @param newProperties {Object} properties to add / change in item
*/
SAGE2ItemList.prototype.editItem = function(id, newProperties) {
	var key;
	for(key in newProperties) {
		this.list[id][key] = newProperties[key];
	}
};

/**
* Sort the list by a given property
*
* @method sortList
* @param property {String} property to sort items by
* @return order {Array} list of keys sorted by propery
*/
SAGE2ItemList.prototype.sortList = function(property) {
	var tmpList = this.list;
	var order = Object.keys(tmpList).sort(function(a, b) {
		return tmpList[a][property] - tmpList[b][property];
	});
	return order;
};

/**
* Get an item from the list with a given id
*
* @method getItemById
* @param id {String} id of item to retrieve
* @return item {Object} item with given id
*/
SAGE2ItemList.prototype.sortList = function(id) {
	return this.list[id];
};

// TODO: Given local coordinate inside the item bounding box, determine if inside an interactable area

module.exports = SAGE2ItemList;
