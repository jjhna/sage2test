import Component from "./Component.jsx";

class react_app extends SAGE2_ReactApp {
    constructor(data) {
        super(data);
    }

    getContextEntries () {
    	var entries = [];

    	// entries.push({
    	// 	description: "Copy URL",
    	// 	callback: "SAGE2_copyURL",
    	// 	parameters: {
    	// 		url: cleanURL(this.state.src || this.state.img_url)
    	// 	}
    	// });

    	// Show overlay with EXIF data
    	entries.push({
    		description: "Reset Count",
    		callback: "resetCount",
    		parameters: {}
    	});

    	return entries;
    }

    resetCount(date) {
        this.state.count = 0;
        this.refresh(date);
    }

    render(props) {
        let [count, setCount] = props.useState('count');

        return <div style={{
                background: "white",
                fontFamily: "sans-serif",
                padding: 20,
                boxSizing: 'border-box',
                ...props,
            }}>SAGE2 React App ({
                props.width.toFixed()
            } x {
                props.height.toFixed()
            }):<br/> Component: 
            <Component
                count={count}
                increment={() => setCount(c => c + 1)}
            />
        </div>;
    }
}

export default react_app;