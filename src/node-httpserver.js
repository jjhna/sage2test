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
 * SAGE2 HTTP handlers
 *
 * @module server
 * @submodule httpserver
 * @requires node-utils
 */

// require variables to be declared
"use strict";

// builtins
var fs   = require('fs');
var path = require('path');
var url  = require('url');
var mime = require('mime');
var zlib = require('zlib');  // to enable HTTP compression

// Using the debug package to track HTTP request
//   to see request: env DEBUG=sage2http node server.js ....
var debug = require('debug')('sage2http');

// npm: defined in package.json
var sanitizer = require('sanitizer');         // input sanitizer
var normalizeURL = require('normalizeurl');   // clean up URL requests

// SAGE2 own modules
var sageutils = require('../src/node-utils');    // provides utility functions
var generateSW = require('../generate-service-worker.js');

// express modules
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// set express headers
var helmet = require('helmet');

// passport modules
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var GitHubStrategy = require('passport-github').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;

var app = null;
var publicDirectory;
var UserList;

/**
 * SAGE HTTP request handlers for GET and POST
 *
 * @class HttpServer
 * @constructor
 * @param publicDirectory {String} folder to expose to the server
 * @param userList {Object} user object
 */
class HttpServer {
	constructor(publicDir, userList) {
		UserList = userList;
		publicDirectory = publicDir;

		this.app = app = express();

		// set default headers
		app.use(helmet(secureHeaders()));

		// Generate the service worker for caching
		generateSW();

		// Add body parser middleware
		app.use(bodyParser.urlencoded({
			extended: true
		}));
		app.use(bodyParser.json());

		// Add cookie parser middleware
		app.use(cookieParser());

		// Add session middleware
		app.use(session({
			secret: 'keyboard cat',
			resave: true,
			saveUninitialized: true,
			cookie: {
				httpOnly: true,
				maxAge: 20 * 24 * 3600 * 1000 // 20 days
			}
		}));

		// configure strategies for passport
		this.strategies = configureStrategies(passport);

		// Initialize Passport middleware
		app.use(passport.initialize());
		app.use(passport.session());

		// set view engine
		app.set('view engine', 'ejs');
		app.set('views', path.join(__dirname, '../public'));

		// handle requests
		this.setUpAuth();
		this.setUpRestCalls();
		this.setUpRoutes();
	}

	setUpAuth() {
		// admin login
		app.get('/admin/login', (req, res) => {
			userIsAdmin(req.user)
				.then(() => {
					res.redirect('/admin/');
				})
				.catch(() => {
					res.render('admin/login.ejs', {
						user: req.user,
						auth: Object.keys(this.strategies)
					});
				});
		});

		app.get('/admin/user', ensureAuthenticated, (req, res) => {
			userIsAdmin(req.user)
				.then(() => {
					res.sendFile(path.join(__dirname, '../public', 'admin/SAGE2_user.html'));
				})
				.catch(() => {
					res.redirect('/admin/login?page=user');
					return;
				});
		});

		// passport authorization
		// log in with local strategy
		app.post('/login', passport.authenticate('local'),
			(req, res) => {
				if (req.user) {
					res.redirect('/');
				} else {
					res.send(req.user);
				}
			});
		app.get('/logout', (req, res) => {
			if (req.user) {
				UserList.disconnectUser(req.user);
				req.logOut();
			}
			res.redirect("/");
		});

		// log in with google strategy
		if (this.strategies.google) {
			app.get('/auth/google',
				passport.authenticate('google', {
					scope: [
						'https://www.googleapis.com/auth/plus.login',
						'email'
					]
				})
			);

			// redirection of third-party login
			app.get(this.strategies.google.url,
				passport.authenticate('google', { failureRedirect: '/' }),
				function(req, res) {
					res.redirect('/');
				}
			);
		}

		// log in with github strategy
		if (this.strategies.github) {
			app.get('/auth/github',
				passport.authenticate('github'));

			app.get(this.strategies.github.url,
				passport.authenticate('github', { failureRedirect: '/' }),
				function(req, res) {
					// Successful authentication, redirect home
					res.redirect('/');
				});
		}

		// log in with facebook strategy
		if (this.strategies.facebook) {
			app.get('/auth/facebook',
				passport.authenticate('facebook'));

			app.get(this.strategies.facebook.url,
				passport.authenticate('facebook', { failureRedirect: '/' }),
				function(req, res) {
					// Successful authentication, redirect home.
					res.redirect('/');
				});
		}
	}

