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
 * Mime type association for files and applications
 *
 * @module server
 * @submodule registry
 * @requires json5, node-json-db, mime
 */

// require variables to be declared
"use strict";

var fs          = require('fs');
var path        = require('path');

var json5       = require('json5');
var JsonDB      = require('node-json-db').JsonDB;

var mime        = require('mime');

var sageutils   = require('../src/node-utils');  // for fileExists function


function RegistryManager() {
	this.registryFile   = "fileRegistry.json";
	this.nativeAppsFile = path.join("config", "nativeApps.json");
	this.mimeFile       = path.join("config", "custom.types");

	// Set the default mime type for SAGE to be a custom app
	// mime.default_type   = "application/custom";
	// Trying to avoid weird content
	mime.default_type   = "";
}

RegistryManager.prototype.initialize = function(assetsFolder) {
	this.assetsFolder = assetsFolder;

	var fullpath = path.join(assetsFolder, this.registryFile);

	sageutils.log("Registry", "Initializing registry", fullpath);

	if (!sageutils.fileExists(fullpath)) {
		fs.writeFileSync(fullpath, "{}");
	}

	// Create the database
	// The second argument is used to tell the DB to save after each push
	// The third argument is to ask JsonDB to save the database in an human readable format
	this.db = new JsonDB(fullpath, true, true);

	// Check if custom.type exists
	if (!sageutils.fileExists(this.mimeFile)) {
		fs.writeFileSync(this.mimeFile, "");
	}

	// Load the SAGE2 applications file association
	// mime.load(path.join(this.mimeFile));

	// Add the jupyter notebook mime definition
	mime.define({'application/x-ipynb+json': ['ipynb']}, true);

	// mime version 2 removed the load function
	var content = fs.readFileSync(path.join(this.mimeFile), 'ascii');
	// split the file content in lines
	var lines   = content.split(/[\r\n]+/);
	lines.forEach(function(line) {
		// Clean up whitespace/comments, and split into fields
		var fields = line.replace(/\s*#.*|^\s*|\s*$/g, '').split(/\s+/);
		// if we get a valid line with two fields
		if (fields.length === 2) {
			let obj = {};
			// create an association object such as {'application/360': ['360']}
			obj[fields[0]] = [fields[1]];
			// add the new association, true means can overwrite
			mime.define(obj, true);
		}
	});

	this.scanNativeApps();
};

RegistryManager.prototype.mimeRegister = function(fileType) {
	var type = mime.getType(fileType);

	if (type === undefined || type === null || type === "" || type === 'application/custom') {
		var map = {};
		map['application/' + fileType] = [fileType];
		mime.define(map);
		fs.appendFileSync(this.mimeFile, 'application/' + fileType + ' ' + fileType + '\n');
		type = mime.getType(fileType);
	}
	return type;
};

RegistryManager.prototype.scanNativeApps = function() {
	var jsonString = fs.readFileSync(this.nativeAppsFile, 'utf8');
	var nativeApps = json5.parse(jsonString);

	if (nativeApps.applications !== undefined &&
		nativeApps.applications !== null &&
		Array.isArray(nativeApps.applications)) {

		for (var i = 0; i < nativeApps.applications.length; i++) {
			var app = nativeApps.applications[i];
			if (app.name  !== undefined && app.name  !== null && app.name !== "" &&
				app.types !== undefined && app.types !== null && Array.isArray(app.types)) {
				this.register(app.name, app.types, app.directory, true);
			}
		}
	}
};

RegistryManager.prototype.register = function(name, types, directory, mimeType) {
	var type;
	for (var i = 0; i < types.length; i++) {
		if (mimeType) {
			type = '/' + types[i];
		} else {
			type = '/' + this.mimeRegister(types[i]);
		}

		var newApp = {};
		newApp.applications = [name];

		// Check if the entry exists
		try {
			var apps = this.db.getData(type + '/applications');
			if (apps.indexOf(name) < 0) {
				this.push(type, newApp, false);
			}
		} catch (error) {
			// Entry does not exist. Add it.
			this.push(type, newApp, false);
		}
		this.push(type + '/directory', directory, true);


		/*try {
			this.db.getData(type + '/default');
		} catch (error) {
			this.push(type + '/default', name, true);
		}*/
	}
};

RegistryManager.prototype.push = function(key, value, overwrite) {
	try {
		this.db.push(key, value, overwrite);
	} catch (error) {
		sageutils.log("Registry", error);
	}
};

RegistryManager.prototype.getMimeType = function(file) {
	return mime.getType(file);
};

RegistryManager.prototype.getDefaultApp = function(file, warn) {
	var defaultApp = "";
	var type = '/' + mime.getType(file);
	// Check if the entry exists
	try {
		defaultApp = this.db.getData(type + '/applications[0]');
	} catch (error) {
		// Entry does not exist.
		if (warn === true) {
			sageutils.log("Registry", "No default app for", file);
		}
	}
	return defaultApp;
};

RegistryManager.prototype.getDefaultAppFromMime = function(type, warn) {
	var defaultApp = "";
	try {
		defaultApp = this.db.getData('/' + type + '/applications[0]');
	} catch (error) {
		if (type === "text/plain") {
			return "uploads/apps/quickNote";
		}
		// currently lack a better way to associate
		if (warn === true) {
			sageutils.log("Registry", "No default app for", type);
		}
	}
	return defaultApp;
};

RegistryManager.prototype.getApps = function(file, warn) {
	var apps = [];
	var type = '/' + mime.getType(file);
	// Check if the entry exists
	try {
		apps = this.db.getData(type + '/applications');
		if (apps.length < 1) {
			sageutils.log("Registry", "No apps for", file);
		}
	} catch (error) {
		// Entry does not exist.
		if (warn === true) {
			sageutils.log("Registry", "No app for", file);
		}
	}
	return apps;
};

RegistryManager.prototype.getAppsFromMime = function(type, warn) {
	var apps = [];
	try {
		apps = this.db.getData('/' + type + '/applications');
		if (apps.length < 1) {
			sageutils.log("Registry", "No apps for", type);
		}
	} catch (error) {
		if (type === "text/plain") {
			return ["uploads/apps/quickNote"];
		}
		if (warn === true) {
			sageutils.log("Registry", "No app for", type);
		}
	}
	return apps;
};

RegistryManager.prototype.getTypeToAppAssociations = function() {
	return this.db.getData('/');
};

RegistryManager.prototype.getDirectory = function(file, warn) {
	var dir = "";
	var type = '/' + mime.getType(file);
	try {
		dir = this.db.getData(type + '/directory');
	} catch (error) {
		if (warn === true) {
			sageutils.log("Registry", "No directory for", file);
		}
	}
	return dir;
};

RegistryManager.prototype.setDefaultApp = function(file, app, warn) {
	var apps = [];
	var type = '/' + mime.getType(file);
	// Check if the entry exists
	try {
		apps = this.db.getData(type + '/applications');
		var appIdx = apps.findIndex(x => x === app);
		if (appIdx < -1) {
			sageutils.log("Registry", "Unknown app", app);
		} else if (appIdx === 0 && warn === true) {
			sageutils.log("Registry", app, "set as default app for", type);
		} else {
			apps.splice(appIdx, 1);
			apps.splice(0, 0, app);
			this.push(type + '/applications', apps, true);
			if (warn === true) {
				sageutils.log("Registry", app, "set as default app for", type);
			}
		}
	} catch (error) {
		// Entry does not exist.
		sageutils.log("Registry", "Unknown file type", type);
	}
};

/**
 * Returns true if the image can be displayed in a browser
 *
 * @method isImageWebNative
 * @param  {String} filetype - a given mime type
 * @return {Boolean}  true if it is a web format
 */
RegistryManager.prototype.isImageWebNative = function(filetype) {
	let browserCompatible = filetype === "image/jpeg" ||
		filetype === "image/png"  ||
		filetype === "image/webp" ||
		filetype === "image/gif";
	return browserCompatible;
};

module.exports = new RegistryManager();
