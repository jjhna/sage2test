let SAGE2_SnippetExporter = (function() {
  let snippetScriptAPI = `
    // get a reference to a globally defined SAGE2 Object
    var SAGE2 = SAGE2 || {};

    // IIFE to instantiate SAGE2 snippets API calls
    (function() {
      // console.log(CodeSnippetInput.create({type: "text", name: "textField"}));
      // console.log(CodeSnippetInput.create({type: "checkbox", name: "checkboxBool"}));
      /*
      * SAGE2.SnippetInput API
      *
      * Break parameters for the function into input specification and link
      *
      */
      SAGE2.SnippetInput = function(specification, link) {
        // if (!link.inputs[specification.name].drawn) {
        //   // create new input element if this doesn't exist
        //   let newInput = CodeSnippetInput.create(specification);
        //   newInput.onUpdate = link.update;

        //   link.inputs[specification.name] = newInput;

        //   // create input element on app
        //   let inputDiv = d3.select(link.getChild().inputs).append("div")
        //     .attr("id", specification.name)
        //     .style("font-size", ui.titleBarHeight * 0.5 + "px")
        //     .attr("class", "snippetsInputDiv");

        //   inputDiv.append("div")
        //     .attr("class", "snippetsInputLabel")
        //     // .style("font-size", ui.titleBarHeight * 0.5 + "px")
        //     .style("margin-top", ui.titleBarHeight * 0.25 + "px")
        //     .text(specification.name);

        //   inputDiv
        //     .each(function() {
        //       // create the input element based on the Element's specification
        //       link.inputs[specification.name].createInputElement(d3.select(this));
        //     });
        // }

        // simply return saved value for now
        return link.inputs[specification.name].state;
      };

      /*
      * SAGE2.SnippetVisElement API
      *
      * Break parameters for the function into outputElement specification and parent element
      *
      */
      SAGE2.SnippetVisElement = function(specification, link) {
        let {type} = specification;

        if (link.snippetVisElement && link.snippetsVisElement.tagName !== type) {
          link.snippetsVisElement.remove();
          delete link.snippetsVisElement;
        }

        // set size to leave space for the inputs
        // let elementWidth = app.inputsOpen ? app.sage2_width - 300 : app.sage2_width;

        // if the app doesn't have a vis element, create one
        if (!link.snippetsVisElement) {
          // add svg and supplementary info
          let funcOrder = link.ancestry.concat(link.snippetID).map(f => functions[f].desc);

          let div = d3.select("body").append("div")
            .style("display", "inline-block")
            .style("padding", "5px")
            .style("margin", "8px")
            // .style("border", "2px solid gray")
            .style("border-radius", "5px")
            .style("box-shadow", "0 0 10px 2px gray")
            .style("background", "lightgray");

          div.append("div")
            .style("text-align", "center")
            .style("font-family", "'Lucida Console', Monaco, monospace")
            .style("font-weight", "bold")
            .style("padding", "8px")
            .style("border-radius", "3px")
            .style("background-color", "white")
            .style("box-shadow", "inset 0 0 5px 1px gray")
            .html(funcOrder.join(" &#9656; "));

          link.snippetsVisElement = div.append(type)
            .style("margin", "10px")
            .node();
        }

        // in all cases, set the size of the vis element
        d3.select(link.snippetsVisElement).each(function() {
          if (type === "svg") {
            d3.select(this)
              .attr("width", 600).attr("height", 300);
          } else {
            d3.select(this)
              .style("width", "600px")
              .style("height", "300px");
          }
        });

        // return the element and size
        return {
          elem: link.snippetsVisElement,
          width: 600,
          height: 300
        };
      };

      /*
      * SAGE2.SnippetTimeout API
      *
      * Specification includes time in ms
      *
      */
      SAGE2.SnippetTimeout = function(specification, link) {
        let { time } = specification;

        // clear existing update timer if it exists
        if (link.timeout) {
          clearTimeout(link.timeout);
        }

        // create and save new timeout
        link.timeout = setTimeout(function() {
          let { type } = functions[link.snippetID];

          runFunction[type](link.data, link, link.ancestry);
        }, time);
      };

      console.log(SAGE2);
    }());
  `.replace(/\t\t/gi, "");

  // function to create script from wall which can be run/developed on personal computer
  function generateScriptFromWall(functions, links) {
    console.log(functions, links);
  
    let newWindow = window.open();
    let newDocument = newWindow.document;
  
    let scripts = {
      gen: newDocument.createElement("script"),
      data: newDocument.createElement("script"),
      draw: newDocument.createElement("script")
    };
  
    let mainScript = newDocument.createElement("script");
    let utilScript = newDocument.createElement("script");
    let downloadScript = newDocument.createElement("script");
  
    for (let type of Object.keys(scripts)) {
      scripts[type].text = createTypedScriptText(
        functions.filter(f => f.type === type)
      );
  
      scripts[type].id = "codeSnippets-" + type;
      scripts[type].async = false;
    }
  
    mainScript.text = createMainScriptText(links);
    mainScript.id = "codeSnippets-main";
    mainScript.async = false;
  
    utilScript.text = snippetScriptAPI;
    utilScript.id = "codeSnippets-util";
    utilScript.async = false;
  
    downloadScript.text = createDownloadScriptText();
  
    // add d3 to new page
    let d3Script = newDocument.createElement("script");
    d3Script.type = "text/javascript";
    d3Script.async = false;
    d3Script.src = "https://d3js.org/d3.v4.min.js";

    let vegaScript = newDocument.createElement("script");
    vegaScript.type = "text/javascript";
    vegaScript.async = false;
    vegaScript.src = "https://cdn.jsdelivr.net/npm/vega@3";
    
    let vegaLiteScript = newDocument.createElement("script");
    vegaLiteScript.type = "text/javascript";
    vegaLiteScript.async = false;
    vegaLiteScript.src = "https://cdn.jsdelivr.net/npm/vega-lite@2";

    let vegaEmbedScript = newDocument.createElement("script");
    vegaEmbedScript.type = "text/javascript";
    vegaEmbedScript.async = false;
    vegaEmbedScript.src = "https://cdn.jsdelivr.net/npm/vega-embed@3";

    newDocument.head.appendChild(d3Script);
    newDocument.head.appendChild(vegaScript);
    newDocument.head.appendChild(vegaLiteScript);
    newDocument.head.appendChild(vegaEmbedScript);

    vegaEmbedScript.onload = function() {
      newDocument.body.appendChild(downloadScript);

      newDocument.head.appendChild(scripts.gen);
      newDocument.head.appendChild(scripts.data);
      newDocument.head.appendChild(scripts.draw);

      newDocument.head.appendChild(utilScript);
      newDocument.head.appendChild(mainScript);
    };

    // ======================================================
    // helper functions for creating scripts
  
    function createTypedScriptText(functions) {
      let scriptText = `
        var functions = functions || {};
        console.log(document.currentScript.id, "Loaded");
        `.replace(/\t\t\t/gi, "");
  
      for (let func of functions) {
        scriptText += `\n
          functions["${func.id}"] = {
            type: "${func.type}",
            desc: "${func.desc}",
            code: ${func.code}
          }`.replace(/\t\t\t\t/gi, "");
      }
  
      return scriptText;
    }
  
    function createMainScriptText(links) {
      return `
        var functions = functions || {};
        let linkForest;
        console.log(document.currentScript.id, "Loaded");

        let runFunction = {
          gen: function (input, link) {
            let func = functions[link.snippetID];

            // save data for re-execution
            link.data = input;

            // call function
            func.code.call(link, input, link)
              .then(function(result) {
                invokeChildFunctions(result, link.children, [link.snippetID]);
              })
          },
          data: function(input, link, prevFunctions) {
            let func = functions[link.snippetID];
            let result = func.code.call(link, input, link);

            link.data = input;
            link.ancestry = prevFunctions;

            invokeChildFunctions(result, link.children, prevFunctions.concat(link.snippetID));

          },
          draw: function(input, link, prevFunctions) {
            let func = functions[link.snippetID];

            link.ancestry = prevFunctions;

            func.code.call(link, input, link);
          }
        }

        init();

        function init() {
          linkForest = ${JSON.stringify(links)};

          console.log("Init Done", functions);
          console.log("Links", linkForest);
          run();
        }

        function invokeChildFunctions(data, children, prevFunctions) {

          for (let child of children) {
            let { type } = functions[child.snippetID];

            runFunction[type](data, child, prevFunctions);
          }
        }

        function run() {

          // for each root, invoke the function
          for (let root of linkForest) {
            let { type } = functions[root.snippetID];

            runFunction[type](null, root);
          }
        }`.replace(/\t\t\t\t/gi, "");
  
      // replace is to unindent the code and make it readable in the output
      // since string template preserves extra 4 tab indentation from this file's src
    }
  
    function createDownloadScriptText() {
      return `
        let downloadWrapper = document.createElement("div");
        let downloadButton = document.createElement("input");

        downloadButton.type = "button";
        downloadButton.value = "Download Project";
        downloadButton.onclick = download;

        downloadButton.style.backgroundColor = "#b9e1f1";
        downloadButton.style.border = "3px solid rgba(42, 165, 213, 0.25)";
        downloadButton.style.padding = "8px";
        downloadButton.style.margin = "8px";
        downloadButton.style.borderRadius = "5px";
        downloadButton.style.fontSize = "16px";
        downloadButton.style.cursor = "pointer";

        downloadWrapper.appendChild(downloadButton);
        document.body.appendChild(downloadWrapper);

        function download() {
          // create dom clone in order to clear body for download
          let domCopy = document.documentElement.cloneNode(true);
          let body = domCopy.getElementsByTagName("body")[0];
          body.innerHTML = "";
          body.onload = "run";

          var element = document.createElement('a');
          element.setAttribute('href', 'data:text/html;charset=utf-8,' 
          + encodeURIComponent(domCopy.outerHTML));
          element.setAttribute('download', "snippetsOutput.html");

          element.style.display = 'none';
          document.body.appendChild(element);

          element.click();

          document.body.removeChild(element);
          domCopy.remove();
        }`.replace(/\t\t\t\t/gi, "");
    }
  }

  return {
    generateScriptFromWall
  };
})();

