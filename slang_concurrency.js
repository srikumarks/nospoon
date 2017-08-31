
// # Concurrency

// **Date**: 3 April 2017

// Requires slang.js, slang_vocab.js, slang_objects.js.
"use strict";

// Most programming in today's environment involves concurrency.
// This means at any time, we can have more than one "process" running
// concurrently ... from the perspective of the programmer/system designer.
// These concurrent processes may in some cases be executing in parallel
// on different processors or different machines or different cores on the
// same machine, while in other cases they may be multiplexed onto 
// a single processor core. In all of these cases, we'd think of the
// processes as somehow independent of each other's execution. We'll
// also expect the environment to provide for these processes to maintain
// that independence.
//
// To implement this kind of a mechanism, we have to radically change the
// way our "run" function is implemented ... and actually a host of
// other things by consequence ... so that we gain the ability to
// run "concurrent processes".

// ## From sequentiality to concurrency as "beta abstraction"

// When looking to model a domain, we can either come up with
// domain concepts top-down from an existing formalism, or try
// to figure out through trial and error in a bottom-up manner.
// While the former approach works for domains with a clear
// pre-existing computational formalism, we usually have to resort
// to bottom-up formalization in domains that we don't understand
// a priori.
//
// The process of figuring out concepts in a bottom-up manner
// can appear quite haphazard. One technique that offer some guidance
// in such an effort is "beta abstraction". In fact, you could express
// many forms of abstraction as beta abstraction, so it is worth
// understanding beta abstraction.
//
// The key idea is simple to express if we're not concerned about
// being mathematically rigorous. 
//
// > Beta abstraction is about pulling out as an argument, a symbol
// > used within the body of a function definition.
//
// Depending on which symbol you pull out, you gain different kinds of
// flexibility. 
//
// If we have a function like this -
// 
// ```js
// function f(a1,a2,...) { .... S .... }
// ```
//
// then the act of "beta abstracting on `S`" is rewriting this function
// as the application of another more abstract function to `S` - i.e.
//
// ```js
// (function g(a1,a2,...) { return function (S) { .... S .... }; })(S)
// ```
//
// Or to keep it simple, you can just work with a function `g` that is
// the same as `f`, but with an additional argument `S`.
//
// ```js
// function g(a1,a2,...,S) { .... S .... }
// ```
//
// The function `g` is considered to be more abstract than the function `f`
// because we can change what `S` is to achieve different ends.
//
// Now, while many programming language allow you to pull out symbols
// standing for certain types of "values", they do not allow certain
// "reserved" symbols to be passed as arguments like this. However,
// for our purpose, we'll pretend that they do.
// 
// If we look at out interpreter, we have a rough structure as follows -
//
// ```js
// function run(env, program, pc, stack) {
//    for (; pc < program.length; ++pc) {
//      ....
//      switch (instr.t) {
//          ....
//      }
//    }
//
//    ...
//    return stack;
// }
// ```
//
// We can abstract on many symbols, each giving us a different
// kind of "super power". For example, if we pull out `switch`,
// we gain the ability to customize our interpreter, a feature 
// which we can then reintroduce into `slang` itself, to great
// effect. (Granted, Javascript doesn't let you pass `switch`
// as an argument.) If we abstract on the `pc = pc + 1` part,
// then we gain the ability to jump to different parts of a
// program, while we can currently only step through sequentially.
//
// If we abstract on `return`, pretending that it is a function
// to which we pass the result stack as an argument, and that
// the `return` function itself never "returns" to the call site,
// we gain another such super power - the ability to direct program
// flow in a manner that can be exposed to `slang`. As it stands,
// the `return` statement does something magical - you use it to
// specify that "wherever the function `run` gets called, now go
// back to that piece of code and *continue* with the value
// I'm giving you as an argument". That's a pretty special "function".
// 
// > **Term**: In CS literature, such a "function" is called a
// > **continuation**.
//
// If we pull out `return` as an argument, we gain the ability
// to pass whatever target function to which the `run` invocation
// must "return to". So our interpreter loop looks something like
// this -
//
// ```js
// function run(env, program, pc, stack, ret) {
//    ... same same ...
//    ret(stack);
// }
// ```
//
// To truly ensure that we benefit from this change though,
// all the intermediate steps will need to be changed in the same
// manner to take an extra "return function" argument, where we
// pass different values depending on where we are. This is 
// left as an exercise.
//
// > **Term**: Such a rewrite of a normal function in terms of
// > functions that take an extra "return function" argument
// > is called in CS literature as "CPS transformation" where
// > "CPS" stands for "Continuation Passing Style". The CPS
// > transformation is a deep transformation of normal
// > sequential code that affects every operation. Some
// > compilers do this as a first step to providing advanced
// > flow control operators, including concurrency.
//
// While programming in the CPS style is tedious and verbose
// in most languages, supporting CPS in a language can give
// all sorts of cool super powers - like, for example, the
// ability to "return" as many times as you want to the
// call site, the ability to store away the "return function"
// and call it at a later point in time when a particular
// event arrives from a user, or the network, and so on.
//
// So we're going to start with rewriting our interpreter
// to have our `run` function take such an extra "return
// function" argument that we'll be calling ... `callback` :)
// 
// > **Note**: To Node.JS junkies, yes it's the same
// > mundane "callback style" that gives you "callback hell"
// > because you're programming in CPS style quite unnecessarily.
//

