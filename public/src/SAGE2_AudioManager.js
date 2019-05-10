// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-15

/* global createjs */
"use strict";

/**
 * SAGE2 Audio Manager, renders the audio streams for a given site
 *
 * @module client
 * @submodule SAGE2_AudioManager
 * @class SAGE2_AudioManager
 */

// Global variable (needed by runtime)
var hostAlias = {};
// Websocket handle
var wsio;
// default settings for applications
var autoplay = false;
var initialVolume = 8;
// WebAudio API variables
var audioCtx, channelCount;
var channelMerger;
var leftSpeakers = {};
var rightSpeakers = {};
var audioGainNodes   = {};
var audioPannerNodes = {};
var speakerWalls = [];
var wallsSpeakers = []; //this array keeps track of how many speakers are on each wall. For example: if there are 4 walls with 3 speakers on each will this array will be [3,3,3,3]
var wallOffsets = []; //this array keeps track of how many outputs are before each wall. For example: if there are 4 walls with 3 speakers this array will be [0,3,6,9] This is needed so that when a wall other than 0 is in use, you know where it's speakers start in the output array.
var wallInUse = 1;

// Number of sound instances being played at once
var numberOfSounds    = 0;

// folder for audio files (relative to public/)
var audioPath   = "sounds/";

// Explicitely close web socket when web browser is closed
window.onbeforeunload = function() {
	if (wsio !== undefined) {
		wsio.close();
	}
};

/**
 * When the page loads, starts the audio manager
 *
 */
window.addEventListener('load', function(event) {
	SAGE2_init();
});

/**
 * Entry point of the application
 *
 * @method SAGE2_init
 */
function SAGE2_init() {
	// Detect which browser is being used
	SAGE2_browser();

	wsio = new WebsocketIO();

	wsio.open(function() {
		console.log("Websocket opened");

		setupListeners();

		// Get the cookie for the session, if there's one
		var session = getCookie("session");

		var clientDescription = {
			clientType: "audioManager",
			requests: {
				config:  true,
				version: false,
				time:    false,
				console: false
			},
			session: session
		};
		wsio.emit('addClient', clientDescription);
	});

	// Socket close event (ie server crashed)
	wsio.on('close', function(evt) {
		var i, tracks;

		// Pause all video tracks
		tracks = document.getElementsByTagName('video');
		for (i = 0; i < tracks.length; i++) {
			if (tracks[i].parentNode) {
				tracks[i].pause();
				// tracks[i].parentNode.removeChild(tracks[i]);
			}
		}

		// Pause all audio tracks
		tracks = document.getElementsByTagName('audio');
		for (i = 0; i < tracks.length; i++) {
			if (tracks[i].parentNode) {
				tracks[i].pause();
				// tracks[i].parentNode.removeChild(tracks[i]);
			}
		}

		// Play an audio blop
		createjs.Sound.play("down");

		// Try to reload
		var refresh = setInterval(function() {
			// make a dummy request to test the server every 2 sec
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "/", true);
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4 && xhr.status === 200) {
					console.log("server ready");
					// when server ready, clear the interval callback
					clearInterval(refresh);
					// and reload the page
					if (__SAGE2__.browser.isFirefox) {
						var main = document.getElementById('main');
						while (main.firstChild) {
							main.removeChild(main.firstChild);
						}
						window.open(window.location, '_blank');
					} else {
						window.location.reload();
					}
				}
			};
			xhr.send();
		}, 2000);
	});
}

//this function sets up how many speakers are on each wall
//the wall that is currently in use is stored in the variable wallInUse and by default is 1
function routeSpeakers() {
	var speakerOrderingFromHTML = document.getElementById("speakerWalls").value;
	speakerWalls = speakerOrderingFromHTML.split(',');
	console.log("Speaker Wall Ordering: ");

	var totalSpeakers = 0;
	for(var wall = 0; wall < speakerWalls.length; wall++) //for each wall
	{
		for(var wallsSpeaker = 0; wallsSpeaker < speakerWalls[wall]; wallsSpeaker++) //for each speaker on each wall
		{
			totalSpeakers++;
			wallsSpeakers[totalSpeakers] = wall + +1; //speaker 'totalSpeakers' is on wall 'wall'
			console.log((wallsSpeaker + +1) + "-th Speaker " + totalSpeakers + " set to wall: " + wallsSpeakers[totalSpeakers]);
		}
	}

	
	for(var w = 0; w < speakerWalls.length; w++)
	{
		if(w!=0)
			wallOffsets[w] = wallOffsets[w - 1] + +speakerWalls[w - 1];
		else
			wallOffsets[w] = 0;
		console.log("wall offsets for wall" + w + ": " + wallOffsets[w]);
	}
}
//plays the sage 2 uitility sounds taking the file name, data object, and volume (float from 0.0-1.0)
//called from createAppWindow and deleteElement socket events

