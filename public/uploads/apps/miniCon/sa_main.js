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

/* global  SAGE2Connection*/

/*
File has parts:
	1. Any actions needed to run before connecting to server.
	2. Connect to server
	3. Function definitions for those actions
	4. Functions that the app expects to call

*/

/* ------------------------------------------------------------------------------------------------------------------
// 1
// ------------------------------------------------------------------------------------------------------------------
The following will activate as soon as the script is loaded.
*/

document.getElementById("outputFromApp").style.height = window.innerHeight * 0.2 + "px";
document.getElementById("codeInput").style.height = window.innerHeight * 0.6 + "px";

// after clicking on the return button remove this from editor list
document.getElementById("SAGE2_returnToUi").addEventListener("click", function() {
	// function will autofill clientId
	SAGE2Connection.callFunctionOnApp("removeSaEditor", {});
	window.close();
});

// activate the execute code when clicking on send.
document.getElementById("sendCode").addEventListener("click", function() {
	var codeToExecute = document.getElementById("codeInput").value;
	SAGE2Connection.callFunctionOnApp("executeCode", {code: codeToExecute});
});

/* ------------------------------------------------------------------------------------------------------------------
// 2
// ------------------------------------------------------------------------------------------------------------------
Connect to the server
*/

// first describe any reaction after connecting
SAGE2Connection.afterSAGE2Connection = addThisClientAsEditor;

// This this is part of app code, it will use the current window values to connect.
// But if the page was hosted elsewhere, parameters would be required.
SAGE2Connection.initS2Connection();

/* ------------------------------------------------------------------------------------------------------------------
// 3
// ------------------------------------------------------------------------------------------------------------------
These functions are part of the page functionality.
*/
function addThisClientAsEditor() {
	// callFunctionOnApp: function(functionName, parameterObject) { // autofilled id by server
	SAGE2Connection.callFunctionOnApp("addClientAsLogWatcher", {});
}


/* ------------------------------------------------------------------------------------------------------------------
// 4
// ------------------------------------------------------------------------------------------------------------------
The following functions will be called by the app sending data to clients.
*/

function consoleLine(data) {
	outputFromApp.innerHTML += data.content;
	outputFromApp.scrollTop = outputFromApp.scrollHeight;
}


