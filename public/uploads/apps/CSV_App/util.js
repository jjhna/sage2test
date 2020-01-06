import { csvParse } from 'd3';

export function fetchCSV(url) {
    let resourcePromise = fetch(url)
        .then(res => res.text())
        .then(text => csvParse(text));

    return wrapPromise(resourcePromise);
}

function wrapPromise(promise) {
    let status = "pending";
    let result;
    let suspender = promise.then(
        r => {
            status = "success";
            result = r;
        },
        e => {
            status = "error";
            result = e;
        }
    );
    return {
        read() {
            if (status === "pending") {
                throw suspender;
            } else if (status === "error") {
                throw result;
            } else if (status === "success") {
                return result;
            }
        }
    };
}