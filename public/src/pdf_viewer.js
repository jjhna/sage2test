// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

"use strict";

/**
 * @module client
 * @submodule pdf_viewer
 */

PDFJS.workerSrc       = 'lib/pdf.worker.js';
PDFJS.disableWorker   = false;
PDFJS.disableWebGL    = true;
PDFJS.verbosity       = PDFJS.VERBOSITY_LEVELS.infos;
PDFJS.maxCanvasPixels = 67108864; // 8k2

/**
 * PDF viewing application, based on pdf.js library
 *
 * @class pdf_viewer
 */
 var pdf_viewer = SAGE2_App.extend({
	/**
	* Init method, creates an 'img' tag in the DOM and a few canvas contexts to handle multiple redraws
	*
	* @method init
	* @param data {Object} contains initialization values (id, width, height, ...)
	*/
	init: function(data) {
		this.SAGE2Init("img", data);

		this.resizeEvents = "onfinish";

		this.canvas  = [];
		this.ctx     = [];
		this.loaded  = false;
		this.pdfDoc  = null;
		this.ratio   = null;
		this.currCtx = 0;
		this.numCtx  = 5;
		this.src     = null;
		this.gotresize      = false;
		this.enableControls = true;
		this.old_doc_url = "";

		// application specific 'init'
		for (var i = 0; i < this.numCtx; i++) {
			var canvas = document.createElement("canvas");
			canvas.width  = this.element.width;
			canvas.height = this.element.height;
			var ctx = canvas.getContext("2d");

			this.canvas.push(canvas);
			this.ctx.push(ctx);
		}

		this.updateAppFromState(data.date);
	},

	/**
	* Load the app from a previous state, parses the PDF and creates the widgets
	*
	* @method load
	* @param state {Object} object to initialize or restore the app
	* @param date {Date} time from the server
	*/
	load: function(date) {
		this.updateAppFromState(date);
	},

	updateAppFromState: function(date) {
		if (this.old_doc_url !== this.state.doc_url) {
			var _this = this;
			this.loaded = false;

			var docURL = cleanURL(this.state.doc_url);

			PDFJS.getDocument({url: docURL}).then(function getDocumentCallback(pdfDocument) {
				console.log("loaded pdf document", _this.gotresize);
				_this.pdfDoc = pdfDocument;
				_this.loaded = true;

				_this.addWidgetControlsToPdfViewer();

				// if already got a resize event, just redraw, otherwise send message
				if (_this.gotresize) {
					_this.refresh(date);
					_this.gotresize = false;
				} else {
					// Getting the size of the page
					_this.pdfDoc.getPage(1).then(function(page) {
						var viewport = page.getViewport(1.0);
						var w = parseInt(viewport.width,  10);
						var h = parseInt(viewport.height, 10);
						_this.ratio = w / h;
						// Depending on the aspect ratio, adjust one dimension
						if (_this.ratio < 1) {
							_this.sendResize(_this.element.width, _this.element.width / _this.ratio);
						} else {
							_this.sendResize(_this.element.height * _this.ratio, _this.element.height);
						}
					});
				}
			});
			this.old_doc_url = this.state.doc_url;
		} else {
			// load new state of same document
			this.refresh(date);
		}
	},

	/**
	* Adds custom widgets to app
	*
	* @method addWidgetControlsToPdfViewer
	*/
	addWidgetControlsToPdfViewer: function() {
		if (this.pdfDoc.numPages > 1) {
			this.controls.addButton({type: "fastforward", position: 6, identifier: "LastPage"});
			this.controls.addButton({type: "rewind",      position: 2, identifier: "FirstPage"});
			this.controls.addButton({type: "prev",        position: 3, identifier: "PreviousPage"});
			this.controls.addButton({type: "next",        position: 5, identifier: "NextPage"});
			this.controls.addSlider({
				minimum: 1,
				maximum: this.pdfDoc.numPages,
				increments: 1,
				property: "this.state.page",
				label: "Page",
				identifier: "Page"
			});
		}
		this.controls.finishedAddingControls();
	},

	/**
	* Draw function, renders the current page into a canvas
	*
	* @method draw
	* @param date {Date} current time from the server
	*/
	draw: function(date) {
		if (this.loaded === false) {
			return;
		}

		var _this = this;
		var renderPage = this.state.page;
		var renderCanvas;

		var gotPdfPage = function(pdfPage) {
			renderCanvas = _this.currCtx;

			// set the scale to match the canvas
			var viewport = pdfPage.getViewport(_this.canvas[renderCanvas].width / pdfPage.getViewport(1.0).width);

			// Render PDF page into canvas context
			var renderContext = {
				canvasContext: _this.ctx[_this.currCtx],
				viewport: viewport,
				continueCallback: function(cont) {
					cont(); // nothing special right now
				}
			};
			_this.currCtx = (_this.currCtx + 1) % _this.numCtx;

			pdfPage.render(renderContext).then(renderPdfPage);
		};

		var renderPdfPage = function() {
			if (renderPage === _this.state.page) {
				var data = _this.canvas[renderCanvas].toDataURL().split(',');
				var bin  = atob(data[1]);
				var mime = data[0].split(':')[1].split(';')[0];

				var buf  = new ArrayBuffer(bin.length);
				var view = new Uint8Array(buf);
				for (var i = 0; i < view.length; i++) {
					view[i] = bin.charCodeAt(i);
				}

				var blob = new Blob([buf], {type: mime});
				var source = window.URL.createObjectURL(blob);

				if (_this.src !== null) {
					window.URL.revokeObjectURL(_this.src);
				}
				_this.src = source;

				_this.element.src = _this.src;
			}
		};
		this.pdfDoc.getPage(this.state.page).then(gotPdfPage);
	},

	/**
	* Resize function, resizes all the canvas contexts
	*
	* @method resize
	* @param date {Date} current time from the server
	*/
	resize: function(date) {
		console.log("resize pdf viewer");
		for (var i = 0; i < this.numCtx; i++) {
			this.canvas[i].width  = this.element.width;
			this.canvas[i].height = this.element.height;
		}
		// Force a redraw after resize
		this.gotresize = true;
		this.refresh(date);
	},

	/**
	* Handles event processing, arrow keys to navigate, and r to redraw
	*
	* @method event
	* @param eventType {String} the type of event
	* @param position {Object} contains the x and y positions of the event
	* @param user_id {Object} data about the user who triggered the event
	* @param data {Object} object containing extra data about the event,
	* @param date {Date} current time from the server
	*/
	event: function(eventType, position, user, data, date) {
		// Left Click  - go back one page
		// Right Click - go forward one page
		// if (eventType === "pointerPress") {
		// 	if (data.button === "left") {
		// 		if (this.state.page <= 1) {
		// 			return;
		// 		}
		// 		this.state.page = this.state.page - 1;
		// 		this.refresh(date);
		// 	} else if (data.button === "right") {
		// 		if (this.state.page >= this.pdfDoc.numPages) {
		// 			return;
		// 		}
		// 		this.state.page = this.state.page + 1;
		// 		this.refresh(date);
		// 	}
		// }

		// Keyboard:
		//   spacebar - next
		//   1 - first
		//   0 - last
		if (eventType === "keyboard") {
			if (data.character === " ") {
				this.state.page = (this.state.page + 1) % this.pdfDoc.numPages;
				this.refresh(date);
			}
			if (data.character === "1") {
				this.state.page = 1;
				this.refresh(date);
			}
			if (data.character === "0") {
				this.state.page = this.pdfDoc.numPages;
				this.refresh(date);
			}
			// Press 'x' to close itself
			if (data.character === 'x') {
				this.close();
			}
		}

		// Left Arrow  - go back one page
		// Right Arrow - go forward one page
		if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "up") { // Left Arrow
				if (this.state.page <= 1) {
					return;
				}
				this.state.page = this.state.page - 1;
				this.refresh(date);
			} else if (data.code === 39 && data.state === "up") { // Right Arrow
				this.state.page = (this.state.page + 1) % this.pdfDoc.numPages;
				this.refresh(date);
			}
		} else if (eventType === "widgetEvent") {
			switch (data.identifier) {
				case "LastPage":
					this.state.page = this.pdfDoc.numPages;
					break;
				case "FirstPage":
					this.state.page = 1;
					break;
				case "PreviousPage":
					if (this.state.page <= 1) {
						return;
					}
					this.state.page = this.state.page - 1;
					break;
				case "NextPage":
					if (this.state.page >= this.pdfDoc.numPages) {
						return;
					}
					this.state.page = this.state.page + 1;
					break;
				case "Page":
					switch (data.action) {
						case "sliderRelease":
							break;
						default:
							return;
					}
					break;
				default:
					return;
			}
			this.refresh(date);
		} else if (eventType === "keyboard") {
			if (data.character === "r" || data.character === "R") {
				this.refresh(date);
			}
		}
	}
});