	// WIP: "REST" calls?
	setUpRestCalls() {
		// send config object to client
		app.get('/config',  (req, res) => {
			// Set type
			let header = {};
			header["Content-Type"] = "application/json";
			// Allow CORS on the /config route
			if (req.headers.origin !== undefined) {
				header['Access-Control-Allow-Origin' ] = req.headers.origin;
				header['Access-Control-Allow-Methods'] = "GET";
				header['Access-Control-Allow-Headers'] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
				header['Access-Control-Allow-Credentials'] = true;
			}
			res.writeHead(200, header);
			// Adding the calculated version into the data structure
			// global.config.version = SAGE2_version;
			res.write(JSON.stringify(global.config, null, 2));
			res.end();
		});
	}

	setUpRoutes() {
		// static assets directories
		app.use(ensureAuthenticated, secureStatic, express.static(publicDirectory));

		for (let f in global.mediaFolders) {
			let folder = global.mediaFolders[f];
			app.use(folder.url, ensureAuthenticated, secureStatic, express.static(folder.path));
		}

		// serve index at root path
		app.get('/', ensureAuthenticated, setUserCookies, (req, res) => {
			// set user cookies
			res.render('index.ejs', {
				user: req.user,
				auth: Object.keys(this.strategies).join(',')
			});
		});

		// handle other paths
		app.get('*', ensureAuthenticated, handleGet);
		app.put('*', handlePut);	// not sure if this does anything
	}
}

function configureStrategies(passport) {
	let strategies = {};

	// set up local strategy
	passport.use(new LocalStrategy(function(username, password, done) {
		// get user with username/password
		UserList.findOrCreate({
			strategy: 'local',
			username: username,
			password: password
		}, function(err, user) {
			return done(err, user);
		});
	}));

	// check local config file for keys
	const configFile = path.join(sageutils.getHomeDirectory(), "Documents", "SAGE2_Media", "config", "ids.json");
	let configJson;
	if (sageutils.fileExists(configFile)) {
		// if the file exists, load it
		const text = fs.readFileSync(configFile, 'utf8');
		configJson = JSON.parse(text);

		const servicesArray = ['google', 'facebook', 'github'];

		servicesArray.forEach(service => {
			if (configJson[service] &&
				configJson[service].clientID &&
				configJson[service].clientSecret) {

				// get callbackURL if exists
				let callbackURL = configJson[service].callbackURL ||
					'/auth/' + service + '/return';

				// store in strategies object
				strategies[service] = {
					url: callbackURL
				};
			}
		});
	}

	// set up google strategy
	// for testing, use localhost on port 9090...
	if (strategies.google) {
		passport.use(new GoogleStrategy({
			clientID: configJson.google.clientID,
			clientSecret: configJson.google.clientSecret,
			callbackURL: "https://" + global.config.host + ":" + global.config.secure_port + strategies.google.url
		},
		function (accessToken, refreshToken, profile, done) {
			UserList.findOrCreate({
				strategy: 'google',
				id: profile.id,
				name: profile.displayName
			}, function(err, user) {
				return done(err, user);
			});
		}));
	}

	if (strategies.github) {
		passport.use(new GitHubStrategy({
			clientID: configJson.github.clientID,
			clientSecret: configJson.github.clientSecret,
			callbackURL: "https://" + global.config.host + ":" + global.config.secure_port + strategies.github.url
		},
		function(accessToken, refreshToken, profile, done) {
			UserList.findOrCreate({
				strategy: 'github',
				id: profile.id,
				name: profile.displayName || profile.username
			}, function(err, user) {
				return done(err, user);
			});
		}));
	}

	if (strategies.facebook) {
		passport.use(new FacebookStrategy({
			clientID: configJson.facebook.clientID,
			clientSecret: configJson.facebook.clientSecret,
			callbackURL: "https://" + global.config.host + ":" + global.config.secure_port + strategies.facebook.url
		},
		function(accessToken, refreshToken, profile, done) {
			UserList.findOrCreate({
				strategy: 'facebook',
				id: profile.id,
				name: profile.displayName
			}, function(err, user) {
				return done(err, user);
			});
		}));
	}

	// serialize/deserialize users for persistent authentication
	passport.serializeUser(function(user, done) {
		// console.log('serializing user', user);
		done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		UserList.findById(id, function(err, user) {
			// console.log('deserializing user id...', id);
			if (err) {
				done(err);
			} else if (user) {
				done(null, user);
			} else {
				done(null, false);
			}
		});
	});

	return strategies;
}

