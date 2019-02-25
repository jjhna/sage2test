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
var router = null;
var userDB = null;
var publicDirectory;

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
		this.router = router = express.Router();
		var dataFolder = 'sessiondata';
		if (!sageutils.folderExists(dataFolder)) {
			sageutils.mkdirParent(dataFolder);
		}

		var sessionDB = new SessionJSONStore();
		sessionDB.initialize(path.join(dataFolder, 'sessionDB.json'));

		this.userDB = userDB = new UserJSONStore();
		this.userDB.initialize(path.join(dataFolder, 'userDB.json'));

		// Generate the service worker for caching
		generateSW();

		// Add body parser middleware
		app.use(bodyParser.urlencoded({
			extended: true
		}));
		app.use(bodyParser.json());
		var cfg = global.config;

		// add & configure middleware
		app.use(session({
			genid: (req) => {
				return uuid(); // use UUIDs for session IDs
			},
			cookie: {
				secure: true,
				httpOnly: true,
				maxAge: 2 * 24 * 3600 * 1000 // 2 days
			},
			store: sessionDB,
			name: 'SAGE2.sid',
			secret: cfg.ciLogon.sessionSecret,
			resave: false,
			saveUninitialized: false
		}));

		
		var redirect_uri = 'https://' + cfg.host + '/authcb';
		Issuer.discover('https://cilogon.org/.well-known/openid-configuration')
			.then(function (ciLogon) {
				var client = new ciLogon.Client({
					client_id: cfg.ciLogon.client_id,
					client_secret: cfg.ciLogon.client_secret
				});
				client.CLOCK_TOLERANCE = 5 * 60; // 5 Minutes
				var params = {
					client_id: cfg.ciLogon.client_id,
					redirect_uri: redirect_uri,
					scope: 'openid profile'
				};
				// Tell passport hows users will login
				passport.use('oidc', new Strategy({client: client, params: params}, (tokenset, userinfo, done) => {
					userDB.get(tokenset.claims.sub, function (err, user) {
						if (err) {
							user = {
								id: tokenset.claims.sub,
								tokenset: tokenset,
								claims: tokenset.claims,
								userinfo: userinfo
							};
							userDB.set(user.id, user, function(err) {
								if (err) {
									sageutils.log('OIDC', err);
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

				// handle requests
				this.setUpRoutes();
				// For all paths, use this router
				app.use('/', router);
			}.bind(this));
	}

	setUpRoutes() {
		// redirect http to https
		router.use(enforceHttps);

		// authentication starting point
		router.get('/login', passport.authenticate('oidc'));

		// authentication callback
		router.get('/authcb', passport.authenticate('oidc'), ensureAuthenticated, setUserCookies, connect);

		// Serve static files
		router.use(ensureAuthenticated, secureStatic, express.static(publicDirectory));

		// Serve static file from media folders
		for (let f in global.mediaFolders) {
			let folder = global.mediaFolders[f];
			router.get(folder.url, ensureAuthenticated, secureStatic, express.static(folder.path));
		}

		// serve index at root path
		router.get('/', ensureAuthenticated, (req, res) => {
			return res.redirect('/index.html');
		});

		// send config object to client
		router.get('/config', ensureAuthenticated, (req, res) => {
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
			//Removing ciLogon client details from config before serving it.
			var configCopy = Object.assign({}, global.config);
			delete configCopy["ciLogon"];
			res.write(JSON.stringify(configCopy, null, 2));
			res.end();
		});
		// handle other paths
		router.get('*', ensureAuthenticated, handleGet);
		router.put('*', handlePut);	// not sure if this does anything
	}



	buildHeader() {
		// Get the site configuration, from server.js
		var cfg = global.config;
		// Build the header object
		var header = {};

		// Default datatype of the response
		header["Content-Type"] = "text/html; charset=utf-8";

		// The X-Frame-Options header can be used to to indicate whether a browser is allowed
		// to render a page within an <iframe> element or not. This is helpful to prevent clickjacking
		// attacks by ensuring your content is not embedded within other sites.
		// See more here: https://developer.mozilla.org/en-US/docs/HTTP/X-Frame-Options.
		// "SAMEORIGIN" or "DENY" for instance
		header["X-Frame-Options"] = "SAMEORIGIN";

		// This header enables the Cross-site scripting (XSS) filter built into most recent web browsers.
		// It's usually enabled by default anyway, so the role of this header is to re-enable the filter
		// for this particular website if it was disabled by the user.
		// This header is supported in IE 8+, and in Chrome.
		header["X-XSS-Protection"] = "1; mode=block";

		// The only defined value, "nosniff", prevents Internet Explorer and Google Chrome from MIME-sniffing
		// a response away from the declared content-type. This also applies to Google Chrome, when downloading
		// extensions. This reduces exposure to drive-by download attacks and sites serving user uploaded content
		// that, by clever naming, could be treated by MSIE as executable or dynamic HTML files.
		header["X-Content-Type-Options"] = "nosniff";

		// HTTP Strict Transport Security (HSTS) is an opt-in security enhancement
		// Once a supported browser receives this header that browser will prevent any
		// communications from being sent over HTTP to the specified domain
		// and will instead send all communications over HTTPS.
		// Here using a long (1 year) max-age
		if (cfg.security && sageutils.isTrue(cfg.security.enableHSTS)) {
			header["Strict-Transport-Security"] = "max-age=31536000";
		}

		// Instead of blindly trusting everything that a server delivers, Content-Security-Policy defines
		// the HTTP header that allows you to create a whitelist of sources of trusted content,
		// and instructs the browser to only execute or render resources from those sources.
		// Even if an attacker can find a hole through which to inject script, the script won’t match
		// the whitelist, and therefore won’t be executed.
		// default-src 'none' -> default policy that blocks absolutely everything
		if (cfg.security && sageutils.isTrue(cfg.security.enableCSP)) {
			// Pretty open
			header["Content-Security-Policy"] = "default-src 'self';" +
				// application/browser-plugin is for vtc
				" plugin-types image/svg+xml application/browser-plugin;" +
				" object-src 'self';" +
				" child-src 'self' blob:;" +
				" connect-src *;" +
				" font-src 'self' fonts.gstatic.com;" +
				" form-action 'self';" +
				" img-src * data: blob:;" +
				" media-src 'self' blob:;" +
				" style-src 'self' 'unsafe-inline' fonts.googleapis.com;" +
				" script-src * 'unsafe-eval' 'unsafe-inline';";
		}

		// Expect-CT allows a site to determine if they enforce their Certificate Transparency policy
		if (cfg.security && sageutils.isTrue(cfg.security.enableExpectCertificateTransparency)) {
			// set to enforce, and valid for 1 hour
			header["Expect-CT"] = "enforce; max-age:3600;";
		}

		// Referrer Policy allows a site to control how much information the browser includes
		//   with navigations away from a document. Only set here for same origin site
		if (cfg.security && sageutils.isTrue(cfg.security.enableReferrerPolicy)) {
			header["Referrer-Policy"] = "same-origin";
		}

		// Feature Policy allows to enable and disable certain web platform features
		//  in local pages and those they embed
		if (cfg.security && sageutils.isTrue(cfg.security.enableFeaturePolicy)) {
			header["Feature-Policy"] = "" +
				"accelerometer 'none'" +
				"; ambient-light-sensor 'none'" +
				"; autoplay *" +
				"; camera *" +
				"; encrypted-media 'none'" +
				"; fullscreen 'none'" +
				"; geolocation *" +
				"; gyroscope 'none'" +
				"; magnetometer 'none'" +
				"; microphone *" +
				"; midi 'none'" +
				"; payment 'none'" +
				// "; picture-in-picture 'none'" +
				"; speaker *" +
				"; usb 'self'" +
				"; vr 'self'";
		}
		return header;
	}
}

/**
 * Express middleware to reroute all http requests to https
 *
 * @method enforceHttps
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Object} the middleware chaining object
 */
function enforceHttps(req, res, next) {
	if (!req.secure) {
		return res.redirect("https://" + req.headers.host + req.url);
	}
	return next();
}

/**
 * Express middleware to handle redirection to page the user requested before login in
 *
 * @method connect
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Object} the middleware chaining object
 */

function connect(req, res, next) {
	var returnTo = req.session.returnTo;
	delete req.session.returnTo;
	return res.redirect(returnTo || '/');
}

/**
 * Express middleware for making sure that the user is logged in
 *
 * @method ensureAuthenticated
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Object} the middleware chaining object
 */
function ensureAuthenticated(req, res, next) {
	// Pass through is the request has been authenticated
	if (req.isAuthenticated()) {
		return next();
	}
	// Otherwise save the url for redirection after authenticaion and redirect to login page
	req.session.returnTo = req.originalUrl;
	return res.redirect('/login');
}


/**
 * Express middleware for protecting static pages
 *
 * @method secureStatic
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Object} the middleware chaining object
 */


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

/**
 * Express middleware for setting pointer name and pointer color
 *
 * @method setUserCookies
 * @param req {Object} the request object
 * @param res {Object} the response object
 * @param next {Object} the middleware chaining object
 */

function setUserCookies(req, res, next) {
	userDB.get(req.user.id, function (err, user) {
		if (err) {
			return res.redirect('/login');
		}
		var ptrName = user.userinfo.given_name || req.user.SAGE2_ptrName;
		if (ptrName) {
			res.cookie('SAGE2_ptrName', ptrName);
		}
		if (req.user.SAGE2_ptrColor) {
			res.cookie('SAGE2_ptrColor', req.user.SAGE2_ptrColor);
		}
		next();
	});
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
	sageutils.log('In handle put');
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

