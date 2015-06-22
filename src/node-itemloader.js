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
 * Main module loading content and creating applications
 *
 * @module server
 * @submodule itemLoader
 * @requires decompress-zip, gm, mime, request, ytdl-core, node-demux, node-exiftool, node-assets, node-utils, node-registry
 */

"use strict";

var fs           = require('fs');
var path         = require('path');

var Unzip        = require('decompress-zip');
var gm           = require('gm');
var mime         = require('mime');
var request      = require('request');
var ytdl         = require('ytdl-core');
var Videodemuxer = require('node-demux');

var exiftool     = require('../src/node-exiftool');        // gets exif tags for images
var assets       = require('../src/node-assets');          // asset management
var sageutils    = require('../src/node-utils');           // provides utility functions
var registry     = require('../src/node-registry');        // Registry Manager

var imageMagick;

/** don't use path.join for URL creation - all URLs use forward slashes **/

//////////////////////////////////////////////////////////////////////////////////////////


function encodeReservedURL(url) {
	return encodeURI(url).replace(/\$/g, "%24").replace(/\&/g, "%26").replace(/\+/g, "%2B").replace(/\,/g, "%2C").replace(/\:/g, "%3A").replace(/\;/g, "%3B").replace(/\=/g, "%3D").replace(/\?/g, "%3F").replace(/\@/g, "%40");
}

//////////////////////////////////////////////////////////////////////////////////////////
function AppLoader(publicDir, hostOrigin, config, imOptions, ffmpegOptions) {
	this.publicDir      = publicDir;
	this.hostOrigin     = hostOrigin;
	this.configuration  = config;
	this.displayWidth   = config.totalWidth;
	this.displayHeight  = config.totalHeight;
	this.titleBarHeight = (config.ui.auto_hide_ui===true) ? 0 : config.ui.titleBarHeight;

	imageMagick     = gm.subClass(imOptions);
	this.ffmpegPath = ffmpegOptions.appPath;
}

//////////////////////////////////////////////////////////////////////////////////////////


AppLoader.prototype.scaleAppToFitDisplay = function(appInstance) {
	var wallRatio   = this.displayWidth / (this.displayHeight-this.titleBarHeight);
	var iWidth      = appInstance.native_width;
	var iHeight     = appInstance.native_height;
	var aspectRatio = iWidth / iHeight;
	// Image wider than wall
	if(iWidth > (this.displayWidth - (2*this.titleBarHeight)) && appInstance.aspect >= wallRatio) {
		// Image wider than wall
		iWidth  = this.displayWidth - (2*this.titleBarHeight);
		iHeight = iWidth / appInstance.aspect;
	}
	// Image taller than wall
	else if(iHeight > (this.displayHeight - (3*this.titleBarHeight)) && appInstance.aspect < wallRatio) {
		// Wall wider than image
		iHeight = this.displayHeight - (3*this.titleBarHeight);
		iWidth  = iHeight*appInstance.aspect;
	}

	// Check against min dimensions
	if(iWidth < this.configuration.ui.minWindowWidth){
		iWidth  = this.configuration.ui.minWindowWidth;
		iHeight = iWidth / aspectRatio;
	}
	if(iWidth > this.configuration.ui.maxWindowWidth){
		iWidth  = this.configuration.ui.maxWindowWidth;
		iHeight = iWidth / aspectRatio;
	}
	if(iHeight < this.configuration.ui.minWindowHeight){
		iHeight = this.configuration.ui.minWindowHeight;
		iWidth  = iHeight * aspectRatio;
	}
	if(iHeight > this.configuration.ui.maxWindowHeight){
		iHeight = this.configuration.ui.maxWindowHeight;
		iWidth  = iHeight * aspectRatio;
	}

	appInstance.width  = iWidth;
	appInstance.height = iHeight;
};

