// Renaming require keyword to be able to use jQuery and node in electron, load node modules with nodeRequire()
window.nodeRequire = require;
delete window.require;
delete window.exports; delete window.module;

const electron = nodeRequire('electron');
const fs = nodeRequire('fs');
const { ipcRenderer } = electron;

const favorites_path = '/tmp/sage2_favorite_sites.json';

// DOM Element declaration
const favoriteHeart = document.getElementById("favorite_heart");
const favoriteCarousel = document.getElementById("favorites_carousel");
const idDropdown = document.getElementById('ids_dropdown');
const idDropName = document.getElementById('id_drop');
const siteDropdown = document.getElementById('sites_dropdown');
const check1 = document.getElementById('check_1');
const check2 = document.getElementById('check_2');
const urlInput = document.getElementById('url');

const onlineColor = "#60d277";
const offlineColor = "#d5715d";

//JS object containing list of favorites sites
var favorites = {
	list: []
	// list: [{
	//     host: 'orion-win.evl.uic.edu',
	//     name: 'CAVE2'
	// },
	// {
	//     host: 'test.edu',
	//     name: 'CAVE3'
	// },
	// {
	//     host: 'hhhg.sds.ds',
	//     name: 'CAVE4'
	// }]
};

// Reading the favorites json file
fs.readFile(favorites_path, 'utf8', function readFileCallback(err, data) {
	if (err) { // most likely no json file (first use), write empty favorites on file
		console.log(err);
		writeFavoritesOnFile(favorites);
	} else {
		favorites = JSON.parse(data); //convert json to object
		if (favorites.list.length > 0) {
			clearCarousel();
			populateCarousel(favorites.list);
			updateInitCarousel();
		}
	}
});


// add on click listener to heart (add/remove from favorites)
/**
 *
 * TODO when added to favorites load its config file
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
 * Populates the carousel with the given array of sites objects
 *
 * @param  {Array of sites objects} favorites_list
 */
function populateCarousel(favorites_list) {
	if (!favorites_list) {
		return;
	}
	favorites_list.forEach(addItemToCarousel);
	// attachBehaviorDropdownSites();
}

function addClass(elem, classes) {
	let arr = classes.split(" ");
	for (let i = 0; i < arr.length; i++) {
		elem.classList.add(arr[i]);
	}
}

function removeClass(elem, classes) {
	let arr = classes.split(" ");
	for (let i = 0; i < arr.length; i++) {
		elem.classList.remove(arr[i]);
	}
}

/**
 * Adds an item to the carousel of favorites
 *
 * @param  {site object} item a site object
 * @param  {int} index the index in the array of objects
 * @return {void}
 */
function addItemToCarousel(item, index) {
	let it = document.createElement("DIV");
	addClass(it, "card blue-grey darken-2 carousel-item z-depth-3");
	let htmlCode = `<div class="card-content white-text">
                                <span class="card-title">${item.name}</span><p>${item.host}</p>
                                </div>
                                <div class="card-action">
                                    <a onclick="selectFavoriteSite(this)" href="#"><i
                                            class="material-icons prefix" style="color:${offlineColor}">add_to_queue</i></a>
                                    <a onclick="removeFavoriteSite(this)" href="#"><i
                                            class="small material-icons prefix" style="color:${offlineColor}">favorite</i></a>
                                </div>`;
	it.innerHTML = htmlCode;

	favoriteCarousel.appendChild(it);
	setOnlineStatus(buildConfigURL(item.host), it, 1000);
}

/**
 * Onclick function for clicking on a favorite site in the favorite carousel, select the site
 *
 * @param  {<a> element} element the clicked <a> element
 * @return {void}
 */
