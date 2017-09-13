// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-17

"use strict";

/* global showSAGE2Message */

var SAGE2_speech = {};
SAGE2_speech.hasInit            = false;
SAGE2_speech.webkitSR           = null;
SAGE2_speech.recognizing        = false;
SAGE2_speech.final_transcript   = false;
SAGE2_speech.interim_transcript = false;
SAGE2_speech.firstNameMention   = false;
SAGE2_speech.nameMarker         = "sage "; // should be set by server, this space is critical
SAGE2_speech.errorNotAllowed    = false;
SAGE2_speech.errorCount         = -1;
SAGE2_speech.errorTime          = null; // can probably get away without using time for now
SAGE2_speech.interimStart       = -1;
SAGE2_speech.interimId          = null;
// restart listener for mouse hold
SAGE2_speech.mouseHoldTimeNeeded = 800; // ms
SAGE2_speech.mouseHoldTimeoutId  = null;
SAGE2_speech.mouseHoldActivated  = false;
SAGE2_speech.mouseHoldStartPos   = {x: -100, y: -100};
SAGE2_speech.mouseHoldMoveLimit  = {x: 20, y: 20};
// listening variables
SAGE2_speech.showListening      = false;
SAGE2_speech.listentingInfo     = null;
SAGE2_speech.mousePosition      = {x: window.innerWidth / 2, y: 0};
// speech synthesis
SAGE2_speech.ttsConverter       = null;
SAGE2_speech.synth              = null;
SAGE2_speech.voices             = null;


/**
 * Intializes the speech recognition object.
 *
 * @method init
 */
