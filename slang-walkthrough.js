// # Building slang

// ------------------------

// Towards understanding system design through programming.

// - https://gitlab.pramati.com/nospoon/talks
// - https://no-spoon-imaginea.slack.com

// ------------------------

// Base language = Javascript ES6 subset
"use strict";

// ## Application area 

// A drawing/animation tool that works within web browsers.
// ... and more as we go on.

// ## Approach

// Normally ...
//
// - Learn syntax
// - Learn semantics
// - Build mental model
// - Profit
// - Go back to step 1

// ------------------

// Our approach ...
//
// - Start with a mental model
//   - Profit.
// - Build semantics incrementally in a "bottom up" way,
//   understanding the choices at hand.
//   - Profit.
// - Go back to step 1
// - Slap on a syntax
//   - Profit.
// - Go back to step 1


// ## The mental model

// - **Program**: A *sequence* of instructions to our interpreter.
// - **Environment**: The *context* in which instructions will be interpreted.
// - **Stack**: The *data* our programs will work with.

// ## Values

// Basic value types needed for drawing.

let number = function (v)  { return {t: 'number', v: v};  },
    string = function (v)  { return {t: 'string', v: v};  },
    word   = function (v)  { return {t: 'word',   v: v};  },
    prim   = function (fn) { return {t: 'prim',   v: fn}; };

// ## The interpreter

// As the Red Queen said to the White Rabbit in Alice in Wonderland - "Start at
// the beginning, go on until you reach the end, then stop."

// ------------------------

let run = function (env, program, pc, stack) {
    for (; pc < program.length; ++pc) {
        let instr = program[pc];
        
        if (instr.t === 'word') {
            instr = lookup(env, instr);
        }

        switch (instr.t) {
            case 'prim':
                stack = apply(instr, stack);
                break;
                
            default:
                push(stack, instr);
                break;
        }
    }

    return stack;
};

// ## The environment

let mk_env = function () {
    return {}; // For key-value associations.
};

let lookup = function (env, word) {
    return env[word.v];
};

let define = function (env, key, value) {
    env[key] = value;
    return env;
};

// ---------------------------

// "Primitive" operations are expressed in the base language.
let apply = function (prim, stack) {
    return prim.v(stack);
};

// > Question: What limitations does this definition impose on
// > what a primitive function can do?

// ----------------------------

// Abstract the stack operations

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

// ------------------------------

// A few more convenience ones.

let topi = function (stack, i) {
    return stack[stack.length - 1 - i];
};

let depth = function (stack) {
    return stack.length;
};

// ----------------------------

// ### Testing our mini language

// We'll hold all our tests in a single hash table mapping the test
// name to the test function to be called.
let tests = {};

// --------------------------------

// Add 1 and 2 and see that the result is 3.
tests.smoke = function () {
    let env = load_stdlib(mk_env());
    
    let program = [
        number(1),      // Push 1 on to the stack
        number(2),      // Push 2 on to the stack
        word('+')       // Apply '+' operation on top two elements.
    ];

    return run(env, program, 0, []);
};

// --------------------------------

// ### Displaying the stack for debugging

let show = function (stack, n) {
    n = Math.min(n || 20, depth(stack)); // Default to 20 elements.

    for (let i = 0; i < n; ++i) {
        show_item(topi(stack, i));
    }
};

// ---------------------------------

let show_item = function (item) {
    switch (item.t) {
        case 'string':
            return console.log('string(' + JSON.stringify(item.v) + ')');
        default:
            return console.log(item.t + '(' + item.v + ')');
    }
};


// ----------------------------------

// ## Standard library

