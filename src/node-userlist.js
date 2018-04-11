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
 * @submodule userlist
 */

// require variables to be declared
"use strict";

const path        = require('path');
const fs          = require('fs');
const JsonDB      = require('node-json-db');
const sageutils   = require('../src/node-utils');

// folder to store the user DB
const pathname = 'logs';
// Name of the file storing the user DB
const filename = 'users.json';
// const rbacFilename = 'rbac.json';

let nAnonClients = 0;
const strNames = "Aardvark Albatross Alligator Alpaca Ant Anteater Antelope Armadillo " +
	"Badger Barracuda Bat Beaver Bee Bison Boar Buffalo Butterfly Camel Caribou Cassowary Cat "    +
	"Caterpillar Cheetah Chicken Chinchilla Cobra Cormorant Coyote Crab Crane Crocodile "         +
	"Crow Deer Dinosaur Dog Dolphin Dove Dragonfly Duck Eagle Echidna Eel Elephant "       +
	"Emu Falcon Ferret Finch Flamingo Fox Frog Gazelle Giraffe Goat Goldfish Goose Gorilla "        +
	"Grasshopper Grizzly Hamster Hawk Hedgehog Heron Hippo Horse Hummingbird Hyena Ibex Jackal "   +
	"Jaguar Jellyfish Kangaroo Koala Lark Lemur Leopard Lion Llama Lobster Manatee "      +
	"Mink Mole Mongoose Monkey Mouse Narwhal Newt Nightingale Octopus Okapi Opossum Ostrich "      +
	"Otter Owl Oyster Panther Parrot Panda Partridge Pelican Penguin Pheasant Pigeon Porcupine "   +
	"Porpoise Quail Rabbit Raccoon Raven Rhinoceros Salamander Seahorse Seal Shark Sheep "   +
	"Sloth Snail Squid Squirrel Starling Swan Tapir Tiger T-rex Turtle Walrus Weasel Whale "       +
	"Wolf Wombat Yak Zebra";
const tempNames = strNames.split(' ');

/**
 * Creates an uid.
 *
 * @method     createUid
 * @param      {String}  name    The name
 * @param      {<type>}  email   The email
 * @return     {String}  the uid string
 */
function createUid(name, email) {
	return name.replace(/[;,=]/g, '-') + '-' + Date.now();
}

/**
 * shuffle randomly and array
 *
 * @method     shuffle
 * @param      {<type>}  array   The array
 */
function shuffle(array) {
	let l = array.length, t, i;

	while (l) {
		i = Math.floor(Math.random() * l--);

		// swap random element to end of unshuffled segment
		t = array[l];
		array[l] = array[i];
		array[i] = t;
	}
}

/**
 * Handles users and storage to database
 * as well as user roles and permissions
 *
 * @class UserList
 */
class UserList {
	constructor() {
		this.currentSession = null;

		// make sure that the path and file exist
		if (!sageutils.folderExists(pathname)) {
			fs.mkdirSync(pathname);
		}
		if (!sageutils.fileExists(this.filePath)) {
			fs.writeFileSync(this.filePath, "{}");
		}
		// if (!sageutils.fileExists(this.rbacPath)) {
		// 	fs.writeFileSync(this.rbacPath, "{}");
		// }

		// create the databases
		this.db = new JsonDB(
			this.filePath,
			true, 	// save after each push
			true	// save in human-readable format
		);
		// this.rbacDb = new JsonDB(this.rbacPath, true, true);

		// per session
		shuffle(tempNames);
		this.connectedUsers = {};
		this.connectedClients = {};
		this.clients = {};
		this.rbac = null;
		this.rbacList = [];

		// get roles/permissions
		let getRbac = this.getData('/rbac');
		if (getRbac.success) {
			this.rbacList = getRbac.data || [];
			this.rbac = this.rbacList[0];
		}
		if (!this.rbac) {
			this.initRolesAndPermissions({
				roles: ['admin', 'user', 'guest'],
				actions: [
					'upload files',
					'use apps',
					'share screen',
					'share pointer',
					'move/resize windows',
					'access admin pages'
				],
				permissions: {
					admin: 0b111111,
					user:  0b111110,
					guest: 0b111110
				}
			});
		}
	}