// ## Basic asynchronous behaviour

// Before we get to concurrent processes, we'll support asynchronous
// invocations so that we can at least use slang with Node.JS.
//
// We'll use beta abstraction and modify our `run` function such that it will
// no longer return a value normally. Instead, it will provide its result via a
// callback function provided to it. The callback function, if required will
// need to be passed as the last argument to the `run` function, and must be a
// function that accepts a stack as its sole argument. At the end of the day,
// the callback function will be called with the current stack as the sole
// argument.

run = function (env, program, pc, stack, callback) {
    for (; pc < program.length; ++pc) {
        let instr = program[pc];
        
        if (instr.t === 'word') {
            let deref = lookup(env, instr);
            if (!deref) {
                console.error('Undefined word "' + instr.v + '" at instruction ' + pc);
            }
            instr = deref;
        }

        switch (instr.t) {
            case 'prim':
                // We identify a primitive that will complete only
                // asynchronously by checking whether its function
                // has arity 1 or 2. If it is 1, it is synchronous,
                // if it is 2, it is asynchronous and the second
                // argument needs to be the callback. If no callback
                // is provided, we assume that all code is synchronous.
                // The only place where this will throw an error is
                // if you do an `await` within a synchronous
                // `run` call.
                if (callback && instr.v.length === 3) {
                    return apply(env, instr, stack, function (stack) {
                        return run(env, program, pc+1, stack, callback);
                    });
                } else {
                    stack = apply(env, instr, stack);
                    break;
                }

            case 'block':
                let bound_block = block(instr.v);
                bound_block.bindings = instr.bindings || copy_bindings(current_bindings(env), {});
                push(stack, bound_block);
                break;
                
            // In all other cases we just store the value on the stack.
            default:
                push(stack, instr);
                break;
        }
    }

    // If the caller is thinking that this the run may operate asynchronously,
    // we'll oblige by calling the supplied callback .. but in the next
    // scheduler tick.
    if (callback) {
        return later(callback, stack);
    }

    return stack;
};

// We define `later` to be a function that will postpone the 
// immediate execution of the zero-argument function passed to it.
//
// See slang_later.js for a faster implemetation.
let later = function (callback, value) {
    callback && setTimout(callback, 0, value);
    return value;
};

// We used a four-argument version of `apply`. So we need to change its
// implementation to support primitives with callbacks too. We simply
// make use of the Javascript feature which lets us pass as many arguments
// as we want to any function. If a function receives more arguments
// than it knows about, it will just ignore them.
apply = function (env, prim, stack, callback) {
    console.assert(prim.t === 'prim');
    return prim.v(env, stack, callback);
};



// ## Cooperative multi-tasking

// While the ability to have our interpreter return asynchronously
// is the key step in our single threaded JS environment to enable
// concurrency, we need to explicitly use some scheduler in
// Javascript to enable cooperative multi-tasking between different
// sequences of interpreters.

// We'll therefore need a way to spawn off such asynchronous processes
// which will not interfere with our spawning process. We'll add a
// primitive called `go` for that purpose. While `go` itself
// will be a synchronous operator, it will set up a process which
// will run at the next asynchronous opportunity. This will work to
// create concurrency only if there is enough opportunity for
// asynchronicity in each such process - i.e. if a spawned process
// doesn't have any async steps in it, it will hog the main loop and
// complete synchronously.

// We first introduce a primitive type for processes. The notify
// array is intended to hold a bunch of callbacks to be called
// with the process's result value once the process finishes.
let process = function (env, block) {
    return {t: 'process', v: block, state: 'waiting', notify: [], env: env};
};

