//
// SAGE2 application: articulate_ui
// by: Jillian Aurisano <jillian.aurisano@gmail.com>
//
// Copyright (c) 2015
//

var articulate_ui_chat = SAGE2_App.extend( {
	init: function(data) {
		this.SAGE2Init("div", data);

		this.element.style.backgroundColor = '#FFFFFF';
		this.element.style.opacity = 1.0;

		this.passSAGE2PointerAsMouseEvents = true;
		this.debugMode = true;
		this.chatData = [];

		this.useMaster = true;

		console.log("Am I master? " + isMaster );
		console.log("using master? " + this.useMaster);


		this.listOfCommandsForTesting = 
		[
			{"who": "chat friend", "message": "Lets start with the activity around UIC", "targetAppId": null},//Q1, app2
			{"who": "chat friend", "message":	"Could I take a look at when crimes happen",  "targetAppId": null},//Q2, app3
			{"who": "chat friend", "message": "Could I look at when crimes happen for each neighborhood",  "targetAppId": null},//Q3, app4
			{"who": "chat friend", "message": "Show me the months where the most number of crimes occur around school areas",  "targetAppId": null},//Q4, app5
			{"who": "chat friend", "message": "If I was walking to the EL, would there be any areas that are particularly dangerous to walk through due to theft or battery",  "targetAppId": null}, //Q5, app6
			{"who": "chat friend", "message": "Of the theft in the Near West Side, are you able to kind of show it by month",  "targetAppId": null},//Q6, app7
			
			{"who": "chat friend", "message": "PART 2a",  "targetAppId": null},//delete

			{"who": "chat friend", "message": "I would just like to see the total amount of crimes that happened divided by the three main areas, UIC, River North and Near West Side",  "targetAppId": null},//Q1, app8
			{"who": "chat friend", "message":	"Are you able to show like the entire percentage of crime in each neighborhood",  "targetAppId": null},//Q2, app9
			{"who": "chat friend", "message": "Is there any way to kind of show theft by location type",  "targetAppId": null},//Q3, app10
			{"who": "chat friend", "message": "Can you show the location type for the crimes that occur between noon and 6 and 6 and midnight",  "targetAppId": null},//Q5, app11
			{"who": "chat friend", "message": "I am wondering around the bus lines if there are more public intoxication or fighting or verbal harassment in the summer",  "targetAppId": null}, //Q6, app12
			{"who": "chat friend", "message": "Show me the crime reported with respect to the location specifically in River North and UIC by year",  "targetAppId": null},//Q4, app13

			{"who": "chat friend", "message": "PART 2b",  "targetAppId": null},//Q4, app7

			{"who": "chat friend", "message": "Can you show the same chart for days of the week?",  "targetAppId": "app_12"},  // app 8
			{"who": "chat friend", "message": "Can you show this graph for months of year?",  "targetAppId": "app_12"}, // app 9
			{"who": "chat friend", "message": "Can you move it",  "targetAppId": "app_12"}, 
			{"who": "chat friend", "message": "Can you minimize it?",  "targetAppId": "app_12"},
			{"who": "chat friend", "message": "Can you bring up this pic that has been hidden?",  "targetAppId": "app_12"},			
			{"who": "chat friend", "message": "Yeah don't need this one here",  "targetAppId": "app_12"}

		];

		this.currentTestCommand = 0;

		this.targetAppID = null;
		this.requests = new Array();
		this.responces = new Array();
		this.sessionId = null;

		this.waitingForResponse = false;
		this.animCount = 0; 

		this.previousDate = new Date();
		this.percentage = 50; 
		this.increment = 1;
		this.loaderColor = 'green'; 

		this.resizeEvents = "onfinish";
		this.svg = null;

		this.element.id = "div" + data.id;

		// Get width height from the supporting div
		var myWidth  = this.element.clientWidth;
		var myHeight = this.element.clientHeight;

		this.mainDiv = d3.select(this.element).append("div")
			.attr("width",   myWidth)
			.attr("height",  myHeight);

		// this.loader = this.mainDiv.append('div')
		// 						.style('width', myWidth+"px")
		// 						.style('height', '10%')
		// 						.style('position', 'absolute')
		// 						//.style('display', 'inline-block')
		// 						.style('top', '0%');

		// this.ball = this.loader.append('div');
		// this.ball.style('width', '120px')
		// 			.style('height', '120px')
		// 			.style('background', '#ccc')
		// 			.style('border-radius', '50%')
		// 			.style('position', 'absolute')
		// 			.style('left', '50%')
		// 			.style('top', '20%');


		this.chatbox = this.mainDiv.append('div')
					.attr('class', 'chatbox')
					.style('width', "90%")
					.style('min-width', '390px')
					.style('height', "90%")
					.style('position', 'absolute')
					.style('top', '5%')
					.style('left', '5%')
					//.style('display', 'inline-block')
					.style('background', '#fff')
					// .style('padding', '25px')
					// .style('margin', '20px auto')
					.style('box-shadow', '0 0px #fff');

		this.chatlogs = this.chatbox.append('div')
				.attr('class', 'chatlogs')
				// .style('padding', '10px')
				.style('width', '100%')
				.style('height', '100%')
				.style('top', '0%')
				.style('left', '0%')
				.style('overflow-x', 'hidden')
				.style('overflow-y', 'scroll');

		this.chatData.push({"message": "hello. I'm ready to answer your questions", "who": "chat self"});


		// this.rows = d3.select('.chatlogs')
		// 	.selectAll('div')
		// 	.data(this.chatData)

		this.update();

	},

	update: function(){
		//console.log(this.chatData);

		// this.savedChatData = this.chatData; 
		// this.chatData = [];

		// this.rows.exit().remove();

		// this.chatData = this.savedChatData;

		this.rows = d3.select('.chatlogs')
			.selectAll('div')
			.data(this.chatData );

		if( this.chatData.length > 1 ){
				d3.selectAll("#newChats")
					.attr('id', "oldChats");
					//.style("background", "black");
		}

		this.rows
			.enter()
			.append('div')
			.attr('class', function (d) { return d.who })
			.attr('id', 'newChats');

		// this.newChats = d3.selectAll('#newChats');


		// 	this.newChats.append('div')
		// 	.attr('class', 'user-photo')
		// 	.style('width', '60px')
		// 	.style('height', '60px')
		// 	.style('background', '#ccc')
		// 	.style('border-radius', '50%');

		var	gradText = "linear-gradient(to right, #1ddced 0%, #1ddced, " + (this.animCount%100) + "%, #ffffff 100%)";
			//console.log(gradText);

		d3.selectAll("#newChats")
			.append('p')
			.attr('class', 'chat-message')
			.text( function(d) { return d.message } )
			.style('background', function(d){ 
				if( d["who"] == "chat friend")
					return "#1adda4";
				else
					return "#1ddced"; //gradText;//"linear-gradient(to right, #ffffff 0%, #1ddced, 30%, #ffffff 100%)";//"#1ddced";
			})
			.style('order', function(d){ 
				if( d["who"] == "chat self")
					return -1;
				else
					return 1;
			})
			.style('width', "80%")
			// .style('width',  function(d) {
			// 	if( d["who"] == "chat self")
			// 		return "100%";
			// 	else
			// 		return "80%";
			// })
			.style('padding', '15px')
			.style('margin', function(d) {
				if( d["who"] == "chat self")
					return '5px 200px 0px 10px';
				else
					return '5px 0px 0px 200px';
			})
			// .style('text-align', function(d) {
			// 	if( d["who"] == "chat self")
			// 		return 'left';
			// 	else
			// 		return 'right';
			// })
			.style('border-radius', '10px')
			.style('color', '#fff')
			.style('font-size', '40px');
			
		// this.msg = d3.selectAll(".chat-message")
		// 	.text( function(d) { return d.message } );
		// 					.style('background', function(d){ 
		// 		if( d["who"] == "chat friend")
		// 			return "#1adda4";
		// 		else
		// 			return gradText;//"linear-gradient(to right, #ffffff 0%, #1ddced, 30%, #ffffff 100%)";//"#1ddced";
		// 	});



		this.chat = d3.selectAll('.chat')
			.style("display", "flex")
			.style("flex-flow", "row wrap")
			.style("align-items", "flex-start")
			.style("margin-bottom", "10px");

		this.refresh();
			//this.refresh(date);


	},

	updateMessage: function(){
		this.msg = d3.selectAll(".chat-message")
			.text( function(d) { return d.message } );
	},

	// update: function(data){


	// },

	// init2: function(data){
	// 	// Create div into the DOM
	// 	this.SAGE2Init("canvas", data);
	// 	// Set the background to black
	// 	this.element.style.backgroundColor = '#404040';
	// 	this.element.style.opacity = 1.0;
	// 	//this.element.width = 5464;
	// 	//this.element.height = 2304;
	// 	// move and resize callbacks
	// 	this.resizeEvents = "continuous";
	// 	this.moveEvents   = "continuous";
 //    	this.systemInstruction = ">> Begin Speaking . . .";
	// 	// SAGE2 Application Settings
	// 	//
	// 	// Control the frame rate for an animation application
	// 	this.maxFPS = 2.0;
	// 	// Not adding controls but making the default buttons available
	// 	this.controls.finishedAddingControls();
	// 	this.enableControls = true;

	// 	this.ctx = this.element.getContext('2d');

	// 	this.counter = 0;
	// 	this.debugMode = true;

	// 	this.currentTestCommand = 0;

	// 	this.listOfCommandsForTesting = 
	// 	[
	// 		{text: "Lets start with the activity around UIC", targetAppId: null},//Q1, app2
	// 		{text:	"Could I take a look at when crimes happen", targetAppId: null},//Q2, app3
	// 		{text: "Could I look at when crimes happen for each neighborhood", targetAppId: null},//Q3, app4
	// 		{text: "Show me the months where the most number of crimes occur around school areas", targetAppId: null},//Q4, app5
	// 		{text: "If I was walking to the EL, would there be any areas that are particularly dangerous to walk through due to theft or battery", targetAppId: null}, //Q5, app6
	// 		{text: "Of the theft in the Near West Side, are you able to kind of show it by month", targetAppId: null},//Q6, app7
			
	// 		{text: "PART 2a", targetAppId: null},//delete

	// 		{text: "I would just like to see the total amount of crimes that happened divided by the three main areas, UIC, River North and Near West Side", targetAppId: null},//Q1, app8
	// 		{text:	"Are you able to show like the entire percentage of crime in each neighborhood", targetAppId: null},//Q2, app9
	// 		{text: "Is there any way to kind of show theft by location type", targetAppId: null},//Q3, app10
	// 		{text: "Can you show the location type for the crimes that occur between noon and 6 and 6 and midnight", targetAppId: null},//Q5, app11
	// 		{text: "I am wondering around the bus lines if there are more public intoxication or fighting or verbal harassment in the summer", targetAppId: null}, //Q6, app12
	// 		{text: "Show me the crime reported with respect to the location specifically in River North and UIC by year", targetAppId: null},//Q4, app13

	// 		{text: "PART 2b", targetAppId: null},//Q4, app7

	// 		{text: "Can you show the same chart for days of the week?", targetAppId: "app_12"},  // app 8
	// 		{text: "Can you show this graph for months of year?", targetAppId: "app_12"}, // app 9
	// 		{text: "Can you move it", targetAppId: "app_12"}, 
	// 		{text: "Can you minimize it?", targetAppId: "app_12"},
	// 		{text: "Can you bring up this pic that has been hidden?", targetAppId: "app_12"},			
	// 		{text: "Yeah don't need this one here", targetAppId: "app_12"}

	// 	];


	// 	this.useMaster = true; //turn on and off using the isMaster function...


	// 	//in practice, I don't use colors well.  Ideally, we would want this to be 'smarter'
	// 	// now it just cycles through these colors, unless assigned by the nlp side
	// 	this.colors = ["steelblue", "mediumseagreen", "cadetblue", "lightskyblue"];


	// 	//this stores the commands that are visible and displayed to the user
	// 	// the text of the spoken commands
	// 	this.commands = [];
	// 	this.commands.push(">");

	// 	//vis parameters used to draw stuff
	// 	this.gap = 10;
	// 	this.statusBar = {x: this.gap, y: this.gap, w: this.element.width-this.gap*2.0, h: 50};
	// 	this.userInputArea = {x: this.gap, y: this.statusBar.h+this.gap+this.statusBar.y, w:this.statusBar.w/2.0-this.gap/2.0, h: this.element.height-this.statusBar.h-this.gap*3.0};
	// 	this.systemInputArea = {x: this.userInputArea.x+this.userInputArea.w+this.gap, y: this.userInputArea.y, w: this.userInputArea.w, h:this.userInputArea.h};

	// 	//this.contactArticulateHub("https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query/show me thefts in the loop by crime types", 0);
	// 	this.targetAppID = null;
	// 	this.requests = new Array();
	// 	this.responces = new Array();
	// 	this.sessionId = null;

	// 	this.waitingForResponse = false;
	// 	this.animCount = 0; 


	// },

	// checkWaiting: function(date){
	// 	this.waitingForResponse = true;
	// 	this.refresh(date);
	// },

	// stopWaiting: function(date){
	// 	this.waitingForResponse = false;
	// 	this.refresh(date);
	// }

	load: function(date) {
		console.log('articulate_ui> Load with state value', this.state.value);
		this.refresh(date);
	},


	draw: function(date) {

		// if( this.waitingForResponse ){
		// 		this.ball.style('left', this.percentage + "%");
		// 		//this.ball.style('top', this.percentage + "%")
		// 		this.ball.style('background', 'lightsalmon');
		// 		this.changeBy = this.increment * (date.getTime() - this.previousDate.getTime()) / 50;
		// 		this.percentage = this.percentage +  this.changeBy;
		// 		//console.log( this.changeBy );
				
		// 		if( this.percentage > 75)
		// 			this.increment = -1;
		// 		if( this.percentage < 25 )
		// 			this.increment = 1; 
		// } else {
		// 		this.ball.style('left', this.percentage + "%");
		// 		//this.ball.style('top', this.percentage + "%")
		// 		this.ball.style('background', 'lightsteelblue');
		// 		this.changeBy = this.increment * (date.getTime() - this.previousDate.getTime()) / 300;
		// 		this.percentage = this.percentage +  this.changeBy;
		// 		//console.log( this.changeBy );
				
		// 		if( this.percentage > 75)
		// 			this.increment = -1;
		// 		if( this.percentage < 25 )
		// 			this.increment = 1; 

		// }


			// this.previousDate = date;


			//  this.refresh(new Date());



	},

	//----------------------------------------//
	//---------- DRAWING FUNCTIONS ----------//
	//---------------------------------------//
	//I used the canvas to draw because I find it preferable for text, and I am more accustumed to it
	//but this isn't necessary
	draw2: function(date) {
		//console.log('articulate_ui> Draw with state value', this.state.value);

		this.ctx.clearRect(0, 0, this.element.width, this.element.height);
		this.ctx.fillStyle = "rgba(0,0,0,1)";
		this.ctx.fillRect(0,0,this.element.width, this.element.height);
		this.fontSize = 32;
		this.ctx.font = "32px Helvetica";
		this.ctx.textAlign="left";

		//status bar
		this.ctx.fillStyle = "rgba(23, 191, 140, 1.0)"
		this.ctx.fillRect(this.statusBar.x, this.statusBar.y, this.statusBar.w, this.statusBar.h);
		this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)"
		this.ctx.fillRect(this.statusBar.x, this.statusBar.y + this.statusBar.h + 10, 1100, 600);
		//this.ctx.fillRect(this.statusBar.x, this.statusBar.y + this.statusBar.h + 10, this.element.width / 5, this.element.height / 4);
		this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
		this.ctx.fillText( "Connected", this.statusBar.x+this.gap, this.statusBar.y+this.statusBar.h/2.0+16);

		//System instruction bar at the bottom of the screen
		this.ctx.fillStyle = "rgba(38, 38, 38, 1.0)"
		this.ctx.fillRect(this.statusBar.x, this.element.height - 200, this.statusBar.w, this.statusBar.h * 2.5);
		this.ctx.fillStyle = "rgba(23, 191, 140, 1.0)"
		this.ctx.font = "64px Helvetica";
		var w = this.ctx.measureText( this.systemInstruction).width;
		this.ctx.fillText( this.systemInstruction, this.element.width / 2 - w / 2, this.element.height - 175 + this.statusBar.h);

		//this.ctx.fillRect(this.userInputArea.x, this.userInputArea.y, this.userInputArea.w, this.userInputArea.h);
		//this.ctx.fillRect(this.systemInputArea.x, this.systemInputArea.y, this.systemInputArea.w, this.systemInputArea.h);

		this.fontSize = 32;
		this.ctx.font = this.fontSize+"px Ariel";
		this.ctx.textAlign="left";
		this.ctx.fillStyle = "rgba(225, 225, 225, 1.0)";
		theY = this.userInputArea.y+32+this.gap;

		//no idea if this works...
		startIdx = 0;
		if( this.commands.length*32 > this.element.length-100 ) {
			diff = (this.element.length-100) - (this.commands.length*32);
			startIdx = diff % 32;
		}

		// but this works...
		for(i = 0; i < this.commands.length; i++){
			this.ctx.fillText( this.commands[i], this.userInputArea.x+this.gap, theY);
			theY += 32;
		}

			this.ctx.fillStyle = "rgba(200, 200, 200, 1.0)";
			this.ctx.font = 24 + "px Ariel";
			this.ctx.fillText( this.final_url, this.userInputArea.x+this.gap+20, theY);

		// synced data
		// this.ctx.fillStyle = "rgba(189, 148, 255, 1.0)";
		// this.ctx.fillRect(100, this.element.height - 100, this.element.width-200, 75 );
		// this.ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
		// this.ctx.font = "24px Ariel";
		// this.ctx.textAlign="left";
		// this.ctx.fillText("generate vis", 110, this.element.height - 50 );
	},

	//--------------------------------------------//
	//--------- WINDOW CHANGE FUNCTIONS ----------//
	//--------------------------------------------//
	resize: function(date) {
		this.statusBar = {x: this.gap, y: this.gap, w: this.element.width-this.gap*2.0, h: 50};

			myWidth = this.element.clientWidth;
			myHeight = this.element.clientHeight;


		this.mainDiv.attr("width",   myWidth)
			.attr("height",  myHeight);

		//this.loader	.style('width', myWidth+"px");
		this.refresh(date);
	},
	move: function(date) {
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},


	//------------------------------------------//
	//--------------EVENT FUNCTIONS-------------//
	//------------------------------------------//
	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) { 
			console.log('pointer press');

			if( this.debugMode )
			{
				if( this.currentTestCommand < this.listOfCommandsForTesting.length )
				{
					this.chatData.push( this.listOfCommandsForTesting[this.currentTestCommand] );
					//this.update();
					//this.refresh(date);
					this.currentTestCommand = this.currentTestCommand + 1;
				}
			}

			this.waitingForResponse = true;

			//this.update(date);

			//this.chatData.push({"who": "chat nobody", "message": "empty"});//not sure why

			this.chatData.push({"who": "chat self", "message": "processing...."});

			this.update();

			//this.chatData.push({"who": "chat nobody", "message": "empty"});//not sure why

			//this.checkWaiting();
			this.refresh(date);

				// this.update();
				// this.refresh();

			var base_url = "https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query?utterance=";
			var requestIndex = this.requests.push(base_url + this.chatData[this.chatData.length-2]["message"]+"&gesturetargetid="+this.chatData[this.chatData.length-2]["targetAppId"]); //returns the number of elements
					//this.contactArticulateHub(base_url+data.text, data.orderedItems, requestIndex - 1);  //send to the articulate hub

					//only send url and the index of the request
			//if( isMaster || !this.useMaster ){ //THIS SEEMES BUGGY- should be on, but sometimes then the message doesn't go through
				console.log("ABOUT TO CONTACT ARTICULATE HUB")
				//orderedItems = [ this.listOfCommandsForTesting[this.currentTestCommand]["text"] ];
				console.log( this.chatData[this.chatData.length-2]["targetAppId"] );  //send to the articulate hub
				this.contactArticulateHub(base_url+ this.chatData[this.chatData.length-2]["message"], requestIndex - 1, this.chatData[this.chatData.length-2]["targetAppId"]);  //send to the articulate hub
			//}//

			

			
		}



	},

	event2 : function(eventType, position, user_id, data, date) {
		//when I am debugging, I use pointer presses to launch example visualizations
			//if( isMaster && this.debugMode ){


				//this.readExample2(this.specificationObjects[this.counter], this.colors[this.counter]);
				//this.contactArticulateHub("show me theft in loop by location type"); //or can use it to contact articulate hub with a dummy question
			//}

			if( this.debugMode ){
				//I can't remember why this code is here...
				//this.counter++;
				if( this.currentTestCommand < this.listOfCommandsForTesting.length )
				{

					console.log("TEXT INPUT " + this.listOfCommandsForTesting[this.currentTestCommand]["text"]);
					//console.log("targetApp " + this.orderedItems);
					this.commands[this.commands.length-1] =this.listOfCommandsForTesting[this.currentTestCommand]["text"];
					this.commands.push(">");
					this.refresh();
					this.systemInstruction = "";
					this.refresh();
					this.systemInstruction = ">> Sending Request . . ."
					this.refresh();

					
		// }
		// else if (eventType === "pointerMove" && this.dragging) {
		// }//new logic to maintain the same sessionId
					var base_url = "https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query?utterance=";
					var requestIndex = this.requests.push(base_url + this.listOfCommandsForTesting[this.currentTestCommand]["text"]+"&gesturetargetid="+this.listOfCommandsForTesting[this.currentTestCommand]["targetAppId"]); //returns the number of elements
					//this.contactArticulateHub(base_url+data.text, data.orderedItems, requestIndex - 1);  //send to the articulate hub

					//only send url and the index of the request
				//if( isMaster || !this.useMaster ){ //THIS SEEMES BUGGY- should be on, but sometimes then the message doesn't go through
						console.log("ABOUT TO CONTACT ARTICULATE HUB")
						orderedItems = [ this.listOfCommandsForTesting[this.currentTestCommand]["text"] ];
						console.log( this.listOfCommandsForTesting[this.currentTestCommand]["targetAppId"] );  //send to the articulate hub
						this.contactArticulateHub(base_url+this.listOfCommandsForTesting[this.currentTestCommand]["text"], requestIndex - 1, this.listOfCommandsForTesting[this.currentTestCommand]["targetAppId"]);  //send to the articulate hub
				 //}

				 this.currentTestCommand++;

				}
			}



		// else if (eventType === "pointerRelease" && (data.button === "left")) {
		// }

		// // Scroll events for zoom
		// else if (eventType === "pointerScroll") {
		// }
		// else if (eventType === "widgetEvent"){
		// }
		// else if (eventType === "keyboard") {
		// 	if (data.character === "m") {
		// 		this.refresh(date);
		// 	}
		// }
		// else if (eventType === "specialKey") {
		// 	if (data.code === 37 && data.state === "down") { // left
		// 		this.refresh(date);
		// 	}
		// 	else if (data.code === 38 && data.state === "down") { // up
		// 		this.refresh(date);
		// 	}
		// 	else if (data.code === 39 && data.state === "down") { // right
		// 		this.refresh(date);
		// 	}
		// 	else if (data.code === 40 && data.state === "down") { // down
		// 		this.refresh(date);
		// 	}
		// }
	},