AppLoader.prototype.loadImageFromURL = function(url, mime_type, name, strictSSL, callback) {
	var _this = this;

	request({
		url: url,
		encoding: null,
		strictSSL: strictSSL,
		agentOptions: {rejectUnauthorized:false, requestCert: false},
		headers:{'User-Agent':'node'}},
		function(err1, response, body) {
			if (err1) {
				console.log("request error", err1);
				throw err1;
			}
			// var result = exiftool.buffer(body, function(err2, info) {
			// 	if (err2) {
			// 		console.log("Error processing image:", url, mime_type, name, result.err);
			// 	}
			// 	else {
			// 		if (info.ImageWidth && info.ImageHeight) {
			// 			_this.loadImageFromDataBuffer(body, info.ImageWidth, info.ImageHeight, mime_type, url, url, name, info,
			// 				function(appInstance) {
			// 					_this.scaleAppToFitDisplay(appInstance);
			// 					callback(appInstance);
			// 				}
			// 				);
			// 		} else {
			// 			console.log("File not recognized:", mime_type, url);
			// 		}
			// 	}
			// });

			var localPath = path.join(_this.publicDir, "uploads", "images", name);

			fs.writeFile(localPath, body, function (err2) {
				if (err2) console.log("Error saving image:", url, localPath);

				assets.exifAsync([localPath], function(err3) {
					if (!err3) {
						_this.loadImageFromFile(localPath, mime_type, url, url, name, function(appInstance) {
								_this.scaleAppToFitDisplay(appInstance);
								callback(appInstance);
						});
					}
				});

			});

		}
	);
};

AppLoader.prototype.loadYoutubeFromURL = function(url, callback) {
	var _this = this;

	ytdl.getInfo(url, function(err, info){
		if(err) throw err;

		var video = {index: -1, resolution: 0, type: ""};
		var audio = {index: -1, bitrate: 0, type: ""};
		for(var i=0; i<info.formats.length; i++){
			var type = info.formats[i].type.split(";")[0];
			if ((type === "video/mp4" || type === "video/webm") && info.formats[i].resolution !== null && info.formats[i].profile !== "3d") {
				var res = parseInt(info.formats[i].resolution.substring(0, info.formats[i].resolution.length-1));
				if (res <= 1200 && res > video.resolution) {
					video.index = i;
					video.resolution = res;
					video.type = type;
				}
			}
			else if ((type === "audio/mp4" || type === "audio/webm")) {
				var bitrate = info.formats[i].audioBitrate || 0;
				if ((audio.type === type && bitrate > audio.bitrate) ||
					(audio.type !== "audio/webm" && type === "audio/webm") ||
					(audio.type === "")
					) {
					audio.index = i;
					audio.bitrate = bitrate;
					audio.type = type;
				}
			}
		}

		_this.loadVideoFromURL(url, "video/youtube", info.formats[video.index].url, info.title, function(appInstance, videohandle) {
			appInstance.data.video_url  = info.formats[video.index].url;
			appInstance.data.video_type = video.type;
			appInstance.data.audio_url  = info.formats[audio.index].url;
			appInstance.data.audio_type = audio.type;

			callback(appInstance, videohandle);
		});
	});
};

AppLoader.prototype.loadVideoFromURL = function(url, mime_type, source_url, name, callback) {
	this.loadVideoFromFile(source_url, mime_type, url, url, name, callback);
};


AppLoader.prototype.loadPdfFromURL = function(url, mime_type, name, strictSSL, callback) {
	var local_url = "uploads/pdfs/"+name;
	var localPath = path.join(this.publicDir, "uploads", "pdfs", name);
	var _this = this;

	var tmp = fs.createWriteStream(localPath);
	tmp.on('error', function(err) {
		if(err) throw err;
	});
	tmp.on('close', function() {
		//loadPDF
		_this.loadPdfFromFile(localPath, mime_type, local_url, url, name, function(appInstance) {
			callback(appInstance);
		});
	});
	request({url: url, strictSSL: strictSSL, headers:{'User-Agent':'node'}}).pipe(tmp);
};