stddefs(function (env) {
    
    // Spawning a process will produce a process object on the
    // stack. We can add notifiers to this process object so that
    // the spawning process can await its result.
    //
    // So, we have now implemented "go routines". We still don't
    // have an error model in slang. We'll come to that. Since this
    // is similar, we'll call the spawning operator as `go`.
    define(env, 'go', prim(function (env, stack) {
        let code = pop(stack);
        console.assert(code.t === 'block');

        // When spawning off a new process, we don't want the process to clobber the
        // parent environment or stack. So we copy the environment and pass a fresh
        // empty stack.
        let env2 = env.slice(0);
        enter(env2);
        copy_bindings(code.bindings, current_bindings(env2));

        let proc = process(env2, code);

        // A new process will receive a stack with two elements - the
        // parent process, and the process itself. The block is free to
        // pop it off and define it to a variable for multiple access.
        // For example, a block may begin with -
        //
        // `[parent-process current-process] args ...`
        //
        // Using this technique, you can send/receive messages to yourself,
        // or pass a reference to your process to another process you
        // spawn, to enable two-way communication.
        let new_stack = [stack.process, proc];
        new_stack.process = proc;
        return later(function () {
            let env = env2;
            run(env, code.v, 0, new_stack, function (stack) {
                leave(env);
                proc.state = 'done';
                proc.result = pop(stack);
                if (proc.notify) {
                    for (let i = 0; i < proc.notify.length; ++i) {
                        proc.notify[i](env, proc.result);
                    }
                    proc.notify = [];
                }
            });
        }, push(stack, proc));
    }));

    // Since we're passing the process object as a property of the
    // stack, we'll need to ensure that run function when called raw
    // ensures that such a process object is available.
    run = (function (old_run) {
        return function (env, program, pc, stack, callback) {
            if (!stack.process) {
                stack.process = process(env, block(program));
            }
            return old_run(env, program, pc, stack, callback);
        };
    }(run));

    // Invoking `await` with a process object on the stack will result
    // in the spawning process pausing until the spawned process finishes,
    // and then it will end with the result of the spawned process on
    // the parent process's stack. Notice that we define a two-argument
    // function here, to indicate that `await` is an asynchronous primitive.
    //
    // In this way, `await` has behaviour similar to "promises" or "futures".
    // When a process is finished, the `await` will always fetch the
    // result of the process, much like the way a promise immediately provides
    // the value that is promised once the process that produces it has
    // completed.
    //
    // Another term for such an `await` in the concurrency jargon is "join".
    // You may encounter phrases like "fork-join parallelism".
    //
    // Though we've implemented these concepts in a single threaded
    // system, we're not limited to it, given some basic coordination
    // primitives.
    define(env, 'await', prim(function (env, stack, callback) {
        let proc = pop(stack);
        console.assert(proc.t === 'process');
        console.assert(callback);

        // The process may be working or may be dead. If it is dead,
        // then we need to immediately succeed with its result value.
        if (proc.state === 'done') {
            return later(callback, push(stack, proc.result));
        }

        // The process isn't done yet. So add ourselves to the
        // notify list. Note that the notification callback itself
        // will not immediately invoke the callback function to
        // continue. But it will postpone it to the next scheduler
        // cycle so that all the notifications stand some chance
        // of running, and also we don't blow the javascript stack.
        proc.notify.push(function (result) {
            later(callback, push(stack, result));
        });

        // Return value will be discarded in the async case anyway.
        return stack;
    }));

    // Though we shouldn't need it in most cases, we'll add a 
    // `yield` operator which will give up time for another
    // concurrency process to run. This takes no arguments.
    define(env, 'yield', prim(function (env, stack, callback) {
        console.assert(callback);
        return later(callback, stack);
    }));

    // We obviously need the quintessential asynchronous operation
    // of sleeping for a given number of milliseconds! We use the
    // word `after` instead of `sleep` to prevent the misconception
    // that *all* processes would be asleep during this period.
    define(env, 'after', prim(function (env, stack, callback) {
        let ms = pop(stack);
        console.assert(ms.t === 'number');
        callback && setTimeout(callback, ms.v, stack);
        return stack;
    }));
});


// We'll finally modify the main control structures to also support
// async operation. This includes `do`, `defun`, `if`, `branch` and `vocab`.
// We have another option here - to create new primitives like `do/async`,
// `if/async` and so on which will treat their blocks as async blocks.
// However, we want to avoid that extra hassle. The consequence of this
// choice is that there will always be a yield at block boundaries.
do_block = function (env, stack, block, callback) {
    enter(env);
    copy_bindings(block.bindings, current_bindings(env));
    if (callback) {
        return run(env, block.v, 0, stack, function (stack) {
            leave(env);
            callback(stack);
        });
    } else {
        stack = run(env, block.v, 0, stack);
        leave(env);
        return stack;
    }
};

