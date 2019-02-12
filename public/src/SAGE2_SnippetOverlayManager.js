// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-19

"use strict";

/* global ace d3 displayUI interactor wsio SAGE2_SnippetExporter CodeSnippetCompiler */

let SAGE2_SnippetOverlayManager = (function() {
	// snippet type color palette
	let lightColor = { gen: "#b3e2cd", data: "#cbd5e8", draw: "#fdcdac" };
	let darkColor = { gen: "#87d1b0", data: "#9db0d3", draw: "#fba76d" };

	return function(config) {
		let self = {
			showOverlay: false,
			overlay: d3.select("#snippetsOverlay"),

			appGroup: null,
			linkGroup: null,

			// appElements: null,

			snippetStates: null,

			associations: null,
			appMapping: null,

			snippetLinks: {},
			snippetApps: {}
		};

		init();

		function init() {
			console.log(config);
			self.overlay.attr(
				"viewBox",
				[
					0,
					0,
					config.totalWidth,
					config.totalHeight
				].join(", ")
			);

			setOverlayVisibility(true);

			self.titleBarOffset = config.ui.titleBarHeight;

			self.linkGroup = self.overlay.append("g")
				.attr("transform", `translate(0, ${config.ui.titleBarHeight})`);

			self.appGroup = self.overlay.append("g");
		}

		function setOverlayVisibility(isVisible) {
			self.showOverlay = isVisible;

			self.overlay.style("display", isVisible ? "initial" : "none");
		}


		// save new set of snippet associations, redraw all
		function updateAssociations(data) {
			self.associations = data;
			self.appMapping = {};

			for (let app of data.apps) {
				self.appMapping[app.snippetsID] = app.appID;
			}

			for (let link of data.links) {
				processSubtree(link, null);
			}

			console.log(self.snippetLinks);

			draw();
		}

		function processSubtree(link, parent) {
			let linkData = self.snippetLinks[link.linkID];

			if (!linkData) {
				self.snippetLinks[link.linkID] = {
					parent: null,
					child: {},
					snippetID: link.snippetID
				};

				linkData = self.snippetLinks[link.linkID];
			}

			if (parent) {
				linkData.parent = {
					snippetsID: parent.appID,
					appID: self.appMapping[parent.appID],
					position: parent.position
				};
			}

			linkData.child = {
				snippetsID: link.appID,
				appID: self.appMapping[link.appID]
			};

			self.snippetApps[self.appMapping[link.appID]] = {
				snippetsID: link.appID,
				appID: self.appMapping[link.appID]
			};

			for (let child of link.children) {
				processSubtree(child, link);
			}
		}

		function updateSnippetStates(states) {
			console.log("Snippet States:", states, self.snippetLinks);

			self.snippetStates = states;

			self.linkGroup
				.selectAll(".snippetLinkOverlay")
				.style("stroke", linkID => {
					return lightColor[
						self.snippetStates[self.snippetLinks[linkID].snippetID].type
					];
				})
				.style("fill", linkID => {
					return darkColor[
						self.snippetStates[self.snippetLinks[linkID].snippetID].type
					];
				});

			self.appGroup.selectAll(".snippetAppGroup")
				.each(function(appID) {
					let parentType = d3.select(this).select(".snippetAppCreationType");
					let parentLinkID = Object.keys(self.snippetLinks).filter(
						lID => self.snippetLinks[lID].child.appID === appID
					)[0];
					let parentLink = self.snippetLinks[parentLinkID];

					parentType
						.style("stroke", linkID => {
							return darkColor[
								self.snippetStates[parentLink.snippetID].type
							];
						})
						.style("fill", linkID => {
							return lightColor[
								self.snippetStates[parentLink.snippetID].type
							];
						});
				});
		}

		function draw() {
			console.log("draw snippets overlay");

			self.appGroup.selectAll("*").remove();
			self.linkGroup.selectAll("*").remove();

			// draw info per app
			self.appGroup.selectAll(".snippetAppGroup")
				.data(Object.keys(self.snippetApps))
				.enter().append("g")
				.each(function(appID) {
					let appData = self.snippetApps[appID];

					let {
						left,
						top,
						width,
						height
					} = displayUI.applications[appID];

					let g = d3.select(this);

					g
						.attr("id", "overlay_" + appData.appID)
						.attr("class", "snippetAppGroup")
						.attr("transform", `translate(${left}, ${top})`);

					g.append("rect")
						.attr("class", "snippetAppOverlay")
						.attr("width", width)
						.attr("height", height + self.titleBarOffset);

					let parentType = g.append("rect")
						.attr("class", "snippetAppCreationType")
						.attr("y", self.titleBarOffset)
						.attr("width", self.titleBarOffset)
						.attr("height", height);

					g.append("rect")
						.attr("class", "snippetAppTitlebar")
						.attr("width", width)
						.attr("height", self.titleBarOffset);

					if (self.snippetStates) {
						let parentLinkID = Object.keys(self.snippetLinks).filter(
							lID => self.snippetLinks[lID].child.appID === appID
						)[0];
						let parentLink = self.snippetLinks[parentLinkID];

						parentType
							.style("stroke", linkID => {
								return darkColor[
									self.snippetStates[parentLink.snippetID].type
								];
							})
							.style("fill", linkID => {
								return lightColor[
									self.snippetStates[parentLink.snippetID].type
								];
							});
					}
				});

			// draw links between apps

			self.linkGroup.selectAll(".snippetLinkOverlay")
				.data(Object.keys(self.snippetLinks).filter(lID => self.snippetLinks[lID].parent))
				.enter().append("path")
				.each(function(linkID) {
					let link = self.snippetLinks[linkID];

					d3.select(this)
						.attr("id", "overlay_" + linkID)
						.attr("class", "snippetLinkOverlay")
						.attr("d", calculateLinkPath(link));

					if (self.snippetStates) {
						d3.select(this)
							.style("stroke", linkID => {
								return lightColor[self.snippetStates[self.snippetLinks[linkID].snippetID].type];
							})
							.style("fill", linkID => {
								return darkColor[self.snippetStates[self.snippetLinks[linkID].snippetID].type];
							});
					}
				});
		}

		function updateItemOrder(order) {
			let ordering = Object.keys(order).sort((a, b) => {
				return order[a] - order[b];
			});

			for (let appID of ordering) {
				self.appGroup.select(`#overlay_${appID}`).raise();
			}

			let linkOrdering = Object.keys(self.snippetLinks).sort((a, b) => {
				let linkA = self.snippetLinks[a];
				let linkB = self.snippetLinks[b];

				let aIndex = linkA.parent ?
					Math.max(order[linkA.parent.appID], order[linkA.child.appID]) :
					order[linkA.child.appID];

				let bIndex = linkB.parent ?
					Math.max(order[linkB.parent.appID], order[linkB.child.appID]) :
					order[linkB.child.appID];

				return aIndex - bIndex;
			});

			for (let linkID of linkOrdering) {
				self.linkGroup.select(`#overlay_${linkID}`).raise();
			}
		}

		function updateHighlightedApp(app) {
			self.appGroup.selectAll(".snippetAppHighlighted").classed("snippetAppHighlighted", false);

			if (app) {
				self.appGroup
					.select(`#overlay_${app.id}`)
					.classed("snippetAppHighlighted", true);
			}
		}

		// update a single item when moved/resized
		function itemUpdated(data) {

			let {
				left,
				top,
				width,
				height
			} = displayUI.applications[data.elemId];

			let appG = self.appGroup.select(`#overlay_${data.elemId}`)
				.attr("transform", `translate(${left}, ${top})`);

			appG.select(".snippetAppOverlay")
				.attr("width", width)
				.attr("height", height + self.titleBarOffset);


			appG.select(".snippetAppTitlebar")
				.attr("width", width)
				.attr("height", self.titleBarOffset);


			appG.select(".snippetAppCreationType")
				.attr("width", self.titleBarOffset)
				.attr("height", height);

			// update links connecting to this app
			let linksToUpdate = Object.keys(self.snippetLinks).filter(l => {
				let link = self.snippetLinks[l];

				return link.parent && (link.parent.appID === data.elemId ||
					link.child.appID === data.elemId);
			});

			for (let linkID of linksToUpdate) {
				let link = self.snippetLinks[linkID];

				self.linkGroup.select("#overlay_" + linkID)
					.attr("class", "snippetLinkOverlay")
					.attr("d", calculateLinkPath(link));

			}
		}

		function calculateLinkPath(link) {
			let {
				left: left1,
				top: top1,
				width: width1,
				height: height1
			} = displayUI.applications[link.parent.appID];

			let {
				left: left2,
				top: top2,
				width: width2,
				height: height2
			} = displayUI.applications[link.child.appID];

			let slope = (top2 - top1) / (left2 - left1);
			let inverse = 1 / -slope;

			let width = self.titleBarOffset;

			let dx = Math.sqrt(Math.pow(width / 2, 2) / (1 + Math.pow(inverse, 2)));
			let dy = inverse * dx;

			let pathCoords = [
				[left1 - dx * 1.5 + width1 / 2, top1 - dy * 1.5 + height1 / 2],
				[left1 + dx * 1.5 + width1 / 2, top1 + dy * 1.5 + height1 / 2],
				[left2 + dx / 2 + width2 / 2, top2 + dy / 2 + height2 / 2],
				[left2 - dx / 2 + width2 / 2, top2 - dy / 2 + height2 / 2]
			];

			return `M ${pathCoords.map(c => c.join(", ")).join("L ")} Z`;
		}

		return {
			setOverlayVisibility,

			updateAssociations,
			updateSnippetStates,

			updateHighlightedApp,

			updateItemOrder,
			itemUpdated
		};
	};
}());
