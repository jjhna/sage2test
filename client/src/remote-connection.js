/**
 *
 * @class electron
 * @module remote-connection
 * @submodule electron
 * @requires electron, fs, os, path,
 */
'use strict';

/******************************* Node modules ********************************/
const electron = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ipcRenderer } = electron;

const favorites_file_name = 'sage2_sites.json';

// Object containing list of favorites sites
var favorites = {
	list: [],
	// example of favorites object structure
	// list: [{
	//     host: 'orion-win.evl.uic.edu',
	//     name: 'CAVE2',
	//     hash: B0A0C534BE83D0342E38D233643BDABB
	// }]
};

// Variables for the current site
let passwordRequired = false;
let isHashSaved = false;
const urlInput = document.getElementById('url');

// Reading the favorites json file
fs.readFile(getAppDataPath(favorites_file_name), 'utf8', function readFileCallback(err, data) {
	if (err) {
		// most likely no json file (first use), write empty favorites on file
		writeFavoritesOnFile(favorites);
	} else {
		favorites = JSON.parse(data); //convert json to object
		// if (favorites.list.length > 0) {
		// 	clearCarousel();
		// 	populateFavorites(favorites.list);
		// 	updateInitCarousel();
		// 	if (favorites.UIswitchPosition === FAVORITES_LIST_UI) {
		// 		switchToListUI();
		// 		switchFavoritesUI.firstElementChild.firstElementChild.checked = true;
		// 	}
		// }
	}
});



/**
 * Gets the windows path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getWindowPath() {
	return path.join(os.homedir(), "AppData");
}

/**
 * Gets the Mac path to a temporary folder to store data (/tmp)
 *
 * @return {String} the path
 */
function getMacPath() {
	return path.join(os.homedir(), ".config");
}

/**
 * Gets the Linux path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getLinuxPath() {
	return path.join(os.homedir(), ".config");
}

/**
 * In case the platform is among the known ones (for the potential
 * future os platforms)
 *
 * @return {String} the path
 */
function getFallback() {
	if (os.platform().startsWith("win")) {
		return getWindowPath();
	}
	return getLinuxPath();
}


/**
 * Creates the path to the file in a platform-independent way
 *
 * @param  {String} file_name the name of the file
 * @return the path to the file
 */
function getAppDataPath(file_name) {
	let appDataPath = '';
	switch (os.platform()) {
		case "win32":
			appDataPath = getWindowPath();
			break;
		case "darwin":
			appDataPath = getMacPath();
			break;
		case "linux":
			appDataPath = getLinuxPath();
			break;
		default:
			appDataPath = getFallback();

	}
	if (file_name === undefined) {
		return appDataPath;
	} else {
		return path.join(appDataPath, file_name);
	}
}


/**
 * Writes favorites in a persistent way on local machine
 *
 * @method writeFavoritesOnFile
 * @param {Object} favorites_obj the object containing the list of favorites
 */
function writeFavoritesOnFile(favorites_obj) {
	fs.writeFile(getAppDataPath(favorites_file_name),
		JSON.stringify(favorites_obj, null, 4), 'utf8', () => {
			// done
		});
}


/**
 * Take site's host and format it properly as a URL, handling clientID and password
 *
 * @method formatProperly
 * @param  {String} url the host site url to be formatted
 * @return {String} the formatted url
 */
function formatProperly(url) {
	// if (check1.checked) {
	// 	var id = parseInt(idDropName.innerHTML);
	// 	url = url + '/display.html?clientID=' + id;
	// } else {
		url = url + '/display.html?clientID=-1';
	// }
	if (passwordRequired) {
		var pwd = pwdInput.value;
		if (pwd == "") {
			// if the password field is empty try to connect without using a password
			return url;
		} else {
			if (isHashSaved) {
				// Correct hash previously saved locally
				url = url + '&hash=' + pwd;
			} else { // Normal password
				url = url + '&session=' + pwd;
			}
		}
	}
	return url;
}

/**
 * Sends a message to the main electron window to say to close this menu
 *
 * @return {void}
 */
function cancelOnClick() {
	ipcRenderer.send('close-connect-page', "0");
}

/**
 * Sends a message to the main electron window to request the connection to the specified page
 * @return {void}
 */
function okayOnClick() {
	let URL = formatProperly(urlInput.value);
	// sending URL to electron.js, params: key value pair (id,URL)
	ipcRenderer.send('connect-url', URL);
}

/**
 * fetches the config JSON from the site's url provided, executes the
 * onTimeout function if the delay is passed without hearing back from
 * the fetch callback. Otherwise it populates the UI with the JSON
 * containing the list of connected sites
 *
 * @param {String} url the url to fetch from
 * @param {int} delay the timeout time in ms
 * @param {function} onTimeout the function to be executed in case of timeout
 */
function fetchWithTimeout(url, delay, onTimeout) {
	const timer = new Promise((resolve) => {
		setTimeout(resolve, delay, {
			timeout: true
		});
	});

	return Promise.race([
		fetch(url),
		timer
	]).then((response) => {
		if (response.timeout) {
			onTimeout();
			return null;
		} else {
			return response.json();
		}
	}).then((json) => {
		if (json) {
			populateUI(json);
		}
	});
}

/**
 * Refreshes the dropdowns given a new config JSON file from a site
 *
 * @method populateUI
 * @param  {JSON} config_json the json config file from a site
 * @return {void}
 */
function populateUI(config_json) {
	urlInput.setAttribute("data-name", config_json.name);
}

/**
 * Sets the color of card to display online/offline status
 *
 * @param  {String} url of the site
 * @param  {HTML element} elem card elem
 * @param  {any} delay time in ms to wait for fetch request before declaring to be offline
 * @return void
 */
function setOnlineStatus(url, elem, delay) {
	// Setting offline as default
	elem.style.color = offlineColor;
	const timer = new Promise((resolve) => {
		setTimeout(resolve, delay, {
			timeout: true
		});
	});

	return Promise.race([
		fetch(url),
		timer
	]).then((response) => {
		if (response.timeout) {
			elem.style.color = offlineColor;
			return;
		} else {
			elem.style.color = onlineColor;
		}
	});
}


/**
 * Loads information about a site given its host. Populates dropdowns, sets online/offline status
 * @param  {String} host the host of the site to load
 * @return {void}
 */
function loadSiteInfo(host) {
	fetchWithTimeout(host + '/config', 1000, () => {
		onCurrentSiteDown();
	}).catch(err => {
		throw err;
	});
}



// Catches the message sent from the main electron window
// that is providing the current location
ipcRenderer.on('current-location', (e, host) => {
	urlInput.value = host;
	loadSiteInfo(host);
});

/******************* Adding event listeners to html elems ********************/

// Initialize dropdown and carousel with sites
document.addEventListener('DOMContentLoaded', function () {
	console.log('Ready')
});

var form = document.querySelector("form");
form.addEventListener("submit", function(event) {
	console.log("Values", form.elements);
	okayOnClick();
	event.preventDefault();
});