// So far, we've had to deal only with one environment.
// Now that we need to transport vocabularies between environments,
// we need to respond to the *current* environment when binding
// symbols to values instead of using the definition environment
// by default.
stddefs(function (env) {
    define(env, 'do', prim(function (env, stack, callback) {
        let code = pop(stack);
        if (code.t === 'prim') {
            return apply(env, code, stack, callback);
        }
        
        console.assert(code.t === 'block');
        return do_block(env, stack, code, callback);
    }));

    define(env, 'defun', prim(function (env, stack) {
        let sym = pop(stack), block = pop(stack);
        console.assert(sym.t === 'symbol');
        if (block.t === 'prim') {
            define(env, sym.v, block);
        } else {
            console.assert(block.t === 'block');
            define(env, sym.v, prim(function (env, stack, callback) {
                return do_block(env, stack, block, callback);
            }));
        }
        return stack;
    }));

    define(env, 'if', prim(function (env, stack, callback) {
        let blk = pop(stack), cond = pop(stack);
        console.assert(blk.t === 'block');
        console.assert(cond.t === 'bool');
        if (cond.v) {
            // Note that we're again making the choice that the 
            // `if` block will get evaluated in the enclosing scope
            // and won't have its own scope. If you want definitions
            // within `if` to stay within the `if` block, then you
            // can make new environment for the block to execute in.
            return run(env, blk.v, 0, stack, callback);
        }

        if (callback) {
            return later(callback, stack);
        }

        return stack;
    }));

    define(env, 'branch', prim(function (env, stack, callback) {
        let cond_pairs = pop(stack);
        console.assert(cond_pairs.t === 'block');
        console.assert(cond_pairs.v.length % 2 === 0);
        if (callback) {
            let step = function (i, callback) {
                if (i >= cond_pairs.v.length) {
                    return later(callback, stack);
                }
                console.assert(cond_pairs.v[i].t === 'block');
                console.assert(cond_pairs.v[i+1].t === 'block');
                return run(env, cond_pairs.v[i].v, 0, stack, function (env, stack) {
                    let b = pop(stack);
                    console.assert(b.t === 'bool');
                    if (b.v) {
                        run(env, cond_pairs.v[i+1].v, 0, stack, callback);
                    } else {
                        step(i+1, callback);
                    }
                });
            };
            return step(0, callback);
        } else {
            for (let i = 0; i < cond_pairs.v.length; i += 2) {
                console.assert(cond_pairs.v[i].t === 'block');
                console.assert(cond_pairs.v[i+1].t === 'block');
                // Check the condition.
                stack = run(env, cond_pairs.v[i].v, 0, stack);
                let b = pop(stack);
                console.assert(b.t === 'bool');
                if (b.v) {
                    // Condition satisfied. Now evaluate the
                    // "consequence" block corresponding to that condition.
                    return run(env, cond_pairs.v[i+1].v, 0, stack);
                }
            }
            return stack;
        }
    }));

    define(env, 'vocab', prim(function (env, stack, callback) {
        let defs = pop(stack);
        console.assert(defs.t === 'block');

        // Execute the block and capture its definitions before
        // we leave it.
        enter(env);
        if (callback) {
            return run(env, defs.v, 0, stack, function (stack) {
                let bindings = copy_bindings(current_bindings(env), {});
                leave(env);
                delete bindings[parent_scope_key];
                callback(push(stack, vocab(bindings)));
            });
        } else {
            stack = run(env, defs.v, 0, stack);
            let bindings = copy_bindings(current_bindings(env), {});
            leave(env);

            // We don't want to preserve the scope chain in this case, so
            // delete the parent scope entry.
            delete bindings[parent_scope_key];

            return push(stack, vocab(bindings));
        }
    }));
});

// ## Communicating between processes

// **Date**: 11 Apr 2017

// So far, we can spawn a process and the only way we can 
// interact with it is to await its completion, upon which
// we'll get passed the result of that process on our stack.
//
// We want to do more. Maybe we want a process that will
// never complete, but functions like a "server" which will
// receive requests from a port and keep responding to them.
//
// To get this capability, we'll add a "mailbox" to
// each process. The mailbox canbe used to send and receive
// messages to the process. Since each process automatically
// gets a process-wide mailbox, we don't usually need anything
// more. 
process = function (env, block) {
    return {t: 'process', v: block, state: 'waiting', notify: [],
            mailbox: mailbox(), env: env, pid: process.pid++};
};

process.pid = 1;

// We'll introduce a slang type to represent the mailbox. We'll
// later transform this into something that can be used at the language
// level too.
let mailbox = function () {
    return {t: 'mailbox', v: [], receiver: null};
};

let mailbox_post = function (mb, msg) {
    mb.v.push(msg);
    if (mb.receiver) {
        later(mb.receiver);
        mb.receiver = null;
    }
    return msg;
};

let mailbox_receive = function (mb, stack, callback) {
    if (mb.v.length > 0) {
        let msg = mb.v.shift();
        mb.receiver = null;
        return later(callback, push(stack, msg));
    }

    mb.receiver = function () {
        let msg = mb.v.shift();
        callback(push(stack, msg));
    };

    return stack;
};

// We need facilities to post messages to a process and for a process
// to receive and ... um ... process messages from another process.
stddefs(function (env) {
    // Posting a message to a process is a synchronous operation that
    // places the message into the process' mailbox.
    //
    // Usage: `proc msg post`
    define(env, 'post', prim(function (env, stack) {
        let msg = pop(stack), proc = pop(stack);
        console.assert(proc.t === 'process');
        mailbox_post(proc.mailbox, msg);
        return stack;
    }));

    // Receiving a message will wait for a messages to arrive into the current
    // process' mailbox, and will place it on the stack when it does. Further
    // code can then examine the message and take appropriate actions.
    //
    // Usage: `receive`
    define(env, 'receive', prim(function (env, stack, callback) {
        let proc = stack.process;
        console.assert(proc.t === 'process');
        mailbox_receive(proc.mailbox, stack, callback);
        return stack;
    }));    

    // Sometimes, we may not be able to process a received message until another
    // one arrives, since messages arrive non-determinstically. In such cases,
    // we'd need to postpone a message back into the process' mailbox.
    //
    // Usage: `msg postpone`
    define(env, 'postpone', prim(function (env, stack) {
        let msg = pop(stack);
        console.assert(proc.t === 'process');
        console.assert(stack.process);
        stack.process.post(msg);
        return stack;
    }));
});

