import Component from "./Component.jsx";

class react_app extends SAGE2_ReactApp {
    constructor(data) {
        super(data);
    }

    render(props) {
        return <div style={{
            background: "white",
            fontFamily: "sans-serif",
            padding: 20,
            boxSizing: 'border-box',
            ...props,
        }}>SAGE2 React App ({props.width.toFixed()} x {props.height.toFixed()}):<br/> Component: <Component /></div>;
    }
}

export default react_app;