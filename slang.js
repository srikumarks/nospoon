// % The No Spoon Series : Building Slang
// % Srikumar K. S.
// % 21 Feb 2017
//
// # Building Slang

// In this series, we will gradually work through implementing an interpreter
// for a small programming language in Javascript.  The goal is to understand
// language "features" whose needs arise at various points and the how various
// languages trade off these features in their implementations. We aim to
// understand them so that we can invent the most appropriate tool for the job
// at hand in any occasion instead of boxing ourselves into the limitations of
// a design made for another context. We'll be working towards a pretty
// powerful feature set, but efficiency will not be one of our initial
// concerns. The goal will be to understand how to think out of the box no
// matter what programming language or toolkit you're working with.
// 
// > **Note**: This file is written in a "stream of thought" style so you can
// > follow along from top to bottom as we add more detail. You can pretty much
// > draw a line at any point in the code, copy paste everything before that line
// > into a javascript console and run it. I say "pretty much" because some
// > concepts and implementations will take a few steps to flesh out, so
// > "pretty much" means "as long as everything you need has been defined".
// >
// > -Srikumar

// We use ES6 features like `let`.
"use strict";

// ## Application area

// While working through this, we'll keep in mind a simple application of the
// language we'll be building - a drawing tool that works within web browsers. As
// we do more advanced stuff, we'll be going beyond this application area, but
// those transition points will be well defined.
 
// ## Approach
// 
// Normally, when learning a programming language, we learn first about its
// *syntax* - which is how the language looks, then delve a little deeper into its
// *semantics* - which is how the language works and behaves and later on work out
// a *mental model* for the language so we can understand programs in it and use
// the language syntax and semantics for effective system design.
//
// In this series, we'll be going the other way around. We won't bother ourselves
// with pretty syntax, but we'll start with a mental model of programming and work
// out a viable semantics for a language and only then slap a syntax on it purely
// for convenience.

// ## The mental model

// **Program**: Our program will be .. a sequence of instructions we give our
// interpreter to perform. Simple eh? We read instructions one by one and
// "execute" them. This will be how our "interpreter" will work.
// 
// **Environment**: The instructions our program runs will do their job within the
// context of an environment. Making this environment explicit is very useful to
// making multiple runtimes co-exist by creating different environments for them.
// 
// **Stack**: Our programs will operate on a *stack* of values.  Programs will
// have immediate access to the top elements of the stack, but will have to pop
// out elements in order to look any deeper.
 
// ## Values

// We break down our language into the values that our programs work
// with and choose basic data structures for representing our program
// as well as the stack that they operate on.
// 
// So what values will our program need to deal with? If you think about drawing
// applications, at the minimum we need numbers to represent coordinates and
// strings to include text. We're also likely to encounter repeated patterns. So
// we need some ways of giving names to these patterns so we can reuse them. We'll
// also have some operations that we initially won't be able to perform in our
// language and will need to dig into the "host language" - in this case
// Javascript - to perform.  We'll call these "primitives".
 
// We'll represent values of these types using a simple Javascript Object with two
// fields `t` for "type" and `v` for "value".
//
// We can use these functions to make values that our programs can consume.
// By using these functions, we're guaranteeing that we'll supply proper argument
// types so our programs can, for example, trust that the `v` field will be a
// number if the `t` field has the value `"number"`.
let number = function (v)  { return {t: 'number', v: v};  },
    string = function (v)  { return {t: 'string', v: v};  },
    word   = function (v)  { return {t: 'word',   v: v};  },
    prim   = function (fn) { return {t: 'prim',   v: fn}; };

// If you look carefully into what we've done here, we've already committed to
// something pretty big! These are the entities using which we'll be expressing
// the values that our programs will operate on. They are also the entities
// using which we'll express our programs! Though we'll be expanding on this
// set, we'll try and preserve this symmetry as far down the line as makes
// sense for our purpose.

// ## Running a program

// Recall that we said our program is a sequence of instructions we process
// one by one. We can represent our program therefore using a plain old
// Javascript array, along with a "program counter" which is an index into
// the array of instructions to execute next. The stack that our program needs
// to work on can also be represented by an array.

let run = function (env, program, pc, stack) {
    // So how do we run our program? It is just as the Red Queen said to the
    // White Rabbit in Alice in Wonderland - "Start at the beginning, go on
    // until you reach the end, then stop."
    for (; pc < program.length; ++pc) {
        let instr = program[pc];

        // When an instruction is a "word", we need to use it as a key to lookup
        // a value in our environment. Once we look it up, we have to treat it
        // as though this value occurred in our program as a literal, which means
        // treating it as an instruction and processing it.
        if (instr.t === 'word') {
            let deref = lookup(env, instr);
            if (!deref) {
                console.error('Undefined word "' + instr.v + '" at instruction ' + pc);
            }
            instr = deref;
        }

        switch (instr.t) {
            // When we encounter a primitive operation given as a Javascript function,
            // we have to pass it our stack so that it can do whatever it needs to do
            // with the values stored on the stack.
            case 'prim':
                stack = apply(env, instr, stack);
                break;
                
            // In all other cases we just store the value on the stack.
            default:
                push(stack, instr);
                break;
        }
    }

    return stack;
};

