/**
 * Handles behavior of remoteSiteWindow.html web page.
 * Bring up page with cmd+k on Mac, ctrl+k on windows.
 * This gives a user-friendly navigation/connection to different SAGE2 sites.
 * The user can see the remote sites connected to the current one, see their
 * online/offline status, add them in a persistent favorites list, choose
 * the ClientID among the available ones, default is Full Screen.
 * If a password is required the user is also given the possibility to
 * insert one. The password hash is automatically saved locally.
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
const { ipcRenderer } = electron;
const { platform, homedir } = require("os");
const { join } = require("path");

/************************* DOM element declaration ***************************/
const favoriteHeart = document.getElementById("favorite_heart");
// const favoriteCarousel = document.getElementById("favorites_carousel");
const favoriteList = document.getElementById("favorites_list");
const idDropdown = document.getElementById('ids_dropdown');
const idDropName = document.getElementById('id_drop');
// const siteDropdown = document.getElementById('sites_dropdown');
const check1 = document.getElementById('check_1');
const check2 = document.getElementById('check_2');
const urlInput = document.getElementById('url');
const okayBtn = document.getElementById('okay_btn');
const cancelBtn = document.getElementById('cancel_btn');
// const switchFavoritesUI = document.getElementById('switch_favorites_ui');
const loadSiteInfoBtn = document.getElementById('current_status_btn');
const pwdInput = document.getElementById('password');

/********************** html classes and attribute values ********************/
const buttonColorClass = "blue-grey darken-2";
const pulseClass = "pulse";
const onlineColor = "#60d277";
const offlineColor = "#d5715d";
const blackColor = "#222222";

const favorites_file_name = 'sage2_favorite_sites.json';
const FAVORITES_LIST_UI = 2;
const FAVORITES_CAROUSEL_UI = 1;

const PREDEFINED_LOCAL_PORT = "9090";

//JS object containing list of favorites sites
var favorites = {
	list: [],
	UIswitchPosition: FAVORITES_CAROUSEL_UI //TODO delete
	// example of favorites object structure
	// list: [{
	//     host: 'orion-win.evl.uic.edu',
	//     name: 'CAVE2',
	//     hash: B0A0C534BE83D0342E38D233643BDABB
	// },
	// {
	//     host: 'test.edu',
	//     name: 'CAVE3'
	// }]
};
// Variables for the current site
let passwordRequired = false;
let isHashSaved = false;

// Reading the favorites json file
fs.readFile(getAppDataPath(favorites_file_name), 'utf8', function readFileCallback(err, data) {
	if (err) { // most likely no json file (first use), write empty favorites on file
		console.log(err);
		writeFavoritesOnFile(favorites);
	} else {
		favorites = JSON.parse(data); //convert json to object
		console.log(favorites);
		if (favorites.list.length > 0) {
			// clearCarousel();
			populateFavorites(favorites.list);
			// updateInitCarousel();
			if (favorites.UIswitchPosition === FAVORITES_LIST_UI) { //TODO delete
				// switchToListUI();
				// switchFavoritesUI.firstElementChild.firstElementChild.checked = true;
			}
		}
	}
});

/********************************* Functions *********************************/

/**
 * Gets the windows path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getWindowPath() {
	return join(homedir(), "AppData");
}

/**
 * Gets the Mac path to a temporary folder to store data (/tmp)
 *
 * @return {String} the path
 */
function getMacPath() {
	return '/tmp';
}

/**
 * Gets the Linux path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getLinuxPath() {
	return join(homedir(), ".config");
}

/**
 * In case the platform is among the known ones (for the potential
 * future os platforms)
 *
 * @return {String} the path
 */