SAGE2_speech.init = function() {
	// console.log("SAGE2_speech init()");
	if (!("webkitSpeechRecognition" in window)) {
		console.log("This browser doesn't support webkitSpeechRecognition, updated Chrome needed");
	} else {
		console.log("webkitSpeechRecognition exists beginning setup");
		// the contructor is actually lower case
		this.webkitSR = new webkitSpeechRecognition(); // eslint-disable-line
		this.webkitSR.continuous = true;
		this.webkitSR.interimResults = true;

		this.webkitSR.onstart = function() {
			console.log("SAGE2_speech started");
			this.recognizing = true;
			// cleanup variables
			SAGE2_speech.showListening = false;
			SAGE2_speech.firstNameMention = false;
		};

		this.initMouseholdToStart();
		this.speechSynthesisInit();
		this.listeningVisualInit();

		/*
			After getting a result, but this also includes pieces that aren't detected as full sentences.
		*/
		this.webkitSR.onresult = function(event) {
			this.interim_transcript = " ";
			for (var i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					this.final_transcript = event.results[i][0].transcript;
					if (SAGE2_speech.mouseHoldActivated
						&& !this.final_transcript.toLowerCase().includes(SAGE2_speech.nameMarker)) {
						this.final_transcript = SAGE2_speech.nameMarker + this.final_transcript;
					}
					console.log("final_transcript(" + event.results[i][0].confidence + "%):" + this.final_transcript);

					// set for later a restart
					setTimeout(function() {
						console.log("restarting");
						SAGE2_speech.webkitSR.stop();
					}, 10);
					// remove the checker for stuck transcript
					if (SAGE2_speech.interimId) {
						window.clearTimeout(SAGE2_speech.interimId);
						SAGE2_speech.interimId = null;
					}

					// UI debug activator check
					var ftl = this.final_transcript.toLowerCase(this.final_transcript);
					var debugActivationWords = [SAGE2_speech.nameMarker, "show", "debug"];
					for (let i = 0; i < debugActivationWords.length; i++) {
						if (!ftl.includes(debugActivationWords[i])) {
							break;
						}
						if (i === debugActivationWords.length - 1) {
							document.getElementById("voiceTranscriptOuterContainer").style.visibility = "visible";
							document.getElementById("voiceTranscriptActual").textContent = "Voice debug activated";
							return; // show debug shouldn't send command to server
						}
					}
					// this is the final transcript to log
					wsio.emit("serverDataSetValue", {
						nameOfValue: "voiceToActionInterimTranscript",
						value: "Submitted phrase:" + this.final_transcript,
						confidence: event.results[i][0].confidence
					});
					// do something with it now.
					wsio.emit('voiceToAction', {words: this.final_transcript, confidence: event.results[i][0].confidence});
					document.getElementById("voiceTranscriptActual").textContent =
						"(" + parseInt(event.results[i][0].confidence * 100) + "%) " + this.final_transcript;
				} else {
					this.interim_transcript += event.results[i][0].transcript;
					console.log("interim_transcript:" + this.interim_transcript);
					if (SAGE2_speech.interimId) {
						// this should get cleared out each transcript change
						window.clearTimeout(SAGE2_speech.interimId);
						SAGE2_speech.interimId = null;
					}
					// if ever gets stuck on a single interim transcript for timeout restart
					SAGE2_speech.interimId = setTimeout(() => {
						SAGE2_speech.init();
					}, 6000); // good enough?
					// if this is the first time name is said then play listening sound
					if ((!SAGE2_speech.firstNameMention) &&
						(!SAGE2_speech.mouseHoldActivated) &&
						this.interim_transcript.toLowerCase().includes(SAGE2_speech.nameMarker)) {
						SAGE2_speech.firstNameMention = true;
						// SAGE2_speech.listenSound.play();
						SAGE2_speech.showListening = true;
						console.log("speech marker detected");
					} if (SAGE2_speech.firstNameMention) { // if first name is mentioned set the transcript
						let transcript = this.interim_transcript.toLowerCase();
						// possible that the transcript changes with an update
						if (!transcript.includes(SAGE2_speech.nameMarker)) {
							SAGE2_speech.firstNameMention = false;
						} else {
							transcript = transcript.substring(transcript.indexOf(SAGE2_speech.nameMarker));
							transcript = transcript.substring(transcript.indexOf(" ") + 1);
							document.getElementById("voiceTranscriptActual").textContent = transcript;
						}
					}
					wsio.emit("serverDataSetValue", {
						nameOfValue: "voiceToActionInterimTranscript",
						value: "Detected Words:" + this.interim_transcript
					});
				}
			}
		}; //end onresult

		this.webkitSR.onerror = function(e) {
			console.log("webkitSpeechRecognition error:" + e.error);
			console.dir(e);
			// this particular error will be triggered if the microphone is blocked.
			if (e.error === "not-allowed") {
				SAGE2_speech.errorNotAllowed = true;
			} else {
				// how to reliably detect when lost connection to server?
				// SAGE2_speech.errorCount++;
				// if (SAGE2_speech.errorCount >= 5) {
				// 	showSAGE2Message("Chrome speech recognition has errored."
				// 		+ "page must be reloaded to attempt speech recognition restart.");
				// }
			}
		};

		// after ending restart
		this.webkitSR.onend = function() {
			this.recognizing = false;
			// restart if error was caused
			if (!SAGE2_speech.errorNotAllowed && SAGE2_speech.errorCount < 5) {
				// console.log("voice ended, attempting to restart");
				SAGE2_speech.webkitSR.start();
			}
			// cleanup variables
			SAGE2_speech.mouseHoldActivated = false;
		};
		this.toggleSAGE2_speech();
	} //end else there is webkit
	// this.successSound = new Audio('sounds/ALARM.WAV');
	// this.failSound    = new Audio('sounds/ALARMTIME1.WAV');
	// this.listenSound  = new Audio('sounds/IDENTIFY.WAV');
};

/**
 * Toggles speech recongition on / off.
 *
 * @method toggleSAGE2_speech
 */
SAGE2_speech.toggleSAGE2_speech = function() {
	if (this.recognizing) {
		this.webkitSR.stop();
		return;
	}
	this.final_transcript = " ";
	this.webkitSR.lang = "en-US";
	this.webkitSR.start();
};

/**
 * Initializes by creating listeners to restart and enable sending if mouse is held down.
 *
 * @method initMouseholdToStart
 */