/**
 * Redirect page requests if session is password-protected and no matching cookie
 *
 * @method ensureAuthenticated
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Function} callback to the next function
 */
function ensureAuthenticated(req, res, next) {
	// //////////////////////
	// Are we trying to session management
	// //////////////////////
	let pathname = url.parse(req.url).pathname;

	if (global.__SESSION_ID && req.cookies.session !== global.__SESSION_ID) {
		// if the request is for a page that is not session.html
		if (!pathname.startsWith('/src/') && !pathname.startsWith('/css/') && !pathname.startsWith("/session.html")) {
			// If no match, go back to password page
			res.redirect("/session.html?page=" + req.url.substring(1));
			return;
		}
	}
	next();
}

function secureStatic(req, res, next) {
	let pathname = url.parse(req.url).pathname;

	// Decode the misc characters in the URL
	pathname = decodeURIComponent(pathname);

	// blacklist access to certain urls
	if (pathname.startsWith('/config/') ||
		pathname.startsWith('/passwd.json')) {
		notFound(res);
		return;
	}

	// handle headers
	function handleHeaders() {
		let header = req.headers;

		// Track requests and responses
		debug('request', (req.connection.encrypted ? 'https' : 'http') + '://' + req.headers.host + req.url);
		debug('response', pathname);

		if (path.extname(pathname) === ".html") {
			if (pathname.endsWith("public/index.html")) {
				// Allow embedding the UI page
				delete header['X-Frame-Options'];
			} else {
				// Do not allow iframe
				header['X-Frame-Options'] = 'DENY';
			}
		} else {
			// not needed for images and such
			delete header["X-XSS-Protection"];
			delete header['X-Frame-Options'];
		}

		next();
	}

	// secure admin files
	if (pathname.startsWith('/admin')) {
		// redirect to get authentication
		userIsAdmin(req.user)
			.then(handleHeaders)
			.catch(() => {
				res.redirect('/admin/login?page=' + pathname.substring(7));
				return;
			});
	} else {
		handleHeaders();
	}
}

function userIsAdmin(user, cb) {
	return new Promise((resolve, reject) => {
		if (!user) {
			reject('No user');
		}

		if (UserList.connectedUsers[user.id] &&
			UserList.connectedUsers[user.id].role === 'admin') {
			resolve(true);
		} else {
			reject();
		}
	});
}

function setUserCookies(req, res, next) {
	if (req.user) {
		if (req.user.SAGE2_ptrName) {
			res.cookie('SAGE2_ptrName', req.user.SAGE2_ptrName);
		} else {
			res.cookie('SAGE2_ptrName', UserList.requestGuestName());
		}
		if (req.user.SAGE2_ptrColor) {
			res.cookie('SAGE2_ptrColor', req.user.SAGE2_ptrColor);
		}
	} else {
		let cookieName = req.cookies.SAGE2_ptrName;
		if (!cookieName || cookieName.startsWith('Anon ') || cookieName === 'SAGE2_user' || cookieName === 'SAGE2_mobile') {
			res.cookie('SAGE2_ptrName', UserList.requestGuestName());
		}
	}
	next();
}

