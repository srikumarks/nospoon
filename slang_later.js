
later = (function () {
    "use strict";

    // Delaying a function invocation to the next round of the event
    // loop in Javascript is no joke apparently. Different JS environments
    // are capable of doing this differently and the techniques vary in
    // efficiency. The below implementation tries various facilities from
    // fastest to slowest, falling back ultimately on the slowest of them
    // all - the humble `setTimeout`.
    //
    // nextTick function largely taken from Q.js by kriskowal.
    //  repo: https://github.com/kriskowal/q
    //  file: q.js
    //
    // The "new Image()" hack is from - http://www.nonblocking.io/2011/06/windownexttick.html
    // Whoa! The original source of that hack is JSDeferred - https://github.com/cho45/jsdeferred
    //
    // Use the fastest possible means to execute a task in a future turn
    // of the event loop.
    let nextTick = (function () {
        try {
            if (typeof process !== "undefined" && typeof process.nextTick === 'function') {
                // node
                return process.nextTick;
            } 
        } catch (e) {}

        try {
            if (typeof setImmediate === "function") {
                // In IE10, or use https://github.com/NobleJS/setImmediate
                return setImmediate;
            } 
        } catch (e) {}

        try {
            if (typeof MessageChannel !== "undefined") {
                // modern browsers
                // http://www.nonblocking.io/2011/06/windownexttick.html
                let channel = new MessageChannel();
                // linked list of tasks (single, with head node)
                let head = {}, tail = head;
                channel.port1.onmessage = function () {
                    head = head.next;
                    var task = head.task;
                    delete head.task;
                    task();
                };
                return function (task) {
                    tail = tail.next = {task: task};
                    channel.port2.postMessage(0);
                };
            }
        } catch (e) {}

        try {
            if (typeof Image !== 'undefined') {
                // Fast hack for not so modern browsers.
                return function (task) {
                    let img = new Image();
                    img.onerror = task;
                    img.src = 'data:image/png,' + Math.random();
                };
            }
        } catch (e) {}

        // Worst case.
        return function (task) {
            return setTimeout(task, 0);
        };
    }());

    return function (callback, value) {
        if (callback) { nextTick(function () { callback(value); }); }
        return value;
    };
}());