SAGE2_speech.initMouseholdToStart = function() {
	// on mouse down, if over canvas, set a timeout to check for listening
	document.addEventListener("mousedown", function(e) {
		SAGE2_speech.mouseHoldTimeoutId = null;
		// only activate if over the sage2UICanvas
		if (event.target.id === "sage2UICanvas") {
			SAGE2_speech.mouseHoldStartPos.x = e.clientX;
			SAGE2_speech.mouseHoldStartPos.y = e.clientY;
			// clear out existing timeouts if they exist.
			if (SAGE2_speech.mouseHoldTimeoutId) {
				window.clearTimeout(SAGE2_speech.mouseHoldTimeoutId);
				SAGE2_speech.mouseHoldTimeoutId = null;
			}
			// after timeout attempt speech recognition if valid
			SAGE2_speech.mouseHoldTimeoutId = setTimeout(function() {
				SAGE2_speech.mouseHoldTimeoutId = null;
				SAGE2_speech.enableMouseholdToStart();
			}, SAGE2_speech.mouseHoldTimeNeeded);
		}
	});
	// on mouse up, if there is a timer waiting for speech recognition remove it
	document.addEventListener("mouseup", function() {
		if (SAGE2_speech.mouseHoldTimeoutId) {
			window.clearTimeout(SAGE2_speech.mouseHoldTimeoutId);
			SAGE2_speech.mouseHoldTimeoutId = null;
		}
	});
};

/**
 * Starts the mouse hold recognition.
 * If there has not been a 1st name mention. Restart listener.
 * Show listening.
 * Mark this as getting an automatic name mention.
 *
 * @method enableMouseholdToStart
 */
SAGE2_speech.enableMouseholdToStart = function(e) {
	var dx = Math.abs(e.clientX - SAGE2_speech.mouseHoldStartPos.x);
	var dy = Math.abs(e.clientY - SAGE2_speech.mouseHoldStartPos.y);
	// if mouse cursor is still within move limit
	if (dx < SAGE2_speech.mouseHoldMoveLimit.x && dy < SAGE2_speech.mouseHoldMoveLimit.y) {
		// if it isn't listening.
		if (!SAGE2_speech.firstNameMention) {
			this.webkitSR.stop(); // stop
			setTimeout(function() {
				SAGE2_speech.mouseHoldActivated = true;
				console.log("speech activated through mouse down");
				// SAGE2_speech.webkitSR.start(); // start
			}, SAGE2_speech.mouseHoldTimeNeeded / 2); // not sure best minimum
		}
	}
};

/**
 * Creates and intializes the listening visual.
 *
 * @method listeningVisualInit
 */
SAGE2_speech.listeningVisualInit = function () {
	if (SAGE2_speech.listentingInfo) {
		return;
	}
	SAGE2_speech.listentingInfo = {
		divId: "divForListentingVisual",
		canvasId: "canvasVoiceListening",
		canvasWidth:  100,
		canvasHeight: 20,
		circleRadius:  25,
		cycleTime: 1500 // divide by 2 to get one sweep time
	};

	var d = document.createElement("div");
	d.id = SAGE2_speech.listentingInfo.divId;
	d.style.border = "2px solid black";
	d.style.position = "absolute";
	d.style.width = SAGE2_speech.listentingInfo.canvasWidth + "px";
	d.style.height = SAGE2_speech.listentingInfo.canvasHeight + "px";
	d.style.zIndex = 10000; // unsure of highest value

	var c = document.createElement("canvas");
	c.id = SAGE2_speech.listentingInfo.canvasId;
	c.style.width = SAGE2_speech.listentingInfo.canvasWidth;
	c.style.height = SAGE2_speech.listentingInfo.canvasHeight;

	// add to page
	d.appendChild(c);
	document.body.appendChild(d);

	// add listener for mouse move
	document.addEventListener("mousemove", SAGE2_speech.mouseMoveListener);

	// start drawing
	window.requestAnimationFrame(SAGE2_speech.drawListeningVisual);
};

/**
 * Updates position of mouse location to move the listening visual.
 *
 * @method mouseMoveListener
 * @param {Object} e - The mouse event, should be standard.
 */
SAGE2_speech.mouseMoveListener = function (e) {
	SAGE2_speech.mousePosition.x = e.clientX;
	SAGE2_speech.mousePosition.y = e.clientY;
};

/**
 * Animated the listening visual
 *
 * @method drawListeningVisual
 */
