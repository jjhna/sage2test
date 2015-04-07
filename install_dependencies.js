// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2015

// Options:
// --win              : force Windows installation
// --mac              : force Mac OS X installation
// --lnx              : force Linux installation
// --target <version> : force installation for specified version of Node.js
// --prod             : production mode, no devel packages

"use strict";

var fs      = require('fs');
var https   = require('https');
var os      = require('os');
var path    = require('path');
var url     = require('url');

var child_process = require('child_process');
var exec          = child_process.exec;


// Node version detection
var _NODE_VERSION = parseInt(process.versions.node.split(".")[1], 10);

// Platform detection or force mode
var platform;
var platformFull;
if      (process.argv.indexOf('--win') > 0) platform = "win";
else if (process.argv.indexOf('--mac') > 0) platform = "mac";
else if (process.argv.indexOf('--lnx') > 0) platform = "lnx";
else platform = os.platform() === "win32" ? "win" : os.platform() === "darwin" ? "mac" : "lnx";
platformFull = platform === "win" ? "Windows" : platform === "mac" ? "Mac OS X" : "Linux";

// Target detection or force mode
var target;
var target_arg = process.argv.indexOf('--target');
if (target_arg > 0 && process.argv.length > target_arg+1) target = process.argv[target_arg+1];
else target = process.versions.node;

console.log("Installing for " + platformFull + ", Node v" + target);

var unpacked = [];

if(fileExistsSync("node_modules")) rmdirSync("node_modules");
fs.mkdirSync("node_modules");


var suffix = "_"+platform+"_"+target+".tar.gz";
var packages = [
	"node-demux",
	"ws"
];

var downloaded = {};
for(var i=0; i<packages.length; i++){
	downloaded[packages[i]] = false;
}

packages.forEach(function(element, index, array) {
	request({host: "bitbucket.org", path: "/sage2/sage2/downloads/"+element+suffix}, function(res) {
		if(res.statusCode === 200) {
			console.log("found binary package: " + element+suffix);
			var writestream = fs.createWriteStream(path.join("node_modules", element+suffix));
			writestream.on('error', function(err) {
				console.log(err);
			});

			res.on('end', function () {
				downloaded[element] = true;
				if(allTrueDict(downloaded)) unzipModules();
			});
			res.pipe(writestream);
		}
		else {
			console.log("could not find binary package " + element+suffix + ". compiling instead.");
			delete downloaded[element];
			if(allTrueDict(downloaded)) unzipModules();
		}
	});
});

function install() {
	process.stdout.write("installing: ");
	var timer = setInterval(function() {
		process.stdout.write(".");
	}, 667);

	// Test if an argument requests production installation (no dev dependencies installed)
	var installCommand;

	if (process.argv.indexOf('--prod') > 0)
		installCommand = "npm install --skip-installed --target=" + target + " --loglevel warn --production";
	else
		installCommand = "npm install --skip-installed --target=" + target + " --loglevel warn";

	// Run the command
	exec(installCommand, {encoding: "utf8", timeout: 0, maxBuffer: 1024*1024},
		function(error, stdout, stderr) {
			// fail or not
			if (error) throw error;
			// wait for it...
			clearInterval(timer);
			process.stdout.write("\n");
			console.log(stdout);
			console.log("INSTALL FINISHED!");
		}
	);
}

function unzipModules() {
	if(isEmpty(downloaded)) {
		install();
	}
	else {
		var key;
		for(key in downloaded) {
			unpacked.push(key+suffix);
		}

		unzipModule(unpacked, 0);
	}
}

function unzipModule(keys, idx) {
	if(idx >= keys.length) { install(); return; }

	var mod = keys[idx];
	if(mod.indexOf(".tar.gz") >= 0) {
		var modDir = path.join("node_modules", mod.substring(0, mod.indexOf(suffix)));
		if(fileExistsSync(modDir)) {
			rmdirSync(modDir);
		}

		if(platform === "win") {
			exec("7z x " + mod, {cwd: "node_modules"}, function(error1, stdout1, stderr1) {
				if(error1) throw error1;

				exec("7z x " + path.basename(mod, ".gz"), {cwd: "node_modules"}, function(error2, stdout2, stderr2) {
					if(error2) throw error2;

					fs.unlinkSync(path.join("node_modules", path.basename(mod, ".gz")));
					fs.unlinkSync(path.join("node_modules", mod));
					unpacked[mod] = true;

					unzipModule(keys, idx+1);
				});
			});
		}
		else {
			exec("tar xzf " + mod, {cwd: "node_modules"}, function(error, stdout, stderr) {
				if(error) throw error;
				fs.unlinkSync(path.join("node_modules", mod));
				unpacked[mod] = true;

				unzipModule(keys, idx+1);
			});
		}
	}
}

function request(options, callback) {
	var req = https.get(options, function(res) {
		if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
			var location = url.parse(res.headers.location);
			if(location.hostname) {
				request(res.headers.location, callback);
			}
			else {
				request(options.host + res.headers.location, callback);
			}
		}
		else {
			callback(res);
		}
	});
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});
}

function allTrueDict(dict) {
	var key;
	for(key in dict) {
		if(dict[key] !== true) return false;
	}
	return true;
}

function isEmpty(obj) {
	// null and undefined are "empty"
	if (obj === null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
		if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}

function rmdirSync(directory) {
	if(!fileExistsSync(directory) || !fs.lstatSync(directory).isDirectory()) return false;

	var list = fs.readdirSync(directory);
	for (var j=0; j <list.length; j++) {
		var file = path.join(directory, list[j]);
		if (fs.lstatSync(file).isDirectory()) {
			rmdirSync(file);
		}
		else {
			fs.unlinkSync(file);
		}
	}
	fs.rmdirSync(directory);
}

function fileExistsSync(filename) {
	if (_NODE_VERSION === 10 || _NODE_VERSION === 11) {
		return fs.existsSync(filename);
	} else {
		try {
			fs.accessSync(filename, fs.R_OK);
			return true;
		} catch (err) {
			return false;
		}
	}
}