articulateDebugInfo: function(data, date){
console.log("debugDatagram: "+ data);
},
	// this is where commands come from the UI
	// so when the user speaks, and presses 'send to sage2', it ends up here
	//recieves data.data: {text: data.text, orderedItems: orderedItems} , data.targetAppID??
	//orderedItems Array[name: appId, count: Occurances]
	textInputEvent: function(data, date){
		//console.log("in articulate");
		// this.orderedItems = data.orderedItems;
		// //console.log("targetApp " + this.orderedItems);
		// this.commands[this.commands.length-1] = data.text;
		// this.commands.push(">");
		// this.refresh();
		// this.systemInstruction = "";
		// this.refresh();
		// this.systemInstruction = ">> Sending Request . . ."
		// this.refresh();



		console.log("TEXT INPUT " + data.text);
		//new logic to maintain the same sessionId
		var base_url = "https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query?utterance=";
		var requestIndex = this.requests.push(base_url + data.text); //returns the number of elements
		//this.contactArticulateHub(base_url+data.text, data.orderedItems, requestIndex - 1);  //send to the articulate hub


		if( data.targetAppID) {
			this.chatData.push( {"message": data.text, "who": "chat friend", "targetAppID":  data.targetAppID["appId"] } );
		}
		else {
			this.chatData.push( {"message": data.text, "who": "chat friend", "targetAppID": "null" } );
		}


		this.waitingForResponse = true;


		this.chatData.push({"who": "chat self", "message": "processing...."});

		this.update();

			//this.chatData.push({"who": "chat nobody", "message": "empty"});//not sure why

			//this.checkWaiting();
		this.refresh(date);
		// this.update();
		// this.refresh();

		
		//only send url and the index of the request
		//if( isMaster || !this.useMaster ){ //THIS SEEMES BUGGY- should be on, but sometimes then the message doesn't go through
			console.log("ABOUT TO CONTACT ARTICULATE HUB");
				if( data.targetAppID) {
						this.contactArticulateHub(base_url+data.text, requestIndex - 1, data.targetAppID["appId"]);  //send to the articulate hub
				}
				else {

						this.contactArticulateHub(base_url+data.text, requestIndex - 1, "null");  //send to the articulate hub

				}
		//}
		//----------------------------------------

		//if( isMaster ){
		//send to articulate hub...
		//this.contactArticulateHub(data.text, data.orderedItems);  //send to the articulate hub

		//}


		// if( text.indexOf("Launch example") > -1 ){
		// 	//wsio.emit('launchLinkedChildApp', {application: "apps/d3plus_visapp", user: "articulate_ui", msg:"this is a message from articulate_ui"});
		// 	this.launchVis();
		// }
		// if( text.indexOf("Open example") > -1 ){
		// 	this.launchVis2();

		// }

	},

	//---------------------------------------------
	//------------ CONNECTION FUNCTIONS -----------
	//---------------------------------------------
	//contact the smart hub-- only called by master
	//contactArticulateHub: function(url, orderedItems, requestIndex){
	contactArticulateHub: function(url, requestIndex, targetAppID){
		//msg.replace(" ", "%");
		console.log("sending msg: " , url);
		console.log(targetAppID);

		//debugging
		console.log(this.childList);
		targetHubId = null;
		if( this.childList.length >= 1 ){
			for(i = 0; i<this.childList.length;i++){
				console.log("child:");
				console.log(this.childList[i]);
				console.log("target:");
				console.log(targetAppID);
				if(this.childList[i]["childId"] == targetAppID){
					console.log("FOUND THE TARGET");
					console.log(this.childList[i]);
					targetHubId = this.childList[i]["initState"]["initState"]["hub_id"];
					console.log(targetHubId);
				}
			}
		}

		//var temp= JSON.stringify(orderedItems);
		//console.log("orderedItems: " + temp);
		url = url.replace(/"/g,"");

		//new: adding the gestureRelease
		if(targetHubId != null)
			url=url+"&gesturetargetid="+targetHubId;
		//else {

		//}
		console.log(url);

		this.callbackFunc = this.callback.bind(this);
		this.postRequest(url, this.callbackFunc, 'JSON', requestIndex);
	},

	// //contact the smart hub-- only called by master
	// contactArticulateHub: function(msg, orderedItems){
	// 	//msg.replace(" ", "%");
	// 	console.log("sending msg: " , msg);
  //
  //
  //
	// 	//if(msg.includes("Close")){
  //
	// 	//}else{
	// 		//msg = "Can I see crimes on streets by crime type"; //msg.replace(" ", "%");
	// 	//}
	// 	url = "https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query/";
  //
	// 	//url = "https://articulate.evl.uic.edu:8443/smarthub/webapi/myresource/query/can%we%look%at%total%crime%by%locationtype%in%2013%for%UIC";
	// 	var temp= JSON.stringify(orderedItems);
	// 	console.log(temp);
	// 	msg = msg.replace(/"/g,"");
	// 	url = url+msg;//+temp;
	// 	console.log(url);
	// 	this.callbackFunc = this.callback.bind(this);
  //
	// 	this.postRequest(url, this.callbackFunc, 'JSON');
	// },

	//this sends the request to the rest service
	//only called by master
	postRequest: function(url, callback, type, requestIndex) {
		var dataType = type || "TEXT";

		var xhr = new XMLHttpRequest();
	//	var http = new XMLHttpRequest();
	//	http.open("GET",url,false);
	//	http.withCredentials = true;
	//	http.send(null);

		if(requestIndex >= 1){
			//for (var i = 0; i < this.responces.length; i++){
			//	if(this.responces[i].sessionId != null)
			this.final_url = url + "&jsessionid=" + this.sessionId;
			//final_url = url + ";jsessionid=" + this.responces[requestIndex-1].sessionId;
			//}
			console.log("supsequent call " + this.final_url);
			xhr.withCredentials = true;
			if( isMaster || !this.useMaster){
					xhr.open("GET", this.final_url, true);
			}

		} else {
			this.final_url = url + "&isnewsession=True";

			console.log("first call " + this.final_url);
			xhr.withCredentials = true;
			if( isMaster || !this.useMaster){
					xhr.open("GET", this.final_url, true);
			}
		}

		//if( isMaster || !this.useMaster){
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						if (dataType === "TEXT") {
							callback(null, xhr.responseText);
						} else if (dataType === "JSON") {

							callback(null, JSON.parse(xhr.responseText), requestIndex);


						} else if (dataType === "CSV") {
							callback(null, csvToArray(xhr.responseText));
						} else if (dataType === "SVG") {
							callback(null, xhr.responseXML.getElementsByTagName('svg')[0]);
						} else {
							callback(null, xhr.responseText);
						}
					} else {
						callback("Error: File Not Found", null);
					}
				}
			};

			if(isMaster || !this.useMaster )
					xhr.send();
		//}
	},

	//this gets the data from the smart hub, in a callback
	callback: function(err, specObj, requestIndex) {
		console.log("IN CALLBACK");
		console.log(specObj);
			if (err){
				console.log("error connecting to articulate smart hub" + err);
				// this.systemInstruction = ">> Error connecting to articulate smart hub";
				this.chatData[this.chatData.length-1]["message"] = "Sorry, we had trouble with this request. Can you try again?";
				this.updateMessage();

				this.waitingForResponse = false;
				this.refresh();
				//return;
				}

			if(specObj != null && specObj["dataQuery"] != null){
				console.log("GOT THE RESPONSE: ");
				//this.refresh();
				//this.systemInstruction = "";
				//this.refresh();
				//this.systemInstruction = ">> Response Recieved . . .";
				console.log(specObj);
				this.responces[requestIndex] = specObj;
				console.log("sess id all " + this.responces[requestIndex].sessionId);
				this.sessionId = specObj["sessionId"];
				console.log(this.sessionId);
				this.refresh();
			//OLD
			//this.handleResponse(specObj);
				//if( isMaster || !this.useMaster){
					this.readExample3(specObj, "null"); // call the parser
				//}
			}
			else if(specObj["dataQuery"] == null){

				if( specObj["request"] == "close.01" || specObj["request"] == "need.01"){
					console.log("close");
					this.readExample3(specObj);
				}
				else if( specObj["request"] == "move.01"){
					console.log("move");
					this.readExample3(specObj);
				}
				else if( specObj["request"] == "minimize.01"){
					console.log("minimize");
					this.readExample3(specObj);
				}
				else if( specObj["request"] == "maximize.01"){
					console.log("maximize");
					this.readExample3(specObj);
				}
				else{ //not sure what this is for
					// this.refresh();
					// this.systemInstruction = "";
					// this.refresh();
					// this.systemInstruction = ">> Cannot understand the request! Try again . . .";
					console.log("Cannot understand the request! Try again");
					// this.refresh();

						// this.systemInstruction = ">> Error connecting to articulate smart hub"; 
						this.chatData[this.chatData.length-1]["message"] = "Something has gone wrong. Please try again!";
						this.updateMessage();
						this.waitingForResponse = false;
						this.refresh();
				}
			}
			//then broadcast the results to display nodes!
			//broadcast( "handleResponse", {response:"responseTest"} );
		},


	readExample3: function(specificationObj, color){
		//layout requests (close)
		//this.chatData.push({"who": "chat nobody", "message": "empty"});//not sure why

		

		//vis requests
		console.log("######################################")
		console.log("NEW SPECIFICATION OBJ");
		console.log(specificationObj);
		console.log("######################################")

		if( specificationObj["requestType"] == "Layout" ||  specificationObj["requestType"] == "Preference Expression"  ){
			if( specificationObj["request"] == "close.01" || specificationObj["request"] == "need.01"){
				console.log("CLOSE");
				console.log(specificationObj["targetId"]);
				hubId = specificationObj["targetId"];
				this.closeChildByHubId(hubId);
			}
			else if( specificationObj["request"] == "move.01"){
				console.log("MOVE");
				console.log(specificationObj["targetId"]);
				hubId = specificationObj["targetId"];
				this.moveChildByHubId(hubId);
			}
			else if( specificationObj["request"] == "minimize.01"){
				console.log("MINIMIZE");
				console.log(specificationObj["targetId"]);
				hubId = specificationObj["targetId"];
				this.minimizeChildByHubId(hubId);
			}
			else if( specificationObj["request"] == "maximize.01"){
				console.log("MAXIMIZE");
				console.log(specificationObj["targetId"]);
				hubId = specificationObj["targetId"];
				this.maximizeChildByHubId(hubId);
			}
		}
		else if(specificationObj["requestType"] == "Command Based on previous viz"
								|| specificationObj["requestType"] == "Command Not based on an existing visualization") {

			console.log("make a vis!");
			plotTitle = specificationObj["plotHeadline"]["shortSummary"];
			console.log(plotTitle);

			type = specificationObj["plotHeadline"]["plotType"].toLowerCase(); //what kind of plot: bar chart, map, line chart
			x = specificationObj["horizontalAxis"];//.toLowerCase();//changed: specificationObj["horizontalGroupAxis"].toLowerCase()
			y = specificationObj["verticalAxis"];//.toLowerCase();
			c =  specificationObj["horizontalGroupAxis"];
			hub_id = specificationObj["plotHeadline"]["id"];
			//id = null;//specificationObj["id"]; //not using right now...
			//if( specificationObj["horizontalAxis"] ) // this  just required some additional parsing...
			//	if( specificationObj["horizontalAxis"] == "NON_UNIT")
			//		id = null;//specificationObj["id"];
			//	else
			//		id = specificationObj["horizontalAxis"].toLowerCase();
			dataToVisualize = [];
			maxVal = 0;

/*
{
  "$schema": "https://vega.github.io/schema/vega-lite/v3.json",
  "description": "A simple bar chart with embedded data.",
  "data": {
    "values": [
      {"a": "A","b": 28}, {"a": "B","b": 55}, {"a": "C","b": 43},
      {"a": "D","b": 91}, {"a": "E","b": 81}, {"a": "F","b": 53},
      {"a": "G","b": 19}, {"a": "H","b": 87}, {"a": "I","b": 52}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "a", "type": "ordinal"},
    "y": {"field": "b", "type": "quantitative"}
  }
}
*/


			if( specificationObj["plotHeadline"]["plotType"] == "BAR" && c == null ){
				dataToVisualize = this.parseBar(specificationObj["dataQueryResult"], c, specificationObj["horizontalAxis"]);

				//launch app
				applicationType ="custom",
				application = "apps/vega_lite_app"; 	 //its a vega app
				msg = "this is a message from articulate_ui", //not used so much, but could
				console.log(dataToVisualize);


				 this.vegaLiteSpec = {
					  "$schema": "https://vega.github.io/schema/vega-lite/v3.json",
					  "description": plotTitle,
					  "width": 700,
					  "height": 500,
					   "autosize": {
					    "type": "fit",
					    "resize": true
					  },
					  //"title": {
    				//	"text": plotTitle,
  					//	 "anchor": "start"
					  //},
					 "data": {
					 	"values" : dataToVisualize
					 },
					  //"data" : {
					    //"values": [
					    //  {"a": "A","b": 28}, {"a": "B","b": 55}, {"a": "C","b": 43},
					   //  {"a": "D","b": 91}, {"a": "E","b": 81}, {"a": "F","b": 53},
					  //   {"a": "G","b": 19}, {"a": "H","b": 87}, {"a": "I","b": 52}
					  //  ]
					  //},
					  "mark": "bar",
					  "encoding": {
					    "x": {"field": specificationObj["horizontalAxis"], "type": "ordinal",  "sort": {"op": "count", "field": "number of crimes", "order": "descending"}},
					    "y": {"field": "number of crimes", "type": "quantitative"},
					    "tooltip": {"field": "b", "type": "quantitative"}
					  }
					};


				initState = {  // the vis app will get these values and use them to draw appropriately
					value: 10,
					hub_id: hub_id,
					plotTitle: plotTitle,
					vegaLiteSpec: this.vegaLiteSpec
				};
			}
			if( specificationObj["plotHeadline"]["plotType"] == "BAR" && c != null ){
				dataToVisualize = this.parseBar(specificationObj["dataQueryResult"], c, specificationObj["horizontalAxis"]);

				//launch app
				applicationType ="custom",
				application = "apps/vega_vis_app"; 	 //its a vega app
				msg = "this is a message from articulate_ui", //not used so much, but could
				console.log(dataToVisualize);

				if( x == "time"){
					x = "hour";
				}

				initState = {  // the vis app will get these values and use them to draw appropriately
					value: 10,
					hub_id: hub_id,
					title: plotTitle,
					type: "grouped-bar",  //what kind of chart: bar or line
					x: x.toLowerCase(), //x axis for the bar chart
					y: y.toLowerCase(), //y axis for the bar chart (usually counts in our case)
					color: color, //what color to give the bars - at this point a single color- someday need multiple colors
					visId: this.counter,  //unique id for the vis, based on the count
					data: dataToVisualize //the data to visualize- like counts and labels
					//title: "visualization response" //should make this better someday...
				};
			}
			if( specificationObj["plotHeadline"]["plotType"] == "LINE"){


				dataToVisualize = this.parseLine(specificationObj["dataQueryResult"], c, specificationObj["horizontalAxis"], plotTitle);

				//launch app
				applicationType ="custom",
				application = "apps/vega_lite_app"; 	 //its a vega app
				msg = "this is a message from articulate_ui", //not used so much, but could
				console.log(dataToVisualize);

				//type = "quantitative";
				//sort = "[]"; 
				//if( specificationObj["horizontalAxis"] == "month" || specificationObj["horizontalAxis"] == "day" || specificationObj["horizontalAxis"] == "time"   ){
					// type = "ordinal";
					// if(specificationObj["horizontalAxis"] == "day" )
					// 	sort = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
					// if( specificationObj["horizontalAxis"] == "month" )
					// 	sort = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
					// if(specificationObj["horizontalAxis"] == "time" )
					// 	sort = ["midnight", "1-a_m", "2-a_m", "3-a_m", "4-a_m", "5-a_m", "6-a_m", "7-a_m", "8-a_m", "9-a_m", "10-a_m", "11-a_m", "noon", "1-p_m", "2-p_m", "3-p_m", "4-p_m", "5-p_m", "6-p_m", "7-p_m", "8-p_m", "9-p_m", "10-p_m", "11-p_m"];
					// if( specificationObj["horizontalAxis"] == "year" )
					// 	sort = ["2010", "2011", "2012", "2013", "2014", "2015"];
					
				//}
				timeUnit = "year";
				if( specificationObj["horizontalAxis"]  == "time" )
					timeUnit = "hours";
				if( specificationObj["horizontalAxis"]  == "month")
					timeUnit = "month";
				if( specificationObj["horizontalAxis"] == "day")
					timeUnit = "day";

				console.log("time unit = " + timeUnit)

				 this.vegaLiteSpec =  {

				 	"$schema": "https://vega.github.io/schema/vega-lite/v3.json",
		   			 "description": "Stock prices of 5 Tech Companies over Time.",
		   			 "width": 700,
		    		"height": 500,
 				    //"title": {
    				//	"text": plotTitle,
  					//	 "anchor": "start"
					 // },
		    		"data": {
		    			"values": dataToVisualize, 
		    			// [
								// {"x": "2010", "y": 100, "c": "UIC"},
								// {"x": "2011", "y": 200, "c": "UIC"},
								// {"x": "2012", "y": 320, "c": "UIC"},
								// {"x": "2013", "y": 450, "c": "UIC"},
								// {"x": "2014", "y": 120, "c": "UIC"},
								// {"x": "2010", "y": 340, "c": "Loop"},
								// {"x": "2011", "y": 150, "c": "Loop"},
								// {"x": "2012", "y": 630, "c": "Loop"},
								// {"x": "2013", "y": 540, "c": "Loop"},
								// {"x": "2014", "y": 520, "c": "Loop"}
						// ]
		   			 },
				    "mark": {
						"type": "line",
						"interpolate": "monotone",
						"point": true
				    },
				    "transform": [{"timeUnit": timeUnit, "field": "x", "as": timeUnit}],
				    "encoding": {
						// "x": { "field": "x", "type": type, "axis": {"ticks": true, "tickCount": 5}, "sort": sort },
						"x": { "field": "time", "type": "ordinal", "timeUnit": timeUnit,  "axis": {"ticks": true, "tickCount": 5} },
						"y": {"field": "number of crimes", "type": "quantitative"},
						"color": {"field": "legend", "type": "nominal"}
				    },
				      "config": {"point": {"size": 100}}
                };

				initState = {  // the vis app will get these values and use them to draw appropriately
					value: 10,
					hub_id: hub_id,
					plotTitle: plotTitle,
					vegaLiteSpec: this.vegaLiteSpec
				};
			}
			if( specificationObj["plotHeadline"]["plotType"] == "MAP"){

				for(i = 0; i < specificationObj["dataQueryResult"].length; i++){
					line = specificationObj["dataQueryResult"][i];
					//console.log(line);

					//"(latitude,41.859);(longitude,-87.687);1"
					while( line.indexOf("(") != -1 )
						line = line.replace("(", "#");
					while( line.indexOf(")") != -1 )
						line = line.replace(")", "#");
					while( line.indexOf(";") != -1 )
						line = line.replace(";", "#");
					while( line.indexOf(",") != -1 )
						line = line.replace(",", "#");
					tokens = line.split("#");
					//console.log(tokens);
					obj = new Object();

					//console.log(tokens);
					obj["latitude"] = parseFloat(tokens[2]);
					obj["longitude"] = parseFloat(tokens[6]);
					val = parseFloat(tokens[8]);
					obj["value"] = val;
					if( val > maxVal )
						maxVal = val;
					//to do... maybe?

					if( obj["latitude"] != -1 )
						dataToVisualize.push(obj);
				}//end look through data

				// now launch the map in a separate sage2 app
				applicationType ="custom", //its a custom app (as opposed to say video app)
				application = "apps/heat_map"; //I called it 'heat map'
				msg = "this is a message from articulate_ui", //not really used, but an option
				console.log(dataToVisualize); //just for sanity

				initState = {  // these values will load on child app init
					value: 20,
					data: dataToVisualize, //here is where I send the locations and number of crimes at this location, which came from the nlp smart hub
					maxValue: maxVal,
					title: plotTitle,
					hub_id: hub_id
				};


			}//end maps
			console.log("launch");
			if( isMaster || !this.useMaster )
					this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app

		}
		else { //generic-
			hub_id = specificationObj["plotHeadline"]["id"];
			applicationType ="custom",
			application = "apps/vega_vis_app"; 	 //its a vega app
			msg = "this is a message from articulate_ui", //not used so much, but could

			initState = {  // the vis app will get these values and use them to draw appropriately
				value: 10,
				hub_id: hub_id,
				title: "plotTitle",
				type: "line",  //what kind of chart: bar or line
				x: "x", //x axis for the bar chart
				y: "y", //y axis for the bar chart (usually counts in our case)
				visId: this.counter,  //unique id for the vis, based on the count
				data: [
				    {"x": 1, "c":"id1", "value": 15},
				    {"x": 1, "c":"id2", "value": 10},
				    {"x": 1, "c":"id3", "value": 5},
				    {"x": 1, "c":"id4", "value": 50},
				  	{"x": 2, "c":"id1", "value": 22},
				    {"x": 2, "c":"id2", "value": 13},
				    {"x": 2, "c":"id3", "value": 16},
				    {"x": 2, "c":"id4", "value": 55},
				  	{"x": 3, "c":"id1", "value": 43},
				    {"x": 3, "c":"id2", "value": 3},
				    {"x": 3, "c":"id3", "value": 34},
				    {"x": 3, "c":"id4", "value": 23},
				  	{"x": 4, "c":"id1", "value": 27},
				    {"x": 4, "c":"id2", "value": 14},
				    {"x": 4, "c":"id3", "value": 10},
				    {"x": 4, "c":"id4", "value": 2},
				    {"x": 5, "c":"id1", "value": 47},
				    {"x": 5, "c":"id2", "value": 4},
				    {"x": 5, "c":"id3", "value": 18},
				    {"x": 5, "c":"id4", "value": 22}
				  ],
				  "color": "steelblue"
			};
			if( isMaster || !this.useMaster )
					this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
		}
	},

	parseBar: function(dataQueryResult, c, horizontalAxis){
		dataToVisualize = [];

		if( dataQueryResult.length == 1 ){
			line = dataQueryResult[0];

			while( line.indexOf("(") != -1 )
				line = line.replace("(", "#");
			while( line.indexOf(")") != -1 )
				line = line.replace(")", "#");
			while( line.indexOf(";") != -1 )
				line = line.replace(";", "#");
			while( line.indexOf(",") != -1 )
				line = line.replace(",", "#");
			tokens = line.split("#");
			//console.log(tokens);
			obj = new Object();

			if( c == null ){
				obj["number of crimes"] = parseInt(tokens[2]);
				obj[""+horizontalAxis] = "";
				obj["c"] = "null";
			}
			else {
				obj["number of crimes"] = parseInt(tokens[2]);
				obj[""+horizontalAxis] = "";//tokens[2];
				obj["c"] = "";//tokens[6];
			}
			dataToVisualize.push(obj);

		}
		else {
			for(i = 0; i < dataQueryResult.length; i++){ //same thing parse the data
				line = dataQueryResult[i];
				//console.log(line);

				while( line.indexOf("(") != -1 )
					line = line.replace("(", "#");
				while( line.indexOf(")") != -1 )
					line = line.replace(")", "#");
				while( line.indexOf(";") != -1 )
					line = line.replace(";", "#");
				while( line.indexOf(",") != -1 )
					line = line.replace(",", "#");
				tokens = line.split("#");
				//console.log(tokens);
				obj = new Object();

				//console.log(tokens);
				if( c == null ){
					obj["number of crimes"] = parseInt(tokens[6]);
					obj[""+horizontalAxis] = tokens[2];
					obj["c"] = "null";
				}
				else {
					obj["number of crimes"] = parseInt(tokens[10]);
					obj[""+horizontalAxis] = tokens[2];
					obj["c"] = tokens[6];
				}
				dataToVisualize.push(obj);
				// console.log(obj);
			}
		}
		return dataToVisualize;
	},

	parseLine: function(dataQueryResult, c, horizontalAxis, plotTitle){
		dataToVisualize = [];

//		temp = id;
//		id = y;
//		y = id;
		var name = "all";
		if( plotTitle.includes(" by ") ){
			name = plotTitle.split(" by ")[0];
		}

		for(i = 0; i < dataQueryResult.length; i++){ //parsing...
			line = dataQueryResult[i];
			//console.log(line);

			while( line.indexOf("(") != -1 )
				line = line.replace("(", "#");
			while( line.indexOf(")") != -1 )
				line = line.replace(")", "#");
			while( line.indexOf(";") != -1 )
				line = line.replace(";", "#");
			while( line.indexOf(",") != -1 )
				line = line.replace(",", "#");
			tokens = line.split("#");
			//console.log(tokens);
			obj = new Object();

			if( c == null ){
				//console.log(tokens);
				obj["time"] = this.parseDateTime(tokens[2], horizontalAxis);//tokens[2];
				obj["number of crimes"] = parseInt(tokens[6]);
				obj["legend"] = name;
			}
			else {
				//to do
				//console.log(tokens.length);
				//console.log(tokens);
				if( tokens.length <= 14 ){
					obj["time"] = this.parseDateTime(tokens[2], horizontalAxis); // tokens[2];
					obj["number of crimes"] = parseInt(tokens[10]);
					obj["legend"] = tokens[6];
				}
				else // month and year 
				{
					//obj["x"] = " ";
					//if( tokens[2] == "january")
						//obj["x"] = tokens[6];
					obj["time"] = tokens[6]+","+tokens[2];
					obj["number of crimes"] = parseInt(tokens[14]);
					obj["legend"] = tokens[10];
				}
			}


			dataToVisualize.push(obj);
			// console.log(obj);
		}
		return dataToVisualize;
	},


	parseDateTime: function(xValue, horizontalAxis){

	//if(specificationObj["horizontalAxis"] == "day" )
	// 	sort = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
	// if( specificationObj["horizontalAxis"] == "month" )
	// 	sort = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
	// if(specificationObj["horizontalAxis"] == "time" )
	// 	sort = ["midnight", "1-a_m", "2-a_m", "3-a_m", "4-a_m", "5-a_m", "6-a_m", "7-a_m", "8-a_m", "9-a_m", "10-a_m", "11-a_m", "noon", "1-p_m", "2-p_m", "3-p_m", "4-p_m", "5-p_m", "6-p_m", "7-p_m", "8-p_m", "9-p_m", "10-p_m", "11-p_m"];
	// if( specificationObj["horizontalAxis"] == "year" )
	// 	sort = ["2010", "2011", "2012", "2013", "2014", "2015"];
	if( horizontalAxis == "year")
		return xValue;
	if( horizontalAxis == "month" ){
		if(xValue == "january"){
			return "1";
		}
		if(xValue == "february"){
			return "2";
		}
		if(xValue == "march"){
			return "3";
		}
		if(xValue == "april"){
			return "4";
		}
		if(xValue == "may"){
			return "5";
		}
		if(xValue == "june"){
			return "6";
		}
		if(xValue == "july"){
			return "7";
		}
		if(xValue == "august"){
			return "8";
		}
		if(xValue == "september"){
			return "9";
		}
		if(xValue == "october"){
			return "10";
		}
		if(xValue == "november"){
			return "11";
		}
		if(xValue == "december"){
			return "12";
		}
	}

	if( horizontalAxis == "time" ){
		if(xValue == "1-a_m")
			return "December 1, 1995 01:00:00";
		if(xValue == "2-a_m")
			return "December 1, 1995 02:00:00";
		if(xValue == "3-a_m")
			return "December 1, 1995 03:00:00";
		if(xValue == "4-a_m")
			return "December 1, 1995 04:00:00";
		if(xValue == "5-a_m")
			return "December 1, 1995 05:00:00";
		if(xValue == "6-a_m")
			return "December 1, 1995 06:00:00";
		if(xValue == "7-a_m")
			return "December 1, 1995 07:00:00";
		if(xValue == "8-a_m")
			return "December 1, 1995 08:00:00";
		if(xValue == "9-a_m")
			return "December 1, 1995 09:00:00";
		if(xValue == "10-a_m")
			return "December 1, 1995 10:00:00";
		if(xValue == "11-a_m")
			return "December 1, 1995 11:00:00";
		if(xValue ==  "noon")
			return "December 1, 1995 12:00:00";
		if(xValue == "1-p_m")
			return "December 1, 1995 13:00:00";
		if(xValue == "2-p_m")
			return "December 1, 1995 14:00:00";
		if(xValue == "3-p_m")
			return "December 1, 1995 15:00:00";
		if(xValue == "4-p_m")
			return "December 1, 1995 16:00:00";
		if(xValue == "5-p_m")
			return "December 1, 1995 17:00:00";
		if(xValue == "6-p_m")
			return "December 1, 1995 18:00:00";
		if(xValue == "7-p_m")
			return "December 1, 1995 19:00:00";
		if(xValue == "8-p_m")
			return "December 1, 1995 20:00:00";
		if(xValue == "9-p_m")
			return "December 1, 1995 21:00:00";
		if(xValue == "10-p_m")
			return "December 1, 1995 22:00:00";
		if(xValue == "11-p_m")
			return "December 1, 1995 23:00:00";
		if(xValue ==  "midnight")
			return "December 1, 1995 24:00:00";
		
	}
	if( horizontalAxis == "day" ){
		if(xValue == "sunday")
			return "January 27, 2019 12:00:00";
		if(xValue == "monday")
			return "January 28, 2019 12:00:00";
		if(xValue == "tuesday")
			return "January 29, 2019 12:00:00";
		if(xValue == "wednesday")
			return "January 30, 2019 12:00:00";
		if(xValue == "thursday")
			return "January 31, 2019 12:00:00";
		if(xValue == "friday")
			return "February 1, 2019 12:00:00";
		if(xValue == "saturday")
			return "February 2, 2019 12:00:00";
	}



	},

