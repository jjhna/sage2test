function Geometry () {

}

Geometry.prototype.init = function(options) {
	this.points = {};
	//How close must two x,y pairs be to be considered the same point:
	this.pointSensitivity = options.pointSensitivity || 1;
};

Geometry.prototype.findPoint = function(xy) {
	var t;
	for (var p in this.points) {
		if (this.points.hasOwnProperty(p) === true) {
			t = this.points[p];
			if (Math.abs(t.x - xy.x) < this.pointSensitivity && Math.abs(t.y - xy.y) < this.pointSensitivity) {
				return p;
			}
		}
	}
	return false;
};

Geometry.prototype.getPointValue = function(label) {
	if (this.points.hasOwnProperty(label) === true) {
		return this.points[label];
	}
};

Geometry.prototype.getXYListForPoints = function(points, scale) {
	scale = scale || 1;
	var list = [];
	for(var p = 0; p < points.length; p++) {
		var v = points[p];
		list.push(v.x * scale);
		list.push(v.y * scale);
	}
	return list;
};

Geometry.prototype.getPathForLinePoints = function(p1, p2, thickness, scale) {
	var d = "M";
	if (scale) {
		p1 = {x: p1.x * scale, y: p1.y * scale};
		p2 = {x: p2.x * scale, y: p2.y * scale};
	}
	var dx = p2.x - p1.x;
	var dy = p2.y - p1.y;
	var dist = Math.sqrt(dx * dx + dy * dy);
	var lineDir = Math.atan2(dy, dx);
	var alphaX = (1 + Math.abs(thickness * Math.cos(lineDir) / (2 * dist)));
	var alphaY = (1 + Math.abs(thickness * Math.sin(lineDir) / (2 * dist)));
	
	console.log(alphaX, alphaY, lineDir * 180 / Math.PI, dist);
	var p3 = {
		x: p1.x * alphaX + (1 - alphaX) * p2.x,
		y: p1.y * alphaY + (1 - alphaY) * p2.y
	};
	var p4 = {
		x: p2.x * alphaX + (1 - alphaX) * p1.x,
		y: p2.y * alphaY + (1 - alphaY) * p1.y
	}
	var normalDir = Math.atan2(-dx, dy);
	var p5 = {
		x: p3.x + thickness * Math.cos(normalDir) / 2,
		y: p3.y + thickness * Math.sin(normalDir) / 2
	};
	var p6 = {
		x: p3.x + thickness * Math.cos(normalDir + Math.PI) / 2,
		y: p3.y + thickness * Math.sin(normalDir + Math.PI) / 2
	};
	var p7 = {
		x: p4.x + thickness * Math.cos(normalDir + Math.PI) / 2,
		y: p4.y + thickness * Math.sin(normalDir + Math.PI) / 2
	};

	var p8 = {
		x: p4.x + thickness * Math.cos(normalDir) / 2,
		y: p4.y + thickness * Math.sin(normalDir) / 2
	};
	
	return "M " + p5.x + " " + p5.y + " L " + p6.x + " " + p6.y +
		" L " + p7.x + " " + p7.y + " L " + p8.x + " " + p8.y + " Z";
	//return [p3.x, p3.y, p4.x, p4.y];
};
Geometry.prototype.createPoint = function(xy) {
	var id = getUniqueId('PT');
	this.points[id] = {
		id: id,
		x: xy.x,
		y: xy.y 
	};
	return id;
};

Geometry.prototype.isPointOnWall = function(wallObj, wallThickness, x, y) {
	var point = Snap.closestPoint(wallObj, x, y);
	console.log(point);
	var dist = Snap.len(point.x, point.y, x, y);
	if (dist < 2 * wallThickness) {
		return true;
	}
	return false;
};

Geometry.prototype.getFurthestPair = function(pointsA, pointsB) {
	var maxDistance = 0;
	var furthestPair = null;
	pointsA.forEach(a => {
		pointsB.forEach(b => {
			var d = distance(a.x, a.y, b.x, b.y);
			if (maxDistance < d) {
				furthestPair = [a, b];
				maxDistance = d;
			}
		});
	});
	return furthestPair;
};