// ... and that's it for our first interpreter!

// ## Looking up words and performing primitive operations

// Since our simple idea of an environment is as a key-value lookup table,
// we use a plain Javascript object as our environment. We'll capture this
// assumption in a function to create a new environment from scratch.

let mk_env = function () {
    return {}; // A new hash map for key-value associations.
};

// With such an "environment", we get a simple lookup function -
let lookup = function (env, word) {
    console.assert(word.t === 'word');
    return env[word.v];
};

// Associate the value with the given key and returns the environment.
let define = function (env, key, value) {
    env[key] = value;
    return env;
};

// For generality, we can model primitive operations as functions on our
// stack. 
let apply = function (env, prim, stack) {
    console.assert(prim.t === 'prim');
    return prim.v(env, stack);
};

// > **Question**: What limitations does this definition impose on
// > what a primitive function can do?

// We'll also abstract the stack operations to keep things flexible.
let push = function (stack, item) {
    stack.push(item);
    return stack;
};

let pop = function (stack) {
    return stack.pop();
};

let topitem = function (stack) {
    return stack[stack.length - 1];
};

// It is useful to look a little deeper into the stack.
// So we add another function to peek deeper than the topmost
// element.
let topi = function (stack, i) {
    return stack[stack.length - 1 - i];
};

let depth = function (stack) {
    return stack.length;
};

// For simplicity, we assume that our primitives do not throw exceptions.
// In fact, we will not bother with exceptions at all. Forget that they were
// even mentioned here!

// ### Testing our mini language

// Let's quickly write a few functions to express how we intend to run
// our programs and what we'll expect of them.

// We'll hold all our tests in a single hash table mapping the test
// name to the test function to be called.
let tests = {};

// The smoke_test function should produce a stack with a single item
// on it - the number 3.
tests.smoke = function () {
    // We start with an empty environment, load our standard library of
    // routines into it and use it to run our "program" that adds 1 and 2
    // and returns the stack with the result.
    let env = load_stdlib(mk_env());
    
    let program = [
        number(1),      // Push 1 on to the stack
        number(2),      // Push 2 on to the stack
        word('+')       // Apply '+' operation on top two elements.
    ];

    return run(env, program, 0, []);
};

// ### Displaying the stack for debugging

// A helper function to show the top n elements of the stack on the console.
// The count defaults to 20.

let show = function (stack, n) {
    n = Math.min(n || 20, depth(stack)); // Default to 20 elements.

    for (let i = 0; i < n; ++i) {
        show_item(topi(stack, i));
    }
};

let show_item = function (item) {
    switch (item.t) {
        case 'string':
            // We need to properly escape characters, so we use stringify only for strings.
            return console.log('string(' + JSON.stringify(item.v) + ')');
        default:
            // Everything else, we let the default display routine take over.
            return console.log(item.t + '(' + item.v + ')');
    }
};


// ## Standard library

// We'll choose a very basic standard library consisting of 4 arithmetic
// operations to start with. We'll expand this set, but we're too impatient
// to get to try out our new fangled "language" that we're willing to wait
// for that coolness.

let load_stdlib = function (env) {
    
    // Basic arithmetic operators for starters.
    // Note the order in which the arguments are retrieved.

    define(env, '+', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, number(x.v + y.v));
    }));

    define(env, '-', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, number(x.v - y.v));
    }));

    define(env, '*', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, number(x.v * y.v));
    }));

    define(env, '/', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, number(x.v / y.v));
    }));

    return env;
};

// ### Test distance calculation

// To calculate the distance between two points on a 2D plane,
// we need a new primitive - the square root function.

// First, a small utility to add new definitions to our 
// `load_stdlib` function. `new_defns` is expected to be
// a function that takes an environment, defines some things
// into it and returns the environment.
let stddefs = function (new_defns) {
    load_stdlib = (function (load_first) {
        return function (env) {
            return new_defns(load_first(env)) || env;
        };
    }(load_stdlib));
};

// Augment our "standard library" with a new 'sqrt' primitive function.
stddefs(function (env) {
    // We'll not be able to express x * x without the
    // ability to duplicate the top value on the stack.
    // We could also add 'pow' as a primitive for that
    // specific case.
    define(env, 'dup', prim(function (env, stack) {
        return push(stack, topitem(stack));
    }));

    // Similarly, we could use 'drop' also to take off
    // elements from the stack without doing anything with them.
    define(env, 'drop', prim(function (env, stack) {
        pop(stack);
        return stack;
    }));

    define(env, 'sqrt', prim(function (env, stack) {
        let x = pop(stack);
        return push(stack, number(Math.sqrt(x.v)));
    }));
});

