import React, { useState, useEffect } from "react";
import Chart from "./Chart.jsx";

const CHART_TYPES = [
	"Scatter Plot"
	// "Contour Plot"
];

function Component(props) {
	let { width: appWidth, height: appHeight } = props;

	let data = props.resource.read();

	console.log(data);
	let [xAttr, setXAttr] = props.useStateSAGE2("X-attr");
	let [yAttr, setYAttr] = props.useStateSAGE2("Y-attr");

	let x = 6;
	let y = 10;

	useEffect(() => {
		!xAttr && setXAttr(data.columns[x]);
		!yAttr && setYAttr(data.columns[y]);
	}, []);

	let [chartType, setChartType] = props.useStateSAGE2("chart-type");
	let [showingCols, setShowingCols] = useState(false);

	console.log("x", xAttr, "y", yAttr);

	return (
		<div className="data-view">
			<div className="option-bar">
				{CHART_TYPES.map(d => (
					<div
						key={"button-" + d}
						className={`option ${chartType === d ? "active" : ""}`}
						onClick={() => {
							setChartType(d);
						}}
					>
						{d}
					</div>
				))}
				<div
					className={`option push ${showingCols ? "active" : ""}`}
					onClick={() => {
						setShowingCols(s => !s);
					}}
				>
					<i className="fas fa-columns"></i>
					<span className="badge">{data.columns.length}</span>
				</div>
			</div>
			<div
				style={{
					flex: "1",
					background: "none",
					padding: "8px",
					boxSizing: "border-box",
					position: "relative",
					overflow: "hidden"
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						display: !showingCols ? "flex" : "none"
					}}
				>
					<Chart
						data={data}
						xAttr={xAttr}
						yAttr={yAttr}
						type={chartType}
						{...{ appWidth, appHeight }}
					/>
				</div>
				<div
					className="overlay"
					style={{
						display: showingCols ? "grid" : "none"
					}}
				>
					{data.columns
						.filter(d => d)
						.map(col => (
							<div className={`colSelector`} key={col}>
								<span className="colName">{col}</span>
								<span
									className={`axisButton ${col === xAttr ? "active" : ""}`}
									style={{ marginLeft: "auto" }}
									onClick={() => setXAttr(col)}
								>
									X
								</span>
								<span
									className={`axisButton ${col === yAttr ? "active" : ""}`}
									onClick={() => setYAttr(col)}
								>
									Y
								</span>
							</div>
						))}
				</div>
			</div>
		</div>
	);
}

export default Component;