	/**
	* Track user locally by ip
	*
	* @method track
	* @param ip {String} ip address
	* @param user {Object} user
	* @return {String} name of the user
	*/
	track(ip, user) {
		this.clients[ip] = {
			user: user,
			role: []
		};

		// assign guest role to non-logged in users
		if (!user.name && !user.email) {
			this.assignRole(ip, 'guest');
			if (!user.SAGE2_ptrName) {
				user.SAGE2_ptrName = 'Anon ' + tempNames[nAnonClients];
				nAnonClients = (nAnonClients + 1) % tempNames.length; // FIXME
			}
		} else {
			// assign user role to logged in users by default
			this.assignRole(ip, 'user');

			// find if user already has an active client
			for (let i in this.clients) {
				if (i !== ip && this.clients[i].user.name === user.name && this.clients[i].user.email === user.email) {
					this.clients[ip].role = this.clients[i].role;
				}
				break;
			}
		}

		return user.SAGE2_ptrName;
	}

	/**
	* Stop tracking this ip
	*
	* @method disconnect
	* @param ip {String} ip address
	*/
	disconnect(ip) {
		delete this.clients[ip];
		delete this.connectedClients[ip];
	}

	// ***********  Role Management Functions *************

	/**
	* Initialize role access system
	*
	* @method initRolesAndPermissions
	* @param rbac {Object} object containing the three parameters:
	*  - roles:       an array of strings of role names
	*  - actions:     an array of strings of action names
	*  - permissions: an object of role-bitfield pairs
	*/
	initRolesAndPermissions(rbac) {
		rbac.mask = {};

		let l = rbac.actions.length - 1;
		rbac.actions.forEach((action, i) => {
			rbac.mask[action] = (1 << (l - i));
		});
		rbac.maskAll = (1 << rbac.actions.length) - 1;

		this.rbacList.push(rbac);
		this.rbac = rbac;
	}

	/**
	* Set permissions for this role
	*
	* @method defineRolePermissions
	* @param role {String}
	* @param permissions {Object} list of permission names and values
	* as String-Boolean pairs
	*/
	defineRolePermissions(role, permissions) {
		if (this.rbac.roles.indexOf(role) < 0) {
			this.rbac.roles.push(role);
		}

		// generate permission bit string
		let pBits = 0;
		for (let action in permissions) {
			if (permissions[action] && this.rbac.mask[action]) {
				pBits |= this.rbac.mask[action];
			}
		}

		this.rbac.permissions[role] = pBits;
	}

	/**
	* Add permission for this action to the role
	*
	* @method grantPermission
	* @param role {String}
	* @param action {String}
	*/
	grantPermission(role, action) {
		if (this.rbac.roles.indexOf(role) > -1) {
			this.rbac.permissions[role] |= this.rbac.mask[action];
		}
	}

	/**
	* Remove permission for this action from the role
	*
	* @method revokePermission
	* @param role {String}
	* @param action {String}
	*/
	revokePermission(role, action) {
		if (this.rbac.roles.indexOf(role) > -1) {
			this.rbac.permissions[role] &= (this.rbac.maskAll ^ this.rbac.mask[action]);
		}
	}


	/**
	* Set the user to have only this role
	*
	* @method assignRole
	* @param ip {String}
	* @param role {String}
	*/
	assignRole(ip, role) {
		if (this.clients[ip]) {
			this.clients[ip].role = [role];
		}
	}

	assignRoleToUser(id, role) {
		if (this.connectedUsers[id]) {
			this.connectedUsers[id].role = role;
		}
	}
	/**
	* Add this role to the list of user's roles
	*
	* @method addRole
	* @param ip {String}
	* @param role {String}
	*/
	addRole(ip, role) {
		if (this.clients[ip] && this.clients[ip].role.indexOf(role) < 0) {
			this.clients[ip].role.push(role);
		}
	}

	/**
	* Remove this role from the list of user's roles
	*
	* @method removeRole
	* @param ip {String}
	* @param role {String}
	*/
	removeRole(ip, role) {
		if (this.clients[ip]) {
			let i = this.clients[ip].role.indexOf(role);
			if (i > -1) {
				this.clients[ip].role.splice(i, 1);
			}
		}
	}

	/**
	* Add the ID of a model to this user
	*
	* @method addModel
	* @param userId {String}
	* @param modelId {String}
	* @param roles (optional) initialize with an {Array} of {String}s
	*/
	addModel(userId, modelId, roles) {

	}

	/**
	* Get rid of any stray user roles, assign default user role
	*
	* @method cleanUserModel
	* @param userId {String}
	* @param modelId {String}
	*/
	cleanUserModel(userId, modelId) {

	}

