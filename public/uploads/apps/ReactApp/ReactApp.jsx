// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014


console.log("Loading ReactApp.jsx");

SAGE2_ReactAppLoader.fileLoaded("ReactApp");

import List from './components/List';

class ReactApp extends SAGE2_ReactApp {
	constructor(props) {
		super(props);
	}

	render() {
		return (
			<div style={{width: "100%", height: "100%"}}>
				<List />
			</div>
		)
	}
}