function getFallback() {
	if (platform().startsWith("win")) {
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
	switch (platform()) {
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
		return join(appDataPath, file_name);
	}
}

/**
 * add on click listener to heart (add/remove from favorites)
 */
favoriteHeart.addEventListener('click', (e) => {
	let checked = e.target.innerHTML == 'favorite_border' ? false : true;
	let URL = urlInput.value;
	let sitename = urlInput.getAttribute('data-name');
	if (URL) {
		if (!checked) { //item added to favorites
			setFullHeart();
			addToFavorites({
				name: sitename || 'Unknown name',
				host: URL
			});
		} else { //item removed from favorites
			setEmptyHeart();
			removeFromFavorites(URL);
		}
	}
});

/**
* Sets the heart icon to full
*
* @method setFullHeart
*/
function setFullHeart() {
	favoriteHeart.innerHTML = 'favorite';
}

/**
 * Sets the heart icon to empty
 *
 * @method setEmptyHeart
 */
function setEmptyHeart() {
	favoriteHeart.innerHTML = 'favorite_border';
}

/**
 * Populates the carousel and list with the given array of sites objects
 *
 * @param  {Array of sites objects} favorites_list
 */
function populateFavorites(favorites_list) {
	if (!favorites_list) {
		return;
	}
	// favorites_list.forEach(addItemToCarousel);
	favorites_list.forEach(addItemToList);
	// attachBehaviorDropdownSites();
}

/**
 * Adds a class or more classes to the html element
 *
 * @param  {HTML element} elem the html element
 * @param  {String} classes space separated classes identifiers
 * @return {void}
 */
function addClass(elem, classes) {
	let arr = classes.split(" ");
	for (let i = 0; i < arr.length; i++) {
		elem.classList.add(arr[i]);
	}
}

/**
 * Removes a class or more classes from the html element
 *
 * @param  {HTML element} elem the html element
 * @param  {String} classes space separated classes identifiers
 * @return {void}
 */
function removeClass(elem, classes) {
	let arr = classes.split(" ");
	for (let i = 0; i < arr.length; i++) {
		elem.classList.remove(arr[i]);
	}
}

/**
 * Enables the password input field
 *
 * @return {void}
 */
function enablePassword() {
	passwordRequired = true;
	pwdInput.removeAttribute("disabled");
}

/**
 * Disables the password input field
 *
 * @return {void}
 */
function disablePassword() {
	passwordRequired = false;
	pwdInput.setAttribute("disabled", "");
}

/**
 * Adds an item to the UI list of favorites
 *
 * @param  {site object} item a site object
 * @param  {int} index the index in the array of objects
 * @return {void}
 */
function addItemToList(item, index) {
	// console.log(item);
	let it = document.createElement("LI");
	addClass(it, "collection-item grey lighten-2 z-depth-3");
	let htmlCode = `<div><b><span>${item.name}</span> -</b> <span>${item.host}</span><a href="#!" class="secondary-content">
                        <i class="material-icons style="color:${blackColor};">favorite</i>
                            </a>
                    </div>`;
	it.innerHTML = htmlCode;

	it.addEventListener('click', selectFavoriteSite);
	// it.style.cursor = "pointer";
	it.firstElementChild.lastElementChild.addEventListener('click', removeFavoriteSiteList);
	// favoriteList.appendChild(it);
	it.style.color = "grey";
	favoriteList.insertBefore(it, favoriteList.firstChild);
	it.firstElementChild.lastElementChild.firstElementChild.style.color = blackColor; //color heart
	setOnlineStatus(buildConfigURL(item.host), it.firstElementChild.lastElementChild.firstElementChild, it, 1000);
}

/**
 * Adds an item to the UI list of favorites
 *
 * @param  {site object} item a site object
 * @param  {int} index the index in the array of objects
 * @return {void}
 */
function addConnectedSiteToList(item, index) {
	//add only if not present in favorites already
	if (alreadyInFavorites(item.host)) {
		return;
	}
	let it = document.createElement("LI");
	addClass(it, "collection-item grey lighten-2 z-depth-3");
	let htmlCode = `<div><b><span>${item.name}</span> -</b> <span>${item.host}</span><a href="#!" class="secondary-content">
                        <i class="material-icons style="color:${blackColor};">favorite_border</i>
                            </a>
                    </div>`;
	it.innerHTML = htmlCode;

	it.addEventListener('click', selectFavoriteSite);
	// it.style.cursor = "pointer";
	it.firstElementChild.lastElementChild.addEventListener('click', addFavoriteSiteList);
	// favoriteList.appendChild(it);
	it.style.color = "grey";
	favoriteList.insertBefore(it, favoriteList.lastChild.nextSibling);
	it.firstElementChild.lastElementChild.firstElementChild.style.color = blackColor;
	setOnlineStatus(buildConfigURL(item.host), it.firstElementChild.lastElementChild.firstElementChild, it, 1000);
}

/**
 * Adds an item to the carousel of favorites
 *
 * @param  {site object} item a site object
 * @param  {int} index the index in the array of objects
 * @return {void}
 */
// function addItemToCarousel(item, index) {
// 	let it = document.createElement("DIV");
// 	addClass(it, "card small blue-grey darken-2 carousel-item z-depth-3");
// 	let htmlCode = `<div class="card-content white-text">
//                                 <span class="card-title">${item.name}</span><p>${item.host}</p>
//                                 </div>
//                                 <div class="card-action">
//                                     <a href="#"><i
//                                             class="small material-icons prefix" style="color:${offlineColor}">favorite</i></a>
//                                 </div>`;
// 	it.innerHTML = htmlCode;

// 	it.firstElementChild.firstElementChild.addEventListener('click', selectFavoriteSite);
// 	it.firstElementChild.firstElementChild.style.cursor = "pointer";
// 	it.firstElementChild.nextElementSibling.firstElementChild.addEventListener('click', removeFavoriteSite);
// 	favoriteCarousel.appendChild(it);
// 	setOnlineStatus(buildConfigURL(item.host), it.lastChild.firstElementChild.firstElementChild, 1000);
// }

/**
 * Onclick function for clicking on a favorite site in the favorites carousel or list, select the site,
 * it inserts in the url input the current host, loads the information about the site, color heart,
 * check if the hash of the password was previously saved and in case it is, it inserts it into the
 * password field and also sets the isHashSaved variable to true
 *
 * @param  {<a> element} element the clicked <a> element
 * @return {void}
 */
function selectFavoriteSite(event) {
	var elem = event.target;
	console.log(elem.tagName);
	if (elem.tagName === "SPAN") {
		elem = elem.parentElement.parentElement;
	}
	if (elem.tagName === "DIV") {
		elem = elem.parentElement;
	}
	if (elem.tagName === "LI") {
		let host = elem.firstElementChild.firstElementChild.nextElementSibling.innerText;
		let name = elem.firstElementChild.firstElementChild.innerText;
		urlInput.value = host;
		urlInput.setAttribute("data-name", name); // store site name in data-name attr of url
		// color heart
		if (alreadyInFavorites(host)) {
			setFullHeart();
		} else {
			setEmptyHeart();
		}

		// fetch config file and update list
		loadSiteInfo(host);
	}
}

/**
 * Onclick function for clicking on the heart on a card in the carousel
 * Remove from favorites JSON, write JSON file, update carousel removing the site,
 * color heart in white if the url in #url is the
 * same as the one just unselected
 *
 * @method removeFromFavorites
 * @param {<a> element}
 */
// function removeFavoriteSite(event) {
// 	var url = event.target.parentElement.parentElement.parentElement.firstElementChild.lastElementChild.innerText;
// 	let URL_in_form = urlInput.value;
// 	removeFromFavorites(url);
// 	if (URL_in_form === url) {
// 		setEmptyHeart();
// 	}
// }

/**
 * Onclick function for clicking on the heart on a card in the list
 * Remove from favorites JSON, write JSON file, update list removing the site,
 * color heart in white if the url in #url is the
 * same as the one just unselected
 *
 * @method removeFromFavorites
 * @param {<a> element}
 */
function removeFavoriteSiteList(event) {
	var url = event.target.parentElement.parentElement.firstElementChild.nextElementSibling.innerText;
	let URL_in_form = urlInput.value;
	removeFromFavorites(url);
	if (URL_in_form === url) {
		setEmptyHeart();
	}
}

/**
 * Onclick function for clicking on the empty heart on a list item (connected site)
 * Add to favorites JSON, write JSON file, update list removing the site,
 *
 * @method removeFromFavorites
 * @param {<a> element}
 */
function addFavoriteSiteList(event) {
	var itemInside = event.target.parentElement.parentElement;
	// console.log(itemInside.firstElementChild.firstElementChild.innerText);
	var URL = itemInside.firstElementChild.nextElementSibling.innerText;
	let sitename = itemInside.firstElementChild.firstElementChild.innerText; //TODO real sitename

	addToFavorites({
		name: sitename || 'Unknown name',
		host: URL
	});

	//remove from connected sites list since it is pinned in favorites
	var parent = itemInside.parentElement.parentNode;
	var item = itemInside.parentElement;
	parent.removeChild(item);
}


/**
 * Adds a new favorite site to the favorite json if it is not already in the list and writes back to file
 *
 * @method addToFavorites
 * @param {site object} favorite_item the site objet that needs to be added to favorites
 */
function addToFavorites(favorite_item) {
	if (!alreadyInFavorites(favorite_item.host)) {
		favorites.list.push(favorite_item);
		writeFavoritesOnFile(favorites);
		addItemToList(favorite_item);
		// clearList();
		// clearCarousel();
		// populateFavorites(favorites.list);
		// updateInitCarousel();
	}
}

/**
 * Checks if the host is already in the favorites list
 * @param  {String} host the host of the site
 * @return {Boolean} true if the host is already in the favorites list
 */
function alreadyInFavorites(host) {
	if (favorites.list.length === 0) {
		return false;
	}
	var favorite = 0;
	for (favorite of favorites.list) {
		if (favorite.host === host) {
			return true;
		}
	}
	return false;
}

/**
 * Clears the carousel, removing all cards
 *
 * @method clearCarousel
 * @return {void}
 */
// function clearCarousel() {
// 	favoriteCarousel.innerHTML = "";
// }

/**
 * Clears the favorites list, removing all inner elems
 *
 * @method clearList
 * @return {void}
 */
function clearList() {
	favoriteList.innerHTML = "";
}

/**
 * Removes the favorite site from the list in the favorites object, writes back to the JSON, handles UI refreshing
 * TODO popup with UNDO
 *
 * @method removeFromFavorites
 * @param  {String} favorite_url the url of the site
 * @return {void}
 */
function removeFromFavorites(favorite_url) {
	for (let i = 0; i < favorites.list.length; i++) {
		if (favorite_url === favorites.list[i].host) {
			favorites.list.splice(i, 1);
			writeFavoritesOnFile(favorites);



			// clearList();
			// clearCarousel();
			// populateFavorites(favorites.list);
			// updateInitCarousel();
		}
		if (favoriteList.children[i].firstChild.firstChild.nextElementSibling.textContent == favorite_url) {
			favoriteList.removeChild(favoriteList.children[i]);
		}
	}
}

/**
 * Writes favorites in a persistent way on local machine
 *
 * @method writeFavoritesOnFile
 * @param {Object} favorites_obj the object containing the list of favorites
 */
function writeFavoritesOnFile(favorites_obj) {
	fs.writeFile(getAppDataPath(favorites_file_name), JSON.stringify(favorites_obj), 'utf8', () => { });
}

/**
 * TODO remove
 * logging function
 * @param  {any} item
 * @return {void}
 */
function l(item) {
	console.log(item);
}

/**
 * Creates the config file URL from site domain
 *
 * @method buildConfigURL
 * @param  {String} domain the site domain
 * @return the URL for the config file
 */
function buildConfigURL(domain) {
	if (domain === "localhost" || domain === "127.0.0.1") {
		domain = domain + ":" + PREDEFINED_LOCAL_PORT;
	}
	return 'https://' + domain + '/config';
}


/**
 * Onclick function for a site in the sites dropdown: puts the host in the
 * URL input, stores in the data-name attribute of the URL input the name of
 * the site, updates the heart according to if the site is in the favorites
 * list, fetches the new config file and repopulates the dropdowns
 *
 * @param  {Object} e the click event
 * @return {void}
 */
function sitesOnClick(e) {
	// set text of url field
	urlInput.value = e.target.getAttribute('data-host');
	urlInput.setAttribute("data-name", e.target.innerText);
	//check if in favorites, if it is color heart in black, if not color it in white
	if (alreadyInFavorites(e.target.getAttribute('data-host'))) { //TODONOW
		setFullHeart();
	} else {
		setEmptyHeart();
	}
	// fetch config file and update list
	loadSiteInfo(e.target.getAttribute('data-host'));
}

/**
 * Adds an event listener to all sites in dropdown
 *
 * @method attachBehaviorDropdownSites
 * @return {void}
 */
function attachBehaviorDropdownSites() { //TODO change what happens when one is clicked
	const dropd = document.querySelectorAll('.clickable');

	dropd.forEach(function (item) {
		item.addEventListener('click', sitesOnClick);
	});
}

/**
 * Adds an event listener to all IDs in dropdown
 *
 * @method attachBehaviorDropdownIds
 * @return {void}
 */
function attachBehaviorDropdownIds() {
	const dropd = document.querySelectorAll('.clickable-id');

	dropd.forEach(function (item) {
		item.addEventListener('click', (e) => {
			idDropName.innerHTML = e.target.innerHTML;
		});
	});
}

/**
 * Removes all the items in the dropdown with id: ul_id
 *
 * @method removePreviousDropdownItem
 * @param  {String} ul_id the html id of the ul dropdown
 * @return {void}
 */
function removePreviousDropdownItem(ul_id) {
	document.getElementById(ul_id).innerHTML = "";
}

/**
 * Refreshes the dropdowns given a new config JSON file from a site
 *
 * @method populateUI
 * @param  {JSON} config_json the json config file from a site
 * @return {void}
 */
function populateUI(config_json) {
	removePreviousDropdownItem("ids_dropdown"); //clean IDs of previous selection
	addConnectedSitesToList(config_json.remote_sites);
	populateDropdownIds(config_json.displays);


	urlInput.setAttribute("data-name", config_json.name);

	if (config_json.passwordProtected) {
		enablePassword();
		handlePasswordHash(config_json.host);
	} else {
		resetPasswordStatus();
	}
}

/**
 * Resets the password input field value by removing the content and disabling it
 *
 * @return {void}
 */
function resetPasswordStatus() {
	pwdInput.value = "";
	isHashSaved = false;
	disablePassword();
}

/**
 * If the hash of the password was previously saved and in case it is, it inserts it into the
 * password field and also sets the isHashSaved variable to true
 *
 * @param  {String} host the host of the site loaded
 * @return {void}
 */
function handlePasswordHash(host) {
	for (let i = 0; i < favorites.list.length; i++) {
		if (favorites.list[i].host === host) {
			if (favorites.list[i].hash !== undefined) {
				pwdInput.value = favorites.list[i].hash;
				isHashSaved = true;
			}
		}
	}
}

/**
 * Populates the IDs dropdown and initializes the items with an onlclick behavior
 *
 * @method populateDropdownIds
 * @param  {Object} display_ids the displays object from the JSON config
 */
function populateDropdownIds(display_ids) {
	if (!display_ids) {
		return;
	}
	display_ids.forEach(createDropItemIds);
	attachBehaviorDropdownIds();
}

// /**
//  * Populates the Sites dropdown and initializes the items with an onlclick behavior
//  *
//  * @method populateDropdownSites
//  * @param remote_sites the remote_sites object from the JSON config
//  */
// function populateDropdownSites(remote_sites) {
// 	if (!remote_sites) {
// 		return;
// 	}
// 	remote_sites.forEach(createDropItemSites);
// 	attachBehaviorDropdownSites();
// }

/**
 * TODO
 *
 * @method addConnectedSitesToList
 * @param remote_sites the remote_sites object from the JSON config
 */
function addConnectedSitesToList(remote_sites) {
	if (!remote_sites) {
		return;
	}
	// console.log(remote_sites);
	remote_sites.forEach(addConnectedSiteToList);
	attachBehaviorDropdownSites();
}

// /**
//  * Creates a dropdown item for the sites dropdown and appends it
//  *
//  * @param  {Object} item site object
//  * @param  {int} index the index of the site
//  * @return {void}
//  */
// function createDropItemSites(item, index) {
// 	let it = document.createElement("LI");
// 	let htmlCode = `<a class='clickable' data-host= "${item.host}" >${item.name}</a>`;
// 	it.innerHTML = htmlCode;
// 	siteDropdown.appendChild(it);
// }

/**
 * Creates a dropdown item for the IDs dropdown and appends it
 *
 * @param  {Object} item client ID object
 * @param  {int} index the index of the client ID
 * @return {void}
 */
function createDropItemIds(item, index) {
	let it = document.createElement("LI");
	let htmlCode = `<a class='clickable-id' >${index}</a>`;
	it.innerHTML = htmlCode;
	idDropdown.appendChild(it);
}

/**
 * Take site's host and format it properly as a URL, handling clientID and password
 *
 * @method formatProperly
 * @param  {String} url the host site url to be formatted
 * @return {String} the formatted url
 */
function formatProperly(url) {
	const url_start = 'https://';
	if (url === "localhost" || url == '127.0.0.1') {
		url = url + ":" + PREDEFINED_LOCAL_PORT;
	}
	if (!url.startsWith('http://') || !url.startsWith('https://')) {
		url = url_start + url;
	}

	// If display number is toggled then take the ID, if NaN do full screen
	if (check1.checked) {
		var id = isNaN(parseInt(idDropName.innerHTML)) ? -1 : parseInt(idDropName.innerHTML);

		if (id > -2) {
			url = url + '/display.html?clientID=' + id;
		}
	} else {
		url = url + '/display.html?clientID=-1';
	}
	if (passwordRequired) {
		var pwd = pwdInput.value;
		if (pwd == "") { // if the password field is empty try to connect without using a password
			return url;
		} else {
			if (isHashSaved) { // Correct hash previously saved locally
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
	// sending URL to electron.js, params: key value pair (id,URL)
	connectToPage(urlInput.value);
}

function connectToPage(URL) {
	URL = formatProperly(URL);
	ipcRenderer.send('connect-url', URL);
}

/**
 * Handles the UI update if the current site is down by removing the
 * list of IDs and Connected sites from the relative dropdowns, disables
 * the connect button and colors the Info Button in red
 * @return {void}
 */
function onCurrentSiteDown() {
	resetPasswordStatus();
	// removePreviousDropdownItem("sites_dropdown");
	removePreviousDropdownItem("ids_dropdown");
	setLoadInfoButtonOffline();
	disableConnection();
	l('Site server down, timeout reached, refresh to try again');
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
			enableConnection();
			setLoadInfoButtonOnline();
		}
	});
}

// function disableSiteItem(elem) {
// 	removeClass(elem, "blue-grey darken-2");
// 	addClass(elem, "grey lighten-2");
// }

function enableSiteItem(elem) {
	elem.style.cursor = "pointer";
	removeClass(elem, "grey lighten-2");
	addClass(elem, "blue-grey darken-2");
	elem.style.color = "white";

	elem.addEventListener('dblclick', (e) => {
		var elem = e.target;
		if (elem.tagName === "SPAN") {
			elem = elem.parentElement.parentElement;
		}
		if (elem.tagName === "DIV") {
			elem = elem.parentElement;
		}
		if (elem.tagName === "LI") {
			let host = elem.firstElementChild.firstElementChild.nextElementSibling.innerText;
			connectToPage(host);
		}
	});
}

/**
 * Sets the color of card to display online/offline status
 *
 * @param  {String} url of the site
 * @param  {HTML element} elem card elem
 * @param  {any} delay time in ms to wait for fetch request before declaring to be offline
 * @return void
 */
function setOnlineStatus(url, elem, itemElem, delay) {
	// Setting offline as default
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
			// elem.style.color = offlineColor; //color heart red
			return;
		} else {
			// elem.style.color = onlineColor; //color heart green
			enableSiteItem(itemElem);
		}
	});
}

