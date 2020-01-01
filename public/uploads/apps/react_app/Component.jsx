import React, {useState, useEffect} from 'react';

function Component(props) {
    return <div style={{marginTop: 10}}>
        <div>
            <strong>hello from Component second file</strong>
        </div>
        Count: {props.count}
        <button style={{marginLeft: 5}} onClick={props.increment}>++</button>
    </div>
}

export default Component;