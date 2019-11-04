var fractionLookup = {
	'1': '1 1/5',
	'2': '2 2/5',
	'3': '3 3/5',
	'4': '4 4/5',
	'5': '6',
	'6': '7 1/5',
	'7': '8 2/5',
	'8': '9 3/5',
	'9': '10 4/5' 
};



var getUniqueId2D = function(prefix, param) {
	// reset the counter
	if (param && param === -1) {
		getUniqueId2D.count = 0;
		return;
	}
	var id = prefix + '2D' + getUniqueId2D.count.toString();
	getUniqueId2D.count++;
	return id;
};
getUniqueId2D.count = 0;


var Planner2D_distance = function(x1, y1, x2, y2) {
	return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
};

var Planner2D_wallLengthFormatted = function(wallEl) {
	var len = Planner2D_distance(wallEl.points[0].x, wallEl.points[0].y, wallEl.points[1].x, wallEl.points[1].y);
	var temp = len.toFixed(1).split('.');
	var dist = temp[0] ;
	dist += (temp[1] === '0') ? ' \' ' : ' \' '  + fractionLookup[temp[1]] + ' \"';
	return dist;
};

var Planner2D_angleBetween = function(x1, y1, x2, y2) {
	var dot = x1 * x2 + y1 * y2;
	var magu = Math.sqrt(x1 * x1 + y1 * y1);
	var magv = Math.sqrt(x2 * x2 + y2 * y2);
	return Math.acos(dot / (magu * magv)) * 180 / Math.PI;
};

var Planner2D_isPointOnLine = function(line, P) {
	var startPointToP = Planner2D_distance(line[0], line[1], P.x, P.y);
	var endPointToP = Planner2D_distance(line[2], line[3], P.x, P.y);
	var lineLength = Planner2D_distance(...line);
	if (Math.abs(lineLength - startPointToP - endPointToP) < 1) {
		return true;
	}
	return false;
};


var Planner2D_closerPoint = function(line, P) {
	var startPointToP = Planner2D_distance(line[0], line[1], P.x, P.y);
	var endPointToP = Planner2D_distance(line[2], line[3], P.x, P.y);
	console.log(line, P, startPointToP, endPointToP);
	if (startPointToP < endPointToP) {
		return 0;
	}
	return 1;
};

function Planner2D_improperFractionToMixedNumber(n, d) {
    i = parseInt(n / d);
    n -= i * d;
    return [i, reduce(n,d)];   
}


function Planner2D_reduce(numerator,denominator){
    if (isNaN(numerator) || isNaN(denominator))
      return NaN;
    var gcd = function gcd(a, b){ return b ? gcd(b, a%b) : a; };
    gcd = gcd(numerator, denominator);
    return [numerator/gcd, denominator/gcd];
}


var Planner2D_makeDoorShape = function (paper, options) {
	var doorGrp = paper.g();
	doorGrp.attr("id", options.id);
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	r1.attr({
		fill: 'rgba(220, 220, 220, 1.0)'
		//stroke: options.stroke
	});
	var r2 = paper.rect(x + height, y + height / 3, width - 2 * height, height / 3);
	r2.attr("stroke", options.stroke);
	var r3 = paper.rect(x + width - height, y, height, height);
	r3.attr("stroke", options.stroke);
	var r4 = paper.rect(x, y, height, height);
	r4.attr("stroke", options.stroke);
	var r5 = paper.rect(x + height, y + 8 / 3 * height - width, height / 3, width - 2 * height);
	r5.attr("fill", options.fill);
	var arcPathStr = "M " + (x + height) + " " + (y - width + 8 * height / 3) +
		"A " + (width - 2 * height) + " " + (width - 2 * height) + " 0 0 1 " + 
		(width / 2 - height) + " " + (y + height / 3);
	var p6 = paper.path( arcPathStr);
	p6.attr({
		stroke:	options.stroke,
		fill: "none"
	});
	doorGrp.add(r1, p6, r5, r4, r3, r2);
	return doorGrp;

};