// We always want the standard library for tests, so simplify it
// with a function.
let test_env = function () {
    return load_stdlib(mk_env());
};

// Now we can finally calculate the distance between two points.
tests.distance = function (x1, y1, x2, y2) {
    let program = [
        number(x1),     // Store x1
        number(x2),     // Store x2
        word('-'),      // Take the difference
        word('dup'),    // 'dup' followed by '*' will square it.
        word('*'),
        number(y1),     // Store y1
        number(y2),     // Store y2
        word('-'),      // Take the difference
        word('dup'),    // 'dup' followed by '*' will square it.
        word('*'),      
        word('+'),      // Sum of the two squares.
        word('sqrt')    // The square root of that.
    ];

    return run(test_env(), program, 0, []);
};

// # Developing Abstractions

// We now have a simple language "slang" in which we can give a sequence of
// instructions to be "performed" by the interpreter and it will faithfully
// run through and do it one by one. 
//
// This is great for a basic calculator, but for anything with a bit of
// complexity, this is inadequate since we **want** to be able to build
// higher levels of abstraction as we work with on more complicated problems.
//
// Let's recall the distance calculation program we wrote earlier -
//
// ```js
// let program = [
//        number(x1),     // Store x1
//        number(x2),     // Store x2
//        word('-'),      // Take the difference
//        word('dup'),    // 'dup' followed by '*' will square it.
//        word('*'),
//        number(y1),     // Store y1
//        number(y2),     // Store y2
//        word('-'),      // Take the difference
//        word('dup'),    // 'dup' followed by '*' will square it.
//        word('*'),      
//        word('+'),      // Sum of the two squares.
//        word('sqrt')    // The square root of that.
//    ];
// ```
//
// This is cheating a bit actually. We're inserting values directly into a
// program as though they were constants. If we were to truly express this as
// a reusable function, then we'll need to make it operate on the top 4
// values on the stack - `[y2, x2, y1, x1, ...]` and produce the distance
// as a result on the stack.
//
// Since our environment can hold key-value associations, we can add a primitive
// that will insert these mappings into the current environment.
//
// We need two things for that - a) a way to specify a "symbol" and 
// b) a primitive to assign the symbol to a value in the current environment.

// We introduce a new value type called 'symbol' which is similar to a 'word',
// except that it will always refer to itself when "evaluated" - i.e. if you ask
// our interpreter the value of a symbol, it will simply return the symbol itself,
// unlike a word.

let symbol = function (name) { return {t: 'symbol', v: name}; };

// At this point, our interpreter only has special dealings for 'word' and 'prim'
// types. Everything else gets pushed on to the stack. So the interpreter already
// knows how to work with symbols. What we need is a way to use a symbol name
// and bind it to a value. For this, we add a new primitive to our standard library
// called 'def'.
stddefs(function (env) {
    define(env, 'def', prim(function (env, stack) {
        let sym = pop(stack), val = pop(stack);
        console.assert(sym.t === 'symbol');
        define(env, sym.v, val);
        return stack;
    }));
});

// > That seems fine and will also work fine in basic tests. However, there is
// > a subtlety here. The way we've implemented the `def` primitive, the value
// > assignment will *always* happen in the top level environment! For the
// > moment, that is ok. We'll improve this soon as we realize that programs
// > become hard to reason about if references are implemented globally all the
// > time. This is the same as the "no global variables" rule most of you follow.

// With symbols and `def`, we can now implement a proper distance calculator.
// The new tests.distance will need to be called like this -
// `tests.distance2([2,4,6,7].map(number))`