// ## Processes as "objects"

// If you recall, we said in the section on object oriented programming that
// that main concept behind OOP is objects which interact by passing messages
// between them. We highlighted at that point that there is no intrinsic
// requirement to make such message passing synchronous in the way most OOP
// languages including the seminal Smalltalk implement.
//
// We now have processes that can pass messages between each other
// asynchronously - i.e. when a process passes another a message, it doesn't
// expect to get a "return value" immediately. Instead it is free to do other
// activities and *maybe* ask for one or more reply messages from the target
// process.
//
// So, in a sense, our "processes" are better "objects" than our "objects".
// About the only programming language and runtime where this interpretation
// is close to feasible is [Erlang] - which doesn't have a notion of "objects",
// but has cheap isolated concurrent processes which can communicate with
// each other through message passing. If you think about it, objects in our
// real world are always concurrent - they have a clearly defined interaction
// boundary and have their own timeline of activities they may be engaged in.
// A clock keeps ticking, a fan keeps spinning, the TV keeps showing a
// video on a screen, the grinder keeps mashing up food, and so on. Very
// rarely do we have synchronicity among objects in our real world. One
// example is perhaps an electrical switch - whose response to making or
// breaking an electrical circuit is immediate .. for practical purposes.
//
// [Erlang]: https://www.erlang.org

// ## Supporting objects

// Let's return to our mundane symchronous world of objects for now.

// We implemented message passing as method invocation in our object
// system. That doesn't yet support asynchronous operation. We'll need
// to fix that before we can use objects in this new circumstance.

// We can add general asynchronous support to `send`, `send*` and
// `new` (for async constructor), but instead of doing that, we'll
// add a new message sending operator that will work asynchronously.
// We'll call them `send&` and and `send*&`. We'll use the `&` character
// to indicate that the message sending is being "backgrounded" like
// you might do in a shell.
//
// Now, we have many choices here. We can simply implement async
// support for `send&` and `send*&`, but that is not a true message
// send because we'll have to wait for the send to finish before
// doing anything else. This prevents us from doing a sequence of
// message sends to various objects at one go. It also forces async
// operation for every object message send.
//
// A better way to look at async object message sends is as though
// you're sending to another process, in which case if you intend
// to receive a message back, you'll send along your process id
// so that the process can communicate back to you whatever it
// needs to ... or not. From the perspective of the sending process,
// the sending step appears synchronous, just like a `post`.
//
// So an asynchronous message send to an object is a method
// invocation that accepts the sending process as the top-stack
// argument, after which the regular `send` arguments appear.

// > **Note**: This means the appropriate vocabularies must be designed for
// > such asynchronicity. No result should be expected from such an async send on
// > the stack and the design of an async vocabulary should be such that it
// > should pass results only by posting to the provided process object.

stddefs(function (env) {
    define(env, 'send&', prim(function (env, stack) {
        let msg = pop(stack), thing = pop(stack);
        console.assert(msg.t === 'symbol');

        if (!thing.vocab || !thing.vocab.v[msg.v]) {
            console.error('No vocabulary relevant to message');
            return stack;
        }

        let method_or_val = thing.vocab.v[msg.v];
        if (!method_or_val) {
            console.error('Vocabulary doesn\'t accept message "' + msg.v + '"');
            return stack;
        }

        switch (method_or_val.t) {
            case 'prim':
                push(stack, thing);
                push(stack, stack.process); // Extra process argument.
                return apply(env, method_or_val, stack);
            default:
                return push(stack, method_or_val); // Normal value.
        }
    }));

    define(env, 'send*&', prim(function (env, stack) {
        let msg = pop(stack), voc = pop(stack);
        console.assert(msg.t === 'symbol');
        console.assert(voc.t === 'vocab');

        let method_or_val = voc.v[msg.v];
        if (!method_or_val) {
            console.error('Vocabulary doesn\'t accept message "' + msg.v + '"');
            return stack;
        }

        if (method_or_val.t === 'prim') {
            push(stack, stack.process); // Extra process argument.
            return apply(env, method_or_val, stack);
        }

        return push(stack, method_or_val);
    }));
});

// ### The trouble with such objects

// Beyond this, we'll find that working with objects in an environment where
// such concurrency has prolific use is extremely hard to get right.  In
// particular, designing a transport mechanism for objects that actually works
// is very hard. At best, objects can be exposed via communication port.  In
// this sense, processes serve as better "objects" than objects themselves.
//
// We'll satisfy ourselves with what we have for the moment and dive deeper
// into how to setup interplay between objects and concurrency later on.

