// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2017


// Require variables to be declared
"use strict";

// Builtins
// var fs    = require('fs');
// modules defined in package.json
var chalk = require('chalk'); // used for colorizing the console output
// SAGE2 modules
var sageutils = require('../src/node-utils');
// sageutils.log("Prefix before >", "Message", "additional");


/**
 * VersionChecker container object.
 *
 * @class VersionChecker
 * @constructor
 * @param  {object} obj - Object containing necessary references to function at server top level
 */
function VersionChecker(obj) {
	sageutils.log("Version manager>", "Starting...");
	sageutils.log("Version manager>", "Base: " + obj.version.base);
	sageutils.log("Version manager>", "Branch: " + obj.version.branch);
	sageutils.log("Version manager>", "Date: " + obj.version.date);
	this.myVersion = obj.version;

	this.config = obj.config;
	// Just the remote site section from the config
	this.remote_sites = obj.config.remote_sites;
	// Keep the function references
	this.showGenericInfoPaneOnDisplay = obj.showGenericInfoPaneOnDisplay;

	// Using this to ensure all messages are visible.
	this.messageQueue = [];
}


/**
 * Function doesThisServerKnowAboutRemoteSite is to determine if
 * local server know about a particular remote_sites.
 *
 * @method doesThisServerKnowAboutRemoteSite
 * @param  {String} host - String of the host address for remote site.
 */
VersionChecker.prototype.doesThisServerKnowAboutRemoteSite = function(host) {
	let found = false;
	for (var i = 0; i < this.remote_sites.length; i++) {
		if (host.includes(this.remote_sites[i].host)
			|| this.remote_sites[i].host.includes(host)) {
			found = i;
			break;
		}
	}
	if (found === false) {
		sageutils.log("Version manager",
			chalk.bgRed("Incomming remote connection initiated by site '" + host
				+ " not specified by local config"));
	}
	return found;
};


/**
 * Function determineIfVersionMismatch to detect if remote site has a
 * different version from the local version.
 *
 * @method determineIfVersionMismatch
 * @param  {Object} remoteData - Data remote site sends about its remote config
 * @param  {Object} site - Information part of the socket handler for the remote site
 * @param  {String} remotesocketAddress - Address of the remote socket for reporting.
 */
VersionChecker.prototype.determineIfVersionMismatch = function(remoteData, site, remotesocketAddress) {
	// Need to know if remote site know about this server
	// Note: only possible to determine if verion is after ~2019 05
	let found = this.doesRemoteSiteKnowAboutThisServer(remoteData);
	// Versioning between remote sites.
	let mismatch = this.determineIfVersionMismatchBetweenRemoteSiteAndThiServer(remoteData);


	if (mismatch) {
		let mismatchMessage = [
			"-----VERSION MISMATCH DETECTED-----",
			"Warning mismatch with remote site" + site.name
		];
		if (mismatch.beforeCheckVersion) {
			mismatchMessage.push("Remote site " + site.name + " has an older version and is unable to report its version");
		}
		if (mismatch.base) {
			mismatchMessage.push("Remote site " + site.name + " has "
			+ mismatch.baseOfRemote + " version and may not work well with this site");
			mismatchMessage.push("This site (" + this.myVersion.base
			+ ") vs (" + remoteData.version.base + ") remote site");
		}
		if (mismatch.branch) {
			mismatchMessage.push("Remote site " + site.name + " has a different branch ("
			+ mismatch.branchOfRemote + ") and may not work well with this site");
			mismatchMessage.push("This site (" + this.myVersion.branch
			+ ") vs (" + remoteData.version.branch + ") remote site");
		}
		if (mismatch.date) {
			mismatchMessage.push("Remote site " + site.name + " has a "
			+ mismatch.dateOfRemote + " release and may not work well with this site");
			mismatchMessage.push("This site (" + this.myVersion.date
			+ ") vs (" + remoteData.version.date + ") remote site");
		}
		mismatchMessage.push("-----VERSION MISMATCH END OF REPORT-----");
		mismatchMessage.forEach((line) => {
			sageutils.log("Version manager", chalk.bgRed(line));
		});
	}

	let messageForDisplay = remotesocketAddress + "\r\n";
	let shouldSendMessage = false;
	if (!found) {
		shouldSendMessage = true;
		messageForDisplay += " Isn't aware of this site\r\n";
	}
	if (mismatch) {
		shouldSendMessage = true;
		messageForDisplay += " Doesn't have same version\r\n";
	}
	if (shouldSendMessage) {
		messageForDisplay += " Sharing may not work correctly\r\n";
		this.tryShowMessageOnDisplay({message: messageForDisplay, hideReject: true}, remoteData, remotesocketAddress);
	}
};


/**
 * Function doesRemoteSiteKnowAboutThisServer is to determine if
 * remote site lists this server in its config.remote_sites.
 *
 * @method doesRemoteSiteKnowAboutThisServer
 * @param  {Object} remoteData - Data remote site gave
 */