/**
 * General routing handler for GET requests
 *
 * @method handleGet
 * @param req {Object} the request object
 * @param res {Object} the response object
 */
function handleGet(req, res) {
	let pathname = path.join(publicDirectory, req.url);

	// Decode the misc characters in the URL
	pathname = decodeURIComponent(pathname);

	// Converting to an actual path
	pathname = path.resolve(pathname);

	// Track requests and responses
	debug('request', (req.connection.encrypted ? 'https' : 'http') + '://' + req.headers.host + req.url);
	debug('response', pathname);

	// redirect a folder path to its containing index.html
	if (sageutils.fileExists(pathname)) {
		var stats = fs.lstatSync(pathname);
		if (stats.isDirectory()) {
			res.redirect(res, req.url + '/index.html');
			return;
		}

		// Build a default header object
		let header = req.headers;

		if (path.extname(pathname) === ".html") {
			if (pathname.endsWith("public/index.html")) {
				// Allow embedding the UI page
				delete header['X-Frame-Options'];
			} else {
				// Do not allow iframe
				header['X-Frame-Options'] = 'DENY';
			}
		} else {
			// not needed for images and such
			delete header["X-XSS-Protection"];
			delete header['X-Frame-Options'];
		}

		header['Access-Control-Allow-Headers']  = 'Range';
		header['Access-Control-Expose-Headers'] = 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range';
		if (req.headers.origin !== undefined) {
			header['Access-Control-Allow-Origin' ]     = req.headers.origin;
			header['Access-Control-Allow-Methods']     = 'GET';
			header['Access-Control-Allow-Headers']     = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept';
			header['Access-Control-Allow-Credentials'] = true;
		}

		if (req.url.match(/^\/(src|lib|images|css)\/.+/)) {
			// cache for 1 week for SAGE2 core files
			// header['Cache-Control'] = 'public, max-age=604800';

			// No persistent copy - must check
			header['Cache-Control'] = 'no-store, must-revalidate, max-age=604800';
		} else {
			// No caching at all
			header['Cache-Control'] = 'no-cache, no-store, must-revalidate';
			/* eslint-disable */
			header['Pragma']        = 'no-cache';
			header['Expires']       = '0';
			/* eslint-enable */
		}

		// Useful Cache-Control response headers include:
		// max-age=[seconds] — specifies the maximum amount of time that a representation will be considered fresh.
		// s-maxage=[seconds] — similar to max-age, except that it only applies to shared (e.g., proxy) caches.
		// public — marks authenticated responses as cacheable;
		// private — allows caches that are specific to one user (e.g., in a browser) to store the response
		// no-cache — forces caches to submit the request to the origin server for validation before releasing
		//  a cached copy, every time.
		// no-store — instructs caches not to keep a copy of the representation under any conditions.
		// must-revalidate — tells caches that they must obey any freshness information you give them about a representation.
		// proxy-revalidate — similar to must-revalidate, except that it only applies to proxy caches.
		//
		// For example:
		// Cache-Control: max-age=3600, must-revalidate
		//

		// Set the mime type
		var fileMime = mime.getType(pathname);
		var charFile;
		if (fileMime === "image/svg+xml" || fileMime === "application/manifest+json") {
			charFile = "UTF-8";
		}
		if (charFile) {
			header["Content-Type"] =  fileMime + "; charset=" + charFile;
		} else {
			header["Content-Type"] =  fileMime;
		}

		// Get the file size from the 'stat' system call
		var total = stats.size;
		if (typeof req.headers.range !== 'undefined') {
			// Parse the range request from the HTTP header
			var range = req.headers.range;
			var parts = range.replace(/bytes=/, "").split("-");
			var partialstart = parts[0];
			var partialend   = parts[1];

			var start = parseInt(partialstart, 10);
			var end = partialend ? parseInt(partialend, 10) : total - 1;
			var chunksize = (end - start) + 1;

			// Set the range into the HTPP header for the response
			header["Content-Range"]  = "bytes " + start + "-" + end + "/" + total;
			header["Accept-Ranges"]  = "bytes";
			header["Content-Length"] = chunksize;

			// Write the HTTP header, 206 Partial Content
			res.writeHead(206, header);

			// Read part of the file
			// This line opens the file as a readable stream
			let readStream = fs.createReadStream(pathname, {start: start, end: end});
			// This will wait until we know the readable stream is actually valid before piping
			readStream.on('open', function () {
				// This just pipes the read stream to the response object
				readStream.pipe(res);
			});
			// This catches any errors that happen while creating the readable stream
			readStream.on('error', function(err) {
				res.end(err);
			});


		} else {
			// Open the file as a stream
			let readStream = fs.createReadStream(pathname);
			// array of allowed compression file types
			var compressExtensions = ['.html', '.json', '.js', '.css', '.txt', '.svg', '.xml', '.md'];
			if (compressExtensions.indexOf(path.extname(pathname)) === -1) {
				// Do not compress, just set file size
				header["Content-Length"] = total;
				res.writeHead(200, header);
				readStream.on('open', function () {
					readStream.pipe(res);
				});
				readStream.on('end', function() {
				});
				readStream.on('close', function() {
				});
				readStream.on('error', function(err) {
					res.end(err);
				});
			} else {
				// Check for allowed compression
				var acceptEncoding = req.headers['accept-encoding'] || '';
				if (acceptEncoding.match(/gzip/)) {
					// Set the encoding to gzip
					header["Content-Encoding"] = 'gzip';
					// Write the HTTP response header
					res.writeHead(200, header);
					// Pipe the file input onto the HTTP response
					readStream.on('open', function () {
						readStream.pipe(zlib.createGzip()).pipe(res);
					});
					readStream.on('error', function(err) {
						res.end(err);
					});
				} else if (acceptEncoding.match(/deflate/)) {
					// Set the encoding to deflate
					header["Content-Encoding"] = 'deflate';
					res.writeHead(200, header);
					readStream.on('open', function () {
						readStream.pipe(zlib.createDeflate()).pipe(res);
					});
					readStream.on('error', function(err) {
						res.end(err);
					});
				} else {
					// No HTTP compression, just set file size
					header["Content-Length"] = total;
					res.writeHead(200, header);
					readStream.on('open', function () {
						readStream.pipe(res);
					});
					readStream.on('error', function(err) {
						res.end(err);
					});
				}
			}
		}
	} else {
		// File not found: 404 HTTP error
		notFound(res);
		return;
	}
}