tests.distance2 = function (stack) {
    let program = [
        // We name our four arguments and consume them from the stack.
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        // Calc square of x1 - x2
        word('x1'), word('x2'),
        word('-'), word('dup'), word('*'),

        // Calc square of y1 - y2
        word('y1'), word('y2'),
        word('-'), word('dup'), word('*'),

        // Sum and sqroot.
        word('+'),
        word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// Now you see that the entire program within `tests.distance` is a
// **constant** array, unlike what it was before when parts of the program
// depended on the arguments to the distance function. We can actually store
// this into disk and load it and use it at will.

// 
// ## Blocks
//
// We see a sequence occuring twice exactly as is -
//
// ```js
// let program = [
//         ...
//         word('-'), word('dup'), word('*'),
//         ...
//         word('-'), word('dup'), word('*')
//         ...
//    ];
// ```
// 
// Any time you see this specific sequence, you know that the top two 
// elements of the stack will be differenced and squared. In other words,
// this sequence behaves like the following function - a primitive, if
// we were to implement in javascript -
//
// ```js
// let diffsq = prim(function (env, stack) {
//     let x2 = pop(stack), x1 = pop(stack);
//     let dx = x1.v - x2.v;
//     push(stack, number(dx * dx));
// });
// ```
// 
// We could replace those three sequences with `diffsq` and nobody would notice
// anything different .. except maybe the processor which would have to do more
// work with our interpreter.
//
// It therefore seems pertinent to introduce a block of instructions as a
// type of thing we can store on the stack and assign to symbols in an
// environment, so we can reuse such blocks whenever we need them instead
// of having to copy paste the code like we've done here.

// We have to introduce a new value type called 'block' for this purpose,
// which holds a program to jump into part-way when the interpreter encounters
// it.  We also have to introduce a primitive for "performing" a block 
// encountered on a stack. We'll call this primitive `do`.

let block = function (program) { return {t: 'block', v: program}; };

stddefs(function (env) {
    define(env, 'do', prim(function (env, stack) {
        let program = pop(stack);

        // If we've been given a primitive, we call it directly.
        if (program.t === 'prim') {
            return program.v(env, stack);
        }

        console.assert(program.t === 'block');
        return run(env, program.v, 0, stack);
    }));
});

// We can now rewrite our distance function with some more abstraction.

tests.distance3 = function (stack) {
    let program = [
        // We define a "difference and square" subprogram
        block([word('-'), word('dup'), word('*')]), symbol('dsq'), word('def'),

        // We name our four arguments and consume them from the stack.
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        // Calc square of x1 - x2
        word('x1'), word('x2'), word('dsq'), word('do'),

        // Calc square of y1 - y2
        word('y1'), word('y2'), word('dsq'), word('do'),

        // Sum and sqroot.
        word('+'), word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// # Scoping and Control Structures
// **Date**: 28 Feb 2017

// What we had to do with `do` is still not quite satisfactory. We're now
// forced to distinguish between when a word is a primitive and when it is a
// "user-defined" block to be run using `do`. We don't really want this
// distinction.

// We'll define a separate primitive called `defun` which will behave just like
// def, but must be used with blocks so that referring to these "defined
// functions" does not require an explicit `do` to perform them.
//
// The disadvantage of `defun` folding the `do` operation is that we can 
// no longer treat the block as a value. The only thing we can do with a
// `defun`d block is to execute it.

stddefs(function (env) {
    define(env, 'defun', prim(function (env, stack) {
        let sym = pop(stack), program = pop(stack);
        console.assert(sym.t === 'symbol');
        console.assert(program.t === 'block');
        define(env, sym.v, prim(function (env, stack) {
            return run(env, program.v, 0, stack);
        }));
        return stack;
    }));
});

// With this `defun`, we can simplify the distance calculation program to -

tests.distance4 = function (stack) {
    let program = [
        // We define a "difference and square" subprogram
        block([word('-'), word('dup'), word('*')]), symbol('diffsq'), word('defun'),

        // We name our four arguments and consume them from the stack.
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        // Calc square of x1 - x2
        word('x1'), word('x2'), word('diffsq'),

        // Calc square of y1 - y2
        word('y1'), word('y2'), word('diffsq'),

        // Sum and sqroot.
        word('+'), word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// ## Control structures

// We now have a concept of blocks and we can use them to implement
// simple control structures like if-then-else and while. We're going
// to need some comparison operators to work with and we need a boolean
// type.

let bool = function (b) { return {t: 'bool', v: b}; };

// Languages differ in how they choose to define a boolean type
// based on what notion of "type" is implemented. In our case, we're
// treating a boolean like an enumeration where the `v:` part
// tells what the value actually is. Dynamic object-oriented languages
// may implement this idea by defining a separate 'true' type and
// a 'false' type.

stddefs(function (env) {
    define(env, 'true', bool(true));
    define(env, 'false', bool(false));
    
    define(env, '>', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v > y.v));
    }));

    define(env, '<', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v < y.v));
    }));

    define(env, '>=', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v >= y.v));
    }));

    define(env, '<=', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v <= y.v));
    }));

    define(env, '=', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v === y.v));
    }));

    define(env, '!=', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v !== y.v));
    }));
});

// We'll also need some binary combining operators for booleans.
stddefs(function (env) {
    define(env, 'and', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v && y.v));
    }));

    define(env, 'or', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v || y.v));
    }));

    define(env, 'not', prim(function (env, stack) {
        let x = pop(stack);
        return push(stack, bool(!x.v));
    }));

    define(env, 'either', prim(function (env, stack) {
        let y = pop(stack), x = pop(stack);
        return push(stack, bool(x.v ? !y.v : y.v));
    }));
});