	/**
	* Check if user has permission to do an action
	*
	* @method isAllowed
	* @param ip {String} client ip requesting permission
	* @param action {String} name of the action
	* @return {Boolean} true if user is permitted to perform this action
	*/
	isAllowed(ip, action) {
		// Skip authorization for now
		return true;

		// server's special case
		// if (ip === "127.0.0.1:42") {
		// 	return true;
		// }
		// if (!this.clients[ip]) {
		// 	return false;
		// }
		// let roles = this.clients[ip].role;
		// for (let i in roles) {
		// 	if (this.rbac.mask[action] & this.rbac.permissions[roles[i]]) {
		// 		return true;
		// 	}
		// }
		// return false;
	}

	/**
	* save permissions models to database
	*
	* @method save
	*/
	save() {
		this.push('/rbac', this.rbacList);
	}

	// **************  Database Functions *****************

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
	 * Retrieve data from json database or log an error if it fails
	 *
	 * @method getData
	 * @param dbPath {String}
	 * @return {Object} object with the success flag and the retrieved data
	 */
	getData(dbPath) {
		try {
			let data = this.db.getData(dbPath);
			return {
				success: true,
				data: data
			};
		} catch (error) {
			// sageutils.log("Userlist", "Error", error.message);
			return {
				success: false
			};
		}
	}