/**
 * Handler for PUT requests
 *
 * @method handlePut
 * @param req {Object} the request object
 * @param res {Object} the response object
 */
function handlePut(req, res) {
	var putName = sageutils.sanitizedURL(url.parse(req.url).pathname);
	// Remove the first / if there
	if (putName[0] === '/') {
		putName = putName.slice(1);
	}

	var fileLength = 0;
	var filename   = path.join(publicDirectory, "uploads", "tmp", putName);
	var wstream    = fs.createWriteStream(filename);

	wstream.on('finish', function() {
		// stream closed
		sageutils.log('PUT', 'File written', putName, fileLength, 'bytes');
	});
	wstream.on('error', function() {
		// Error during write
		sageutils.log('PUT', 'Error during write for', putName);
	});
	// Getting data
	req.on('data', function(chunk) {
		// Write into output stream
		wstream.write(chunk);
		fileLength += chunk.length;
	});
	// Data no more
	req.on('end', () => {
		// No more data
		sageutils.log('PUT', 'Received:', filename, putName, fileLength, 'bytes');
		// Close the write stream
		wstream.end();
		// empty 200 OK response for now
		let header = req.headers;
		header["Content-Type"] = "text/html; charset=utf-8";
		res.writeHead(200, "OK", header);
		res.end();
	});
}