SAGE2_speech.drawListeningVisual = function () {
	// move to below mouse cursor
	var listeningDiv = document.getElementById(SAGE2_speech.listentingInfo.divId);
	if (SAGE2_speech.showListening) {
		listeningDiv.style.left = (SAGE2_speech.mousePosition.x
			- SAGE2_speech.listentingInfo.canvasWidth / 2) + "px";
		listeningDiv.style.top = (SAGE2_speech.mousePosition.y + 20) + "px";
	} else {
		listeningDiv.style.left = "-100px";
		listeningDiv.style.top = "-100px";
		return; // don't waste cycles if not showing
	}
	// draw update
	var ctx = document.getElementById(SAGE2_speech.listentingInfo.canvasId).getContext('2d');
	ctx.clearRect(0, 0, SAGE2_speech.listentingInfo.canvasWidth, SAGE2_speech.listentingInfo.canvasHeight); // clear canvas

	var timeCurrent = (SAGE2_speech.listentingInfo.cycleTime / 2); // half a cycle makes one sweep
	timeCurrent = Date.now() % SAGE2_speech.listentingInfo.cycleTime / timeCurrent;
	if (timeCurrent > 1) { // >1 means on return cycle.
		timeCurrent = 2 - timeCurrent; // it cannot be 2
	}
	var xCurrent = SAGE2_speech.listentingInfo.canvasWidth * timeCurrent;
	var yCurrent = SAGE2_speech.listentingInfo.canvasHeight;
	// xycenter, radius start , xy end, radius end
	var gradient = ctx.createRadialGradient(
		xCurrent, yCurrent, SAGE2_speech.listentingInfo.circleRadius,
		xCurrent, yCurrent, 0);
	gradient.addColorStop(0, 'black');
	gradient.addColorStop(1, 'red');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, SAGE2_speech.listentingInfo.canvasWidth, SAGE2_speech.listentingInfo.canvasHeight);
	window.requestAnimationFrame(SAGE2_speech.drawListeningVisual);
};

/**
 * Set whether or not to show the listening visual.
 *
 * @method setListeningVisual
 * @param {Boolean} shouldShow - true to show, otherwise false.
 */
SAGE2_speech.setListeningVisual = function(shouldShow) {
	shouldShow = (shouldShow) ? shouldShow : false; // in case called without params
	SAGE2_speech.showListening = shouldShow;
};

/**
 * Initialize speech synthesis
 *
 * @method speechSynthesisInit
 */
SAGE2_speech.speechSynthesisInit = function() {
	// speech setup
	SAGE2_speech.ttsConverter = new SpeechSynthesisUtterance();
	SAGE2_speech.synth        = window.speechSynthesis;
	// timeout needed because the synch seemed to be an asynchronous action.
	setTimeout(function() {
		SAGE2_speech.voices = SAGE2_speech.synth.getVoices();
		var kyoko, samantha, victoria;
		kyoko = samantha = victoria = false;
		if (SAGE2_speech.voices.length > 0) {
			for (let i = 0; i < SAGE2_speech.voices.length; i++) {
				if (SAGE2_speech.voices[i].name === "Samantha") {
					samantha = i;
				} else if (SAGE2_speech.voices[i].name === "Kyoko") {
					kyoko = i;
				} else if (SAGE2_speech.voices[i].name === "Victoria") {
					victoria = i;
				}
			}
		} else {
			console.log("Speech synthesis voices not available");
		}
		if (samantha) {
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[samantha];
		} else if (kyoko) {
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[kyoko];
		} else if (victoria) {
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[victoria];
		}
		SAGE2_speech.ttsConverter.lang = 'en-US';
	}, 2000);
};

/**
 * Will attempt to voice the given what to say.
 *
 * @method textToSpeech
 * @param {String} whatToSay - will attempt to say this.
 */
SAGE2_speech.textToSpeech = function (whatToSay) {
	if (!SAGE2_speech.ttsConverter) {
		return;
	}
	try {
		console.log("Speech:" + whatToSay);
		SAGE2_speech.ttsConverter.text = whatToSay;
		window.speechSynthesis.speak(SAGE2_speech.ttsConverter);
	} catch (e) {
		console.log("Error with textToSpeech");
	}
};

SAGE2_speech.init();
