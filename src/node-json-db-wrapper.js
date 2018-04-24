// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2017

/**
 * @module server
 * @submodule jsonDbWrapper
 */

const JsonDb      = require('node-json-db');
const sageutils   = require('../src/node-utils');

let numInstances = 1;

/* Wrapper for node-json-db that catches all the not-found exceptions
 * and handles them by setting a {Boolean} success flag
 */
class JsonDbWrapper {

	/**
	* JsonDbWrapper
	*
	* @constructor
	* @param dbName {String} name of database for logging purposes
	* @param filepath {String} path to json db
	* @param saveAfterPush {Boolean} write to database on each push
	* @param saveHumanReadable {Boolean} pretty print json
	* @param logging {Boolean} print debugging messages
	*/
	constructor(
		dbName,
		filePath,
		saveAfterPush = true,
		saveHumanReadable = true,
		logging = false) {
		this.db = new JsonDb(
			filePath,
			saveAfterPush,
			saveHumanReadable
		);
		this.success = true;
		this.logging = logging;
		this.dbName = dbName || "JsonDb " + numInstances;
		++numInstances;
	}

	/**
	* Reload database if json file was changed externally
	*
	* @method reload
	*/
	reload() {
		this.db.reload();
	}

	/**
	 * Wrapper for JsonDB.getData()
	 * Retrieve data from json database or set a flag if it fails
	 *
	 * @method getData
	 * @param field {String}
	 * @return {Object} retrieved data
	 */
	getData(field) {
		try {
			let data = this.db.getData(field);
			this.success = true;
			return data;
		} catch (error) {
			if (this.logging) {
				sageutils.log(this.dbName, "Error", error.message);
			}
			this.success = false;
			return null;
		}
	}

	/**
	 * Wrapper for JsonDB.push()
	 * Push data to json database or set a flag if it fails
	 *
	 * @method push
	 * @param field {String}
	 * @param data {Object} new data to be pushed
	 * @param overwrite {Boolean} overwrite existing data at that location;
	 * default is true
	 * @return {Boolean} true if the push succeeded
	 */
	push(field, data, overwrite = true) {
		try {
			this.db.push(field, data, overwrite);
			this.success = true;
		} catch (error) {
			this.success = false;
		}
		return this.success;
	}

	/**
	 * @method hasField
	 * @param field {String}
	 * @return {Boolean} if the database has this field
	 */
	hasField(field) {
		this.db.getData(field);
		return this.success;
	}

	/**
	 * Wrapper for JsonDB.delete()
	 * Remove data at a path or log an error if it fails
	 *
	 * @method delete
	 * @param dbPath {String}
	 * @return {Boolean} true if delete succeeds
	 */
	delete(dbPath) {
		try {
			this.db.delete(dbPath);
			this.success = true;
		} catch (error) {
			if (this.logging) {
				sageutils.log(this.dbName, "Error", error.message);
			}
			this.success = false;
		}
		return this.success;
	}
}

module.exports = JsonDbWrapper;