// > **Question**: What would be some advantages/disadvantages of
// > defining the boolean combining operators in the above manner?
// > For example, in the expression "a and b", if the "a" part ends
// > up being false, then the "b" part doesn't even need to be
// > evaluated. This is called *short circuiting*. A similar behaviour
// > holds for the "or" and "either" operators too. Such short circuiting
// > prevents unnecesary computations from happening. How would you
// > re-design and re-implement these operators to have short
// > circuiting behaviour?

// We'll implement a generic branching mechanism that checks a set of
// conditions associated with actions and performs the first set of actions
// whose condition evaluates to a true value. This will be implemented using a
// `cond` primitive.  However, contrary to other primitives we've implemented
// thus far, this one will take a block argument with a specific structure - a
// sequence of condition/consequence pairs each of which is itself represented
// using a block.  The condition blocks are expected to produce a boolean on
// the stack which `branch` will examine to determine whether to execute the
// corresponding block or not. If none of the conditions were satisfied, no
// action is taken.
//
// Note that for this to work properly, the condition and conseuence blocks
// must themselves behave properly and leave the stack in the right state.

stddefs(function (env) {
    define(env, 'branch', prim(function (env, stack) {
        let cond_pairs = pop(stack);
        console.assert(cond_pairs.t === 'block');
        console.assert(cond_pairs.v.length % 2 === 0);
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
    }));
});

// ### Test branch

// Run this like `tests.branch([number(2), number(3)])`.
tests.branch = function (stack) {
    let program = [
        symbol('y'), word('def'),
        symbol('x'), word('def'),
        block([
            block([word('x'), word('y'), word('<')]),
            block([string("less than")]),

            block([word('x'), word('y'), word('>')]),
            block([string("greater than")]),

            block([word('true')]),
            block([string("equal")])
        ]),
        word('branch')
    ];

    return run(test_env(), program, 0, stack);
};


// > **Concept**: We've been writing programs simply using Javascript arrays
// > and plain objects. Our program is itself an array. With the newly introduced
// > "blocks", our data structure for representing programs just gained some
// > self referential characteristics. With the recent `branch`, programs are now
// > starting to look like trees with some amount of nesting of blocks. 
// > This data structure that we're using to represent our "programs" is an
// > example of **Abstract Syntax Trees** or **AST** for short.
// >
// > We've been writing ASTs all along! There is little else to it.


// ### Test fibonacci series

// Are we Fibonacci yet? Not quite .. 'cos we can't print anything yet :)
stddefs(function (env) {
    define(env, 'print', prim(function (env, stack) {
        console.log(pop(stack).v);
        return stack;
    }));
});

// Ok now let's try again.
tests.fibonacci = function (n) {
    let program = [
        // We define a 'fib' word that uses 3 values from the stack
        // i n1 n2
        // It prints n1, updates these values as (i-1) n2 (n1+n2)
        // and calls itself by name again, until i reaches 0.
        block([
            // Load up our three arguments.
            symbol('n2'), word('def'),
            symbol('n1'), word('def'),
            symbol('i'), word('def'),

            block([
                // The recursion breaking condition.
                block([word('i'), number(0), word('<=')]),
                block([]),

                block([bool(true)]),
                block([
                    word('n1'), word('print'),  

                    // Leave three values on the stack just like when we
                    // started. Then call ourselves again.
                    word('i'), number(1), word('-'),
                    word('n2'),
                    word('n1'), word('n2'), word('+'),

                    // Recursively invoke ourselves again.
                    word('fib')
                ])
            ]),
            word('branch')
        ]),
        symbol('fib'), word('defun'),

        // The number n is assumed to be available on the stack.
        number(0), number(1), word('fib')
    ];

    return run(test_env(), program, 0, [number(n)]);
};

// ## Detour: Argument binding

// It is kind of getting to be a tedious ritual to bind arguments
// passed on the stack into "variables" we can then refer to in
// our programs.
//
// ```js
// block([
//      symbol('n2'), word('def'),
//      symbol('n1'), word('def'),
//      symbol('i'), word('def'),
//      ...
// ])
// ```

// Let's simplify this using an argument binding primitive we'll call `args`.
// We'll make args take a block given on the stack with a special structure -
// the block must consist of a sequence of symbols. i.e. If you executed the
// block you'd get a bunch of symbols on the stack. We scan this block from
// the end to beginning, pop off matching elements from the stack and `def`
// them into our environment.
//
// This will now permit us to simplify that ritual above to the following -
// 
// ```js
// block([
//      block([word('i'), word('n1'), word('n2')]), word('args'),
//      ...
// ])
// ```

stddefs(function (env) {
    define(env, 'args', prim(function (env, stack) {
        let args = pop(stack);
        console.assert(args.t === 'block');
        for (let i = args.v.length - 1; i >= 0; --i) {
            console.assert(args.v[i].t === 'word');
            define(env, args.v[i].v, pop(stack));
        }
        return stack;
    }));
});

