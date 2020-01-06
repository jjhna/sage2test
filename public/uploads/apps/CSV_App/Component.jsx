import React, { useState } from 'react';

const CHART_TYPES = [
    'Scatter Plot',
    'Contour Plot'
];

function Component(props) {
    let data = props.resource.read();

    console.log(data);
    let [xAttrState, setXAttr] = props.useStateSAGE2('X-attr');
    let [yAttrState, setYAttr] = props.useStateSAGE2('Y-attr');

    let x = 6;
    let y = 10;

    let xAttr = data.columns[x];
    let yAttr = data.columns[y];


    let [active, setActive] = useState(CHART_TYPES[0]);

    console.log(xAttr, yAttr);

    return <div className="data-view">
        <div className='option-bar'>
            {CHART_TYPES.map(d => (<div
                key={"button-" + d}
                className={`option ${active === d ? 'active' : ''}`}
                onClick={() => {
                    setActive(d);
                }}
            >
                {d}
            </div>))}
        </div>
        <div style={{flex: "1", background: "none", padding: "8px", boxSizing: "border-box"}}>
            <div style={{width: "100%", height: "100%"}}>

            </div>
        </div>
    </div>
}

export default Component;