var Planner2D_makeWindowShape = function(paper, options) {
	var windowGrp = paper.g();
	windowGrp.attr("id", options.id);
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	r1.attr({
		fill: 'rgba(220, 220, 220, 1.0)',
		stroke: options.stroke
	});
	var r2 = paper.rect(x, y, height, height);
	r2.attr("stroke", options.stroke);
	var r3 = paper.rect(x + width - height, y, height, height);
	r3.attr("stroke", options.stroke);
	//var r4 = paper.rect(x + height, y, width - 2 * height, height);
	//r4.attr("stroke", options.stroke);
	var r4 = paper.rect(x + height, y + height / 3, width - 2 * height, height / 3);
	r4.attr("stroke", options.stroke);
	windowGrp.add(r1, r2, r3, r4);
	return windowGrp;

};

var Planner2D_makeCameraShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	
	var pathStr = "M " + x + " " + y + " L "
		+ (x + width * 0.25) + " " + (y + height)
		+ " L " + (x + width * 0.75) + " " + (y + height)
		+ " L " + (x + width) + " " + y;
	var cameraShape = paper.path(pathStr);
	cameraShape.attr({
		id: options.id,
		stroke: options.stroke
	});
	return cameraShape;
};

var Planner2D_makeAvatarShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	
	var avatarShape = paper.rect(x, y, width, height);
	avatarShape.attr({
		stroke: options.stroke || 1,
		fill: 'rgba(220, 220, 220, 1.0)'
	});
	return avatarShape;
};

var ClientShape = {
	'3D': Planner2D_makeCameraShape,
	'VR': Planner2D_makeAvatarShape
};


function Planner2D_pointOnParametricLine(line, startIdx, endIdx, alpha, scale) {
	scale = scale || 1;
	return {
		x: line[endIdx].x * scale * alpha + (1 - alpha) * line[startIdx].x * scale,
		y: line[endIdx].y * scale * alpha + (1 - alpha) * line[startIdx].y * scale
	}
}

var Furnitures = {};

var Planner2D_makeCouchShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
		
	
	var r1 = paper.rect(-0.47 * width, -0.49 * height, 0.33 * width, 0.99 * height);
	var r2 = paper.rect(-0.16 * width, -0.49 * height, 0.32 * width, 0.99 * height);
	var r3 = paper.rect(0.16 * width, -0.49 * height, 0.33 * width, 0.99 * height);
	var r4 = paper.rect(-0.5 * width, -0.50 * height, width, 0.12 * height);
	var r5 = paper.rect(-0.5 * width, -0.45 * height, 0.08 * width, 0.94 * height);
	var r6 = paper.rect(0.42 * width, -0.45 * height, 0.08 * width, 0.94 * height);

	var couchGrp = paper.g();
	couchGrp.add(r1, r2, r3, r4, r5, r6);
	couchGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return couchGrp;
};

Furnitures['CO'] = Planner2D_makeCouchShape;

var Planner2D_makePartitionShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var wby4 = width * 0.25;
	var r1 = paper.rect(x, y, wby4, height);
	var r2 = paper.rect(x + wby4, y, wby4, height);
	var r3 = paper.rect(x + 2 * wby4, y, wby4, height);
	var r4 = paper.rect(x + 3 * wby4, y, wby4, height);
	var partitionGrp = paper.g();
	partitionGrp.add(r1, r2, r3, r4);
	partitionGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return partitionGrp;
};

Furnitures['PT'] = Planner2D_makePartitionShape;

var Planner2D_makeChairShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height * 0.1);
	var r2 = paper.rect(x, y  + height * 0.1, width, height * 0.9);

	var chairGrp = paper.g();
	chairGrp.add(r1, r2);
	chairGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return chairGrp;
};

Furnitures['CR'] = Planner2D_makeChairShape;


var Planner2D_makeOfficeChairShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x + width * 0.1, y, width * 0.8, height * 0.1);
	var r2 = paper.rect(x + width * 0.1, y + height * 0.1, width * 0.8, height * 0.9);
	var r3 = paper.rect(x, y + height * 0.3, width * 0.2, height * 0.7);
	var r4 = paper.rect(x + width * 0.8, y + height * 0.3, width * 0.2, height * 0.7);

	var officeChairGrp = paper.g();
	officeChairGrp.add(r1, r2, r3, r4);
	officeChairGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return officeChairGrp;

};

Furnitures['OC'] = Planner2D_makeOfficeChairShape;

var Planner2D_makeSchoolChairShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x + width * 0.1, y, width * 0.9, height * 0.1);
	var r2 = paper.rect(x + width * 0.1, y + height * 0.1, width * 0.9, height * 0.8);
	var r3 = paper.rect(x, y + height * 0.55, width * 0.8, height * 0.45);
	
	var schoolChairGrp = paper.g();
	schoolChairGrp.add(r1, r2, r3);
	schoolChairGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return schoolChairGrp;
};

