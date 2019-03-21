//
// SAGE2 application: Snippets_Vis
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2017
//

"use strict";

/* global d3 */

var Snippets_Vis = SAGE2_App.extend({
  init: function(data) {
    // Create div into the DOM
    this.SAGE2Init("div", data);
    // Set the DOM id
    this.element.id = "div_" + data.id;
    // Set the background to black
    this.element.style.backgroundColor = "white";

    this.dataset = [];

    this.parentLink = null;
    this.childLinks = [];

    // this.inputsOpen = false;

    // move and resize callbacks
    this.resizeEvents = "onfinish"; // continuous

    this.content = document.createElement("div");
    this.content.style.width = "100%";
    this.content.style.height =
      this.sage2_height - ui.titleBarHeight * 1.5 + "px";
    this.content.style.position = "absolute";
    this.content.style.boxSizing = "border-box";
    this.content.style.left = "0";
    this.content.style.top = ui.titleBarHeight * 1.5 + "px";
    this.content.style.overflow = "hidden";

    this.element.appendChild(this.content);

    let inputs = document.createElement("div");
    inputs.className = "snippetsInputWrapper";
    inputs.style.position = "absolute";
    inputs.style.left = this.sage2_width + "px";
    inputs.style.top = "0";
    inputs.style.width = "300px";
    inputs.style.minHeight = "100%";
    inputs.style.padding = ui.titleBarHeight * 1.5 + 8 + "px 10px";
    inputs.style.boxSizing = "border-box";
    inputs.style.background = "lightgray";

    this.inputs = inputs;
    this.element.appendChild(inputs);

    // add error popup to app
    let errorBox = document.createElement("div");
    errorBox.style.width = "90%";
    errorBox.style.height = "50%";
    errorBox.style.position = "absolute";
    errorBox.style.boxSizing = "border-box";
    errorBox.style.left = "5%";
    errorBox.style.top = "20%";

    errorBox.style.borderRadius = "10px";
    errorBox.style.background = "#ffe2e2";
    errorBox.style.boxShadow = "3px 3px 25px 3px black";
    errorBox.style.border = "2px solid #ffb4b4";
    errorBox.style.color = "red";
    errorBox.style.fontWeight = "bold";
    errorBox.style.fontSize = (3 * ui.titleBarHeight) / 4 + "px";
    errorBox.style.padding = "10px";

    errorBox.style.fontFamily = "monospace";
    errorBox.style.whiteSpace = "normal";

    errorBox.style.display = "none";

    this.errorBox = errorBox;
    this.element.appendChild(errorBox);

    // use mouse events normally
    this.passSAGE2PointerAsMouseEvents = true;

    // SAGE2 Application Settings

    // add wrapper for function execution information
    let ancestry = d3
      .select(this.element)
      .append("svg")
      .attr("class", "snippetAncestry")
      .attr("height", ui.titleBarHeight * 1.5)
      .attr("width", data.width);

    this.ancestry = ancestry;

    SAGE2_CodeSnippets.displayApplicationLoaded(this.id, this);

    this.createAncestorList();

    // give descriptive title to app
    if (this.parentLink) {
      if (this.parentLink.getParent()) {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}](${
              this.parentLink.getParent().id
            }) ➔ ` +
            this.id
        );
      } else {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` +
            this.id
        );
      }
    } else {
      this.updateTitle("VisSnippets: " + this.state.snippetsID);
    }
  },

  load: function(date) {
    console.log("Snippets_Vis> Load with state", this.state);
    this.refresh(date);
  },

  draw: function(date) {},

  getElement: function(data, date) {
    // update with new data and draw

    // remove error dialogue when the element is requested for draw function
    this.errorBox.style.display = "none";

    // refresh ancestor list (in case of name change)
    this.createAncestorList();

    return this.snippetsVisElement || this.element;
  },

  getDataset: function(date) {
    // update with new data and draw
    return this.dataset;
  },

  updateDataset: function(data, date) {
    // update dataset
    this.dataset = data;

    this.updateChildren();

    // refresh ancestor list (in case of name change)
    this.createAncestorList();
  },

  updateChildren: function(date) {
    // update all children
    for (let childLink of this.childLinks) {
      childLink.update();
    }
  },

  displayError: function(err) {
    this.errorBox.style.display = "initial";
    this.errorBox.innerHTML = err;
  },

  addChildLink: function(data, date) {
    this.childLinks.push(data);
  },

  removeChildLink: function(link) {
    let linkInd = this.childLinks.indexOf(link);

    this.childLinks.splice(linkInd, 1);
  },

  setParentLink: function(link, date) {
    // save the parent of the function
    this.parentLink = link;

    // give descriptive title to app
    if (this.parentLink) {
      if (this.parentLink.getParent()) {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}](${
              this.parentLink.getParent().id
            }) ➔ ` +
            this.id
        );
      } else {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` +
            this.id
        );
      }
    } else {
      this.updateTitle("VisSnippets: " + this.state.snippetsID);
    }
  },

  removeParentLink: function() {
    delete this.parentLink;

    this.createAncestorList();
  },

  createAncestorList: function() {
    // build sequential function call list and display
    let ancestry = SAGE2_CodeSnippets.getAppAncestry(this);
    // outsource ancestry drawing ot SAGE2_CodeSnippets
    SAGE2_CodeSnippets.drawAppAncestry({
      svg: this.ancestry,
      width: this.sage2_width,
      height: ui.titleBarHeight * 1.5,
      ancestry,
      app: this
    });
  },

  updateAncestorTree: function() {
    this.createAncestorList();

    for (let link of this.childLinks) {
      link.getChild().updateAncestorTree();
    }
  },

  resize: function(date) {
    // Called when window is resized
    let contentWidth = this.state.inputsOpen
      ? this.sage2_width - 300
      : this.sage2_width;
    this.content.style.width = contentWidth + "px";
    this.content.style.height =
      this.sage2_height - ui.titleBarHeight * 1.5 + "px";

    this.inputs.style.left = contentWidth + "px";

    // update ancestor list size
    this.ancestry.attr("width", this.sage2_width);
    this.createAncestorList();

    if (this.parentLink) {
      this.parentLink.update(); // redraw
    }

    this.refresh(date);
  },

  quit: function() {
    // Make sure to delete stuff (timers, ...)
    SAGE2_CodeSnippets.outputAppClosed(this);
  },

  requestEdit: function(data) {
    // handled the same as a load request in the editor
    SAGE2_CodeSnippets.requestSnippetLoad(
      data.clientId,
      this.parentLink.getSnippetID()
    );
  },

  getContextEntries() {
    return [
      {
        description: "Edit Snippet",
        // callback
        callback: "requestEdit",
        // parameters of the callback function
        parameters: {}
      }
    ];
  },

  event: function(eventType, position, user_id, data, date) {
    if (eventType === "pointerPress" && data.button === "left") {
      // click
    } else if (eventType === "pointerMove" && this.dragging) {
      // move
    } else if (eventType === "pointerRelease" && data.button === "left") {
      // click release
    } else if (eventType === "pointerScroll") {
      // Scroll events for zoom
    } else if (eventType === "widgetEvent") {
      // widget events
    } else if (eventType === "keyboard") {
      if (data.character === "m") {
        this.refresh(date);
      }
    } else if (eventType === "specialKey") {
      if (data.code === 37 && data.state === "down") {
        // left
        this.refresh(date);
      } else if (data.code === 38 && data.state === "down") {
        // up
        this.refresh(date);
      } else if (data.code === 39 && data.state === "down") {
        // right
        this.refresh(date);
      } else if (data.code === 40 && data.state === "down") {
        // down
        this.refresh(date);
      }
    } else if (eventType === "dataUpdate") {
      console.log("Data Update", data);

      this.updateContent(data, date);
      // this.refresh(date);
    }
  }
});