/**
 * Handle a page not found (404)
 *
 * @method notFound
 */
function notFound(res) {
	res.status(404).send(
		'<meta http-equiv="refresh" content="5;url=/">' +
		'<h1>SAGE2 error</h1>Invalid request\n' +
		'<br><br><br>\n' +
		'<strong><a href="/">SAGE2 main page</a></strong>\n'
	);
}

var hpkpPin1 = (function() {
	var pin;
	return function() {
		if (!pin) {
			pin = fs.readFileSync(path.join("keys", "pin1.sha256"), {encoding: 'utf8'});
			pin = pin.trim();
			// console.log('PIN1', pin);
		}
		return pin;
	};
}());

var hpkpPin2 = (function() {
	var pin;
	return function() {
		if (!pin) {
			pin = fs.readFileSync(path.join("keys", "pin2.sha256"), {encoding: 'utf8'});
			pin = pin.trim();
			// console.log('PIN2', pin);
		}
		return pin;
	};
}());

/**
 * Set some default headers via helmet for security
 */
function secureHeaders() {
	let helmetConfig = {};
	let cfg = global.config;

	// Set the X-Frame-Options header with helmet.frameguard
	//    default: 'SAMEORIGIN'

	// Set X-XSS-Protection header to filter simple XSS
	//    default: '1; mode block' on most browsers; '0' for <IE8

	// Set X-Content-Type-Options header to prevent browsers from 
	// sniffing the MIME type
	//    default: 'nosniff'

	// HTTP Strict Transport Security (HSTS) is an opt-in security enhancement
	// Once a supported browser receives this header that browser will prevent 
	// any communications from being sent over HTTP to the specified domain
	// and will instead send all communications over HTTPS.
	// Here using a long (1 year) max-age
	if (cfg.security && sageutils.isTrue(cfg.security.enableHSTS)) {
		helmetConfig.hsts = {
			maxAge: 31536000
		};
	}

	// HTTP PUBLIC KEY PINNING (HPKP)
	// Key pinning is a trust-on-first-use (TOFU) mechanism.
	// The first time a browser connects to a host it lacks the the information necessary to perform
	// "pin validation" so it will not be able to detect and thwart a MITM attack.
	// This feature only allows detection of these kinds of attacks after the first connection.
	if (cfg.security && sageutils.isTrue(cfg.security.enableHPKP)) {
		helmetConfig.hpkp = {
			// 30 days expirations
			maxAge: 2592000,
			sha256s: [hpkpPin1(), hpkpPin2()],
			includeSubDomains: true
		};
	}

	// Instead of blindly trusting everything that a server delivers, Content-Security-Policy defines
	// the HTTP header that allows you to create a whitelist of sources of trusted content,
	// and instructs the browser to only execute or render resources from those sources.
	// Even if an attacker can find a hole through which to inject script, the script won’t match
	// the whitelist, and therefore won’t be executed.
	// default-src 'none' -> default policy that blocks absolutely everything
	if (cfg.security && sageutils.isTrue(cfg.security.enableCSP)) {
		// Pretty open
		helmetConfig.csp = {
			directives: {
				defaultSrc: ["'none'"],
				childSrc: ["'self'", 'blob:'],
				connectSrc: ['*'],
				fontSrc: ["'self'", 'fonts.gstatic.com'],
				formAction: ["'self'"],
				imgSrc: ['*', 'data:', 'blob:'],
				mediaSrc: ["'self'", 'blob:'],
				objectSrc: ["'self'"],
				pluginTypes: ['image/svg+xml'],
				styleSrc: ["'self'", 'unsafe-inline', 'fonts.googleapis.com'],
				scriptSrc: ['*', 'unsafe-eval']
			}
		};
	}

	return helmetConfig;
}

module.exports = HttpServer;