//not using...
	parseMap: function(specificationObj){
		dataToVisualize = [];
		for(i = 0; i < specificationObj["dataQueryResult"].length; i++){
			line = specificationObj["dataQueryResult"][i];
			//console.log(line);

			while( line.indexOf("(") != -1 )
				line = line.replace("(", "#");
			while( line.indexOf(")") != -1 )
				line = line.replace(")", "#");
			while( line.indexOf(";") != -1 )
				line = line.replace(";", "#");
			while( line.indexOf(",") != -1 )
				line = line.replace(",", "#");
			tokens = line.split("#");
			//console.log(tokens);
			obj = new Object();

			//console.log(tokens);
			obj["latitude"] = parseFloat(tokens[2]);
			obj["longitude"] = parseFloat(tokens[6]);
			val = parseFloat(tokens[8]);
			obj["value"] = val;
			if( val > maxVal )
				maxVal = val;
			//to do... maybe?


			dataToVisualize.push(obj);
		}
	},

	// parse the data
	// the specification object is not nicely formatting- parsing is a pain!  =(
	readExample2: function(specificationObj, color){
		//if(specificationObj == null){
			//console.log("children " + this.childList[this.childList.length-1].childId);
			//for(var key in this.childList)
			//{
			//	if(this.childList[key].childId == this.targetAppID)
			//	var closeAppIndex = this.childList.indexOf(this.childList[key]);
			//	this.closeChild(closeAppIndex);
			//	console.log("Close "+this.childList[key].childId);
			//}
			//this.closeChild(this.getNumberOfChildren()-1); //right now we just close the last one, later will use a unique id of the vis
		//}
	   if (specificationObj["request"] == "close.01"){
			console.log("CLOSE");
			console.log(specificationObj["targetId"]);
			hubId = specificationObj["targetId"];
			this.closeChildByHubId(hubId);
			//for(var key in this.childList)
			//{
			//	if(this.childList[key].childId == this.targetAppID)
			//	var closeAppIndex = this.childList.indexOf(this.childList[key]);
			//	this.closeChild(closeAppIndex);
			//	console.log("Close "+this.childList[key].childId);
			//}
		}
		else if( specificationObj.specType == "Layout") //only used for close operations
		 {
		// 	if( specificationObj.request.indexOf("close") != -1 )
		// 	{
		// 		for(var key in this.childList)
		// 		{
		// 			if(this.childList[key].childId == this.targetAppID)
		// 			var closeAppIndex = this.childList.indexOf(this.childList[key]);
		// 			this.closeChild(closeAppIndex);
		// 			console.log("Cloose "+this.childList[key].childId);
		// 		}
		// 		//this.closeChild(this.getNumberOfChildren()-1); //right now we just close the last one, later will use a unique id of the vis
		// 	}
		}
		else // else make a vis!
		{
			console.log("make a vis!");
			plotTitle = specificationObj["plotTitle"];
			console.log(plotTitle);

			type = specificationObj["plotType"].toLowerCase(); //what kind of plot: bar chart, map, line chart
			x = specificationObj["horizontalGroupAxis"];//.toLowerCase();//changed: specificationObj["horizontalGroupAxis"].toLowerCase()
			y = specificationObj["verticalAxis"];//.toLowerCase();
			hub_id = specificationObj["id"];
			id = null;//specificationObj["id"]; //not using right now...
			if( specificationObj["horizontalAxis"] ) // this  just required some additional parsing...
				if( specificationObj["horizontalAxis"] == "NON_UNIT")
					id = null;//specificationObj["id"];
				else
					id = specificationObj["horizontalAxis"].toLowerCase();

			dataToVisualize = [];

			//print for sanity
			console.log('type' + type + "x " + x + " y " + y + " hub_id " + hub_id);

			maxVal = 0;

			//handling individual types
			// horrible parsing... =(
			// baasically- I need to get out the data to be visualized:
			// so the values and labels for a bar chart
			// the values and locations for a heat map
			// the values, dates, and labels for a line chart
			if( type == "map"){
				for(i = 0; i < specificationObj["dataQueryResult"].length; i++){
					line = specificationObj["dataQueryResult"][i];
					console.log(line);

					while( line.indexOf("(") != -1 )
						line = line.replace("(", "#");
					while( line.indexOf(")") != -1 )
						line = line.replace(")", "#");
					while( line.indexOf(";") != -1 )
						line = line.replace(";", "#");
					while( line.indexOf(",") != -1 )
						line = line.replace(",", "#");
					tokens = line.split("#");
					console.log(tokens);
					obj = new Object();

					if( id == null ){
						console.log(tokens);
						obj["latitude"] = parseFloat(tokens[2]);
						obj["longitude"] = parseFloat(tokens[6]);
						val = parseFloat(tokens[8]);
						obj["value"] = val;
						if( val > maxVal )
							maxVal = val;
					}
					else { //FIX SOMETIME
						console.log(tokens);
						obj["latitude"] = parseFloat(tokens[2]);
						obj["longitude"] = parseFloat(tokens[6]);
						val = parseFloat(tokens[8]);
						obj["value"] = val;
						if( val > maxVal )
							maxVal = val;
						//to do... maybe?
					}

					dataToVisualize.push(obj);
				}
				// data parsed!

				// now launch the map in a separate sage2 app
				applicationType ="custom", //its a custom app (as opposed to say video app)
				application = "apps/heat_map"; //I called it 'heat map'
				msg = "this is a message from articulate_ui", //not really used, but an option
				console.log(dataToVisualize); //just for sanity

				initState = {  // these values will load on child app init
					value: 20,
					data: dataToVisualize, //here is where I send the locations and number of crimes at this location, which came from the nlp smart hub
					maxValue: maxVal,
					title: plotTitle,
					hub_id: hub_id
				};
			}
			else if( type == "bar" ){
				for(i = 0; i < specificationObj["dataQueryResult"].length; i++){ //same thing parse the data
					line = specificationObj["dataQueryResult"][i];
					console.log(line);

					while( line.indexOf("(") != -1 )
						line = line.replace("(", "#");
					while( line.indexOf(")") != -1 )
						line = line.replace(")", "#");
					while( line.indexOf(";") != -1 )
						line = line.replace(";", "#");
					while( line.indexOf(",") != -1 )
						line = line.replace(",", "#");
					tokens = line.split("#");
					console.log(tokens);
					obj = new Object();

					if( id == null ){
						console.log(tokens);
						obj["y"] = parseInt(tokens[2]);
						obj["x"] = tokens[6];
						obj["c"] = "null";
					}
					else {
						obj["y"] = parseInt(tokens[2]);
						obj["x"] = tokens[6];
						obj["c"] = "null"; //NULL FOR NOW!!
					}


					dataToVisualize.push(obj);
					// console.log(obj);
				}

				//launch app
				applicationType ="custom",
				application = "apps/vega_vis_app"; 	 //its a vega app
				msg = "this is a message from articulate_ui", //not used so much, but could
				console.log(dataToVisualize);

				initState = {  // the vis app will get these values and use them to draw appropriately
					value: 10,
					hub_id: hub_id,
					title: plotTitle,
					type: type.toLowerCase(),  //what kind of chart: bar or line
					x: x.toLowerCase(), //x axis for the bar chart
					y: y.toLowerCase(), //y axis for the bar chart (usually counts in our case)
					color: color, //what color to give the bars - at this point a single color- someday need multiple colors
					visId: this.counter,  //unique id for the vis, based on the count
					data: dataToVisualize //the data to visualize- like counts and labels
					//title: "visualization response" //should make this better someday...
				};
			}
			else { //line charts are the only remaining at this point
			//(line chart format reminder: total_crime,16);(year,2010);(crimetype,arson)
				temp = id;
				id = y;
				y = id;
				for(i = 0; i < specificationObj["dataQueryResult"].length; i++){ //parsing...
					line = specificationObj["dataQueryResult"][i];
					console.log(line);

					while( line.indexOf("(") != -1 )
						line = line.replace("(", "#");
					while( line.indexOf(")") != -1 )
						line = line.replace(")", "#");
					while( line.indexOf(";") != -1 )
						line = line.replace(";", "#");
					while( line.indexOf(",") != -1 )
						line = line.replace(",", "#");
					tokens = line.split("#");
					console.log(tokens);
					obj = new Object();

					if( id == null ){
						console.log(tokens);
						obj["y"] = parseInt(tokens[2]);
						obj["x"] = tokens[6];
						obj["c"] = "null";
					}
					else {
						//to do
						console.log(tokens);
						obj["y"] = parseInt(tokens[2]);
						obj["x"] = tokens[6];
						obj["c"] = tokens[10];
					}


					dataToVisualize.push(obj);
					// console.log(obj);
				}

				//launch app
				applicationType ="custom",
				application = "apps/vega_vis_app"; // launch the vega app
				msg = "this is a message from articulate_ui",
				console.log(dataToVisualize);

				initState = {  // these values will load on child app init
					value: 10, //not used
					type: type.toLowerCase(), //line chart
					title: plotTitle,
					x: x.toLowerCase(),//x axis (like years)
					y: y.toLowerCase(), //y axis (usually counts)
					id: id, //what are the lines
					hub_id: hub_id,
					color: color, //i can't remember where the colors for the lines get set- maybe in the vega vis app... but someday need to be able to pass array of colors associated with lines
					visId: this.counter, //unique id for the vis
					data: dataToVisualize //data to draw
				//	title: "visualization response"
				};
			}// this is the end of the line chart

			// launch the app we created!

			console.log("LAUNCH!");
			if( isMaster || !this.useMaster ){

					this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
			}
			//console.log(hub_id);
			//console.log(this.childList[this.getNumberOfChildren()-1]);
			//this.childList[this.getNumberOfChildren()-1].hub_id_YO = hub_id;
			//console.log(this.childList[this.getNumberOfChildren()-1]);


			//this.closeChild(this.getNumberOfChildren()-1);
			//console.log("after " + this.childList.length);
		}

	},

	closeChildByHubId: function(hubId){
		for(var key in this.childList)
		{
			if(this.childList[key]["initState"]["initState"]["hub_id"] == hubId){
				var closeAppIndex = this.childList.indexOf(this.childList[key]);
				//this.closeChild(closeAppIndex);
				this.closeChildById(this.childList[key].childId);
				console.log("Close "+this.childList[key].childId);
				return;
			}
		}
	},

	moveChildByHubId: function(hubId){
		for(var key in this.childList)
		{
			if(this.childList[key]["initState"]["initState"]["hub_id"] == hubId){
				var moveAppIndex = this.childList.indexOf(this.childList[key]);
				//this.closeChild(closeAppIndex);
				newX = this.childList[key].x+400;
				newY = this.childList[key].y+400;

				this.moveChildById(this.childList[key].childId, newX, newY);
				console.log("Move "+this.childList[key].childId);
				return;
			}
		}
	},

	minimizeChildByHubId: function(hubId){
		for(var key in this.childList)
		{
			if(this.childList[key]["initState"]["initState"]["hub_id"] == hubId){
				var moveAppIndex = this.childList.indexOf(this.childList[key]);
				//this.closeChild(closeAppIndex);
				newW = this.childList[key].w;
				newH = this.childList[key].h;
				newX = 5440 - newW;//this.childList[key].x+200;
				newY = this.childList[key].y;
				this.moveAndResizeChildById(this.childList[key].childId, newX, newY, newW, newH, true);
				console.log("Move and Resize "+this.childList[key].childId);
				return;
			}
		}
	},


	maximizeChildByHubId: function(hubId){
		for(var key in this.childList)
		{
			if(this.childList[key]["initState"]["initState"]["hub_id"] == hubId){
				var moveAppIndex = this.childList.indexOf(this.childList[key]);
				//this.closeChild(closeAppIndex);
				newW = this.childList[key].w*1.5;
				newH = this.childList[key].h*1.5;
				newX = 5440/2.0 - newW;//this.childList[key].x+200;
				newY = (3000 - newH)/2;

				console.log(newW);
				console.log(newH);
				this.moveAndResizeChildById(this.childList[key].childId, newX, newY, newW, newH, true);
				console.log("Move and Resize "+this.childList[key].childId);
				return;
			}
		}
	},



	childMonitorEvent: function(childId, type, data, date){
		console.log("child monitoring event in chat")
		if( type == "childMoveEvent"){
			console.log(data);
			console.log("child move");
		}
		if( type == "childResizeEvent")
			console.log("child resize");
		if( type == "childMoveAndResizeEvent")
			console.log("child move and resize");
		if( type == "childCloseEvent" )
			console.log("child close");

			//IS CHILD OFF LIST?   
			//NEED TO TELL ARTICULATE HUB?

		if( type == "childOpenEvent") {
			//center and resize the current child
			//if( this.getNumberOfChildren() > 1){
			//	this.resizeChild(this.getNumberOfChildren()-2, 400, 300, false);
			//	this.moveChild(this.getNumberOfChildren()-2, 50, 2000) //move aside
			//}
			//this.moveChild(this.getNumberOfChildren()-1, 2000, 750); //center
			//this.resizeChild(this.getNumberOfChildren()-1, 1600, 1200, false);
			this.childList[ this.childList.length-1].hub_id = data.initState.hub_id;
			console.log("child open");
			console.log(this.childList);
			//this.childList[this.childList.length][""]
			//
			//this.chatData.push({"who": "chat nobody", "message": "done!"});
			//this.chatData.push({"who": "chat self", "message": "done!"});
			// 			this.chatData.push({"who": "chat nobody", "message": "done!"});
			// // this.chatData.push({"who": "chat self", "message": "done!"});
			// 			this.chatData.push({"who": "chat nobody", "message": "done!"});
			// this.chatData.push({"who": "chat self", "message": "done!"});
			this.chatData[ this.chatData.length-1]['message'] = "done!";
			console.log(this.chatData);
			this.updateMessage();

			this.waitingForResponse = false;
			this.refresh();
		}
		if( type == "childReopenEvent"){
			console.log("child reopen");
		}
		this.refresh(date);
		resetIdle();
	},

	// childMonitorEvent: function(childId, type, data, date){
	// 	// if( type == "childMoveEvent")
	// 	// 	this.monitoringText = "child: " + childId + " " + type + " x: " + data.x + "y: " + data.y;
	// 	// if( type == "childResizeEvent")
	// 	// 	this.monitoringText = "child: " + childId + " " + type + " w: " + data.w + "h: " + data.h;
	// 	// if( type == "childMoveAndResizeEvent")
	// 	// 	this.monitoringText = "child: " + childId + " " + type +  " x: " + data.x + "y: " + data.y + " w: " + data.w + "h: " + data.h;
	// 	// if( type == "childCloseEvent" )
	// 	// 	this.monitoringText = "child: " + childId + " closed";
	// 	if( type == "childOpenEvent") {
	// 		//this.monitoringText = "child: " + childId + " opened";
	// 	}
	// 	// if( type == "childReopenEvent"){
	// 	// 	this.monitoringText = "child: " + childId + " reopened ";
	// 	// }
	// 	this.refresh(date);
	// }


