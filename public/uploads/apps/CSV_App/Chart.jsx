import React, { useState, useMemo, useRef, useEffect } from "react";

const MARGIN = {
	left: 30,
	right: 15,
	top: 15,
	bottom: 30
};

export default function(props) {
	let { data, xAttr, yAttr, type, appWidth, appHeight } = props;

	let [width, setWidth] = useState(600);
	let [height, setHeight] = useState(600);

	console.log(appWidth, appHeight);

	let svgRef = useRef();
	let xAxisRef = useRef();
	let yAxisRef = useRef();

	useEffect(() => {
		setWidth(svgRef.current.clientWidth);
		setHeight(svgRef.current.clientHeight);
	}, [appWidth, appHeight]);

	let xScale = useMemo(() => {
		return d3
			.scaleLinear()
			.domain(d3.extent(data, d => +d[xAttr]))
			.range([MARGIN.left, width - MARGIN.left - MARGIN.right]);
	}, [data, xAttr, width]);

	let yScale = useMemo(() => {
		return d3
			.scaleLinear()
			.domain(d3.extent(data, d => +d[yAttr]))
			.range([height - MARGIN.bottom, MARGIN.top]);
	}, [data, yAttr, height]);

	let xAxis = useMemo(() => {
		return d3.axisBottom(xScale);
	}, [xScale]);

	let yAxis = useMemo(() => {
		return d3.axisLeft(yScale);
	}, [yScale]);

	useEffect(() => {
		d3.select(xAxisRef.current).call(xAxis);
	}, [xAxis]);

	useEffect(() => {
		d3.select(yAxisRef.current).call(yAxis);
	}, [yAxis]);

	return (
		<svg
			ref={svgRef}
			{...{ width, height }}
			style={{ width: "100%", height: "100%" }}
		>
			<g className="points">
				{data.map(d => {
					return (
						<circle
							key={d[""]}
							cx={xScale(d[xAttr])}
							cy={yScale(d[yAttr])}
							r={3}
							style={{ fillOpacity: 0.25, stroke: "black" }}
						></circle>
					);
				})}
			</g>
			<g ref={xAxisRef} transform={`translate(0, ${height - MARGIN.bottom})`} />
			<text textAnchor="middle" x={width / 2} y={height} fontSize={12}>
				{xAttr}
			</text>

			<g ref={yAxisRef} transform={`translate(${MARGIN.left}, 0)`} />
			<text
				textAnchor="middle"
				style={{
					transform: `translate(12px, ${height / 2}px) rotate(-90deg)`
				}}
				fontSize={12}
			>
				{yAttr}
			</text>
		</svg>
	);
}