// ## Tests

// ### Some debug utilities

stddefs(function (env) {
    // The top of the stack is expected to contain a message string
    // that will be gobbled. The next stack item will be printed 
    // without popping it off the stack.
    define(env, 'debug', prim(function (env, stack) {
       let str = pop(stack).v;
       console.log(str, topitem(stack).v);
       return stack;
    }));

    // A `breakpoint` is useful to invoke the Javascript debugger's
    // breakpoint without having any other impact on program
    // behaviour.
    define(env, 'breakpoint', prim(function (env, stack) {
        debugger;
        return stack;
    }));
});

// ### Test: Count down timer

// Basic asynchronicity test where we run a count-down timer
// while the code looks like a normal recursive function.

tests.ticktock = function (n) {
    let program = parse_slang(`
        [ :i def
          i 0 >
          [ i print 1000 after
            i 1 - count-down
          ] if
        ] :count-down defun
        count-down
    `);

    return run(test_env(), program, 0, [number(n)], function (stack) {
        console.log("done");
    });
};

// ### Test: Message passing

tests.passmsg = function () {
    let program = parse_slang(`
        [ "STARTED" debug
          "one" print receive print
          1000 after
          "two" print receive print
          1000 after
          "three" print receive print
          1000 after
          "four" print receive print
          1000 after
        ] go :target def
        target "ondru" post
        target "irandu" post
        target "moondru" post
        target "naangu" post
    `);

    return run(test_env(), program, 0, [], function (stack) {
        console.log("done");
    });
};

// ### Test: Ping Pong

// A basic ping pong messaging between two processes.  The main process
// launches two processes first, it then tells them about each other and what
// messages they must print, and then gives the go to one of them who then
// starts the back-n-forth (pun unintentionally intended ;)

tests.pingpong = function (n) {
    let program = parse_slang(`
        :n def
        [ "PINGPONG" print
          
          "The first two messages tell us who we are
          and who to send messages to.";

          receive :target def
          receive :message def

          [ receive :i def
            message print 1000 after
            i 0 > [ target i 1 - post loop ] if
          ] :loop defun

          loop
        ] :pingpong def
        
        pingpong go :ping def
        pingpong go :pong def

        ping pong post     "Tell ping that pong is its target";
        ping "ping" post
        pong ping post     "Tell pong that ping is its target";
        pong "pong" post

        ping n post        "Start pingponging";
    `);

    return run(test_env(), program, 0, [number(n)], function (stack) {
        console.log("done");
    });
};

// ## Scoping rules for concurrency

// We've used blocks to represent the code that processes should run.  So far,
// so good. If we want to expand the reach of processes to cover running them
// on other machines, then we need to change the meanings of our programs a bit
// to accommodate the fact that what is referred to within such blocks cannot
// be modified *after* the block is created. The reason for that is that, if
// the normal expectation is have bindings be modifiable after block creation,
// then the same expectation needs to be maintained when sending a block over
// to another machine for running there. That would, however, entail that
// variable assignments trigger network communication to the other machine.
//
// We *could* implement such network communication when such "remote variables"
// change values, but then the programmer ceases to have control over the
// meanings of these variables because they may change at any point *within* a
// process. That is, within a process, you'll no longer be able to assume that
// the value of a captured variable will be stable within the process. Such
// unpredictability leads to considerable system complexity and bugs due to
// lapses in accounting for such changes.
//
// To change this behaviour, we need to implement a different mechanism for
// *how* to save bindings at block creation time. One heuristic is to scan the
// block recursively for words and for any word that occurs, store the binding
// in the block's captured bindings. Below is an implementation of this scheme.
//
// > **Note**: With this change, we're significantly changing the meanings of
// > our earlier programs in a subtle way. The reader's task is to revisit the
// > earlier test cases and consider whether they are influenced by this change
// > or not.

let copy_bindings_for_block = function (block, env, dest) {
    let scan = function (instructions) {
        for (let i = 0; i < instructions.length; ++i) {
            let word = instructions[i];
            if (word.t === 'word') {
                let val = lookup(env, word); 
                if (val) {
                    dest[word.v] = val;
                }
            } else if (word.t === 'block') {
                scan(word.v);
            }
        }
    };

    scan(block.v);
    dest['self'] = block; // The word "self" refers to the block itself within the block.
    return dest;
};

// > **Question**: Scrutinize the above heuristic for determining what
// > bindings to keep from the environment. In what cases does it keep
// > more bindings than necessary? Are there cases where it may keep
// > fewer bindings than necessary?
 