//OLD stuff


	// handleResponse: function(specificationObj){
	// 	// console.log(data.response);

	// 	applicationType ="custom",
	// 	application = "apps/d3plus_visapp",
	// 	msg = "this is a message from articulate_ui",


	// 	//type = specificationObj.plotType.string.toLowerCase();
	// 	type = specificationObj["plot-type"].string.toLowerCase();
	// 	x = specificationObj["x-axis"].string.toLowerCase();
	// 	y = specificationObj["y-axis"].string.toLowerCase();

	// 	// x = specificationObj.xAxis.string.toLowerCase();
	// 	// y = specificationObj.yAxis.string.toLowerCase();
	// 	if( specificationObj.id )
	// 		id = specificationObj.id.string.toLowerCase();
	// 	else
	// 		id = null;
	// 	data = [];

	// 	//console.log('type' + type + "x " + x + " y " + y);
	// 	for(i = 0; i < specificationObj["data-query-result"].length; i++){
	// 			line = specificationObj["data-query-result"][i].string;
	// 			console.log(line);
	// 			line = line.replace("(", "#");
	// 			line = line.replace(";", "#");
	// 			line = line.replace(")", "#");
	// 			line = line.replace(",", "#");
	// 			line = line.replace("(", "#");
	// 			line = line.replace(";", "#");
	// 			line = line.replace(")", "#");
	// 			line = line.replace(",", "#");
	// 			//console.log(line);
	// 			tokens = line.split("#");
	// 			//console.log(tokens);
	// 			obj = new Object();
	// 			//obj = {"year": 2010+i, "total_crime": 300, "id": 2010+i};
	// 			obj[tokens[1]] = parseInt(tokens[2]);
	// 			obj[tokens[5]] = parseInt(tokens[6]);
	// 			obj["id"] = parseInt(tokens[6]);//hack for now
	// 			//obj["total_crime"] = 300;
	// 			data.push(obj);
	// 			console.log("HERE IS OBJECT " + i + " PASSED TO D3PLUS")
	// 			console.log(obj);
	// 	}
	// 	console.log("HERE IS DATA PASSED TO D3PLUS")
	// 	console.log(data);

	// 	initState = {  // these values will load on child app init
	// 		value: 10,
	// 		type: type.toLowerCase(),
	// 		x: x.toLowerCase(),
	// 		y: y.toLowerCase(),
	// 		id: "id",
	// 		data: data
	// 	};


	// 	this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
	// },

	// //here is where the parent launches the child app
	// //we will have to add appropriate data variables
	// launchVis: function(){
	// 	applicationType ="custom",
	// 	application = "apps/d3plus_visapp",
	// 	msg = "this is a message from articulate_ui",
	// 	initState = {  // these values will load on child app init
	// 			value: 10,
	// 			type: "bar",
	// 			x: "year",
	// 			y: "value",
	// 			id: "name",
	// 			data:
	// 			[
	// 			    {"year": 2010, "name":"TEST", "value": 15},
	// 			    {"year": 2010, "name":"Loop", "value": 10},
	// 			    {"year": 2010, "name":"River-North", "value": 5},
	// 			    {"year": 2010, "name":"Near-West", "value": 50},
	// 			  	{"year": 2011, "name":"TEST", "value": 22},
	// 			    {"year": 2011, "name":"Loop", "value": 13},
	// 			    {"year": 2011, "name":"River-North", "value": 16},
	// 			    {"year": 2011, "name":"Near-West", "value": 55},
	// 			  	{"year": 2012, "name":"TEST", "value": 43},
	// 			    {"year": 2012, "name":"Loop", "value": 3},
	// 			    {"year": 2012, "name":"River-North", "value": 34},
	// 			    {"year": 2012, "name":"Near-West", "value": 23},
	// 			  	{"year": 2013, "name":"TEST", "value": 27},
	// 			    {"year": 2013, "name":"Loop", "value": 14},
	// 			    {"year": 2013, "name":"River-North", "value": 10},
	// 			    {"year": 2013, "name":"Near-West", "value": 2},
	// 			    {"year": 2014, "name":"TEST", "value": 47},
	// 			    {"year": 2014, "name":"Loop", "value": 4},
	// 			    {"year": 2014, "name":"River-North", "value": 18},
	// 			    {"year": 2014, "name":"Near-West", "value": 22}
	// 		    ]
	// 		};

	// 	this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
	// },


	// launchVis2: function(){
	// 	applicationType ="custom",
	// 	application = "apps/vega_vis_app",
	// 	msg = "this is a message from articulate_ui",
	// 	// initState = {  // these values will load on child app init
	// 	// 		value: 10,
	// 	// 		// specFile: "uploads/apps/vega_vis_app/data/spec.json"

	// 	// 	};

	// 	initState = {  // these values will load on child app init
	// 		value: 10,
	// 		type: "bar",
	// 		x: "year",
	// 		y: "total_crime",
	// 		data:
	// 		[
	// 		    {"x": "2010", "y": 15},
	// 		    {"x": "2011", "y": 10},
	// 		    {"x": "2012", "y": 5},
	// 		    {"x": "2013", "y": 50}
	// 	    ],
	// 	    color: "steelblue"
	// 	};

	// 	this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
	// },



	// readExample: function(specificationObj, color){

	// 	applicationType ="custom",
	// 	application = "apps/vega_vis_app";//"apps/d3plus_visapp",
	// 	msg = "this is a message from articulate_ui",

	// 	type = specificationObj["plot-type"].string.toLowerCase();
	// 	x = specificationObj["x-axis"].string.toLowerCase();
	// 	y = specificationObj["y-axis"].string.toLowerCase();
	// 	if( specificationObj["id"] )
	// 		id = specificationObj["id"].string.toLowerCase();
	// 	else
	// 		id = null;
	// 	data = [];

	// 	console.log('type' + type + "x " + x + " y " + y);
	// 	for(i = 0; i < specificationObj["data-query-result"].length; i++){
	// 			line = specificationObj["data-query-result"][i].string;
	// 			console.log(line);
	// 			line = line.replace("(", "#");
	// 			line = line.replace(";", "#");
	// 			line = line.replace(")", "#");
	// 			line = line.replace(",", "#");
	// 			line = line.replace("(", "#");
	// 			line = line.replace(";", "#");
	// 			line = line.replace(")", "#");
	// 			line = line.replace(",", "#");
	// 			console.log(line);
	// 			tokens = line.split("#");
	// 			console.log(tokens);
	// 			obj = new Object();
	// 			//d3 plus:
	// 			//obj[tokens[1]] = parseInt(tokens[2]);
	// 			//obj[tokens[5]] = tokens[6];
	// 			//obj["id"] = tokens[6];

	// 			//vega:
	// 			obj["x"] = tokens[6];
	// 			obj["y"] = parseInt(tokens[2]);

	// 			data.push(obj);
	// 			console.log(obj);
	// 	}

	// 	console.log(data);

	// 	initState = {  // these values will load on child app init
	// 		value: 10,
	// 		type: type.toLowerCase(),
	// 		x: x.toLowerCase(),
	// 		y: y.toLowerCase(),
	// 		color: color,
	// 		visId: this.counter,
	// 		data: data
	// 	};

	// 	this.launchNewChild(applicationType, application, initState, msg);//defined in sage2 app
	// }

});
