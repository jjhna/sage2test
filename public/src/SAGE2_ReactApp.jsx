// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-2019

/* global ignoreFields, SAGE2WidgetControl, SAGE2PointerToNativeMouseEvent, SAGE2RemoteSitePointer */
/* global addStoredFileListEventHandler, removeStoredFileListEventHandler, isBrowser */
/* global React, ReactDOM */

var SAGE2_ReactAppHelper = (function() {
  return function(data, url) {
    let superApp = new SAGE2_App();

    let Application = window[data.application];
    
    function init(data) {
      console.log("SAGE2_ReactApp.init()", data);

      superApp.SAGE2Init("div", data);

      console.log(superApp);
    }

    function draw() {
      console.log("SAGE2_ReactApp.draw()", data);
      
      ReactDOM.render(<Application />, superApp.element);
      
    }

    return {
      ...superApp,
      init,
      draw,
    };
  };
}());

var SAGE2_ReactAppLoader = (function() {
  let pendingLoads = {};

  function load(data, url) {
    return new Promise(function(resolve, reject) {
      pendingLoads[data.application] = resolve;

      if (window[data.application] !== undefined) {
        resolve();
      }

      var js = document.createElement("script");
      
      fetch(data.sage2URL.substring(1) + "/" + data.main_script)
        .then(function(response) {
          return response.text();
        })
        .then(function(jsxCode) {

          return Babel.transform(jsxCode, {presets: ['es2015', 'react'], plugins: ['transform-modules-amd']}).code;
        })
        .then(function(jsCode) {

          js.text = jsCode;
          js.type = "text/javascript";
      
          js.async = false;
      
          console.log("Loading>", data.id, url + "/" + data.main_script);
          document.head.appendChild(js);
        }); 
  
    });
  }

  function fileLoaded(application) {
    console.log("fileLoaded", application)

    pendingLoads[application]();
  }

  return {
    load,
    fileLoaded
  };
}());

class SAGE2_ReactApp extends React.Component {
  constructor(props) {
    super(props);

    console.log("construct SAGE2_ReactApp");
  }

  render() {
    return (<div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#282c34",
          color: "#61dafb",
          fontSize: "50px",
          display: "flex",
          fontFamily: "sans-serif",
          fontWeight: "bold",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        Hello, I am React!
      </div>
    );
  }
}