Furnitures['SC'] = Planner2D_makeSchoolChairShape;

var Planner2D_makeStoolShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r = width / 2;
	var sr = width / 8;
	var c1 = paper.circle(x + sr, y + sr, sr);
	var c2 = paper.circle(x + sr, r - sr, sr);
	var c3 = paper.circle(r - sr, y + sr, sr);
	var c4 = paper.circle(r - sr, r - sr, sr);
	var c5 = paper.circle(0, 0, r);
	var stoolGrp = paper.g();
	stoolGrp.add(c1, c2, c3, c4, c5);
	stoolGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return stoolGrp;
};

Furnitures['ST'] = Planner2D_makeStoolShape;

var Planner2D_makeDeskShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var deskGrp = paper.g();
	deskGrp.add(r1);
	deskGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return deskGrp;
};

Furnitures['DK'] = Planner2D_makeDeskShape;

var Planner2D_makeTableShape =  function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var tableGrp = paper.g();
	tableGrp.add(r1);
	tableGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return tableGrp;
};

Furnitures['TB'] = Planner2D_makeTableShape;

var Planner2D_makeCoffeeTableShape = function(paper, options) {
	var c1 = paper.circle(0, 0, options.width / 2);
	var coffeeTableGrp = paper.g();
	coffeeTableGrp.add(c1);
	coffeeTableGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return coffeeTableGrp;
};

Furnitures['CT'] = Planner2D_makeCoffeeTableShape;

var Planner2D_makeCabinetShape =  function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var cabinetGrp = paper.g();
	cabinetGrp.add(r1);
	cabinetGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return cabinetGrp;
};

Furnitures['CB'] = Planner2D_makeCabinetShape;

var Planner2D_makeDrawerShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var drawerGrp = paper.g();
	drawerGrp.add(r1);
	drawerGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return drawerGrp;
};


Furnitures['DA'] = Planner2D_makeDrawerShape;

var Planner2D_makeVendingMachineShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var vendingMachineGrp = paper.g();
	vendingMachineGrp.add(r1);
	vendingMachineGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return vendingMachineGrp;
};

Furnitures['VM'] = Planner2D_makeVendingMachineShape;


var Planner2D_makeFountainShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
	var r1 = paper.rect(x, y, width, height);
	var r2 = paper.rect(x + width * 0.1, y + height * 0.1, width * 0.1, height * 0.1);
	var c1 = paper.circle(0, 0, width / 3);
	var c2 = paper.circle(0, 0, width / 8);
	var fountainGrp = paper.g();
	fountainGrp.add(r1, r2, c1, c2);
	fountainGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	return fountainGrp;
};

Furnitures['FT'] = Planner2D_makeFountainShape;

var Planner2D_makeRecycleBinShape = function(paper, options) {
	var height = options.width / 3;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
		
	var h2 = height / 2;
	var r = height / 3;
	var r1 = paper.rect(x, y, height, height);
	var c1 = paper.circle(x + h2, y + h2, r);
	var r2 = paper.rect(x + height, y, height, height);
	var c2 = paper.circle(x + 3 * h2, y + h2, r);
	var r3 = paper.rect(x + 2 * height, y, height, height);
	var c3 = paper.circle(x + 5 * h2, y + h2, r);
	var recycleBinGrp = paper.g();
	recycleBinGrp.add(r1, c1, r2, c2, r3, c3);
	recycleBinGrp.attr({
		id: options.id,
		stroke: options.stroke,
		strokeWidth: options.strokeWidth || 2,
		fill: options.fill
	});
	return recycleBinGrp;
};

Furnitures['RB'] = Planner2D_makeRecycleBinShape;