run = function (env, program, pc, stack, callback) {
    if (!stack.process) {
        stack.process = process(env, block(program));
    }

    for (; pc < program.length; ++pc) {
        let instr = program[pc];
 
        if (instr.t === 'word') {
            let deref = lookup(env, instr);
            if (!deref) {
                console.error('Undefined word "' + instr.v + '" at instruction ' + pc);
            }
            instr = deref;
        }

        switch (instr.t) {
            case 'prim':
                if (callback && instr.v.length === 3) {
                    return apply(env, instr, stack, function (stack) {
                        return run(env, program, pc+1, stack, callback);
                    });
                } else {
                    stack = apply(env, instr, stack);
                    break;
                }

            case 'block':
                let bound_block = block(instr.v);
                // We use `copy_bindings_for_block` instead of the earlier `copy_bindings`
                // implementation. With this implementation, notice that the `[[parent]]`
                // entry will **not** be copied. This has the effect of isolating the
                // block's execution from the rest of the environment chain. This is our
                // first baby step towards "process isolation", given that we intend to
                // reuse blocks to describe processes.
                bound_block.bindings = instr.bindings || copy_bindings_for_block(bound_block, env, {});
                push(stack, bound_block);
                break;

            // In all other cases we just store the value on the stack.
            default:
                push(stack, instr);
                break;
        }
    }

    if (callback) {
        return later(callback, stack);
    }

    return stack;
};

// We have to now examine the impact of this change on how we're spawning
// processes - using our `go` primitive. `go` currently copies the environment
// chain by reference - i.e. it isn't a deep copy. Now that the process of
// creating a block already captures whetever is necessary for the block to
// run, we can safely change the implementation of `go` to create a fresh new
// environment instead. This is also a significant step towards "process
// isolation".

stddefs(function (env) {
    define(env, 'go', prim(function (env, stack) {
        let code = pop(stack);
        console.assert(code.t === 'block');

        // When spawning off a new process, we don't want the process to clobber the
        // parent environment or stack. So we create a *fresh* environment and store
        // whatever the block needs in it. Note that only the creation of `env2` is
        // different from the previous implementation, where we did `env.slice(0)`.
        // We can change that to make a *blank* environment instead because everything
        // that is needed to evaluate the block has already been captured into the
        // `.bindings` hash. If that were not true, then this simplification won't be
        // possible. That capturing step flattens the entire environment stack into a
        // single hash.

        let env2 = mk_env();
        copy_bindings(code.bindings, current_bindings(env2));
        enter(env2);

        // > **Question**: What are the implications of this choice from the perspective
        // > of processes distributed across multiple machines, running within different
        // > interpreter processes? Is there anything that processes cannot do any more
        // > with this implementation that was possible before, for example?

        let proc = process(env2, code);

        // The rest remains the same.
        let new_stack = [stack.process, proc];
        new_stack.process = proc;
        return later(function () {
            let env = env2;
            run(env, code.v, 0, new_stack, function (stack) {
                leave(env);
                proc.state = 'done';
                proc.result = pop(stack);
                if (proc.notify) {
                    for (let i = 0; i < proc.notify.length; ++i) {
                        proc.notify[i](proc.result);
                    }
                    proc.notify = [];
                }
            });
        }, push(stack, proc));
    }));
});

// One thing to notice with this new notion of capturing the bindings
// relevant to a block is that we can now simplify our implementation 
// of environment with no change to behaviour. We can just maintain
// a single chain of scopes.

mk_env = function (base) { return { t: 'env', v: { env: {}, base: base && base.v } }; };

lookup = function (env, word) {
    for (let scope = env.v; scope; scope = scope.base) {
        let val = scope.env[word.v];
        if (val) { return val; }
    }
    return undefined;
};

define = function (env, key, value) {
    env.v.env[key] = value;
    return env;
};

enter = function (env) {
    env.v = { env: {}, base: env.v };
    return env;
};

leave = function (env) {
    env.v = env.v.base;
    return env;
};

current_bindings = function (env) {
    return env.v.env;
};

// ## Data flow variables

// Mutexes, semaphores and critical sections are common ways in which systems
// programming languages deal with concurrency control. Recently, [promises and futures]
// have turned up as useful abstractions in a variety of situations.  A
// promise or a future is an immediate value that stands for the value that a
// process will *eventually* produce. Whenever a process needs the value of an
// unbound dataflow variable, it will suspend and wait for it to be bound in
// some other process. This way, two processes can coordinate their activities
// by synchronizing on such dataflow variables. 
//
// [promises and futures]: https://en.wikipedia.org/wiki/Futures_and_promises

// Let's try to model these in slang by introducing a new type for dataflow
// variables. With each `dfvar`, we need to store a list of callbacks to
// call when the dfvar becomes bound so that processes waiting on it can
// resume. We also keep around the name of the dfvar just for debugging
// purposes.

let dfvar = function (name) { 
    return { t: 'dfvar', v: undefined, name: name, bound: false, resume: [] };
};

let df_is_bound = function (dfv) { return dfv.bound; };

let df_bind = function (dfv, val) {
    if (!dfv.bound) {
        dfv.v = val;
        dfv.bound = true;
    }
    while (dfv.resume.length > 0) {
        let fn = dfv.resume.shift();
        later(fn, dfv.v);
    }
    return dfv.v;
};

