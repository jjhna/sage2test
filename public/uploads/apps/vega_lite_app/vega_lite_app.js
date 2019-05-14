//
// SAGE2 application: vega_vis_app
// by: Jillian Aurisano <jillian.aurisano@gmail.com>
//
// Copyright (c) 2015
//
"use strict";
var vega_lite_app = SAGE2_App.extend( {
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);

		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'white';

		// move and resize callbacks
		this.resizeEvents = "continuous"; // continuous

		this.content = document.createElement("div");
		this.content.className = "viewBox";
		this.content.style.width = "100%";//400 + "px";
		this.content.style.height = "100%";//this.sage2_height - ui.titleBarHeight*1.5 + "px";  //400 + "px";
		this.content.style.position = "absolute";
		this.content.style.boxSizing = "border-box";
		this.content.style.left = "0";
		this.content.style.top = "0";//ui.titleBarHeight * 1.5 + "px";
		this.content.style.overflow = "hidden";

		this.element.appendChild(this.content);

		this.initContent(); 
		
		// move and resize callbacks
		//this.resizeEvents = "onfinish"; // continuous

		this.updateTitle(this.state.viewCount);

		console.log( this.state.viewCount );
		
		
		// SAGE2 Application Settings
		//
		// Control the frame rate for an animation application
		this.maxFPS = 2.0;
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;


	
	    this.updateTitle(this.state.viewCount);
		console.log(this.state.plotTitle);
	

		//this.refresh(date);

	},

	initContent: function(date){



		let inputs = document.createElement("div");
		inputs.className = "snippetsInputWrapper";
		inputs.style.position = "absolute";
		inputs.style.left ="0px"; // this.sage2_width + "px";//"0px";
		inputs.style.top = "0px";
		inputs.style.width = "100%";//"200px";// this.sage2_width;//"100%";//"300px";//"100%";
		inputs.style.height = "100%";//"200px";
		//inputs.style.minHeight = "100%";

		if(this.state.vegaLiteSpec["mark"] != "bar" ){
			inputs.style.padding = "10px 10px";//ui.titleBarHeight * 1.5 + 8 + "px 10px";
			inputs.style.boxSizing = "border-box";
			this.state.vegaLiteSpec["width"] = this.sage2_width-400; 
			this.state.vegaLiteSpec["height"] = this.sage2_height-200;
		}
		else {
			this.state.vegaLiteSpec["width"] = this.sage2_width-40; 
			this.state.vegaLiteSpec["height"] = this.sage2_height-40;
		}
		
		this.inputs = inputs;
		this.element.appendChild(inputs);


		this.vLSpec  = this.state.vegaLiteSpec; 
		this.vLSpec["config"] = {
					    "axis": {
					      "labelFont": "Arial",
					      "labelFontSize": 20,
					      "titleFont": "Arial",
					      "titleFontSize": 30,
					      "titlePadding": 20
					    },
					    "legend": {
					    	"labelFont": "Arial",
					    	"labelFontSize": 30,
					    	"titleFont": "Arial",
					    	"titleFontSize": 30,
					    	"titlePadding": 20
					    },
					    "title" : {
					    	"font": "Arial",
					    	"fontSize": 40,
					    	"padding": 20
					    }
					 };
		   		vegaEmbed(this.inputs, this.vLSpec);



	},

	load: function(date) {
		console.log('vega_vis_app Load with state value', this.state.value);
		
		// this.content.style.height = this.sage2_height - ui.titleBarHeight * 1.5 + "px";

		
		// this.element.removeChild(this.inputs);

		// let inputs = document.createElement("div");
		// inputs.className = "snippetsInputWrapper";
		// inputs.style.position = "absolute";
		// inputs.style.left ="0px"; // this.sage2_width + "px";//"0px";                                                                                 
		// inputs.style.top = "0px";
		// inputs.style.width =this.sage2_width + "px";// this.sage2_width;//"100%";//"300px";//"100%";                                                 \
                                                                                                                                                          
		// inputs.style.height = (this.sage2_height - ui.titleBarHeight * 1.5 - 250) + "px";
		// inputs.style.padding = "10px 10px";
		// inputs.style.boxSizing = "border-box";

		// this.vLSpec["width"] - this.sage2_width;
		// this.vLSpec["height"] = this.sage2_height - ui.titleBarHeight*1.5-250;

		// this.vLSpec["config"] = {
		// 			    "axis": {
		// 			      "labelFont": "Arial",
		// 			      "labelFontSize": 20,
		// 			      "titleFont": "Arial",
		// 			      "titleFontSize": 30,
		// 			      "titlePadding": 20
		// 			    },
		// 			    "legend": {
		// 			    	"labelFont": "Arial",
		// 			    	"labelFontSize": 20
		// 			    }//,
		// 			    //"title" : {
		// 			    //	"font": "Arial",
		// 			    //	"fontSize": 40
		// 			    //}
		// 			 };
		// this.vLSpec["legend"] = {
  //      		 "title": "Case Ageing"
  //    	 };

		// this.inputs = inputs;
		// vegaEmbed(this.inputs, this.vLSpec)

		// this.element.appendChild(inputs);


	 //    this.updateTitle(this.state.plotTitle);
		// console.log(this.state.plotTitle);

		// console.log(this.inputs);


		// this.refresh(date);
	},

	draw: function(date) {
		//console.log('vega_vis_app> Draw with state value', this.state.value);

		// //this.spec = this.state.specFile;//"uploads/apps/vega_vis_app/data/spec.json";
		// console.log(this.spec);
		// if(this.state.type == "bar"){

		// 	this.barSpec.marks[0].properties.update.fill.value = this.state.color; //"red";
		// 	this.barSpec.axes[0].title = this.state.x;
		// 	this.barSpec.axes[1].title = this.state.y;
		// 	this.barSpec.data[0].values = this.state.data;
		// 	this.parseBar(this.barSpec);

		// }
		// if( this.state.type == "line"){

		// 	//this.linSpec.marks[0]
		// 	this.lineSpec.axes[0].title = this.state.x;
		// 	this.lineSpec.axes[1].title = this.state.y;
		// 	this.lineSpec.data[0].values = this.state.data;
		// 	this.parseLine(this.lineSpec);
		// }

	},

	resize: function(date) {

	    // Called when window is resized
	    //let contentWidth = this.sage2_width;
	    // this.content.style.width = contentWidth + "px";
	    // this.content.style.height = this.sage2_height - ui.titleBarHeight * 1.5 + "px";

	    //this.content.style.width = "100%";//400 + "px";
		//this.content.style.height = "100%";//this.sage2_height - ui.titleBarHeight*1.5 + "px";  //400 + "px";
		this.content.style.width = "100%";//400 + "px";
		this.content.style.height = "100%";//this.sage2_height - ui.titleBarHeight*1.5 + "px";  //400 + "px";
		this.content.style.position = "absolute";
		this.content.style.boxSizing = "border-box";
		this.content.style.left = "0";
		this.content.style.top = "0";//ui.titleBarHeight * 1.5 + "px";
		this.content.style.overflow = "hidden";
    
	    this.element.removeChild(this.inputs);

	    this.initContent(); 


	 //    let inputs = document.createElement("div");
	 //    inputs.className = "snippetsInputWrapper";
	 //    inputs.style.position = "absolute";
	 //    inputs.style.left ="0px"; // this.sage2_width + "px";//"0px";                                                                             
	 //    inputs.style.top = "0px";
	 //    inputs.style.width =this.sage2_width + "px";// this.sage2_width;//"100%";//"300px";//"100%";                                                              
	 //    inputs.style.height = (this.sage2_height - ui.titleBarHeight * 1.5 - 250) + "px";
	 //    //inputs.style.minHeight = "100%";                                                                                                        
	 //    inputs.style.padding = "10px 10px";//ui.titleBarHeight * 1.5 + 8 + "px 10px";
	 //    inputs.style.boxSizing = "border-box";

	 //    this.vLSpec["width"] = this.sage2_width - 300;
	 //    this.vLSpec["height"] = this.sage2_height - 300;//ui.titleBarHeight*1.5-250;


		// this.vLSpec["config"] = {
		// 			    "axis": {
		// 			      "labelFont": "Arial",
		// 			      "labelFontSize": 20,
		// 			      "titleFont": "Arial",
		// 			      "titleFontSize": 30,
		// 			      "titlePadding": 20
		// 			    },
		// 			    "legend": {
		// 			    	"labelFont": "Arial",
		// 			    	"labelFontSize": 20
		// 			    }//,
		// 			    //"title" : {
		// 			    //	"font": "Arial",
		// 			    //	"fontSize": 40
		// 			    //}
		// 			 };
	 //    this.inputs = inputs;
	 //    vegaEmbed(this.inputs, this.vLSpec);

  //           this.element.appendChild(inputs);



	 //    console.log(this.inputs);

	    // update ancestor list size
	    //this.ancestry.attr("width", this.sage2_width);
	    //this.createAncestorList();

	    //if (this.parentLink) {
	    //	this.parentLink.update(); // redraw
	    //}

	    this.updateTitle(this.state.viewCount);
		console.log(this.state.viewCount);

	    this.refresh(date);
	},


	//reszing is a BIG problem with line charts
	// no fun trying to fix!!!
	resizeOld: function(date) {
		if( this.state.type == "bar"){
			// updated = false;
			if( this.element.clientWidth > 400 ){
	  			this.view.width(this.element.clientWidth-this.paddingWidth);
	  			updated = true;
	  		}
	  		if( this.element.clientWidth > 400 ){
	  			this.view.height(this.element.clientHeight-this.paddingHeight);
	  			updated = true;
	  		}
	  		if( updated )
	  			this.view.renderer('svg').update();
  		}
  		else if( this.state.type == "line"){
			this.svg.attr('width',  this.element.clientWidth + "px");
			this.svg.attr('height', this.element.clientHeight + "px");
			
			this.refresh(date);
			 		}
 
	},


	move: function(date) {
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
		}
		else if (eventType === "pointerMove" && this.dragging) {
		}
		else if (eventType === "pointerRelease" && (data.button === "left")) {
		}

		// Scroll events for zoom
		else if (eventType === "pointerScroll") {
		}
		else if (eventType === "widgetEvent"){
		}
		else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		}
		else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") { // left
				this.refresh(date);
			}
			else if (data.code === 38 && data.state === "down") { // up
				this.refresh(date);
			}
			else if (data.code === 39 && data.state === "down") { // right
				this.refresh(date);
			}
			else if (data.code === 40 && data.state === "down") { // down
				this.refresh(date);
			}
		}
	},

	//this is vega's function to make a bar chart, from the spec
	parseBar: function(spec) {
		console.log("parse ")
		console.log( spec);
  		vg.parse.spec(spec, this.vegaCallbackFuncBar);
  		//vg.embed("#vis", spec, this.vegaCallbackFunc);

	},

	//after it makes it, this is the callback
	vegaCallbackBar: function(error, chart) {
		// chart( {el:"vis"} ).update();
		this.view = chart({el:'vis'+this.id});
		this.view.update();

		//set width and height appropriately
		this.paddingWidth = this.barSpec.padding.left + this.barSpec.padding.right;
		this.paddingHeight = this.barSpec.padding.top + this.barSpec.padding.bottom;
  		this.view.width(this.element.clientWidth-this.paddingWidth).height(this.element.clientHeight-this.paddingHeight).renderer('svg').update();


  		this.box = "0,0," + this.element.clientWidth + "," + this.element.clientHeight;

  		//d3.select("vis"+this.id).select("div").select("svg").attr("viewBox", this.box);
  		// this.svg = d3.select("vis"+this.id)[0][0];
  		// console.log(this.view);
  		//d3.select(".marks").attr("id", "svg"+this.id).attr("viewBox", this.box);

  		// this.box = "0,0," + this.element.clientWidth + "," + this.element.clientHeight;
  		// this.svg = this.view.children[0];
  		// this.svg.id = "svg" + this.id;
  		// d3.select( "svg" + this.id).attr("viewBox", this.box);

		// this.view.viewport([0,0,this.element.clientWidth, this.element.clientHeight]);

  // 		marks = d3.select(".marks").attr("viewBox", box);

		//this.view.props.marks.update.fill.value = "red";


  		// console.log("call back " + this.view);
  		// this.test = "I changed";
  		// console.log(this.test);
  		//this.view.width(1024).height(768).update({duration: 2000});

	},

	//vega's parsing the line charts
	parseLine: function(spec) {
		console.log("parse ");
		console.log(spec);
  		vg.parse.spec(spec, this.vegaCallbackFuncLine);
  		//vg.embed("#vis", spec, this.vegaCallbackFunc);

	},

	//here's where the chart is returned
	// I made some effort here to fix the resizing problems, but it was monumentally frustrating!
	vegaCallbackLine: function(error, chart) {
		// chart( {el:"vis"} ).update();
		this.view = chart({el:'vis'+this.id});

		// this.box = [this.element.width, this.element.height];
		// var box = "0,0," + this.box[0] + "," + this.box[1];
		// d3.select("svg").attr("viewBox", box);


		this.view.update();

  		//in the end to make it fit in the window, I had this horrible hack that I hate with the passion of fire of a million suns

		//set width and height appropriately
		this.paddingWidth = this.lineSpec.padding.left + this.lineSpec.padding.right;
	 	this.paddingHeight = this.lineSpec.padding.top + this.lineSpec.padding.bottom;
		this.view.width(this.element.clientWidth-this.paddingWidth).height(this.element.clientHeight-this.paddingHeight).renderer('svg').update();


		this.view.renderer('svg').update();

		this.box = "0,0," + this.element.clientWidth + "," + this.element.clientHeight;
		this.svg = d3.select("vis"+this.id).select("div").select("svg");
  		this.svg.attr("viewBox", this.box);

  		console.log(this.lineSpec.padding.left);

		//set width and height appropriately
		// this.paddingWidth = this.lineSpec.padding.left + this.lineSpec.padding.right;
	 // 	this.paddingHeight = this.lineSpec.padding.top + this.lineSpec.padding.bottom;
		// this.view.width(this.element.clientWidth-this.paddingWidth).height(this.element.clientHeight-this.paddingHeight).renderer('svg').update();

	},



	callback2(){
		console.log("it worked!");
	},