// Notice that our functions are now getting to be more self describing.
// If we use `args` in the opening part of all our functions by convention,
// the "code" of each function can be examined to tell how many arguments
// it needs from the stack - i.e. its arity. By then connecting these
// symbols to what the function does with them, we can infer a lot more
// about the function. For example, if `n1` and `n2` are the names of
// two arguments, and the function calculates `n1 n2 +` at some point,
// we know that these two must be numbers without executing the function.

// > **Question**: Can you relate this to main stream programming languages?

// ## Implementing `if`

// `branch` is general enough that we don't need any other conditional
// handling in our language. However, for one or two branches, all that
// nested blocks seems a bit too much. So just for convenience and minimalism,
// we can implement an `if` operator as well. `if` will pop two elements off
// the stack - a boolean and a block. It will execute the block like `do`
// if the boolean happened to be true. This way, you can chain a sequence
// of `if`s to get similar behaviour to `branch`.

stddefs(function (env) {
    define(env, 'if', prim(function (env, stack) {
        let blk = pop(stack), cond = pop(stack);
        console.assert(blk.t === 'block');
        console.assert(cond.t === 'bool');
        if (cond.v) {
            // Note that we're again making the choice that the 
            // if block will get evaluated in the enclosing scope
            // and won't have its own scope. If you want definitions
            // within `if` to stay within the `if` block, then you
            // can make new environment for the block to execute in.
            return run(env, blk.v, 0, stack);
        }
        return stack;
    }));
});

// We can now rewrite the fibonacci in terms of `if` like this -

tests.fobonacci_if = function (n) {
    let program = [
        // We define a 'fib' word that uses 3 values from the stack
        // i n1 n2
        // It prints n1, updates these values as (i-1) n2 (n1+n2)
        // and calls itself by name again, until i reaches 0.
        block([
            // Load up our three arguments.
            symbol('n2'), word('def'),
            symbol('n1'), word('def'),
            symbol('i'), word('def'),

            // The loop exit condition.
            word('i'), number(0), word('>'),
            block([
                word('n1'), word('print'),

                // Leave three values on the stack just like when we
                // started. Then call ourselves again.
                word('i'), number(1), word('-'),
                word('n2'),
                word('n1'), word('n2'), word('+'),

                // Recursively invoke ourselves again.
                word('fib')
            ]), word('if')
        ]),
        symbol('fib'), word('defun'),

        // The number n is assumed to be available on the stack.
        number(0), number(1), word('fib')
    ];

    return run(test_env(), program, 0, [number(n)]);
};

// ## Scope of variables

// It looks like we're comfortably using variables, binding them to
// values in our environment and even doing recursion with them.
// In other words, when we execute a block, its input not only consists
// of the stack contents, but also the bindings in the environment.
// This means a block can both access variables from the environment
// as well as clobber it!

// > **Question**: What are the consequenecs of this approach if we
// > adopted it for large scale software development? Do you know
// > if this approach is used anywhere currently?

// Here is a "weird" implementation of `fib` to prove the point.
// Try to trace what it does.
tests.fibonacci2 = function (n) {
    let program = [
        block([
            block([
                // The recursion breaking condition.
                block([word('i'), number(0), word('<=')]),
                block([]),

                block([bool(true)]),
                block([
                    word('n1'), word('print'),  

                    // Redefine the three variables we use for our iteration.
                    word('i'), number(1), word('-'),
                    symbol('i'), word('def'),
                    
                    word('n2'),
                    word('n1'), word('n2'), word('+'),
                    
                    symbol('n2'), word('def'),
                    symbol('n1'), word('def'),

                    // Recursively invoke ourselves again.
                    word('fib')
                ])
            ]),
            word('branch')
        ]),
        symbol('fib'), word('defun'),

        // Store number(n) available on the stack into 'i'.
        symbol('i'), word('def'),

        number(0), symbol('n1'), word('def'),
        number(1), symbol('n2'), word('def'),
        word('fib')
    ];

    return run(test_env(), program, 0, [number(n)]);
};

// The above implementation of `fib` clearly shows that all our so called
// "functions" are using and clobbering what are essentially "global variables".
// This is not a great idea for programming in the large. It means you'll need
// to reserve some names specially for use within functions as "temporary"
// variables so that functions don't assume that they have valid values.
// It also means you can now look at the internal state of a function after
// it has executed by examining the environment. You cannot also transfer the
// source code of a function between two programs, for fear that the other
// program may be using some names that your function relies on and might
// clobber, causing the other program to break.
//
// In short, we need our functions to **encapsulate** the computation they
// perform and communicate with the outside world only via the stack.

// ### Design choices

// When we want to implement such an encapsulation, we need to take a step
// back and think about the design choices we have at hand and the consequences
// of these designs. Indeed, different programming languages may make different
// choices at this point, ending up with varied behaviours. If we understand the
// choices at hand, then we'll likely be able to quickly construct mental models
// of execution of programs in a given language and be effective in exploiting
// the design.