/**
 * Sets colors of the load site info button to display null site status
 * @return {void}
 */
function resetSiteInfo() {
	addClass(loadSiteInfoBtn, buttonColorClass);
	// loadSiteInfoBtnText.textContent = "Load Site Info";
}

/**
 * Sets colors of the load site info button to display online site
 * @return {void}
 */
function setLoadInfoButtonOnline() {
	removeClass(loadSiteInfoBtn, buttonColorClass);
	loadSiteInfoBtn.style.background = onlineColor;
}

function pulseOnce(elem) {
	addClass(elem, pulseClass);
	setInterval(() => {
		removeClass(elem, pulseClass);
	}, 1000);
}

/**
 * Enables the connect button
 *
 * @return {void}
 */
function enableConnection() {
	removeClass(okayBtn, 'disabled');
	pulseOnce(okayBtn);
}

/**
 * Disables the connect button
 *
 * @return {void}
 */
function disableConnection() {
	addClass(okayBtn, 'disabled');
}

/**
 * Sets colors of the load site info button to display offline site
 * @return {void}
 */
function setLoadInfoButtonOffline() {
	removeClass(loadSiteInfoBtn, buttonColorClass);
	// loadSiteInfoBtnText.textContent = "Site Offline";
	loadSiteInfoBtn.style.background = offlineColor;
}

