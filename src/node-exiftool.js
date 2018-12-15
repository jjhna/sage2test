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
 * Metadata processing using ExifTool
 *   ExifTool by Phil Harvey: http://www.sno.phy.queensu.ca/~phil/exiftool/
 *
 * @module server
 * @submodule exiftool
 * @class exiftool
 */

// require variables to be declared
'use strict';

const exiftool = require("exiftool-vendored").exiftool;

/**
 * Process a file, using exec method
 *
 * @method file
 * @param filename {String} name of the file to be tested
 * @param done {Function} executed when done, done(error, metadata)
 */
function file(filename, done) {
	exiftool
		.read(filename, ['-m', '-json', '-filesize#', '-all'])
		.then(function(tags) {
			if ('SourceFile' in tags) {
				if (tags.Error) {
					// if there was an error because unknown file type, delete it
					delete tags.Error;
				}
				// Add a dummy type if needed
				if (!tags.MIMEType) {
					tags.MIMEType = 'text/plain';
				}
				if (!tags.FileType) {
					tags.FileType = 'text/plain';
				}
				if (tags.FileModifyDate) {
					tags.FileModifyDate = tags.FileModifyDate.toISOString();
				}
				if (tags.FileAccessDate) {
					tags.FileAccessDate = tags.FileAccessDate.toISOString();
				}
				if (tags.FileInodeChangeDate) {
					tags.FileInodeChangeDate = tags.FileInodeChangeDate.toISOString();
				}
			}
			done(null, tags);
		})
		.catch(function(err) {
			done('Fatal Error: Unable to load exiftool. ' + err);
		});
}

exports.file = file;