// #### Option: Scoping by copy

// One basic choice at hand here is to lift the notion of "environment" from
// "set of variable bindings" to a "stack of set of variable bindings".  This
// way, when we enter a "scope" in which we wish that local changes don't
// affect the enclosing scope, we can simply make a **copy** of the current
// environment before entering the scope, push it on to this stack, and pop it
// back once the scope ends.
    
// An important consequence of this choice is that it will **not** be possible
// for a scope to influence another scope through variables.  We may want that
// in our language, we may not. It is not any inevitable law, but simply a
// choice we get to make at design time. With this approach, it is clear what
// should be done when a block "sets a variable to a value".
//    
// When accessing variables not `def`d within a scope (these are called "free
// variables"), this implementation will result in the block picking up values
// of free variables from the environment in which it is *executed*. Such free
// variables are said to be "dynamically scoped". This implementation limits
// dynamic scoping to permit reading such variables, but invoking `def` on them
// won't cause changes in the executing environment of a scope irrespective of
// where it is defined.
//    
// > **Term**: "Free variables" are variables in a block that 
// > are referred to in the code without being defined in it as local.
   
// #### Option: Scoping by live reference chain

// Instead of making a *copy*, we could turn the variable lookup process to
// walk a chain of environments. When looking up a variable, we'd check the
// head of the chain first. If it isn't found, we check its "parent", then the
// parent's parent and so on until we find a reference or declare the variable
// to not be found. This way, we could just push an empty environment at the
// end of the chain to limit the scope of variables used by a block or
// function.
//    
// This is a bit more efficient than the environment copy option. However, it
// influences the meaning of blocks and functions. With this implementation,
// the notion of "setting a variable" can have two meanings. One is to
// introduce the binding in the innermost scope where the variable may not
// exist at `def` time. Another is to figure out which scope in the chain has
// the variable defined and make the `def` operate on that scope's environment.
// With the first option, we get a behaviour similar to (1), but with the
// second option, blocks and functions get to modify their environments in a
// more controlled manner than through global variables.
//    
// Another consequence of this chain approach is how it lets us deal with
// blocks that are defined in one scope but are evaluated in another. We can
// inject a block into a different scope by manipulating the chain of
// environments. The story with free variables is different in this case.  A
// block that `def`s a free variable *can* modify the variable in the scope
// chain in which it is executed.

// #### Option: Scope stored on the stack

// Another implementation choice is to manage the scopes along with the data on
// the same stack. In this case, the "environment" will simply be an index into
// a stack at which we begin the lookup process. The above two implementation
// choices of copying bindings or linking them into a scope chain apply in this
// implementation too.
//    
// As of now, this implementation choice only implies some additional
// book-keeping on our part with no meaning difference with the other
// implementation. However, if we change the execution model (to asynchronous,
// for example), then this will impact the kinds of programs we can write and
// how they will behave.

// #### Option: Splitting away `set` from `def`

// With the three options above, we've pretended that we'll be using `def` to
// both *introduce* a new variable as well as to *set* an existing variable.
// This need not be the case. We're free to differentiate between the two
// operations, which leads to further bifurcation of implementation choices and
// consequences.

// #### Option: Accessing definition scope in execution scope

// When a block is defined, it may wish to refer to bindings in its
// *definition* scope and recall them in its *execution* scope.  Supporting
// this feature requires blocks to be created with the necessary bindings
// captured when they're pushed on to the stack.  Then at execution time, these
// bindings need to be injected into the environment chain so that the blocks
// have access to the definition scope as well as the execution scope.
//    
// We have a couple of options here too - where we preserve the definition
// environment between invocations and where we simply copy the bindings,
// thereby losing any modifications a block may do to is definition scope.
//    
// These two options determine whether a block can communicate with itself
// between two executions or not. If we preserve the definition environment by
// reference, then any `def`s executed will modify it and the changes will be
// visible to subsequent runs. If we copy the definition environment into the
// execution scope, then the modifications won't sustain.

// #### Our choice

// For the moment, we'll take and follow through on approach (2),
// with a basic implementation of (5) also thrown in.
// 
// This means free variables referenced in a function will be able to
// read variables available in their definition and execution environments,
// but won't be able to modify them.
// 
// We'll need to modify our notion of "environment" which now needs to be
// turned into a "stack of variable bindings" instead of "variable bindings".
// This means we need to change the definitions of `mk_env`, `lookup` and
// `define` to reflect this. While `lookup` will now scan the entire stack to
// find a value, `define` will modify it only in the inner-most environment.
// Each scope will maintain a reference to its "parent scope" in a special
// reserved key called "[[parent]]". Though we'll be doing this, we'll also
// maintain the parent relationship via a stack of environments as well
// for the moment.