/**
 * Onclick handler for Load site info button. gets the current site in url and loads its info
 * @return {void}
 */
function loadCurrentSiteInfo() {
	loadSiteInfo(urlInput.value);
}

/**
 * Loads information about a site given its host. Populates dropdowns, sets online/offline status
 * @param  {String} host the host of the site to load
 * @return {void}
 */
function loadSiteInfo(host) {
	// color heart
	if (alreadyInFavorites(host)) {
		setFullHeart();
	} else {
		setEmptyHeart();
	}
	fetchWithTimeout(buildConfigURL(host), 1000, () => {
		onCurrentSiteDown();
	})
		.catch(err => {
			throw err;
		});
}

/**
 * Initializes the JS for the carousel
 *
 * @method updateInitCarousel
 * @return {void}
 */
// function updateInitCarousel() {
// 	var elems = document.querySelectorAll('.carousel');
// 	let options = {
// 		duration: 100,
// 		dist: -100,
// 		indicators: true
// 	};
// 	if (typeof elems !== 'undefined') {
// 		M.Carousel.init(elems, options);
// 	}
// }

/**
 * Swtiches the favorites UI to a vertical scrollable list
 *
 * @return {void}
 */
// function switchToListUI() {
// 	favoriteCarousel.hidden = true;
// 	favoriteList.parentElement.hidden = false;
// 	favorites.UIswitchPosition = FAVORITES_LIST_UI;
// 	writeFavoritesOnFile(favorites);
// }

