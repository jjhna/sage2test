import React, {useState, useEffect} from 'react';

function Component(props) {
    let [count, setCount] = useState(0);

    return <div style={{marginTop: 10}}>
        <div>
            <strong>hello from Component second file</strong>
        </div>
        Count: {count}
        <button style={{marginLeft: 5}} onClick={() => setCount(c => c + 1)}>++</button>
    </div>
}

export default Component;