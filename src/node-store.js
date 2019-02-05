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
 * SAGE2 Session and User Database
 *
 * @module server
 * @submodule store
 * @requires express-session, json5, fs
 */

// require variables to be declared
"use strict";

const {Store} = require('express-session');
var json5 = require('json5');
var fs = require('fs');


class SessionJSONStore extends Store {
	constructor() {
		super();
	}
	initialize(path) {
		this.filePath = path;
		if (fs.existsSync(path)) {
			var jsonString = fs.readFileSync(this.filePath, 'utf8');
			this.db = json5.parse(jsonString);
		} else {
			this.db = {};
		}
	}
	save(cb) {
		try {
			fs.writeFileSync(this.filePath, json5.stringify(this.db));
			cb(null);	
		} catch(error) {
			cb("Could not save database " + error);
		}
		
	}
	all(cb) {
		cb("", Object.values(this.db));
	}
	destroy(sid, cb) {
		if (this.db.hasOwnProperty(sid) === true) {
			delete this.db[sid];
			this.save(cb);
		} else {
			cb("session entry does not exist:" + sid);
		}
	}
	clear(cb) {
		this.db = {};
		this.save(cb);
	}
	length(cb) {
		try {
			var count = Object.keys(this.db).length;
			cb("", count);	
		} catch (error) {
			cb(error);
		}
	}
	get(sid, cb) {
		if (this.db.hasOwnProperty(sid) === true) {
			cb("", this.db[sid]);
		} else {
			cb("session entry does not exist:" + sid, null);
		}
	}
	set(sid, session, cb) {
		this.db[sid] = cloneObject(session);
		this.db[sid].id = sid;
		this.save(cb);
	}
	touch(sid, session, cb) {
		// Implement Touch logic
		this.save(cb);
	}
}

class UserJSONStore {
	initialize(path) {
		this.filePath = path;
		if (fs.existsSync(path)) {
			var jsonString = fs.readFileSync(this.filePath, 'utf8');
			this.db = json5.parse(jsonString);
		} else {
			this.db = {};
		}
		
	}
	save(cb) {
		try {
			fs.writeFileSync(this.filePath, json5.stringify(this.db));
			cb(null);	
		} catch(error) {
			cb("Could not save user database " + error);
		}
		
	}
	all(cb) {
		cb("", Object.values(this.db));
	}
	destroy(id, cb) {
		if (this.db.hasOwnProperty(id) === true) {
			delete this.db[id];
			this.save(cb);
		} else {
			cb("User entry does not exist:" + id);
		}
	}
	clear(cb) {
		this.db = {};
		this.save(cb);
	}
	length(cb) {
		try {
			var count = Object.keys(this.db).length;
			cb("", count);	
		} catch (error) {
			cb(error);
		}
	}
	get(id, cb) {
		if (this.db.hasOwnProperty(id) === true) {
			cb(null, this.db[id]);
		} else {
			cb("User entry does not exist:" + id, false);
		}
	}
	set(id, user, cb) {
		this.db[id] = cloneObject(user);
		this.db[id].id = id;
		this.save(cb);
	}
}

function cloneObject(obj) {
    var clone = {};
    for(var i in obj) {
        if(obj[i] != null &&  typeof(obj[i])=="object")
            clone[i] = cloneObject(obj[i]);
        else
            clone[i] = obj[i];
    }
    return clone;
}

module.exports.SessionJSONStore = SessionJSONStore;
module.exports.UserJSONStore = UserJSONStore;