VersionChecker.prototype.doesRemoteSiteKnowAboutThisServer = function(remoteData) {
	// Check if remote_sites given. Only exists after ~2019 05 update
	let found = false;
	if (remoteData.locationInformation && remoteData.locationInformation.remote_sites) {
		for (var i = 0; i < remoteData.locationInformation.remote_sites.length; i++) {
			if (this.config.host === remoteData.locationInformation.remote_sites[i].host) {
				found = true;
				break;
			}
		}
		// Can only check if remote site know about this one post previously mentioned update
		if (!found) {
			sageutils.log("Version manager",
				chalk.bgRed("The site " + remoteData.locationInformation.host
					+ " doesn't know about this host. They may not be able to share anything back."));
		}
	}
	return found;
};


/**
 * Function determineIfVersionMismatchBetweenRemoteSiteAndThiServer is to determine if
 * remote site lists this server in its config.remote_sites.
 *
 * @method determineIfVersionMismatchBetweenRemoteSiteAndThiServer
 * @param  {Object} remoteData - Data remote site gave
 */
VersionChecker.prototype.determineIfVersionMismatchBetweenRemoteSiteAndThiServer = function(remoteData) {
	let mismatch = false;
	if (remoteData.version) {
		if (remoteData.version.base !== this.myVersion.base) {
			mismatch = {
				base: "mismatch",
				baseOfRemote: (this.myVersion.base > remoteData.version.base) ? "OLDER" : "NEWER"
			};
		}
		if (remoteData.version.branch !== this.myVersion.branch) {
			mismatch = (mismatch) ? mismatch : {};
			mismatch.branch = "mismatch";
			mismatch.branchOfRemote = remoteData.version.branch;
		}
		if (remoteData.version.date !== this.myVersion.date) {
			mismatch = (mismatch) ? mismatch : {};
			mismatch.date = "mismatch";
			mismatch.dateOfRemote = (this.myVersion.date > remoteData.version.date) ? "OLDER" : "NEWER";
		}
	} else {
		mismatch = {};
		mismatch.beforeCheckVersion = true;
	}

	return mismatch;
};

/**
 * Function tryShowMessageOnDisplay will attempt to ensure all messages get shown.
 * Assumes message SHOULD be shown.
 *
 * @method tryShowMessageOnDisplay
 */
VersionChecker.prototype.tryShowMessageOnDisplay = function(messageData, remoteData, remotesocketAddress) {

	/*
		If the message queue has something in it, then wait.
		Messages in the queue look like:
			{
				remoteData:
				messageData: messageData
			}
	*/
	if (this.messageQueue.length == 0) {
		// Show the message
		this.showGenericInfoPaneOnDisplay(true, messageData);
	}
	let queueData = {
		remoteData,
		messageData
	};
	// Double check index reference
	let remoteSiteIndex = this.doesThisServerKnowAboutRemoteSite(remotesocketAddress);
	if (remoteSiteIndex) {
		// Able to find valid index
		queueData.remoteSiteIndex = remoteSiteIndex;
		if (this.remote_sites[remoteSiteIndex].hasAcceptedNotification) {

			// NOTE! Return here if already asked the question
			return;
		}
	}
	// Push the message now
	this.messageQueue.push(queueData);
};


/**
 * Function tryShowNextMesageInQueueOnDisplay will attempt
 * to ensure all messages get shown. Assumes message SHOULD be shown.
 *
 * @method tryShowNextMesageInQueueOnDisplay
 */
VersionChecker.prototype.tryShowNextMesageInQueueOnDisplay = function(acceptOrReject) {
	// Remote the first message
	this.messageQueue.splice(0, 1);
	// MODIFY STATUS OF ACCEPT REJECT
	sageutils.log("Version manager", chalk.bgRed("MODIFY STATUS OF ACCEPT REJECT"));
	if (this.messageQueue.length > 0) {
		// Show the message
		this.showGenericInfoPaneOnDisplay(true, this.messageQueue[0].messageData);
	}
};


/**
 * Function reportReject is to handle the result of a prompt.
 *
 * @method reportReject
 */
VersionChecker.prototype.reportReject = function() {
	sageutils.log("Version manager>", "Reporting REJECT");
	setTimeout(() => {
		this.tryShowNextMesageInQueueOnDisplay("REJECT");
	}, 1500);
};


/**
 * Function reportAccept is to handle the result of a prompt.
 *
 * @method reportAccept
 */
VersionChecker.prototype.reportAccept = function() {
	sageutils.log("Version manager>", "Reporting ACCEPT");

	if (this.messageQueue[0].remoteSiteIndex) {
		this.remote_sites[this.messageQueue[0].remoteSiteIndex].hasAcceptedNotification = true;
	}
	setTimeout(() => {
		this.tryShowNextMesageInQueueOnDisplay("ACCEPT");
	}, 1500);
};


module.exports = VersionChecker;