/**
 * Swtiches the favorites UI to the carousel
 *
 * @return {void}
 */
// function switchToCarouselUI() {
// 	favoriteList.parentElement.hidden = true;
// 	// favoriteCarousel.hidden = false;
// 	favorites.UIswitchPosition = FAVORITES_CAROUSEL_UI;
// 	writeFavoritesOnFile(favorites);
// 	// updateInitCarousel();
// }

/**************************** Functions finished *****************************/
// favoriteList.parentElement.hidden = true;

// Catches the message sent from the main electron window that is providing the current location
ipcRenderer.on('current-location', (e, host) => {
	urlInput.value = host;
	loadSiteInfo(host);
});

/******************* Adding event listeners to html elems ********************/

// Initialize dropdown and carousel with sites
document.addEventListener('DOMContentLoaded', function () {
	var elems = document.querySelectorAll('.dropdown-trigger');
	let options = {
		edge: 'left',
		hover: true
		// noWrap: true
	};
	M.Dropdown.init(elems, options);

	//carousel init
	// updateInitCarousel();

	attachBehaviorDropdownSites();
});

// Adds behavior to ClientID checkbox1 input
check1.addEventListener('click', (e) => {
	var checked = e.target.checked;
	if (checked) {
		if (check2.checked) {
			check2.checked = false;
		}
		addClass(idDropName, 'scale-in');
	}
});

// Adds behavior to ClientID checkbox2 input
check2.addEventListener('click', (e) => {
	var checked = e.target.checked;
	if (checked) {
		if (check1.checked) {
			check1.checked = false;
		}
		removeClass(idDropName, 'scale-in');
	}
});

// Adds behavior to the favorites UI switch
// switchFavoritesUI.addEventListener('click', (e) => {
// 	var checked = e.target.checked;
// 	if (checked) {
// 		switchToListUI();
// 	} else {
// 		switchToCarouselUI();
// 	}
// });

okayBtn.addEventListener('click', okayOnClick);
cancelBtn.addEventListener('click', cancelOnClick);
loadSiteInfoBtn.addEventListener('click', loadCurrentSiteInfo);


// Checks if modified url input contains host of a site in favorite and sets the heart status and loads site information,
// Removes password and disables password input
urlInput.addEventListener("input", (e) => {
	let host = urlInput.value;
	resetPasswordStatus();
	if (alreadyInFavorites(host)) {
		setFullHeart();
		loadSiteInfo(host); //TODO
	} else {
		setEmptyHeart();
		resetSiteInfo();
		disableConnection();
	}
});
