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

// External package to clean up URL requests
var normalizeURL = require('normalizeurl');

// SAGE2 own modules
var sageutils  = require('../src/node-utils');    // provides utility functions
var generateSW = require('../generate-service-worker.js');

const express = require('express');
const uuid = require('uuid/v4');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const { Strategy, Issuer } = require('openid-client');
const { SessionJSONStore, UserJSONStore} = require('../src/node-store.js');


var app = null;
var userDB = null;

/**
 * SAGE HTTP request handlers for GET and POST
 *
 * @class HttpServer
 * @constructor
 * @param publicDirectory {String} folder to expose to the server
 */

class HttpServer {
	constructor(publicDir) {
		
		publicDirectory = publicDir;

		this.app = app = express();

		var dataFolder = '../data';
		if (!sageutils.folderExists(dataFolder)) {
			sageutils.mkdirParent(dataFolder);
		}

		var sessionDB = new SessionJSONStore();
		sessionDB.initialize('../data/sessionDB.json');

		this.userDB = userDB = new UserJSONStore();
		this.userDB.initialize('../data/userDB.json');
		// set default headers
		//app.use(helmet(secureHeaders()));

		// Generate the service worker for caching
		generateSW();

		// Add body parser middleware
		app.use(bodyParser.urlencoded({
			extended: true
		}));
		app.use(bodyParser.json());

	
		// add & configure middleware
		app.use(session({
			genid: (req) => {
				console.log('Inside the session middleware');
				console.log(req.sessionID);
				return uuid(); // use UUIDs for session IDs
			},
			cookie: {
				secure: true,
				httpOnly: true,
				maxAge: 2 * 24 * 3600 * 1000 // 2 days
			},
			store: sessionDB,
			secret: 'asldfkjasd;fkja;sldkf;alsdfk',
			resave: true,
			saveUninitialized: false
		}));

		var cfg = global.config;
		var redirect_uri = 'https://' + cfg.host + ':' + cfg.port + '/authcb';
		Issuer.discover('https://cilogon.org/.well-known/openid-configuration') // => Promise
			.then(function (ciLogon) {
				var client = new ciLogon.Client({
					client_id: cfg.ciLogon.client_id,
					client_secret: cfg.ciLogon.client_secret
				}); // => Client
				client.CLOCK_TOLERANCE = 5 * 60; // 5 Minutes
				var params = {
					client_id: cfg.ciLogon.client_id,
					redirect_uri: redirect_uri
				};
				passport.use('oidc', new Strategy({client: client, params: params}, (tokenset, userinfo, done) => {
					console.log('userinfo', userinfo);
					userDB.get(tokenset.claims.sub, function (err, user) {
						if (err) {
							user = {
								id: tokenset.claims.sub,
								tokenset: tokenset,
								claims: tokenset.claims
							};
							userDB.set(user.id, user, function(err) {
								if (err) {
									console.log(err);
									return done(err, false);
								}
							});
						}
						return done(null, user);
					});
				}));
				passport.serializeUser(function(user, done) {
					done(null, user.id);
				});

				passport.deserializeUser(function(id, done) {
					userDB.get(id, function (err, user) {
						done(err, user);
					});
				});

			app.use(passport.initialize());
			app.use(passport.session());
			app.use(express.static(path.join(__dirname, '../public')));

			// handle requests
			this.setUpAuth();
			this.setUpRestCalls();
			this.setUpRoutes();
		}.bind(this));
	}
	setUpAuth() {
		app.get('/login', passport.authenticate('oidc'));
 
		// authentication callback
		app.get('/authcb', passport.authenticate('oidc', { successRedirect: '/', failureRedirect: '/login' }));

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
			res.sendFile(path.join(__dirname + '/index.html'));
		});

		// handle other paths
		app.get('*', ensureAuthenticated, handleGet);
		app.put('*', handlePut);	// not sure if this does anything
	}
}

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}

	res.redirect('/login');
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
	handleHeaders();
}


function setUserCookies(req, res, next) {
	if (req.user) {
		if (req.user.SAGE2_ptrName) {
			res.cookie('SAGE2_ptrName', req.user.SAGE2_ptrName);
		}
		if (req.user.SAGE2_ptrColor) {
			res.cookie('SAGE2_ptrColor', req.user.SAGE2_ptrColor);
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

module.exports = HttpServer;

