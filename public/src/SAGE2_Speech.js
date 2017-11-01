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

/* global showSAGE2Message webkitSpeechGrammarList */

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
SAGE2_speech.mouseHoldTimeNeeded = 400; // ms
SAGE2_speech.mouseHoldTimeoutId  = null;
SAGE2_speech.mouseHoldActivated  = false;
SAGE2_speech.mouseHoldStartPos   = {x: -100, y: -100};
SAGE2_speech.mouseHoldMoveLimit  = {x: 10, y: 10};
SAGE2_speech.mouseIsDown         = false;
// listening variables
SAGE2_speech.showListening      = false;
SAGE2_speech.listentingInfo     = null;
SAGE2_speech.mousePosition      = {
	x: window.innerWidth / 2,
	y: 0,
	dx: 0,
	dy: 0
};
// speech synthesis
SAGE2_speech.ttsConverter       = null;
SAGE2_speech.synth              = null;
SAGE2_speech.voices             = null;
SAGE2_speech.isEnabled          = true;
SAGE2_speech.uiMenuEntryEnable  = true;
SAGE2_speech.uiMenuEntryDisable = true;


/**
 * Intializes the speech recognition object.
 *
 * @method init
 */
SAGE2_speech.init = function() {
	if (!("webkitSpeechRecognition" in window)) {
		console.log("SpeechRecognition> This browser doesn't support SpeechRecognition API");
	} else {
		console.log("SpeechRecognition> API exists, beginning setup");
		// the contructor is actually lower case
		this.webkitSR = new webkitSpeechRecognition(); // eslint-disable-line
		this.webkitSR.continuous = false;
		this.webkitSR.interimResults = true;

		// give weight to the system name
		var grammar = '#JSGF V1.0; grammar noun; public <noun> = ' + 'Sage' + ' ;';
		if (webkitSpeechGrammarList) {
			var speechRecognitionList = this.webkitSR.grammars;
			// 0->1 weight of grammar likely to happen compared to others.
			speechRecognitionList.addFromString(grammar, 1);
			this.webkitSR.grammars = speechRecognitionList;
		}

		// initialize other parts
		this.initMouseholdToStart();
		this.speechSynthesisInit();
		this.listeningVisualInit();

		// Triggers with event onstart, reset variables

		this.webkitSR.onstart = function() {
			console.log("SpeechRecognition> SAGE2_speech started");
			this.recognizing = true;
			// cleanup variables
			SAGE2_speech.showListening = true;
			SAGE2_speech.firstNameMention = false;
			SAGE2_speech.listentingInfo.imageDetectedInterim = false;
			SAGE2_speech.listentingInfo.imageCycleFrame = 0;
			// start blank
			document.getElementById(SAGE2_speech.listentingInfo.transcriptId).textContent = "";
			// start blank
			document.getElementById(SAGE2_speech.listentingInfo.transcriptId).style.width = "1px";
			document.getElementById(SAGE2_speech.listentingInfo.transcriptId).style.visibility = "hidden";
		};

		// After getting a result, but this also includes pieces
		// that aren't detected as full sentences
		this.webkitSR.onresult = function(event) {
			this.interim_transcript = " ";
			for (var i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					this.final_transcript = event.results[i][0].transcript;
					if (SAGE2_speech.mouseHoldActivated
						&& !this.final_transcript.toLowerCase().includes(SAGE2_speech.nameMarker)) {
						this.final_transcript = SAGE2_speech.nameMarker + this.final_transcript;
					}
					console.log("SpeechRecognition> final_transcript(",
						event.results[i][0].confidence, "%):" + this.final_transcript);

					setTimeout(function() {
						SAGE2_speech.webkitSR.stop();
						// if mouse is held down, restart for continuous commands
						if (SAGE2_speech.mouseIsDown) {
							setTimeout(function() {
								SAGE2_speech.mouseHoldActivated = true;
								SAGE2_speech.webkitSR.start();
							}, 100);
						}
					}, 10);
					// remove the checker for stuck transcript
					if (SAGE2_speech.interimId) {
						window.clearTimeout(SAGE2_speech.interimId);
						SAGE2_speech.interimId = null;
					}

					// if not a local activation give to server
					if (!SAGE2_speech.doesTranscriptActivateLocally(this.final_transcript)) {
						// this is the final transcript to log
						wsio.emit("serverDataSetValue", {
							nameOfValue: "voiceToActionInterimTranscript",
							value: "Submitted phrase:" + this.final_transcript,
							confidence: event.results[i][0].confidence
						});
						// do something with it now
						wsio.emit('voiceToAction', {words: this.final_transcript, confidence: event.results[i][0].confidence});
						document.getElementById("voiceTranscriptActual").textContent =
							"(" + parseInt(event.results[i][0].confidence * 100) + "%) " + this.final_transcript;
					}
				} else {
					this.interim_transcript += event.results[i][0].transcript;
					console.log("SpeechRecognition> interim_transcript:", this.interim_transcript);
					// put transcript in visual
					let tdiv  = document.getElementById(SAGE2_speech.listentingInfo.transcriptId);
					tdiv.textContent = this.interim_transcript;
					tdiv.style.width = (tdiv.textContent.length
						* SAGE2_speech.listentingInfo.transcriptCharacterPadding) + "px";
					// make the element visibe on screen
					tdiv.style.visibility = "visible";
					SAGE2_speech.listentingInfo.imageDetectedInterim = true;
					if (SAGE2_speech.interimId) {
						// this should get cleared out each transcript change
						window.clearTimeout(SAGE2_speech.interimId);
						SAGE2_speech.interimId = null;
					}

					// if ever gets stuck on a single interim transcript for timeout restart
					SAGE2_speech.interimId = setTimeout(() => {
						SAGE2_speech.init();
					}, 6000); // good enough? no

					// if this is the first time name is said then play listening sound
					if ((!SAGE2_speech.firstNameMention) &&
						(!SAGE2_speech.mouseHoldActivated) &&
						this.interim_transcript.toLowerCase().includes(SAGE2_speech.nameMarker)) {
						SAGE2_speech.firstNameMention = true;
						console.log("SpeechRecognition> speech marker detected");
					} if (SAGE2_speech.firstNameMention) {
						// if first name is mentioned set the transcript
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
			console.log("SpeechRecognition> webkitSpeechRecognition error:", e.error);
			console.dir("SpeechRecognition>", e);
			// this particular error will be triggered if the microphone is blocked.
			if (e.error === "not-allowed") {
				SAGE2_speech.errorNotAllowed = true;
				// the toggle wil swap it to false
				SAGE2_speech.isEnabled = true;
				SAGE2_speech.toggleVoiceRecognition();
			}
		};

		// after ending restart
		this.webkitSR.onend = function() {
			this.recognizing = false;
			SAGE2_speech.showListening = false;
			// cleanup variables
			SAGE2_speech.mouseHoldActivated = false;
		};
		this.toggleSAGE2_speech();
		// toggle will flip
		this.isEnabled = false;
		SAGE2_speech.toggleVoiceRecognition();
	}
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
};

/**
 * Check if transcript is a local speech command.
 *
 * @method doesTranscriptActivateLocally
 */
SAGE2_speech.doesTranscriptActivateLocally = function(transcript) {
	// UI debug activator check
	transcript = transcript.toLowerCase();

	// local checks
	var localActions = {
		showSpeechDebug: {
			keywords: ["show voice debug", "show speech debug"],
			successFunction: SAGE2_speech.activateSpeechDebug
		},
		tellTheTime: {
			keywords: ["what time"],
			successFunction: SAGE2_speech.sayTheTime
		},
		tellTheDate: {
			keywords: ["what today", "what date"],
			successFunction: SAGE2_speech.sayTheDate
		}
	};
	var actionNames = Object.keys(localActions);
	var keywords;
	for (let i = 0; i < actionNames.length; i++) {
		for (let keySets = 0; keySets < localActions[actionNames[i]].keywords.length; keySets++) {
			keywords = localActions[actionNames[i]].keywords[keySets].toLowerCase().split(" ");
			for (let k = 0; k < keywords.length; k++) {
				if (!transcript.includes(keywords[k])) {
					// exits out of keyword loop
					break;
				} else if (k == keywords.length - 1) {
					console.log("SpeechRecognition> Local voice function:" + actionNames[i]);
					localActions[actionNames[i]].successFunction();
					return true;
				}
			}
		}
	}
	return false;
};

/**
 * Makes the speech debug text visible.
 *
 * @method activateSpeechDebug
 */
SAGE2_speech.activateSpeechDebug = function() {
	document.getElementById("voiceTranscriptOuterContainer").style.visibility = "visible";
	document.getElementById("voiceTranscriptActual").textContent = "Voice debug activated";
};

/**
 * UI will speak the time.
 *
 * @method sayTheTime
 */
SAGE2_speech.sayTheTime = function() {
	var d = new Date();
	var whatToSay;
	if (d.getHours() > 12) {
		whatToSay = (d.getHours() - 12) + " " + (d.getMinutes()) +  " P M";
	} else {
		whatToSay = d.getHours() + " " + (d.getMinutes()) +  " A M";
	}
	SAGE2_speech.textToSpeech(whatToSay);
};

/**
 * UI will speak the date.
 *
 * @method sayTheDate
 */
SAGE2_speech.sayTheDate = function() {
	var d = new Date();
	var whatToSay = "";
	switch (d.getDay()) {
		case 0: whatToSay = "Sunday ";    break;
		case 1: whatToSay = "Monday ";    break;
		case 2: whatToSay = "Tuesday ";   break;
		case 3: whatToSay = "Wednesday "; break;
		case 4: whatToSay = "Thursday ";  break;
		case 5: whatToSay = "Friday ";    break;
		case 6: whatToSay = "Saturday ";  break;
	}
	switch (d.getMonth()) {
		case  0: whatToSay += "January ";   break;
		case  1: whatToSay += "February ";  break;
		case  2: whatToSay += "March ";     break;
		case  3: whatToSay += "April ";     break;
		case  4: whatToSay += "May ";       break;
		case  5: whatToSay += "June ";      break;
		case  6: whatToSay += "July ";      break;
		case  7: whatToSay += "August ";    break;
		case  8: whatToSay += "September "; break;
		case  9: whatToSay += "October ";   break;
		case 10: whatToSay += "November ";  break;
		case 11: whatToSay += "December ";  break;
	}
	whatToSay += d.getDate();
	SAGE2_speech.textToSpeech(whatToSay);
};

/**
 * Initializes by creating listeners to restart and enable sending if mouse is held down.
 *
 * @method initMouseholdToStart
 */
SAGE2_speech.initMouseholdToStart = function() {
	// on mouse down, if over canvas, set a timeout to check for listening
	document.addEventListener("mousedown", function(e) {
		if (!SAGE2_speech.isEnabled) {
			// if speech recognition was disabled by user, don't
			return;
		}
		// reset the move
		SAGE2_speech.mousePosition.dx = 0;
		SAGE2_speech.mousePosition.dy = 0;
		SAGE2_speech.mouseHoldTimeoutId = null;
		// only activate if over the sage2UICanvas
		if (event.target.id === "sage2UICanvas"
			|| document.getElementById("sage2pointerDialog").style.display === "block") {
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
				SAGE2_speech.enableMouseholdToStart(e);
				SAGE2_speech.mouseIsDown = true;
			}, SAGE2_speech.mouseHoldTimeNeeded);
		}
	});
	// on mouse up, if there is a timer waiting for speech recognition remove it
	document.addEventListener("mouseup", function() {
		SAGE2_speech.mouseIsDown = false;
		if (SAGE2_speech.mouseHoldTimeoutId) {
			window.clearTimeout(SAGE2_speech.mouseHoldTimeoutId);
			SAGE2_speech.mouseHoldTimeoutId = null;
		}
		SAGE2_speech.webkitSR.stop();
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
	var dx = Math.abs(SAGE2_speech.mousePosition.dx);
	var dy = Math.abs(SAGE2_speech.mousePosition.dy);
	// if mouse cursor is still within move limit
	if (dx < SAGE2_speech.mouseHoldMoveLimit.x && dy < SAGE2_speech.mouseHoldMoveLimit.y) {
		// if it isn't listening.
		if (!SAGE2_speech.firstNameMention) {
			this.webkitSR.stop(); // stop
			setTimeout(function() {
				SAGE2_speech.mouseHoldActivated = true;
				// start
				SAGE2_speech.webkitSR.start();
			}, SAGE2_speech.mouseHoldTimeNeeded / 2);
			// not sure best minimum
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
		canvasHeight:  20,
		circleRadius:  25,
		// swap to images
		// multiple images
		imageId: ["imageEar0", "imageEar1", "imageEar2", "imageEar3"],
		imageWidth:  40,
		imageHeight: 40,
		imageFrameDuration: 75, // in ms
		imageFrameStartTime: 0,
		imageCycleFrame: 0,
		imageDetectedInterim: false,
		transcriptId: "listeningTranscriptDiv",
		transcriptCharacterPadding: 7
	};

	var d = document.createElement("div");
	d.id = SAGE2_speech.listentingInfo.divId;
	d.style.position = "absolute";
	// unsure of highest value
	d.style.zIndex = 10000;

	// transcript holder appendChild before images to make transcript visually behind them.
	var transcriptDiv = document.createElement("div");
	transcriptDiv.id = SAGE2_speech.listentingInfo.transcriptId;
	transcriptDiv.style.position = "absolute";
	// not as big as image
	transcriptDiv.style.height = (SAGE2_speech.listentingInfo.imageHeight / 2) + "px";
	// center the transcript
	transcriptDiv.style.top = (SAGE2_speech.listentingInfo.imageHeight / 4 - 6) + "px";
	// put right of image
	transcriptDiv.style.left = (SAGE2_speech.listentingInfo.imageWidth - 20) + "px";
	// match the left offset from image
	transcriptDiv.style.paddingLeft = "25px";
	// match the left offset from image
	transcriptDiv.style.paddingTop = "5px";
	transcriptDiv.style.border = "1px solid black";
	transcriptDiv.style.borderRadius = "1px 20px 20px 1px";
	transcriptDiv.style.background   = "#e6e6e6";
	// start blank
	transcriptDiv.textContent = "";
	transcriptDiv.style.width = (transcriptDiv.textContent.length
		* SAGE2_speech.listentingInfo.transcriptCharacterPadding) + "px";
	d.appendChild(transcriptDiv);

	// images
	// currently 4 frames 0,1,2,3
	for (let i = 0; i < SAGE2_speech.listentingInfo.imageId.length; i++) {
		let c = document.createElement("img");
		c.id = SAGE2_speech.listentingInfo.imageId[i];
		c.style.width = SAGE2_speech.listentingInfo.imageWidth + "px";
		c.style.height = SAGE2_speech.listentingInfo.imageHeight + "px";
		c.src = "images/speech-ear" + i + ".png";
		c.style.position = "absolute";
		if (i > 0) {
			c.style.display = "none";
		}
		d.appendChild(c);
	}

	// add to page
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
	SAGE2_speech.mousePosition.x  =  e.clientX;
	SAGE2_speech.mousePosition.y  =  e.clientY;
	SAGE2_speech.mousePosition.dx += e.movementX;
	SAGE2_speech.mousePosition.dy += e.movementY;
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
			- SAGE2_speech.listentingInfo.imageWidth / 2) + "px";
		listeningDiv.style.top = (SAGE2_speech.mousePosition.y - 10
			- SAGE2_speech.listentingInfo.imageHeight) + "px";
		if (document.pointerLockElement) {
			listeningDiv.style.left = "50px";
			listeningDiv.style.top  = "50px";
		}
	} else {
		listeningDiv.style.left = "-100px";
		listeningDiv.style.top  = "-100px";
		window.requestAnimationFrame(SAGE2_speech.drawListeningVisual);
		// dont forget to recall frame if not showing, otherwise will not restart.
		return;
	}

	// only draw animation if interim activated
	if (SAGE2_speech.listentingInfo.imageDetectedInterim) {
		if ((Date.now() - SAGE2_speech.listentingInfo.imageFrameStartTime)
			>= SAGE2_speech.listentingInfo.imageFrameDuration) {
			SAGE2_speech.listentingInfo.imageCycleFrame++;
			if (SAGE2_speech.listentingInfo.imageCycleFrame >= SAGE2_speech.listentingInfo.imageId.length) {
				SAGE2_speech.listentingInfo.imageCycleFrame = 0;
			}
			for (let i = 0; i < SAGE2_speech.listentingInfo.imageId.length; i++) {
				if (i === SAGE2_speech.listentingInfo.imageCycleFrame) {
					document.getElementById(SAGE2_speech.listentingInfo.imageId[i]).style.display = "block";
				} else {
					document.getElementById(SAGE2_speech.listentingInfo.imageId[i]).style.display = "none";
				}
			}
			SAGE2_speech.listentingInfo.imageFrameStartTime = Date.now();
		}
	}

	// set into next animation frame.
	window.requestAnimationFrame(SAGE2_speech.drawListeningVisual);
};

/**
 * Set whether or not to show the listening visual.
 *
 * @method setListeningVisual
 * @param {Boolean} shouldShow - true to show, otherwise false.
 */
SAGE2_speech.setListeningVisual = function(shouldShow) {
	// in case called without params
	shouldShow = (shouldShow) ? shouldShow : false;
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
		var kyoko    = {found: false};
		var samantha = {found: false};
		var victoria = {found: false};
		if (SAGE2_speech.voices.length > 0) {
			for (let i = 0; i < SAGE2_speech.voices.length; i++) {
				if (SAGE2_speech.voices[i].name === "Samantha") {
					samantha.found = true;
					samantha.index = i;
				} else if (SAGE2_speech.voices[i].name === "Victoria") {
					victoria.found = true;
					victoria.index = i;
				} else if (SAGE2_speech.voices[i].name === "Kyoko") {
					kyoko.found = true;
					kyoko.index = i;
				} 
			}
		} else {
			console.log("SpeechRecognition> Speech synthesis voices not available");
		}
		if (samantha.found) {
			// priority to samantha
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[samantha.index];
		} else if (kyoko.found) {
			// then kyoko
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[kyoko.index];
		} else if (victoria.found) {
			// finally victoria
			SAGE2_speech.ttsConverter.voice = SAGE2_speech.voices[victoria.index];
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
		console.log("SpeechRecognition> Speech:", whatToSay);
		SAGE2_speech.ttsConverter.text = whatToSay;
		window.speechSynthesis.speak(SAGE2_speech.ttsConverter);
	} catch (e) {
		console.log("SpeechRecognition> Error with textToSpeech");
	}
};

/**
 * Will toggle whether or not voice recognition starts for long click and hold.
 *
 * @method toggleVoiceRecognition
 */
SAGE2_speech.toggleVoiceRecognition = function () {
	// toogle: if enabled, disable and make menu allow reenable
	// in the top menu bar (webix ui)
	if (SAGE2_speech.isEnabled) {
		$$('topmenu').showItem('voiceserviceEnable_menu');
		$$('topmenu').hideItem('voiceserviceDisable_menu');
	} else {
		// else was disabled, enable it and allow disable
		$$('topmenu').showItem('voiceserviceDisable_menu');
		$$('topmenu').hideItem('voiceserviceEnable_menu');
	}
	SAGE2_speech.isEnabled = !SAGE2_speech.isEnabled;
};

/**
 * Activates after receiving from server what the name marker is.
 * Only after receiving will it init the voice recognition.
 *
 * @method setNameMarker
 */
SAGE2_speech.setNameMarker = function (nameMarkerFromServer) {
	// console.log("Voice marker:'" + nameMarkerFromServer + "'");
	SAGE2_speech.nameMarker = nameMarkerFromServer.toLowerCase(); // server should give a space
	SAGE2_speech.init();
};