//this function was playing the sound out of the correct location, but for some unknown reason
//the sound was dropping out
function playUtilitySound(soundFileName, data, volume) {
	var panX, deleteSound, channelToPlaySound;
	channelToPlaySound = leftSpeakers[data];
	if(channelToPlaySound < wallOffsets[wallInUse])
		channelToPlaySound = wallOffsets[wallInUse];
	//console.log("channelToPlaySound in playUtilitySound " + channelToPlaySound);
	audioCtx.audioWorklet.addModule('/src/panX.js').then(() => {
			//console.log("top of add audioworklet");
			panX = new AudioWorkletNode(audioCtx, 'panX', {
				channelCount: channelCount,
				channelCountMode: 'explicit',
				channelInterpretation: 'discrete'
			});
			panX.port.onmessage = (event) => {
				// Handling data from the processor.
				//console.log(event.data);
			};
			panX.port.postMessage(true);
		});
		var source = audioCtx.createBufferSource();
		var request = new XMLHttpRequest();
		var URL = audioPath + soundFileName + ".mp3";
		request.open('GET', URL, true);
		
		request.responseType = 'arraybuffer';
		request.onload = function() {
			var audioData = request.response;

			audioCtx.decodeAudioData(audioData, function(buffer) {
				source.buffer = buffer;
				
				//connect to panning algorithm and then to Audio Context Destination:
				// source.connect(panX);
				// panX.connect(audioCtx.destination);
				
				var gainNode = audioCtx.createGain();
				gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
				source.connect(gainNode);
				gainNode.connect(audioCtx.destination);
				
				//set volume using volume argument
				// let volumeParameter = panX.parameters.get('gain');
				// volumeParameter.setTargetAtTime(volume, audioCtx.currentTime, 0);
			},

			function(e){ console.log("Error with decoding audio data" + e.err); });
		}
		request.send();
		source.start(0);
		source.stop(audioCtx.currentTime + 0.5);

  
	// window.fetch(URL)
		// .then(response => response.arrayBuffer())
		// .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
		// .then(audioBuffer => {
			// //console.log("in audiobuffer then ");
			// let source = audioCtx.createBufferSource();
			// source.buffer = audioBuffer;
			// source.connect(panX);
			// panX.connect(audioCtx.destination);
			// let leftSpeakerParameter = panX.parameters.get('leftChannel'); //just get left channel because Utility sounds are mono
			// let volumeParameter = panX.parameters.get('gain');
			// volumeParameter.setTargetAtTime(volume, audioCtx.currentTime, 0);
			// leftSpeakerParameter.setTargetAtTime(channelToPlaySound, audioCtx.currentTime, 0);
			// source.start();
			// source.addEventListener('ended', (event) => {
				// numberOfSounds = numberOfSounds - 1;
			// });
		// });
}