	/**
	 * Wrapper for JsonDB.push()
	 * Push data to json database or log an error if it fails
	 *
	 * @method push
	 * @param dbPath {String}
	 * @param data {Object} new data to be pushed
	 * @param checkIfPathExists {Boolean} check if path exists before pushing * the data; default is false
	 * @return {Boolean} true if push succeeds
	 */
	push(dbPath, data, overwrite = true, checkIfPathExists = false) {
		try {
			if (checkIfPathExists) {
				this.db.getData(dbPath);
			}
			this.db.push(dbPath, data, overwrite);
			return true;
		} catch (error) {
			// sageutils.log("Userlist", "Error", error.message);
			return false;
		}
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
			return true;
		} catch (error) {
			sageutils.log("Userlist", "Error", error.message);
		}
		return false;
	}

	/**
	 * Store a new user in the database
	 *
	 * @method addNewUser
	 * @param name {String}
	 * @param email {String}
	 * @param properties {Object}
	 * @return {Object} object with the user token, user object, and an error
	 * message if the user could not be added
	 */
	addNewUser(name, email, properties = {}) {
		name = name && name.trim();
		email = email && email.trim();
		if (name && email) {
			let req = this.getUser(name, email);
			if (req.error === null) {
				return {
					error: 'User already exists. Sign in instead.',
					user: req.user,
					uid: req.uid
				};
			} else {
				// create a new uid
				let uid = createUid(name, email);

				// add new user to database
				let newUser = Object.assign({name, email}, properties);
				this.push(this.userPath(uid), newUser);
				return {
					error: null,
					uid: uid,
					user: newUser
				};
			}
		}
		return {
			error: 'User must have a name and an email.'
		};
	}

	/**
	 * Retrieve a user in the database by name and email
	 *
	 * @method getUser
	 * @param name {String}
	 * @param email {String}
	 * @return {Object} object with the user token, user object, and an error
	 * message if the user could not be added
	 */
	getUser(name, email) {
		let req = this.getData('/user');
		if (req.success) {
			for (let uid in req.data) {
				if (req.data[uid].name === name && req.data[uid].email === email) {
					return {
						uid: uid,
						user: req.data[uid],
						error: null
					};
				}
			}
		}
		return {
			user: null,
			uid: null,
			error: "Could not find user."
		};
	}

	/**
	 * Retrieve a user in the database by user id
	 *
	 * @method getUserById
	 * @param uid {String}
	 * @param subpath {String}
	 * @return {Object} object with the user token, user object, and an error
	 * message if the user could not be added
	 */
	getUserById(uid, subpath) {
		let req = this.getData(this.userPath(uid, subpath));
		if (req.success) {
			return {
				uid: uid,
				user: req.data,
				error: null
			};
		}

		return {
			user: null,
			uid: null,
			error: "Could not find user."
		};
	}

	/**
	 * Remove user from the database
	 *
	 * @method removeUser
	 * @param uid {String}
	 * @return {Boolean} true if delete succeeds
	 */
	removeUser(uid) {
		return this.delete(this.userPath(uid));
	}

	/**
	 * Edit user properties
	 *
	 * @method editUser
	 * @param uid {String}
	 * @param properties {Object}
	 * @return {Boolean} true if edit succeeds
	 */
	editUser(uid, properties) {
		// name and email keys cannot be empty
		if (!properties.name || !properties.name.trim()) {
			delete properties.name;
		}
		if (!properties.email || !properties.email.trim()) {
			delete properties.email;
		}
		return this.push(this.userPath(uid), properties, false, true);
	}

	/**
	 * Get properties of a user
	 *
	 * @method getProperty
	 * @param uid {String}
	 * @param arguments {String} property key(s)
	 * @return the property or an array of properties
	 */
	getProperty(uid) {
		var keys = [].slice.call(arguments, 1);
		let req = this.getData(this.userPath(uid));
		if (req.success) {
			if (keys.length === 0) {
				return null;
			} else if (keys.length === 1) {
				return req.data[keys[0]];
			} else {
				return keys.map(key => req.data[key]);
			}
		}
		return null;
	}

	//*********** Passport wrapper functions ***********
	/**
	 * User authorization
	 * Called by node-httpserver via Passport strategies
	 *
	 * @method findOrCreate
	 * @param login {Object} authorization information
	 * @param callback {Function} callback to Passport
	 */
	findOrCreate(login, callback) {
		// search for existing user in database
		let query = {};
		if (login.strategy === 'local') {
			query = this.getUser(login.username, login.password);
			if (query.user) {
				query.user.id = this.userPath(query.uid);
			}
		} else {
			query = this.getUserById(login.id, login.strategy);
		}
		// user found
		if (query.user) {
			callback(null, query.user);
		} else {
			// user not found
			if (login.strategy === 'local') {
				callback(query.error);
			} else {
				// create user for non-local auth strategies
				let user = {
					id: this.userPath(login.id, login.strategy)
				};
				if (login.name) {
					user.name = user.SAGE2_ptrName = login.name;
				}
				this.push(user.id, user);
				callback(null, user);
			}
		}
	}

	/**
	 * for deserialization
	 *
	 * @method findById
	 * @param login {Object} authorization information
	 * @param callback {Function} callback to Passport
	 */
	findById(id, callback) {
		let req = this.getData(id);
		if (req.success) {
			this.connectUser(req.data);
			callback(null, req.data);
		} else {
			callback("Could not find user");
		}
	}

	registerClient(client) {
		let newClient = {};
		if (!client.id) {
			// guest user
			newClient.user = {
				SAGE2_ptrName: client.label,
				SAGE2_ptrColor: client.color
			};
			newClient.role = "guest";
		} else {
			// logged in user
			newClient.user = client.id;
		}
		this.connectedClients[client.uniqueId] = newClient;
	}

	closeClient(client) {
		if (client.uniqueId) {
			// todo: check to remove users?
			delete this.connectedClients[client.uniqueId];
		}
	}

	updateUser(clientId, properties) {
		if (!this.connectedClients[clientId]) {
			return false;
		}
		if (typeof this.connectedClients[clientId] === 'string' &&
			this.connectedUsers[this.connectedClients[clientId]]) {
			// a real user
			let user = this.connectedUsers[this.connectedClients[clientId]];

			Object.assign(user, properties);
			return this.editUser(user.id, properties);
		} else {
			// guest user
			let guest = this.connectedClients[clientId];
			if (guest) {
				Object.assign(guest, properties);
			}
			return true;
			console.log(this.connectedUsers, this.connectedClients)
		}
	}

	connectUser(data) {
		if (!this.connectedUsers[data.id]) {
			this.connectedUsers[data.id] = {
				user: data,
				role: (Object.keys(this.connectedUsers).length === 0) ? 'admin' : 'user'
			};
		}
	}

	requestGuestName() {
		let name = 'Anon ' + tempNames[nAnonClients];
		nAnonClients = (nAnonClients + 1) % tempNames.length; // FIXME
		return name;
	}

	can(user, action) {
	}

	//*********** Getters functions ***********

	userPath(uid, subpath = 'user') {
		return `/${subpath}/${uid}`;
	}

	get filePath() {
		return path.join(pathname, filename);
	}

	// get rbacPath() {
	// 	return path.join(pathname, rbacFilename);
	// }
}

module.exports = new UserList();