// Basic arithmetic operators for starters.
let load_stdlib = function (env) {
    
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

// ----------------------------------------

// ### Test distance calculation

// To calculate the distance between two points on a 2D plane,
// we need a new primitive - the square root function.

// --------------------

// A utility to add new definitions to stdlib.
let stddefs = function (new_defns) {
    load_stdlib = (function (load_first) {
        return function (env) {
            return new_defns(load_first(env)) || env;
        };
    }(load_stdlib));
};

// ----------------------

// Augment our "standard library".
stddefs(function (env) {
    define(env, 'dup', prim(function (env, stack) {
        return push(stack, topitem(stack));
    }));

    define(env, 'drop', prim(function (env, stack) {
        pop(stack);
        return stack;
    }));

    define(env, 'sqrt', prim(function (env, stack) {
        return push(stack, number(Math.sqrt(pop(stack).v)));
    }));
});

// -----------------------

// We always want the standard library for tests, so simplify it
// with a function.
let test_env = function () {
    return load_stdlib(mk_env());
};

// ------------------------

// ... and finally!
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

// -------------------------

// # Developing abstractions

// - We need to identify things by name
// - We need to be able to reuse things ... using these named references.

// - Not the *only* way.

// --------------------

// A `symbol` means itself.
let symbol = function (name) {
    return {t: 'symbol', v: name};
};

// --------------------

// `def` associates a symbol with a value.
stddefs(function (env) {
    define(env, 'def', prim(function (env, stack) {
        let sym = pop(stack), val = pop(stack);
        console.assert(sym.t === 'symbol');
        define(env, sym.v, val);
        return stack;
    }));
});

// ----------------------

// A new distance calculator

tests.distance2 = function (stack) {
    let program = [
        /* Name and consume 4 arguments from stack. */
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        /* Calc square of x1 - x2 */
        word('x1'), word('x2'),
        word('-'), word('dup'), word('*'),

        /* Calc square of y1 - y2 */
        word('y1'), word('y2'),
        word('-'), word('dup'), word('*'),

        /* Sum and sqroot. */
        word('+'),
        word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// -----------------------------

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

// ---------------------

// Equivalent primitive
//
// ```js
// let diffsq = prim(function (env, stack) {
//     let x2 = pop(stack), x1 = pop(stack);
//     let dx = x1.v - x2.v;
//     push(stack, number(dx * dx));
// });
// ```
// 

// -----------------------

// New value type `block` and word `do` to "run" a block.

let block = function (program) {
    return {t: 'block', v: program};
};

stddefs(function (env) {
    define(env, 'do', prim(function (env, stack) {
        let program = pop(stack);
        console.assert(program.t === 'block');
        return run(env, program.v, 0, stack);
    }));
});

// -----------------------------

// Our distance function with some more abstraction.

tests.distance3 = function (stack) {
    let program = [
        /* We define a "difference and square" subprogram */
        block([word('-'), word('dup'), word('*')]), symbol('dsq'), word('def'),

        /* Name and consume 4 arguments from stack. */
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        /* Calc square of x1 - x2 */
        word('x1'), word('x2'), word('dsq'), word('do'),

        /* Calc square of y1 - y2 */
        word('y1'), word('y2'), word('dsq'), word('do'),

        /* Sum and sqroot. */
        word('+'), word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// --------------------

// Distinguish between primitives and our abstractions?

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

// --------------------

// With this `defun`, we can simplify the distance calculation program to -

tests.distance4 = function (stack) {
    let program = [
        /* We define a "difference and square" subprogram */
        block([word('-'), word('dup'), word('*')]), symbol('dsq'), word('defun'),

        /* Name and consume 4 arguments from stack. */
        symbol('y2'), word('def'),
        symbol('x2'), word('def'),
        symbol('y1'), word('def'),
        symbol('x1'), word('def'),

        /* Calc square of x1 - x2 */
        word('x1'), word('x2'), word('dsq'),

        /* Calc square of y1 - y2 */
        word('y1'), word('y2'), word('dsq'),

        /* Sum and sqroot. */
        word('+'), word('sqrt')
    ];

    return run(test_env(), program, 0, stack);
};

// --------------------

// ## Control structures

// We need a boolean type for if-then-else.
let bool = function (b) {
    return {t: 'bool', v: b}; 
};

// ------------------------

// Usual comparison operators

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

// ------------------------

// Code structure
// 
// `[cond1 branch1 cond2 branch2 ...] cond`

// ------------------------

// Generic `cond` for branching ..

stddefs(function (env) {
    define(env, 'cond', prim(function (env, stack) {
        let cond_pairs = pop(stack);
        console.assert(cond_pairs.t === 'block');
        console.assert(cond_pairs.v.length % 2 === 0);
        for (let i = 0; i < cond_pairs.v.length; i += 2) {
            console.assert(cond_pairs.v[i].t === 'block');
            console.assert(cond_pairs.v[i+1].t === 'block');
            /* Check the condition. */
            stack = run(env, cond_pairs.v[i].v, 0, stack);
            let b = pop(stack);
            console.assert(b.t === 'bool');
            if (b.v) {
                /* Condition satisfied. Now evaluate the
                   "consequence" block corresponding to that condition. */
                return run(env, cond_pairs.v[i+1].v, 0, stack);
            }
        }
        return stack;
    }));
});

// ------------------------

// ### Test cond

// Run this like `tests.cond([number(2), number(3)])`.
tests.cond = function (stack) {
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
        word('cond')
    ];

    return run(test_env(), program, 0, stack);
};

// ------------------------

// **Concept**: Abstract Syntax Trees


// ------------------------

// ### Test fibonacci series

// Are we Fibonacci yet? Not quite .. 'cos we can't print anything yet :)
stddefs(function (env) {
    define(env, 'print', prim(function (env, stack) {
        console.log(pop(stack).v);
        return stack;
    }));
});

// ------------------------

tests.fibonacci = function (n) {
    let program = [
        /* We define a 'fib' word that uses 3 values from the stack
         * i n1 n2
         * It prints n1, updates these values as (i-1) n2 (n1+n2)
         * and calls itself by name again, until i reaches 0. */
        block([
            /* Load up our three arguments. */
            symbol('n2'), word('def'),
            symbol('n1'), word('def'),
            symbol('i'), word('def'),

            block([
                /* The recursion breaking condition. */
                block([word('i'), number(0), word('<=')]),
                block([]),

                block([bool(true)]),
                block([
                    word('n1'), word('print'),  

                    /* Leave three values on the stack just like when we
                     * started. Then call ourselves again. */
                    word('i'), number(1), word('-'),
                    word('n2'),
                    word('n1'), word('n2'), word('+'),

                    /* Recursively invoke ourselves again. */
                    word('fib')
                ])
            ]),
            word('cond')
        ]),
        symbol('fib'), word('defun'),

        /* The number n is assumed to be available on the stack. */
        number(0), number(1), word('fib')
    ];

    return run(test_env(), program, 0, [number(n)]);
};