function setupListeners() {
	// wall values
	var totalWidth;

	wsio.on('initialize', function(data) {
		// Reset the counter for number sounds
		numberOfSounds = 0;
	});

	wsio.on('setupDisplayConfiguration', function(json_cfg) {
		var i;
		var http_port;
		var https_port;

		http_port  = json_cfg.port === 80 ? "" : ":" + json_cfg.port;
		https_port = json_cfg.secure_port === 443 ? "" : ":" + json_cfg.secure_port;
		hostAlias["http://"  + json_cfg.host + http_port]  = window.location.origin;
		hostAlias["https://" + json_cfg.host + https_port] = window.location.origin;
		for (i = 0; i < json_cfg.alternate_hosts.length; i++) {
			hostAlias["http://"  + json_cfg.alternate_hosts[i] + http_port]  = window.location.origin;
			hostAlias["https://" + json_cfg.alternate_hosts[i] + https_port] = window.location.origin;
		}

		// Load the initial volume value from the configuration object
		if (json_cfg.audio && json_cfg.audio.initialVolume !== undefined) {
			// Making sure the value is between 0 and  10
			initialVolume = parseInt(json_cfg.audio.initialVolume, 10);
			initialVolume = Math.max(Math.min(initialVolume, 10), 0);
			console.log("Configuration> initialVolume = ", initialVolume);
		}

		// Select the jinggle sound (default or configuration file)
		// var jingle = "sage2_jinggle.mp3";
		// var jingle = "kola-startup.mp3";
		// var jingle = "blues_lick_in_a.mp3";
		var jingle = "waipio-jingle.mp3";
		if (json_cfg.ui.startup_sound) {
			// use the jingle file if specificied in configuration file
			jingle = json_cfg.ui.startup_sound;
		}

		// folder for audio files (relative to public/)
		var audioPath   = "sounds/";
		// Default settings
		var defaults =  {
			volume: initialVolume / 20, // volume [0:1] - value 0-10 and half volume for special effects
			delay:  0, // amount of time to delay the start of audio playback, in milliseconds
			loop:   0, // times the audio loops when it reaches the end of playback, 0 no loops, -1 infinite
			offset: 0, // offset from the start of the audio to begin playback, in milliseconds
			pan:    0  // left-right pan of the sound, -1 (left) and 1 (right).
		};
		var lowdefaults =  {
			volume: initialVolume / 80, // low volume for some events
			delay:  0, loop:   0,
			offset: 0, pan:    0
		};
		// Array of assets to preload
		var soundAssets = [
			{id: "startup",   src: "sage 2 startup sound.wav",          defaultPlayProps: defaults},
			{id: "newapp",    src: "newapp2.mp3",   defaultPlayProps: defaults},
			{id: "deleteapp", src: "deleteapp.mp3", defaultPlayProps: defaults},
			{id: "remote",    src: "remote.mp3",    defaultPlayProps: lowdefaults},
			{id: "send",      src: "send.mp3",      defaultPlayProps: defaults},
			{id: "down",      src: "down.mp3",      defaultPlayProps: lowdefaults}
		];

		// Main audio context (for low-level operations)
		audioCtx = new(window.AudioContext || window.webkitAudioContext)();
		audioCtx.listener.setPosition(0, 0, 0);
		channelCount = audioCtx.destination.maxChannelCount;
		audioCtx.destination.channelCount = channelCount;
		console.log("Total Number of Available Output Channels: " + channelCount);
		console.log("Audio Context Sample Rate: " + audioCtx.sampleRate);

		//create merger and connect it to destination to re order outputs for various speaker setups
		totalWidth  = json_cfg.totalWidth;
		
		// Play startup sound
	});

	wsio.on('createAppWindow', function(data) {
		leftSpeakers[data.id] = wallOffsets[wallInUse]; //update the leftSpeaker set so that we know what speaker to play the utility sound out of
		playUtilitySound("newapp2", data.id, 0.20);

		if (data.application === "movie_player") {
			var main = document.getElementById('main');
			var videosTable = document.getElementById('videos');

			var vid;
			if (__SAGE2__.browser.isFirefox || isFileTypeSupportedByHtmlPlayer(data.data.audio_url)) {
				// Firefox seems to crash with audio elements, html player also uses this
				vid = document.createElement('video');
				window.vidRef = vid;
				vid.isUsingHtmlPlayer = true;
			} else {
				vid = document.createElement('audio');
			}
			vid.id            = data.id;
			// vid.volume        = initialVolume / 10;
			vid.firstPlay     = true;
			vid.startPaused   = data.data.paused;
			vid.controls      = false;
			vid.style.display = "none";
			vid.crossOrigin   = "anonymous";
			vid.addEventListener('canplaythrough', function() {
				// Video is loaded and can be played
				if (vid.firstPlay && vid.sessionTime) {
					// Update the local time
					vid.currentTime = vid.sessionTime;
				}
				vid.firstPlay = false;
				if (autoplay === true) {
					playVideo(data.id);
				}
			}, false);
			vid.addEventListener('ended', function() {
				if (autoplay === true) {
					vid.currentTime = 0;
				}
			}, false);
			vid.addEventListener('timeupdate', function() {
				var vid_time = document.getElementById(data.id + "_time");
				if (vid_time) {
					// time second, converted to millis, and to string
					vid_time.textContent = formatHHMMSS(1000.0 * vid.currentTime);
				}
			}, false);

			var url    = cleanURL(data.data.audio_url);
			var source = document.createElement('source');
			var param  = url.indexOf('?');

			// Remove the URL params when using the html player.
			if (vid.isUsingHtmlPlayer) {
				source.src = url;
				//console.log(url);
			} else if (param >= 0) {
				source.src = url + "&clientID=audio";
			} else {
				source.src = url + "?clientID=audio";
			}
			// Having the audio type interferes with playback on certain video types. Probably alters how file is read.
			if (!vid.isUsingHtmlPlayer) {
				source.type = data.data.audio_type;
			}
			vid.appendChild(source);

			// WebAudio API
			//here is where the AudioWorklet is used.
			var audioSource = audioCtx.createMediaElementSource(vid);
			var gainNode    = audioCtx.createGain();
			audioGainNodes[vid.id] = gainNode;	
			//this creates the audioworklet panning algorithm (panx)
			audioCtx.audioWorklet.addModule('/src/panX.js').then(() => {
				let panX = new AudioWorkletNode(audioCtx, 'panX', {
					channelCount: channelCount,
					channelCountMode: 'explicit',
					channelInterpretation: 'discrete'
				});

				audioPannerNodes[vid.id] = panX;
				leftSpeakers[vid.id] = 0;
				rightSpeakers[vid.id] = 0;

				// source -> gain -> pan -> speakers
				audioSource.connect(gainNode);
				gainNode.connect(panX);
				panX.connect(audioCtx.destination);
			});
			// webaudio end

			var videoRow = document.createElement('tr');
			videoRow.className = "rowNoBorder";
			videoRow.id  = data.id + "_row";

			var icon = document.createElement('td');
			icon.setAttribute("rowspan", 2);
			var link = document.createElement("img");
			if (data.icon) {
				link.src = data.icon + '_256.jpg';
			} else {
				link.src = "images/unknownapp_256.jpg";
			}
			link.width = 120;
			icon.appendChild(link);

			var title    = document.createElement('td');
			title.id     = data.id + "_title";
			title.className   = "videoTitle";
			title.textContent = data.title;

			var time = document.createElement('td');
			time.id  = data.id + "_time";
			time.className   = "videoTime";
			time.textContent = "00:00:00";

			var play = document.createElement('td');
			play.id  = data.id + "_play";
			play.className   = "videoPlay";
			play.textContent = "Paused";

			var volumeMute   = document.createElement('td');
			volumeMute.id    = data.id + "_mute";
			volumeMute.className = "videoVolumeMute";
			volumeMute.innerHTML = "&#x2713;";

			videoRow.appendChild(icon);
			videoRow.appendChild(title);
			videoRow.appendChild(time);
			videoRow.appendChild(volumeMute);
			videoRow.appendChild(play);

			var videoRow2 = document.createElement('tr');
			videoRow2.className = "rowWithBorder";
			videoRow2.id  = data.id + "_row2";

			var volume = document.createElement('td');
			volume.setAttribute("colspan", 4);
			volume.id  = data.id + "_volume";
			volume.className = "videoVolume";
			var volumeSlider = document.createElement('input');
			volumeSlider.id  = data.id + "_volumeSlider";
			volumeSlider.className = "videoVolumeSlider";
			volumeSlider.type  = "range";
			volumeSlider.appid = data.id;
			volumeSlider.min   = 0;
			volumeSlider.max   = 1;
			volumeSlider.step  = 0.05;
			// Set the initial value
			volumeSlider.value = initialVolume / 10;
			// Setup a callback for slider
			volumeSlider.addEventListener('input', changeVolume, false);
			// set the initial volume
			changeVolume({target: volumeSlider});
			// Add slider to the DOM
			volume.appendChild(volumeSlider);

			videoRow2.appendChild(volume);

			main.appendChild(vid);
			videosTable.appendChild(videoRow);
			videosTable.appendChild(videoRow2);
		}
	});

	wsio.on('setItemPosition', function (data) {
		if (audioPannerNodes[data.elemId]) {
			// Calculate center of the application window
			var halfTotalWidth = totalWidth / 2;
			var centerX = data.elemLeft + data.elemWidth / 2 - halfTotalWidth;
			if (centerX < -totalWidth) {
				centerX = -totalWidth;
			}
			if (centerX > totalWidth) {
				centerX = totalWidth;
			}
			// Update the panner position
			var panX = centerX / totalWidth;
			var panY = 0;
			var panZ = 1 - Math.abs(panX);
			var panNode = audioPannerNodes[data.elemId];
			
			var gain = panNode.parameters.get('gain');
			var leftSpeakerParameter = panNode.parameters.get('leftChannel');
			var rightSpeakerParameter = panNode.parameters.get('rightChannel');
			
			//speaker to play the left channel of the audio
			var leftChannel = Math.floor((data.elemLeft / totalWidth) * speakerWalls[wallInUse]) + +wallOffsets[wallInUse];

			//make sure it's not outside of the output range
			if(leftChannel < 0)
				leftChannel = 0;
			if(rightChannel < 0)
				rightChannel = 0;
			if(rightChannel == leftChannel)
				rightChannel = leftChannel + +1;
			if(leftChannel == channelCount)
				leftChannel = channelCount - +1;
			if(rightChannel == channelCount)
				rightChannel = channelCount - +1;
			
			gain.setTargetAtTime(1, audioCtx.currentTime, 0);
			if(leftChannel != leftSpeakers[data.elemId] || rightChannel != rightSpeakers[data.elemId])
			{
				leftSpeakers[data.elemId] = leftChannel;
				rightSpeakers[data.elemId] = rightChannel;
				leftSpeakerParameter.setTargetAtTime(leftChannel, audioCtx.currentTime, 0);
				rightSpeakerParameter.setTargetAtTime(rightChannel, audioCtx.currentTime, 0);
			}
		}
	});

	wsio.on('setItemPositionAndSize', function (data) {
		if (audioPannerNodes[data.elemId]) {
			// Calculate center of the application window
			var halfTotalWidth = totalWidth / 2;
			var centerX = data.elemLeft + data.elemWidth / 2 - halfTotalWidth;
			if (centerX < -totalWidth) {
				centerX = -totalWidth;
			}
			if (centerX > totalWidth) {
				centerX = totalWidth;
			}
			// Update the panner position
			var panX = centerX / totalWidth;
			var panY = 0;
			var panZ = 1 - Math.abs(panX);
			var panNode = audioPannerNodes[data.elemId];
			
			var gain = panNode.parameters.get('gain');
			var leftSpeakerParameter = panNode.parameters.get('leftChannel');
			var rightSpeakerParameter = panNode.parameters.get('rightChannel');
			
			var leftChannel = Math.floor((data.elemLeft / totalWidth) * speakerWalls[wallInUse]) + +wallOffsets[wallInUse];
			var rightChannel = Math.floor(((data.elemLeft + data.elemWidth) / totalWidth) * speakerWalls[wallInUse]) + +wallOffsets[wallInUse];
			if(leftChannel < 0)
				leftChannel = 0;
			if(rightChannel < 0)
				rightChannel = 0;
			if(rightChannel == leftChannel)
				rightChannel = leftChannel + +1;
			if(leftChannel == channelCount)
				leftChannel = channelCount - +1;
			if(rightChannel == channelCount)
				rightChannel = channelCount - +1;

			if(leftChannel != leftSpeakers[data.elemId] || rightChannel != rightSpeakers[data.elemId])
			{
				leftSpeakers[data.elemId] = leftChannel;
				rightSpeakers[data.elemId] = rightChannel;
				leftSpeakerParameter.setTargetAtTime(leftChannel, audioCtx.currentTime, 0);
				rightSpeakerParameter.setTargetAtTime(rightChannel, audioCtx.currentTime, 0);
			}
		}
	});

	wsio.on('setVolume', function(data) {
		// Get the slider element
		var slider = document.getElementById(data.id + "_volumeSlider");
		// Change its value
		slider.value = data.level;
		// Go change the actual volume (gain)
		changeVideoVolume(data.id, data.level);
	});

	wsio.on('videoPlaying', function(data) {
		var vid = document.getElementById(data.id);
		if (vid) {
			vid.play();
		}
		var vid_play = document.getElementById(data.id + "_play");
		if (vid_play) {
			vid_play.textContent = "Playing";
		}
	});

	wsio.on('videoPaused', function(data) {
		var vid      = document.getElementById(data.id);
		var vid_play = document.getElementById(data.id + "_play");
		if (vid) {
			vid.pause();
		}
		if (vid_play) {
			vid_play.textContent = "Paused";
		}
	});

	wsio.on('videoEnded', function(data) {
		var vid      = document.getElementById(data.id);
		var vid_play = document.getElementById(data.id + "_play");
		if (vid) {
			vid.pause();
		}
		if (vid_play) {
			vid_play.textContent = "Paused";
		}
	});

	wsio.on('videoMuted', function(data) {
		var vid      = document.getElementById(data.id);
		var vid_mute = document.getElementById(data.id + "_mute");
		if (vid) {
			vid.muted = true;
		}
		if (vid_mute) {
			vid_mute.innerHTML = "&#x2717;";
		}
	});

	wsio.on('videoUnmuted', function(data) {
		var vid      = document.getElementById(data.id);
		var vid_mute = document.getElementById(data.id + "_mute");
		if (vid) {
			vid.muted = false;
		}
		if (vid_mute) {
			vid_mute.innerHTML = "&#x2713;";
		}
	});

	wsio.on('updateVideoItemTime', function(data) {
		var vid = document.getElementById(data.id);
		if (vid) {
			if (vid.firstPlay) {
				// if not fully loaded, just store the time
				vid.sessionTime = data.timestamp;
			} else {
				vid.currentTime = data.timestamp;
			}

			if (data.play) {
				vid.play();
			} else {
				vid.pause();
			}
		}
	});

	wsio.on('deleteElement', function(data) {
		// Limit the number of sounds
		numberOfSounds = numberOfSounds + 1;

		// Play an audio blop
		var deleteSound = createjs.Sound.play("deleteapp");

		// Callback when sound is done playing
		deleteSound.on('complete', function(evt) {
			numberOfSounds = numberOfSounds - 1;
		});

		// Stop video
		var vid = document.getElementById(data.elemId);
		if (vid) {
			vid.pause();
		}

		// Clean up the DOM
		deleteElement(data.elemId);
		deleteElement(data.elemId + "_row");
		deleteElement(data.elemId + "_row2");

		// Delete also the webaudio nodes
		delete audioPannerNodes[data.elemId];
		delete audioGainNodes[data.elemId];
		delete leftSpeakers[data.elemId];
		delete rightSpeakers[data.elemId];
	});

	wsio.on('connectedToRemoteSite', function(data) {
		// Play an audio blop when a remote site comes up or down
		if (data.connected === "on") {
			createjs.Sound.play("remote");
		}
		if (data.connected === "off") {
			createjs.Sound.play("down");
		}
	});

	wsio.on('setAppSharingFlag', function(data) {
		// Play an audio blop when sending an app to a remote site
		if (data.sharing) {
			createjs.Sound.play("send");
		}
	});

}