// DEFAULT SPECS...
	initLineSpec: function(){
		this.lineSpec =
		  {
			  "width": 2140,//2140,//1240,//1260 //WHY- no ideal
			  "height": 730,//530,//530,
  			  "padding": {"top": 10, "left": 60, "bottom": 60, "right": 30},
			  "data": [
			    {
			      "name": "table",
			      "values": [
			        {"x": 2010,"y": 100,"c": "Loop"},
			        {"x": 2011,"y": 200,"c": "Loop"},
			        {"x": 2012,"y": 300,"c": "Loop"},
			        {"x": 2013,"y": 400,"c": "Loop"},
			        {"x": 2010,"y": 100,"c": "UIC"},
			        {"x": 2011,"y": 250,"c": "UIC"},
			        {"x": 2012,"y": 380,"c": "UIC"},
			        {"x": 2013,"y": 420,"c": "UIC"}
			        ]
			    }
			  ],
			  "scales": [
			    {
			      "name": "x",
			      "type": "ordinal",
			      "range": "width",
			      "domain": {"data": "table", "field": "x"}
			    },
			    {
			      "name": "y",
			      "type": "linear",
			      "range": "height",
			      "nice": true,
			      "domain": {"data": "table", "field": "y"}
			    },
			    {
			      "name": "color",
			      "type": "ordinal",
			      "domain": {"data": "table", "field": "c"},
			      "range": "category20"
			    }
			  ],
			  "axes": [
			    {"type": "x",
			    "scale": "x",
			    "tickSizeEnd": 0,
			     "properties": {
			        "labels": {
				    	"fill": {"value": "white"}
				    },
					"axis": {
		        		 "stroke": {"value": "white"},
		        		 "strokeWidth": {"value": 1.0}
		       		}
			    },
					"legends": [
				    {
				      "fill": "color",
				      "title": "Key",
				      "offset": 0,
				      "encode": {
				        "symbols": {
				          "update": {
				            "fillOpacity": {"value": 1.0},
				            "stroke": {"value": "transparent"}
				          }
				        }
				      }
				    }
				  ],
			},
			    {"type": "y",
			    "scale": "y",
			   "properties": {
			        "labels": {
				    	"fill": {"value": "white"}
				    },
					"axis": {
		        		 "stroke": {"value": "white"},
		        		 "strokeWidth": {"value": 1.0}
		       		}
			    }
			}
			  ],
			  "marks": [
			    {
			      "type": "group",
			      "from": {
			        "data": "table",
			        "transform": [{"type": "facet", "groupby": ["c"]}]
			      },
			      "marks": [
			        {
			          "type": "line",
			          "properties": {
			            "enter": {
			              "x": {"scale": "x", "field": "x"},
			              "y": {"scale": "y", "field": "y"},
			              "stroke": {"scale": "color", "field": "c"},
			              "strokeWidth": {"value": 4},
										"text":{
											"text": "HELLO",
											"fill": "white",
											"fontSize": 100
										}
			            }
			          }
								//{
							//		"type": "text",
	          	//		"from": {"data": "id"},
				       //   "encode": {
				        //    "update": {
				         //     "x": {"scale": "x", "field": "date", "offset": 2},
				         //     "y": {"scale": "y", "field": "indexed_price"},
				        //      "fill": {"scale": "color", "field": "symbol"},
				        //      "text": {"field": "symbol"},
				        //      "baseline": {"value": "middle"}
				         //   }
				          //}
				        //}
			        }


			      ]
			    }
			  ],
				"legends": [
		      {
		        "fill": "color",
		        "title": "Values",
		        "offset": -100,
		        "encode": {
		          "symbols": {
		            "update": {
		              "fillOpacity": {
		                "value": 0.5
		              },
		              "stroke": {
		                "value": "transparent"
		              }
		            }
		          },
        			"labels": {
          			"update": {
           				"fill": "white"
          			}
        			}
		        }
		      }
		    ]

			}

	},


	initBarSpec: function(){
		this.barSpec = {
			  "width": 2000,
			  "height": 800,
			  "padding": {"top": 10, "left": 100, "bottom": 220, "right": 30},
			  "data": [
			    {
			      "name": "table",
			      "values": [
			        // {"x": 1,  "y": 28}, {"x": 2,  "y": 55},
			        // {"x": 3,  "y": 43}, {"x": 4,  "y": 91},
			        // {"x": 5,  "y": 81}, {"x": 6,  "y": 53},
			        // {"x": 7,  "y": 19}, {"x": 8,  "y": 87},
			        // {"x": 9,  "y": 52}, {"x": 10, "y": 48},
			        // {"x": 11, "y": 24}, {"x": 12, "y": 49},
			        // {"x": 13, "y": 87}, {"x": 14, "y": 66},
			        // {"x": 15, "y": 17}, {"x": 16, "y": 27},
			        // {"x": 17, "y": 68}, {"x": 18, "y": 16},
			        // {"x": 19, "y": 49}, {"x": 20, "y": 15}
			      ]
			    }
			  ],
			  "scales": [
			    {
			      "name": "x",
			      "type": "ordinal",
			      "range": "width",
			      "domain": {"data": "table", "field": "x"}
			    },
			    {
			      "name": "y",
			      "type": "linear",
			      "range": "height",
			      "domain": {"data": "table", "field": "y"},
			      "nice": true
			    }
			  ],
			  "axes": [
			    {
			    	"type": "x",
			    	"scale": "x",
				    "properties": {
				      	 "ticks": {
				         "stroke": {"value": "white"}
				       },
				       "majorTicks": {
				         "strokeWidth": {"value": 1}
				       },
				       "labels": {
				         "fill": {"value": "white"},
				         "angle": {"value": 50},
				         "fontSize": {"value": 15},
				         "align": {"value": "left"},
				         "baseline": {"value": "middle"}				       },
				       "title": {
								 "fill": {"value": "white"},
				         "fontSize": {"value": 20}
				       },
				       "axis": {
				         "stroke": {"value": "white"},
				         "strokeWidth": {"value": 1.0}
				       }
				     }
				},
			    {"type": "y",
			    "scale": "y",
				    "properties": {
				      	 "ticks": {
				         "stroke": {"value": "white"}
				       },
				       "majorTicks": {
				         "strokeWidth": {"value": 1}
				       },
				       "labels": {
				         "fill": {"value": "white"},
				         "fontSize": {"value": 15}
				         			       },
				       "title": {
								 "fill": {"value": "white"},
				         "fontSize": {"value": 20}
				       },
				       "axis": {
				         "stroke": {"value": "white"},
				         "strokeWidth": {"value": 1.0}
				       }
				     }}
			  ],
			  "marks": [
			    {
			      "type": "rect",
			      "from": {"data": "table"},
			      "properties": {
			        "enter": {
			          "x": {"scale": "x", "field": "x"},
			          "width": {"scale": "x", "band": true, "offset": -1},
			          "y": {"scale": "y", "field": "y"},
			          "y2": {"scale": "y", "value": 0}
			        },
			        "update": {
			          "x": {"scale": "x", "field": "x"},
			          "width": {"scale": "x", "band": true, "offset": -1},
			          "y": {"scale": "y", "field": "y"},
			          "y2": {"scale": "y", "value": 0},
			          "fill": {"value": "steelblue"}
			        },
			        "hover": {
			          "fill": {"value": "red"}
			        }
			      }
			    }
			  ]
			};
	},

	initGroupedBarSpec: function (){
		this.groupedBarSpec = {
			  "width": 2000,
			  "height": 800,
			  "padding": {"top": 10, "left": 100, "bottom": 220, "right": 30},

		};
	}
});