var Planner2D_makeFlagShape = function(paper, options) {
	var height = options.height;
	var width = options.width;
	var x = width / -2;
	var y = height / -2;
		
	//var t1 = paper.polygon(x, y + height, x + width / 2, y, x + width, y + height);
	var c1 = paper.circle(x + height / 2, y + height / 2, height / 8);
	var c2 = paper.circle(x + height / 2, y + height / 2, height / 3);
	var c3 = paper.circle(x + height / 2, y + height / 2, height / 2);
	var flagGrp = paper.g();
	flagGrp.add(c3, c2, c1);
	flagGrp.attr({
		id: options.id,
		stroke: options.stroke,
		fill: options.fill
	});
	function light() {
		c1.animate({fill: "red"}, 500, mina.easeinout);
		c2.animate({fill: options.fill}, 500, mina.easeinout);
		c3.animate({fill: "red"}, 1000, mina.easeinout, dark);
	}
	function dark() {
		c1.animate({fill: options.fill}, 300, mina.easeinout);
		c2.animate({fill: "red"}, 300, mina.easeinout);
		c3.animate({fill: options.fill}, 300, mina.easeinout, light);
	}
	light();
	return flagGrp;
};

Furnitures['FG'] = Planner2D_makeFlagShape;

function Planner2D_getAssetList() {
	return [{
			"name": "select",
			"id": "S",
			"iconUrl": "images/select.svg"
		},{
			"name": "wall",
			"id": "WL",
			"iconUrl": "images/wall.svg"
		}, {
			"name": "door",
			"id": "DR",
			"iconUrl": "images/single-door.svg"
		}, {
			"name": "window",
			"id": "WD",
			"iconUrl": "images/window.svg"
		}, {
			"name": "partition",
			"id": "PT",
			"iconUrl": "images/partition.svg"
		}, {
			"name": "couch",
			"id": "CO",
			"iconUrl": "images/couch.svg"
		}, {
			"name": "chair",
			"id": "CR",
			"iconUrl": "images/chair.svg"
		}, {
			"name": "officeChair",
			"id": "OC",
			"iconUrl": "images/officeChair.svg"
		}, {
			"name": "schoolChair",
			"id": "SC",
			"iconUrl": "images/schoolChair.svg"
		}, {
			"name": "stool",
			"id": "ST",
			"iconUrl": "images/stool.svg"
		}, {
			"name": "desk",
			"id": "DK",
			"iconUrl": "images/desk.svg"
		}, {
			"name": "table",
			"id": "TB",
			"iconUrl": "images/table.svg"
		}, {
			"name": "coffeeTable",
			"id": "CT",
			"iconUrl": "images/coffeeTable.svg"
		}, {
			"name": "cabinet",
			"id": "CB",
			"iconUrl": "images/cabinet.svg"
		}, {
			"name": "drawer",
			"id": "DA",
			"iconUrl": "images/drawer.svg"
		}, {
			"name": "fountain",
			"id": "FT",
			"iconUrl": "images/fountain.svg"
		},  {
			"name": "recycleBin",
			"id": "RB",
			"iconUrl": "images/recycleBin.svg"
		},  {
			"name": "vendingMachine",
			"id": "VM",
			"iconUrl": "images/vendingMachine.svg"
		}, {
			"name": "flag",
			"id": "FG",
			"iconUrl": "images/flag.svg"
		}
	];
}

var Planner2D_itemTypeName = {
	WL: 'Wall',
	DR: 'Door',
	WD: 'Window',
	PT: 'Partition',
	CO: 'Couch',
	CR: 'Chair',
	OC: 'Office Chair',
	SC: 'Desk Chair',
	ST: 'Stool',
	DK: 'Desk',
	TB: 'Table',
	CT: 'Coffee Table',
	CB: 'Cabinet',
	DA: 'Drawer',
	FT: 'Fountain',
	RB: 'Recycle Bin',
	VM: 'Vending Machine',
	FG: 'Flag'
}

var Planner2D_getItemTypeName = function(id) {
	return Planner2D_itemTypeName[id.slice(0, 2)];
}

function Planner2D_transformElement(element, angle, x, y) {
	/*angle = angle || 0;
	x = x || 0;
	y = y || 0;*/
	var transform = element.transform().string;
	var re = /[r,]/;
	
	var transParts = transform.split("t");
	//console.log(transParts);
	if (transParts.length > 1) {
		if (angle === undefined) {
			angle = transParts[0].split(re)[1];
		}
		
		temp = transParts[1].split(re);
		x = x || temp[0];
		y = y || temp[1];
		//console.log(transParts, temp);
	} else {
		angle = angle || 0;
		x = x || 0;
		y = y || 0;
	}
	element.transform("rotate(" + angle + " " + x + " " + y + ") translate(" + x + " " + y + ")"  );
	element.attr("angle", angle);
};