let df_val = function (dfv, callback) {
    if (dfv.bound) {
        return later(callback, dfv.v);
    }

    dfv.resume.push(callback);
    return dfv;
};

// When a process tries to access the value of a dataflow variable that is not
// bound, it must suspend until it gets a value. We do this via the traditional
// `await` route.

// We of course need a way for a process to bind an unbound dataflow variable
// with a value. We must insist that we do this only for unbound variables, or
// we'll end up with an asynchronous mess. We'll simply reuse `def` to include
// dataflow variables in the mix instead of introduce another word. We'll of
// course add a way to create new dataflow variables using a `dfvar` primitive.
// To wait for a dfvar to be bound, we'll repurpose `await`. This is
// particularly appropriate as the behaviour of await in the case of a process
// is similar - where it waits for a process to finish (if it is running) and
// resumes with the value it places on the top of the stack. If the process is
// already finished, then it resumes immediately. Similarly, if the dfvar is
// unbound, it waits for the dfvar to be bound by another process before
// continuing. If it is bound, then it replaces it by its value on the stack
// and continues.
//
// > **Question**: What kind of a concurrency "mess" would we end up with if
// > we permit bindings for already bound dataflow variables?

stddefs(function (env) {
    define(env, 'dfvar', prim(function (env, stack) {
        let sym = pop(stack);
        console.assert(sym.t === 'symbol');
        define(env, sym.v, dfvar(sym));
        return stack;
    }));

    define(env, 'def', prim(function (env, stack) {
        let sym = pop(stack), val = pop(stack);
        switch (sym.t) {
            case 'symbol':
                define(env, sym.v, val);
                break;
            case 'dfvar':
                df_bind(sym, val);
                // TODO: Note that we must fail in this case if the new value
                // is not the same as an already bound value if that was the case.
                break;
            default:
                console.error('Unsupported binding type ' + sym.t);
        }
        return stack;
    }));

    define(env, 'await', prim(function (env, stack, callback) {
        let proc = pop(stack);

        if (proc.t === 'dfvar') {
            console.assert(callback);
            df_val(proc, function (val) {
                callback(push(stack, val));
            });
            return stack;
        }

        console.assert(proc.t === 'process');
        console.assert(callback);

        if (proc.state === 'done') {
            return later(callback, push(stack, proc.result));
        }

        proc.notify.push(function (result) {
            later(callback, push(stack, result));
        });

        // Return value will be discarded in the async case anyway.
        return stack;
    }));    
});

tests.dfvar = function () {
    let program = parse_slang(`
        "We'll use a convention that capital letters indicate dfvars";
        :X dfvar
        [ 5000 after 42 X def ] go
        "Waiting for X" print
        X await print
    `);

    return run(test_env(), program, 0, [], function (stack) {
        console.log("done");
    });
};

// > **Question**: What do we have to do to implement dataflow
// > variables such that we won't need `await` to get the value
// > of such a variable? How would you design your primitives to
// > support the creation of strcutures with unfulfilled dfvars
// > that await their values only when requested?

// > **Question**: Supposing a dfvar never gets bound and a process
// > is waiting for it. What facilities would we need to help
// > design the process so that it won't be locked forever when
// > such a thing happens?

// ## Tests
// ### Test prime number sieve
tests.primesieve = function (n) {
    let program = parse_slang(`
        [n] args                "We stop when we reach n";

        "We spawn one sieve process for each prime number we
         find. Each sieve process filters out the factors of
         that prime number and pipes its output to the higher
         prime processes.";

        [ receive :prime def    "The first number we get is prime";
          prime print
          self go :filter def   "Launch another filter process for
                                 the next prime";

          "Sieve out all factors of our prime and send it to
           the next sieve process";

          [ self :loop def
            receive :i def      "i will not have any factors < prime";
            i prime remainder 0 != [ filter i post ] if

            i n < [ loop do ] if
          ] do
        ] :sieve def

        sieve go :main def      "Start the first sieve";
        
        "Generate 2,3,4,5,... into the first sieve";
        [ [i target] args
          self :gen def
          target i post
          yield                 "Necessary for async generation";
          i n < [i 1 + target gen do] if
        ] :generate defun

        2 main generate
    `);

    return run(test_env(), program, 0, [number(n)], function (stack) {
        console.log("done");
    });
};

// ### Math primitives needed for prime sieve

stddefs(function (env) {
    define(env, 'remainder', prim(function (env, stack) {
        let den = pop(stack), num = pop(stack);
        console.assert(den.t === 'number' && num.t === 'number');
        return push(stack, number(num.v % den.v));
    }));

    define(env, 'quotient', prim(function (env, stack) {
        let den = pop(stack), num = pop(stack);
        console.assert(den.t === 'number' && num.t === 'number');
        return push(stack, number(Math.floor(num.v / den.v)));
    }));
});


