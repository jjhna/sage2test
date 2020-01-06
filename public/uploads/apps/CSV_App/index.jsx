import React, {useState} from 'react';

import Component from "./Component.jsx";
import { fetchCSV } from "./util.js";
import './style.css';

class CSV_App extends SAGE2_ReactApp {
    constructor(data) {
        super(data);
    }

    init(data) {
        super.init(data);

        console.log('CSV App> init');

        // move and resize callbacks
        this.resizeEvents = "onfinish"; // continuous / onfinish
        // this.moveEvents   = "continuous";
        // this.resize = "fixed";

        this.passSAGE2PointerAsMouseEvents = true;

        // SAGE2 Application Settings
        // Not adding controls but making the default buttons available
        this.controls.finishedAddingControls();
        this.enableControls = true;

        console.log(data.state.file);
    }

    getContextEntries() {
        return [
            {
                description: "X:",
                callback: "setAttr",
                parameters: {attr: "X"},
                inputField: true,
            },
            {
                description: "Y:",
                callback: "setAttr",
                parameters: {attr: "Y"},
                inputField: true,
            }
        ];
    }

    setAttr(data, date) {
        this.setState(data.attr + '-attr', data.clientInput);
    }

    render(props) {
        let { width, height } = props;
        let [file] = props.useStateSAGE2('file');
        let [resource] = useState(fetchCSV(file));

        return <div className='SAGE2-CSV-App' style={{
                width,
                height,
            }}>
            <React.Suspense fallback={<div className='fallback'>Loading...</div>}>
                {file && <Component
                    useStateSAGE2={props.useStateSAGE2}
                    resource={resource}
                /> || <div style={{
                    width: "100%",
                    height: "100%",
                    display: 'flex',
                    fontWeight: 'bold',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>No File Selected</div>}
            </React.Suspense>
        </div>;
    }
}

export default CSV_App;