/**
 * Handler for the volume slider
 *
 * @method changeVolume
 * @param event {Event} event data
 */
function changeVolume(event) {
	var volumeSlider = event.target;
	var vol = volumeSlider.value;
	wsio.emit("setVolume", {id: volumeSlider.appid, level: vol});

	// Dont need to change volume since the server will send message
	// changeVideoVolume(volumeSlider.appid, vol);
}

/**
 * Change the volume of a video
 *
 * @method changeVideoVolume
 * @param videoId {String} id of the video
 * @param volume {Number} new volume value
 */
function changeVideoVolume(videoId, volume) {
	// Change the gain (0 to 1)
	audioGainNodes[videoId].gain.value = volume;
}

/**
 * Play a video
 *
 * @method playVideo
 * @param videoId {String} id of the video
 */
function playVideo(videoId) {
	wsio.emit('playVideo', {id: videoId});
}

/**
 * Uptime video time
 *
 * @method updateVideotime
 * @param videoId {String} id of the video
 */
function updateVideotime(videoId, timestamp, play) {
	wsio.emit('updateVideoTime', {id: videoId, timestamp: timestamp, play: play});
}

/**
 * Checks if the filetype is supported by the html player
 *
 * @method isFileTypeSupportedByHtmlPlayer
 * @param file {String} url path of the file
 */
function isFileTypeSupportedByHtmlPlayer(file) {
	// supportedTypes based on https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
	let supportedTypes = ["webm", "ogg", "mp4", "mov"]; // flac
	let ext = file.lastIndexOf(".");
	if (ext > -1) {
		ext = file.substring(ext + 1);
		ext = ext.trim().toLowerCase();
		for (let i = 0; i < supportedTypes.length; i++) {
			if (ext === supportedTypes[i]) {
				//console.log("Extension " + file + " supported by html player");
				return true;
			}
		}
		//console.log("Extension " + file + " didn't match any of the known player formats: " + supportedTypes);
	} else {
		//console.log("No extension in: " + file);
	}
	return false;
}