function selectFavoriteSite(element) {
	let host = element.parentElement.parentElement.firstElementChild.lastElementChild.innerText;
	let name = element.parentElement.parentElement.firstElementChild.firstElementChild.innerText;

	urlInput.value = host;
	urlInput.setAttribute("data-name", name); // store site name in data-name attr of url
	//check if in favorites, if it is color heart in black, if not color it in white
	setFullHeart();
	// fetch config file and update list
	fetchWithTimeout(buildConfigURL(host), 1000, () => {
		onCurrentSiteDown();
	})
		.catch(err => {
			throw err;
		});
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
function removeFavoriteSite(element) {
	var url = element.parentElement.parentElement.firstElementChild.lastElementChild.innerText;
	let URL_in_form = urlInput.value;
	removeFromFavorites(url);
	if (URL_in_form === url) {
		setEmptyHeart();
	}
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
		clearCarousel();
		populateCarousel(favorites.list);
		updateInitCarousel();
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
function clearCarousel() {
	favoriteCarousel.innerHTML = "";
}

/**
 * Removes the favorite site from the list in the favorites object, writes back to the JSON, handles UI refreshing
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
			clearCarousel();
			populateCarousel(favorites.list);
			updateInitCarousel();
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
	fs.writeFile(favorites_path, JSON.stringify(favorites_obj), 'utf8', () => { });
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
	return 'https://' + domain + '/config';
}


/**
 * Onclick function for a site in the sites dropdown: puts the host in the URL input, stores in the data-name attribute
 * of the URL input the name of the site, updates the heart according to if the site is in the favorites list,
 * fetches the new config file and repopulates the dropdowns
 *
 * @param  {Object} e the click event
 * @return {void}
 */
function sitesOnClick(e) {
	// set text of url field
	urlInput.value = e.target.getAttribute('data-host');
	urlInput.setAttribute("data-name", e.target.innerText);
	//check if in favorites, if it is color heart in black, if not color it in white
	if (alreadyInFavorites(e.target.getAttribute('data-host'))) {
		setFullHeart();
	} else {
		setEmptyHeart();
	}
	// fetch config file and update list
	fetchWithTimeout(buildConfigURL(e.target.getAttribute('data-host')), 1000, () => {
		onCurrentSiteDown();
	})
		.catch(err => {
			throw err;
		});

}

/**
 * Adds an event listener to all sites in dropdown
 *
 * @method attachBehaviorDropdownSites
 * @return {void}
 */
function attachBehaviorDropdownSites() {
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
	removePreviousDropdownItem("sites_dropdown");
	removePreviousDropdownItem("ids_dropdown");

	populateDropdownSites(config_json.remote_sites);
	populateDropdownIds(config_json.displays);
	// TODO password
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

/**
 * Populates the Sites dropdown and initializes the items with an onlclick behavior
 *
 * @method populateDropdownSites
 * @param remote_sites the remote_sites object from the JSON config
 */
function populateDropdownSites(remote_sites) {
	if (!remote_sites) {
		return;
	}
	remote_sites.forEach(createDropItemSites);
	attachBehaviorDropdownSites();
}

/**
 * Creates a dropdown item for the sites dropdown and appends it
 *
 * @param  {Object} item site object
 * @param  {int} index the index of the site
 * @return {void}
 */
function createDropItemSites(item, index) {
	let it = document.createElement("LI");
	let htmlCode = `<a class='clickable' data-host= "${item.host}" >${item.name}</a>`;
	it.innerHTML = htmlCode;
	siteDropdown.appendChild(it);
}

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
 * Take site's host and format it properly as a URL
 *
 * @method formatProperly
 * @param  {String} url the host site url to be formatted
 * @return {String} the formatted url
 */
function formatProperly(url) {
	const url_start = 'https://';
	if (!url.startsWith('http://') || !url.startsWith('https://')) {
		url = url_start + url;
	}

	// If display number is toggled then take the ID, if NaN do full sscreen
	if (check1.checked) {
		var id = isNaN(parseInt(idDropName.innerHTML)) ? -1 : parseInt(idDropName.innerHTML);

		if (id > -2) {
			url = url + '/display.html?clientID=' + id;
		}
	} else {
		url = url + '/display.html?clientID=-1';
	}
	return url;
}

/**
 * Okay button handler. Creates the url based on user input and sends it to the main electron.js to connect to the selected site
 */
const form = document.querySelector('form');
form.addEventListener('submit', (e) => {
	if (e.target.id == "cancel_btn") {
		ipcRenderer.send('close-connect-page', "0");
	} else {
		e.preventDefault();
		let URL = urlInput.value;

		URL = formatProperly(URL);
		//sending URL to electron.js, params: key value pair (id,URL)
		ipcRenderer.send('connect-url', URL);
	}
});

ipcRenderer.on('current-location', (e, host) => {
	fetchWithTimeout(buildConfigURL(host), 1000, () => {
		onCurrentSiteDown();
	})
		.catch(err => {
			throw err;
		});
});

function onCurrentSiteDown() {
	removePreviousDropdownItem("sites_dropdown");
	removePreviousDropdownItem("ids_dropdown");
	l('Site server down, timeout reached, refresh to try again');
}


/**
 * fetches the config JSON from the site's url provided, executes the onTimeout function
 * if the delay is passed without hearing back from the fetch callback.
 * otherwise it populates the UI with the JSON containing the list of connected sites
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

function setOnlineStatus(url, elem, delay) {
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
			elem.lastChild.firstElementChild.firstElementChild.style.color = offlineColor;
			elem.lastChild.lastElementChild.firstElementChild.style.color = offlineColor;
			return;
		} else {
			elem.lastChild.firstElementChild.firstElementChild.style.color = onlineColor;
			elem.lastChild.lastElementChild.firstElementChild.style.color = onlineColor;
		}
	});
}

/**
 * Initializes the JS for the carousel
 *
 * @method updateInitCarousel
 * @return {void}
 */
function updateInitCarousel() {
	var elems = document.querySelectorAll('.carousel');
	let options = {
		duration: 100,
		dist: -100,
		indicators: true
	};
	if (typeof elems !== 'undefined') {
		var instances = M.Carousel.init(elems, options);
	}
}

// Initialize dropdown and carousel with sites
document.addEventListener('DOMContentLoaded', function () {
	var elems = document.querySelectorAll('.dropdown-trigger');
	let options = {
		edge: 'left',
		hover: true
		// noWrap: true
	};
	var instances = M.Dropdown.init(elems, options);

	//carousel init
	updateInitCarousel();

	attachBehaviorDropdownSites();
});

check1.addEventListener('click', (e) => {
	var checked = e.target.checked;
	if (checked) {
		if (check2.checked) {
			check2.checked = false;
		}
		addClass(idDropName, 'scale-in');
	}
});

check2.addEventListener('click', (e) => {
	var checked = e.target.checked;
	if (checked) {
		if (check1.checked) {
			check1.checked = false;
		}
		removeClass(idDropName, 'scale-in');
	}
});

urlInput.addEventListener("input", (e) => {
	let host = urlInput.value;
	if (alreadyInFavorites(host)) {
		setFullHeart();
	} else {
		setEmptyHeart();
	}
});