AppLoader.prototype.loadImageFromDataBuffer = function(buffer, width, height, mime_type, url, external_url, name, exif_data, callback) {

	var source = buffer.toString("base64");
	var aspectRatio = width / height;

	var metadata         = {};
	metadata.title       = "Image Viewer";
	metadata.version     = "1.0.0";
	metadata.description = "Image viewer for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["image", "picture", "viewer"];

	var appInstance = {
		id: null,
		title: name,
		application: "image_viewer",
		icon: exif_data ? exif_data.SAGE2thumbnail : null,
		type: mime_type,
		url: external_url,
		data: {
			src: source,
			type: mime_type,
			exif: exif_data,
			top: 0,
			showExif: false
		},
		resrc: null,
		left: this.titleBarHeight,
		top: 1.5*this.titleBarHeight,
		width: width,
		height: height,
		native_width: width,
		native_height: height,
		previous_left: null,
		previous_top: null,
		previous_width: null,
		previous_height: null,
		maximized: false,
		aspect: aspectRatio,
		animation: false,
		metadata: metadata,
		sticky: false,
		date: new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};

AppLoader.prototype.loadImageFromServer = function(width, height, mime_type, url, external_url, name, exif_data, callback) {

	var aspectRatio = width / height;

	var metadata         = {};
	metadata.title       = "Image Viewer";
	metadata.version     = "1.0.0";
	metadata.description = "Image viewer for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["image", "picture", "viewer"];

	var appInstance = {
		id: null,
		title: name,
		application: "image_viewer",
		icon: exif_data ? exif_data.SAGE2thumbnail : null,
		type: mime_type,
		url: external_url,
		data: {
			src: url,
			type: mime_type,
			exif: exif_data,
			top: 0,
			showExif: false
		},
		resrc: null,
		left: this.titleBarHeight,
		top: 1.5*this.titleBarHeight,
		width: width,
		height: height,
		native_width: width,
		native_height: height,
		previous_left: null,
		previous_top: null,
		previous_width: null,
		previous_height: null,
		maximized: false,
		aspect: aspectRatio,
		animation: false,
		metadata: metadata,
		sticky: false,
		annotation:true,
		date: new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};

AppLoader.prototype.loadImageFromFile = function(file, mime_type, url, external_url, name, callback) {
	var _this = this;

	if (mime_type === "image/jpeg" || mime_type === "image/png" || mime_type === "image/webp") {

		// fs.readFile(file, function (err, data) {
		// 	if(err) {
		// 		console.log("Error> opening file", file);
		// 		return; // throw err;
		// 	}
		// 	// Query the exif data
		// 	var dims = assets.getDimensions(file);
		// 	var exif = assets.getExifData(file);
		// 	if (dims) {
		// 		_this.loadImageFromDataBuffer(data, dims.width, dims.height, mime_type, url, external_url, name, exif, function(appInstance) {
		// 			callback(appInstance);
		// 		});
		// 	} else {
		// 		console.log("File not recognized:", file, mime_type, url);
		// 	}
		// });

			// Query the exif data
			var dims = assets.getDimensions(file);
			var exif = assets.getExifData(file);

			if (dims) {
				this.loadImageFromServer(dims.width, dims.height, mime_type, url, external_url, name, exif, function(appInstance) {
					callback(appInstance);
				});
			} else {
				console.log("File not recognized:", file, mime_type, url);
			}

	}
	// SVG file
	else if (mime_type === "image/svg+xml") {
		// fs.readFile(file, function (err, data) {
		// 	if(err) {
		// 		console.log("Error> opening file", file);
		// 		return; // throw err;
		// 	}

		// 	// Query the exif data
		// 	var box  = assets.getTag(file, "ViewBox").split(' ');
		// 	var dims = {width:parseInt(box[2]), height:parseInt(box[3])};
		// 	var exif = assets.getExifData(file);

		// 	if (dims) {
		// 		_this.loadImageFromDataBuffer(data, dims.width, dims.height, mime_type, url, external_url, name, exif, function(appInstance) {
		// 			callback(appInstance);
		// 		});
		// 	} else {
		// 		console.log("File not recognized:", file, mime_type, url);
		// 	}
		// });

		// Query the exif data
		var box  = assets.getTag(file, "ViewBox").split(' ');
		var svgDims = {width:parseInt(box[2]), height:parseInt(box[3])};
		var svgExif = assets.getExifData(file);

		if (svgDims) {
			this.loadImageFromServer(svgDims.width, svgDims.height, mime_type, url, external_url, name, svgExif, function(appInstance) {
				callback(appInstance);
			});
		} else {
			console.log("File not recognized:", file, mime_type, url);
		}
	}
	else {
		// imageMagick(file+"[0]").noProfile().bitdepth(8).flatten().setFormat("PNG").toBuffer(function (err, buffer) {
		// 	if(err) {
		// 		console.log("Error> processing image file", file);
		// 		return; // throw err;
		// 	}

		// 	// Query the exif data
		// 	var dims = assets.getDimensions(file);
		// 	var exif = assets.getExifData(file);

		// 	if (dims) {
		// 		_this.loadImageFromDataBuffer(buffer, dims.width, dims.height, "image/png", url, external_url, name, exif, function(appInstance) {
		// 			callback(appInstance);
		// 		});
		// 	} else {
		// 		console.log("File not recognized:", file, mime_type, url);
		// 	}
		// });

		var localPath = path.join(this.publicDir, "uploads", "tmp", name) + ".png";

		imageMagick(file+"[0]").noProfile().bitdepth(8).flatten().setFormat("PNG").write(localPath, function (err, buffer) {
			if(err) {
				console.log("Error> processing image file", file);
				return;
			}

			// Query the exif data
			var imgDims = assets.getDimensions(file);
			var imgExif = assets.getExifData(file);

			if (dims) {
				_this.loadImageFromServer(imgDims.width, imgDims.height, "image/png", url+".png", external_url+".png", name+".png", imgExif, function(appInstance) {
					callback(appInstance);
				});
			} else {
				console.log("File not recognized:", file, mime_type, url);
			}
		});

	}
};


AppLoader.prototype.loadVideoFromFile = function(file, mime_type, url, external_url, name, callback) {
	var _this = this;
	var video = new Videodemuxer();
	video.on('metadata', function(data) {
		var metadata = {title: "Video Player", version: "2.0.0", description: "Video player for SAGE2", author: "SAGE2", license: "SAGE2-Software-License", keywords: ["video", "movie", "player"]};
		var exif = assets.getExifData(file);

		var stretch = data.display_aspect_ratio / (data.width / data.height);
		var native_width  = data.width * stretch;
		var native_height = data.height;

		var appInstance = {
			id: null,
			title: name,
			application: "movie_player",
			icon: exif ? exif.SAGE2thumbnail : null,
			type: mime_type,
			url: external_url,
			data: {
				width: data.width,
				height: data.height,
				colorspace: "YUV420p",
				video_url: external_url,
				video_type: mime_type,
				audio_url: external_url,
				audio_type: mime_type,
				paused: true,
				frame: 0,
				numframes: data.num_frames,
				framerate: data.frame_rate,
				display_aspect_ratio: data.display_aspect_ratio,
				muted: false,
				looped: false
			},
			resrc: null,
			left:  _this.titleBarHeight,
			top:   1.5 * _this.titleBarHeight,
			width:  data.width,
			height: data.height,
			native_width:    native_width,
			native_height:   native_height,
			previous_left:   null,
			previous_top:    null,
			previous_width:  null,
			previous_height: null,
			maximized:       false,
			aspect:          native_width / native_height,
			animation:       false,
			metadata:        metadata,
			date:            new Date()
		};
		_this.scaleAppToFitDisplay(appInstance);
		callback(appInstance, video);
	});
	video.load(file, {decodeFirstFrame: true});
};


AppLoader.prototype.loadPdfFromFile = function(file, mime_type, url, external_url, name, callback) {
	// Assume default to Letter size
	var page_width  = 612;
	var page_height = 792;

	var aspectRatio = page_width/page_height;

	var metadata         = {};
	metadata.title       = "PDF Viewer";
	metadata.version     = "1.0.0";
	metadata.description = "PDF viewer for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["pdf", "document", "viewer"];

	var exif = assets.getExifData(file);

	var appInstance = {
		id: null,
		title: name,
		application: "pdf_viewer",
		icon: exif ? exif.SAGE2thumbnail : null,
		type: mime_type,
		url: external_url,
		data: {
			doc_url: external_url,
			page: 1,
			numPagesShown: 1
		},
		resrc:  null,
		left:   this.titleBarHeight,
		top:    1.5 * this.titleBarHeight,
		width:  page_width,
		height: page_height,
		native_width:    page_width,
		native_height:   page_height,
		previous_left:   null,
		previous_top:    null,
		previous_width:  null,
		previous_height: null,
		maximized: false,
		aspect:    aspectRatio,
		animation: false,
		metadata: metadata,
		sticky: false,
		annotation:true,
		date:      new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};

AppLoader.prototype.loadAppFromFileFromRegistry = function(file, mime_type, url, external_url, name, callback) {
    // Find the app!!
    var appName = registry.getDefaultApp(file);
    var instructionsFile = path.join(this.publicDir, "uploads", "apps", appName, "instructions.json");

    var _this = this;
    fs.readFile(instructionsFile, 'utf8', function(err, json_str) {
        if(err) throw err;

        var appUrl = "uploads/apps/"+appName;
		var appPath = path.join(_this.publicDir, "uploads", "apps", appName);
		var app_external_url = _this.hostOrigin + encodeReservedURL(appUrl);
		var appInstance = _this.readInstructionsFile(json_str, appPath, mime_type, app_external_url);
		appInstance.data.file = url;
		callback(appInstance);
    });
};


AppLoader.prototype.loadAppFromFile = function(file, mime_type, url, external_url, name, callback) {
	var _this = this;
	var zipFolder = file;

	var instuctionsFile = path.join(zipFolder, "instructions.json");
	fs.readFile(instuctionsFile, 'utf8', function(err, json_str) {
		if(err) throw err;

        var appInstance = _this.readInstructionsFile(json_str, zipFolder, mime_type, external_url);
		//_this.scaleAppToFitDisplay(appInstance);
		callback(appInstance);
	});
};

AppLoader.prototype.loadZipAppFromFile = function(file, mime_type, url, external_url, name, callback) {
	var _this = this;
	var zipFolder = path.join(path.dirname(file), name);

	var unzipper = new Unzip(file);
	unzipper.on('extract', function(log) {
		// read instructions for how to handle
		var instuctionsFile = path.join(zipFolder, "instructions.json");
		fs.readFile(instuctionsFile, 'utf8', function(err1, json_str) {
			if (err1) throw err1;

			assets.exifAsync([zipFolder], function(err2){
				if (err2) throw err2;

                var appInstance = _this.readInstructionsFile(json_str, zipFolder, mime_type, external_url);
				_this.scaleAppToFitDisplay(appInstance);
				callback(appInstance);
			});
		});

		// delete original zip file
		fs.unlink(file, function(err) {
			if(err) throw err;
		});
	});
	unzipper.extract({
		path: path.dirname(file),
		filter: function(extractedFile) {
			if (extractedFile.type === "SymbolicLink") return false;
			if (extractedFile.filename === "__MACOSX") return false;
			if (extractedFile.filename.substring(0, 1) === ".") return false;
			if (extractedFile.parent.length >= 8 && extractedFile.parent.substring(0, 8) === "__MACOSX") return false;

			return true;
		}
	});
};

AppLoader.prototype.createMediaStream = function(source, type, encoding, name, color, width, height, callback) {
	var aspectRatio = width/height;

	var metadata         = {};
	metadata.title       = "Stream Player";
	metadata.version     = "1.0.0";
	metadata.description = "Stream player for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["stream", "network", "player"];

	var appInstance = {
		id: null,
		title: name,
		color: color,
		application: "media_stream",
		type: "application/stream",
		url: null,
		data: {
			src: source,
			type: type,
			encoding: encoding
		},
		resrc: null,
		left: this.titleBarHeight,
		top: 1.5*this.titleBarHeight,
		width: width,
		height: height,
		native_width: width,
		native_height: height,
		previous_left: null,
		previous_top: null,
		previous_width: null,
		previous_height: null,
		maximized: false,
		aspect: aspectRatio,
		animation: false,
		sticky:false,
		metadata: metadata,
		date: new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};


AppLoader.prototype.createMediaBlockStream = function(name, color, colorspace, width, height, callback) {
	var aspectRatio = width/height;

	var metadata         = {};
	metadata.title       = "Stream Player";
	metadata.version     = "1.0.0";
	metadata.description = "Stream player for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["stream", "network", "player"];

	var appInstance = {
		id: null,
		title: name,
		color: color,
		application: "media_block_stream",
		type: "application/stream",
		url: null,
		data: {
			colorspace: colorspace || "YUV420p",
			width: width,
			height: height
		},
		resrc: null,
		left: this.titleBarHeight,
		top: 1.5*this.titleBarHeight,
		width: width,
		height: height,
		native_width: width,
		native_height: height,
		previous_left: null,
		previous_top: null,
		previous_width: null,
		previous_height: null,
		maximized: false,
		aspect: aspectRatio,
		animation: false,
		sticky:false,
		metadata: metadata,
		date: new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};

AppLoader.prototype.loadApplicationFromRemoteServer = function(application, callback) {
	this.loadApplication({location: "remote", application: application}, callback);
	/*
	var _this = this;
	this.loadApplication({location: "remote", application: application}, function(appInstance, videohandle) {
		// cannot use same video url source for youtube
		// must dynamically generate new one
		if(application.type === "video/youtube") {
			_this.loadYoutubeFromURL(application.url, function(youtubeApp) {
				appInstance.data.src = youtubeApp.data.src;
				callback(appInstance, videohandle);
			});
		}
		else if(application.type === "video/youtube")
		else {
			callback(appInstance, videohandle);
		}
	});
	*/
};

AppLoader.prototype.loadFileFromWebURL = function(file, callback) {
	// XXX - Will this work with our custom apps?
    var mime_type = file.type;
	var filename = decodeURI(file.url.substring(file.url.lastIndexOf("/")+1));

	this.loadApplication({location: "url", url: file.url, type: mime_type, name: filename, strictSSL: false}, callback);

};

AppLoader.prototype.loadFileFromLocalStorage = function(file, callback) {
	var dir = registry.getDirectory(file.filename);
	var url = "uploads/"+dir+"/"+file.filename;
	var external_url = this.hostOrigin + encodeReservedURL(url);
	var localPath = path.join(this.publicDir, "uploads", dir, file.filename);
	var mime_type = mime.lookup(localPath);
	
	this.loadApplication({location: "file", path: localPath, url: url, external_url: external_url, type: mime_type, name: file.filename, compressed: false}, function(appInstance, handle) {
		callback(appInstance, handle);
	});
};

AppLoader.prototype.manageAndLoadUploadedFile = function(file, callback) {
    var mime_type = mime.lookup(file.name);
	var app = registry.getDefaultApp(file.name);
	if (app === undefined || app === "") { callback(null); return; }

    var dir = registry.getDirectory(file.name);

	var _this = this;
    if (!fs.existsSync(path.join(this.publicDir, "uploads", dir))) {
        fs.mkdirSync(path.join(this.publicDir, "uploads", dir));
    }
	var url = "uploads/"+dir+"/"+file.name;
	var external_url = this.hostOrigin + encodeReservedURL(url);
	var localPath = path.join(this.publicDir, "uploads", dir, file.name);

	// Filename exists, then add date
	if (sageutils.fileExists(localPath)) {
		// Add the date to filename
		var filen  = file.name;
		var splits = filen.split('.');
		var extension   = splits.pop();
		var newfilename = splits.join('_') + "_" + Date.now() + '.' + extension;
		// Regenerate path and url
		url = "uploads/"+dir+"/"+newfilename;
		external_url = this.hostOrigin + encodeReservedURL(url);
		localPath    = path.join(this.publicDir, "uploads", dir, newfilename);
	}

	fs.rename(file.path, localPath, function(err1) {
		if (err1) throw err1;

		if (app === "image_viewer" || app === "movie_player" || app === "pdf_viewer") {
			exiftool.file(localPath, function(err2, data) {
				if (err2) {
					console.log("internal error", err2);
				} else {
					console.log("EXIF> Adding", data.FileName);
					assets.addFile(data.SourceFile, data, function() {
						_this.loadApplication({location: "file", path: localPath, url: url, external_url: external_url, type: mime_type, name: file.name, compressed: true}, function(appInstance, handle) {
							callback(appInstance, handle);
						});
					});
				}
			});
		}
		else {
			_this.loadApplication({location: "file", path: localPath, url: url, external_url: external_url, type: mime_type, name: file.name, compressed: true}, function(appInstance, handle) {
				callback(appInstance, handle);
			});
		}
	});
};
AppLoader.prototype.createNewNoteFromText = function(data, callback) {
	var url = "uploads/"+data.dir+"/"+data.fileName;
	var external_url = this.hostOrigin + encodeReservedURL(url);

	// Assume default to Letter size
	var page_width  = 300;
	var page_height = 300;

	var aspectRatio = page_width/page_height;

	var metadata         = {};
	metadata.title       = "Sticky Note";
	metadata.version     = "1.0.0";
	metadata.description = "Note taking tool for SAGE2";
	metadata.author      = "SAGE2";
	metadata.license     = "SAGE2-Software-License";
	metadata.keywords    = ["text", "document", "editor"];

	//var exif = assets.getExifData(file);

	var appInstance = {
		id: null,
		title: data.fileName? data.fileName : "Sticky Note",
		application: "sticky_note",
		icon: null,//exif ? exif.SAGE2thumbnail : null,
		type: "application",
		url: external_url,
		data: {
			owner:data.user,
			createdOn: data.date,
			buffer: data.text,
			caretPos: data.text.length,
			bufferEmpty: (data.text.length === 0),
			fontSize: "16px",
			fileName: data.fileName? data.fileName : "Sticky Note"
		},
		resrc:  null,
		left:   this.titleBarHeight,
		top:    1.5 * this.titleBarHeight,
		width:  page_width,
		height: page_height,
		native_width:    page_width,
		native_height:   page_height,
		previous_left:   null,
		previous_top:    null,
		previous_width:  null,
		previous_height: null,
		maximized: false,
		aspect:    aspectRatio,
		animation: false,
		metadata: metadata,
		sticky: true,
		annotation:false,
		date:      new Date()
	};
	this.scaleAppToFitDisplay(appInstance);
	callback(appInstance);
};
AppLoader.prototype.loadApplication = function(appData, callback) {
	var app, dir;
	if (appData.location === "file") {
		app = registry.getDefaultAppFromMime(appData.type);
		dir = registry.getDirectory(appData.type);

		if (app === "image_viewer") {
			this.loadImageFromFile(appData.path, appData.type, appData.url, appData.external_url, appData.name, function(appInstance) {
				callback(appInstance, null);
			});
		}
		else if (app === "movie_player") {
			this.loadVideoFromFile(appData.path, appData.type, appData.url, appData.external_url, appData.name, function(appInstance, handle) {
				callback(appInstance, handle);
			});
		}
		else if (app === "pdf_viewer") {
			this.loadPdfFromFile(appData.path, appData.type, appData.url, appData.external_url, appData.name, function(appInstance) {
				callback(appInstance, null);
			});
		}
		else if (app === "custom_app") {
			if (appData.compressed === true) {
				var name = path.basename(appData.name, path.extname(appData.name));
				var url = "uploads/"+dir+"/"+name;
				var external_url = this.hostOrigin + encodeReservedURL(url);
				this.loadZipAppFromFile(appData.path, appData.type, url, external_url, name, function(appInstance) {
					callback(appInstance, null);
				});
			}
			else {
				this.loadAppFromFile(appData.path, appData.type, appData.url, appData.external_url, appData.name, function(appInstance) {
					callback(appInstance, null);
				});
			}
		}
        else {
            this.loadAppFromFileFromRegistry(appData.path, appData.type, appData.url, appData.external_url, appData.name, function(appInstance) {
                callback(appInstance);
            });
        }
	}

	else if(appData.location === "url") {
		app = registry.getDefaultAppFromMime(appData.type);

		if (app === "image_viewer") {
			this.loadImageFromURL(appData.url, appData.type, appData.name, appData.strictSSL, function(appInstance) {
				callback(appInstance, null);
			});
		}
		else if (app === "movie_player") {
			if (appData.type === "video/youtube") {
				this.loadYoutubeFromURL(appData.url, function(appInstance, handle) {
					callback(appInstance, handle);
				});
			}
			else {
				// Fixed size since cant process exif on URL yet
				this.loadVideoFromURL(appData.url, appData.type, appData.url, appData.name, function(appInstance, handle) {
					callback(appInstance, handle);
				});
			}
		}
		else if (app === "pdf_viewer") {
			this.loadPdfFromURL(appData.url, appData.type, appData.name, appData.strictSSL, function(appInstance) {
				callback(appInstance, null);
			});
		}
	}

	else if (appData.location === "remote") {
		if (appData.application.application === "movie_player") {
			if (appData.application.type === "video/youtube") {
				this.loadYoutubeFromURL(appData.application.url, callback);
			}
			else {
				this.loadVideoFromURL(appData.application.url, appData.application.type, appData.application.url, appData.application.title, callback);
			}
		}
		else {
			var anInstance = {
				id: appData.application.id,
				title: appData.application.title,
				application: appData.application.application,
				type: appData.application.type,
				url: appData.application.url,
				data: appData.application.data,
				resrc: appData.application.resrc,
				left: this.titleBarHeight,
				top: 1.5*this.titleBarHeight,
				width: appData.application.native_width,
				height: appData.application.native_height,
				native_width: appData.application.native_width,
				native_height: appData.application.native_height,
				previous_left: null,
				previous_top: null,
				previous_width: null,
				previous_height: null,
				maximized: false,
				aspect: appData.application.aspect,
				animation: appData.application.animation,
				metadata: appData.application.metadata,
				sticky:appData.application.sticky,
				date: new Date()
			};
			if(appData.application.application === "pdf_viewer") {
				anInstance.data.doc_url = anInstance.url;
			}

			this.scaleAppToFitDisplay(anInstance);
			callback(anInstance, null);
		}
	}
};

AppLoader.prototype.readInstructionsFile = function(json_str, file, mime_type, external_url) {
    var instructions = JSON.parse(json_str);
    var appName = instructions.main_script.substring(0, instructions.main_script.lastIndexOf('.'));
    var aspectRatio = instructions.width / instructions.height;

    var resizeMode = "proportional";
    if (instructions.resize !== undefined && instructions.resize !== null && instructions.resize !== "")
        resizeMode = instructions.resize;

    var exif = assets.getExifData(file);

    return {
        id: null,
        title: exif.metadata.title,
        application: appName,
        icon: exif ? exif.SAGE2thumbnail : null,
        type: mime_type,
        url: external_url,
        data: instructions.load,
        resrc: instructions.dependencies,
        left: this.titleBarHeight,
        top: 1.5*this.titleBarHeight,
        width: instructions.width,
        height: instructions.height,
        native_width: instructions.width,
        native_height: instructions.height,
        previous_left: null,
        previous_top: null,
        previous_width: null,
        previous_height: null,
        maximized: false,
        aspect: aspectRatio,
        animation: instructions.animation,
        metadata: exif.metadata,
        resizeMode: resizeMode,
        sticky:instructions.sticky,
        date: new Date()
    };
};

//////////////////////////////////////////////////////////////////////////////////////////

module.exports = AppLoader;
