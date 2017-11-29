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
// var normalizeURL = require('normalizeurl');

// SAGE2 own modules
var sageutils  = require('../src/node-utils');    // provides utility functions
var generateSW = require('../generate-service-worker.js');

// node modules
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');

var passport = require('passport');
var localStrategy = require('passport-local').Strategy;
var googleStrategy = require('passport-google-oauth').OAuth2Strategy;

var app = null;
var publicDirectory;

/**
 * SAGE HTTP request handlers for GET and POST
 *
 * @class HttpServer
 * @constructor
 * @param publicDirectory {String} folder to expose to the server
 */
function HttpServer(publicDir) {
	publicDirectory = publicDir;

	app = express();

	this.app = app;

	// Generate the service worker for caching
	generateSW();

	// Add cookie parser middleware
	app.use(cookieParser());

	// Add session middleware
	app.use(session({
		secret: 'keyboard cat',
		resave: false,
		saveUninitialized: true,
		cookie: { secure: true }
	}));

	// configure strategies for passport
	configureStrategies();
	app.use(passport.initialize());
	app.use(passport.session());

	// //////////////////////
	// Routes
	// //////////////////////

	// redirect root path to index.html
	app.get('/', (req, res) => res.redirect('/index.html'));

	// static assets directories
	app.use(ensureAuthenticated, express.static(publicDirectory));
	for (let f in global.mediaFolders) {
		let folder = global.mediaFolders[f];
		app.use(folder.url, ensureAuthenticated, express.static(folder.path));
	}

	// TODO: handle login
	// log in with local strategy
	app.post('/login',
		passport.authenticate('local', { successRedirect: '/' })
	);

	// log in with google strategy
	app.get('/auth/google',
		passport.authenticate('google', { scope: [
	        'https://www.googleapis.com/auth/plus.login',
	        'email'
		] })
	);

	// redirection
	app.get('/auth/google/return', 
		passport.authenticate('google', { failureRedirect: '/' }),
		function(req, res) {
			res.redirect('/');
		}
	);

	// handle other paths
	this.routes = {};
	app.get('*', ensureAuthenticated, handleGet.bind(this));
	app.put('*', handlePut.bind(this));
}

function configureStrategies() {
	// set up local strategy
	passport.use(new localStrategy(function(username, password, done) {
		// get user with username/password
		// console.log('local',username, password);
		done(null, "username here");
	}));

	// set up google strategy
	// for testing, use localhost on port 9090...
	let configGoogle = true;
	if (configGoogle) {
		passport.use(new googleStrategy(
			{
				clientID: "307203767774-cda41sqvjrrrrglufo8ret6iv3n4m9f7.apps.googleusercontent.com",
				clientSecret: "peFp3B3KF_YCywXZfR_Us_Bw",
				callbackURL: "https://" + config.host + ":" + config.secure_port + "/auth/google/return"
			},
			function (accessToken, refreshToken, profile, done) {
				// console.log('profile', profile);
				done(null, profile);
			}
		));
	}

	// serialize/deserialize users for persistent authentication
	passport.serializeUser(function(user, done) {
		// TODO: handle this properly: serialize id
		done(null, user);
	});

	passport.deserializeUser(function(id, done) {
		// TODO: handle properly: get user by id and return done(null, user)
		done(null, id);
	});
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
	if (global.__SESSION_ID) {
		let pathname = url.parse(req.url).pathname;

		// if the request is for an HTML page (no security check otherwise)
		//    and it is not session.html
		if (pathname.endsWith('/') ||
			(path.extname(pathname) === ".html" &&
			!req.url.startsWith("/session.html"))) {

			// FIXME: working on Chrome but not on Firefox
			if (req.cookies.session !== global.__SESSION_ID) {
				// If no match, go back to password page
				res.redirect("/session.html?page=" + req.url.substring(1));
				return;
			}
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
	// Check the routes handlers
	if (typeof this.routes[req.url] === 'function') {
		this.routes[req.url](req, res);
		return;
	}

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
			res.redirect(res, path.join(req.url, "index.html"));
			return;
		}

		// Build a default header object
		var header = this.buildHeader();

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
	var filename   = path.join(this.publicDirectory, "uploads", "tmp", putName);
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
		var header = this.buildHeader();
		header["Content-Type"] = "text/html";
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
 * Build an HTTP header object
 *
 * @method buildHeader
 * @return {Object} an object containig common HTTP header values
 */
HttpServer.prototype.buildHeader = function() {
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
		header["Content-Security-Policy"] = "default-src 'none';" +
			" plugin-types image/svg+xml;" +
			" object-src 'self';" +
			" child-src 'self' blob:;" +
			" connect-src *;" +
			" font-src 'self' fonts.gstatic.com;" +
			" form-action 'self';" +
			" img-src * data: blob:;" +
			" media-src 'self' blob:;" +
			" style-src 'self' 'unsafe-inline' fonts.googleapis.com;" +
			" script-src * 'unsafe-eval';";
	}
	// More secure
	// header["Content-Security-Policy"] = "default-src 'none';" +
	// 	" plugin-types image/svg+xml;" +
	// 	" object-src 'self';" +
	// 	" child-src 'self' blob:;" +
	// 	" connect-src 'self' wss: ws: https://query.yahooapis.com https://data.cityofchicago.org https://lyra.evl.uic.edu:9000;" +
	// 	" font-src 'self';" +
	// 	" form-action 'self';" +
	// 	// " img-src 'self' data: http://openweathermap.org a.tile.openstreetmap.org b.tile.openstreetmap.org " +
	// 	// "c.tile.openstreetmap.org http://www.webglearth.com http://server.arcgisonline.com http://radar.weather.gov " +
	// 	// "http://cdn.abclocal.go.com http://www.glerl.noaa.gov " +
	// 	// "https://lyra.evl.uic.edu:9000 https://maps.gstatic.com https://maps.googleapis.com https://khms0.googleapis.com " +
	// 	// "https://khms1.googleapis.com https://khms2.googleapis.com https://csi.gstatic.com;" +
	// 	" img-src *;" +
	// 	" media-src 'self';" +
	// 	" style-src 'self' 'unsafe-inline';" +
	// 	" script-src 'self' http://www.webglearth.com https://maps.googleapis.com 'unsafe-eval';";


	// HTTP PUBLIC KEY PINNING (HPKP)
	// Key pinning is a trust-on-first-use (TOFU) mechanism.
	// The first time a browser connects to a host it lacks the the information necessary to perform
	// "pin validation" so it will not be able to detect and thwart a MITM attack.
	// This feature only allows detection of these kinds of attacks after the first connection.
	if (cfg.security && sageutils.isTrue(cfg.security.enableHPKP)) {
		// 30 days expirations
		header["Public-Key-Pins"] = "pin-sha256=\"" + hpkpPin1() +
			"\"; pin-sha256=\"" + hpkpPin2() +
			"\"; max-age=2592000; includeSubDomains";
	}

	return header;
};

/**
 * Add a HTTP GET handler (i.e. route)
 *
 * @method get
 * @param name {String} matching URL name (i.e. /config)
 * @param callback {Function} processing function
 */
HttpServer.prototype.get = function(name, callback) {
	this.routes[name] = callback;
};

/**
 * Add a HTTP POST handler
 *
 * @method post
 * @param name {String} matching URL name (i.e. /config)
 * @param callback {Function} processing function
 */
HttpServer.prototype.post = function(name, callback) {
	app.post(name, callback);
}

module.exports = HttpServer;