let parent_scope_key = '[[parent]]';

mk_env = function () {
    return [{}]; // We return a stack of environments.
};

lookup = function (env, word) {
    for (let i = env.length - 1; i >= 0; --i) {
        let scope = env[i];
        while (scope) {
            let val = scope[word.v];
            if (val) { return val; }
            scope = scope[parent_scope_key];
        }
    }
    return undefined;
};

define = function (env, key, value) {
    env[env.length - 1][key] = value;
    return env;
};

// We also need new operations for entering and leaving a local environment.
// This local environment needs to have all the info available in its parent
// environment, so we copy the contents of the parent into the local environment
// at creation time. With this, when we leave a local environment, any 
// bindings effected by `define` will be lost.

let enter = function (env) {
    let localEnv = {};
    localEnv[parent_scope_key] = current_bindings(env);
    env.push(localEnv);
    return env;
};

let leave = function (env) {
    env.pop();
    return env;
};

let current_bindings = function (env) {
    return env[env.length - 1];
};

let copy_bindings = function (src, dest) {
    for (let key in src) {
        dest[key] = src[key];
    }
    return dest;
};

// This change affects how the `do` and `defun` words function as well. We
// don't want to change how `branch` behaves just yet.

// Before we get to any of that though, we must modify `run` to handle creation
// of blocks. When a block is about to be pushed on to the stack, a copy of its
// definition environment must be made and stored along with the block. When
// `do` and `defun` evaluate blocks, they will restore this definition
// environment copy and then execute it.

run = function (env, program, pc, stack) {
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
                stack = apply(env, instr, stack);
                break;

            // Special case for block definition. We capture the
            // definition environment and store it along with the
            // block structure on the stack. There is a subtlety
            // here - we're making a new block value instead of
            // reusing the block value in the program directly by
            // reference. This is necessary because the same block
            // may end up being defined multiple times with different
            // sets of bindings from its environment.
            //
            // One subtlety is that copying the bindings at this point
            // as opposed to referencing the current bindings have
            // different effects on program behaviour. When copying,
            // further alterations to the parent environment will not
            // be available to the block's environment. If we reference
            // instead, then we can not only save copy time, but also
            // use the environment sharing as a way to communicate
            // between blocks in the same environment. Briefly, forward
            // references to definitions won't work within a block.
            //
            // We'll choose the stricter form and do copying for now.
            // Later we'll relax this constraint.
            //
            // We've implemented a "closure"!
            //
            // > **Question**: Comment on the efficiency of doing this
            // > as opposed to copying everything as might've happened
            // > had we used approach (1).
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

    return stack;
};

// `do` and `defun` need to be redefined to 
// support the block-level bindings we wish to incorporate.
// But just so we don't repeat ourselves again, we'll
// pull out the common functionality in `do` into a function
// we can customize later.
let do_block = function (env, stack, block) {
    // This is the crucial bit. We enter a local environment
    // when evaluating the block and leave it once the 
    // evaluation is complete. Notice that `copy_bindings`
    // will copy all the bindings including the reference to
    // the parent. This means that the block will not have 
    // access to bindings visible from the execution environment.
    // So if a block makes a reference to a "free" variable 
    // named 'x', then the meaning of 'x' will always be either
    // in the context of where the block was created, or local
    // to the block.
    //
    // > **Question**: What consequence does this choice have
    // > on program behaviour? Consider program predictability,
    // > debuggability, etc. You'll need to check this from both
    // > perspectives - i.e. what happens when we include the
    // > execution environment's bindings as well as what happens
    // > when we exclude them.

    enter(env);
    copy_bindings(block.bindings, current_bindings(env));
    stack = run(env, block.v, 0, stack);
    leave(env);
    return stack;
};

stddefs(function (env) {
    define(env, 'do', prim(function (env, stack) {
        let block = pop(stack);

        // If we've been given a primitive, we call it directly.
        if (block.t === 'prim') {
            return block.v(env, stack);
        }

        console.assert(block.t === 'block');
        return do_block(env, stack, block);
    }));

    define(env, 'defun', prim(function (env, stack) {
        let sym = pop(stack), block = pop(stack);
        console.assert(sym.t === 'symbol');
        if (block.t === 'prim') {
            define(env, sym.v, block);
        } else {
            console.assert(block.t === 'block');
            define(env, sym.v, prim(function (env, stack) {
                return do_block(env, stack, block);
            }));
        }
        return stack;
    }));
});

// With the above re-definitions for local environments, 
// we'll find that `tests.fibonacci2` no longer works,
// but `tests.fibonacci` does work.

tests.fibonacci2 = function (stack) {
    console.error("tests.fibonacci2 will work only before the support for local scope was added.\n" +
                  "tests.fibonacci will continue to work though.");
    return stack;
};

