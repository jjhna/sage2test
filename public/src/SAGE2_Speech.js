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
SAGE2_speech.interimID          = null;
// speech synthesis
SAGE2_speech.synthesis          = null;

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
		};

		/*
			After getting a result, but this also includes pieces that aren't detected as full sentences.
		*/
		this.webkitSR.onresult = function(event) {
			this.interim_transcript = " ";
			for (var i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					this.final_transcript = event.results[i][0].transcript;
					console.log("final_transcript(" + event.results[i][0].confidence + "%):" + this.final_transcript);

					// set for later a restart
					setTimeout(function() {
						console.log("restarting");
						SAGE2_speech.webkitSR.stop();
					}, 10);
					SAGE2_speech.firstNameMention = false;
					// remove the checker for stuck transcript
					if (SAGE2_speech.interimID) {
						window.clearTimeout(SAGE2_speech.interimID);
						SAGE2_speech.interimID = null;
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
					if (SAGE2_speech.interimID) {
						// this should get cleared out each transcript change
						window.clearTimeout(SAGE2_speech.interimID);
						SAGE2_speech.interimID = null;
					}
					// if ever gets stuck on a single interim transcript for timeout restart
					SAGE2_speech.interimID = setTimeout(() => {
						SAGE2_speech.init();
					}, 6000); // good enough?
					// if this is the first time name is said then play listening sound
					if ((!SAGE2_speech.firstNameMention) &&
						this.interim_transcript.toLowerCase().includes(SAGE2_speech.nameMarker)) {
						SAGE2_speech.firstNameMention = true;
						SAGE2_speech.listenSound.play();
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
				SAGE2_speech.errorCount++;
				if (SAGE2_speech.errorCount >= 5) {
					showSAGE2Message("Chrome speech recognition has errored."
						+ "page must be reloaded to attempt speech recognition restart.");
				}
			}
		};

		// after ending restart
		this.webkitSR.onend = function() {
			// restart if error was caused
			if (!SAGE2_speech.errorNotAllowed && SAGE2_speech.errorCount < 5) {
				this.recognizing = false;
				// console.log("voice ended, attempting to restart");
				SAGE2_speech.webkitSR.start();
			}
		};
		this.toggleSAGE2_speech();
	} //end else there is webkit
	this.successSound = new Audio('sounds/ALARM.WAV');
	this.failSound    = new Audio('sounds/ALARMTIME1.WAV');
	this.listenSound  = new Audio('sounds/IDENTIFY.WAV');
};
SAGE2_speech.toggleSAGE2_speech = function() {
	if (this.recognizing) {
		this.webkitSR.stop();
		return;
	}
	this.final_transcript = " ";
	this.webkitSR.lang = "en-US";
	this.webkitSR.start();
};

// SAGE2_speech.init();
