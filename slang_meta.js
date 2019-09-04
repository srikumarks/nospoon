// # Reflection and meta programming
// **Date**: 4 September 2019

// Requires slang.js
"use strict";

// Thus far, we can write programs using "words" that perform some operations on
// values on a stack. We can't yet write programs that can look at programs and
// construct other programs from data. For that meta capability, we need to
// implement a few features that generally go by the term "reflection" - as in
// the program's ability to look at itself.

// To begin with, we need some low level things that can produce values that
// make up programs - numbers, strings, symbols, words and blocks.
stddefs(function (env) {
    // format will take the top element on the stack, turn it into a
    // string value and push the string on the stack.
    define(env, 'format', prim(function (env, stack) {
        let val = pop(stack);
        return push(stack, string(val.v.toString()));
    }));

    // concat will concatenate the top two strings.
    define(env, 'concat', prim(function (env, stack) {
        let second = pop(stack), first = pop(stack);
        console.assert(first.t === 'string' && second.t === 'string');
        return push(stack, string(first.v + second.v));
    }));

    // symbol will turn the top-of-stack string value into a symbol.
    define(env, 'symbol', prim(function (env, stack) {
        let val = pop(stack);
        console.assert(val.t === 'string');
        return push(stack, symbol(val.v));
    }));

    // word will turn the top-of-stack string or symbol value into a word
    // and leave the word on the stack. The word won't be looked up for
    // its value.
    define(env, 'word', prim(function (env, stack) {
        let val = pop(stack);
        console.assert(val.t === 'string' || val.t === 'symbol');
        return push(stack, word(val.v));
    }));

    // We'll also want to lookup the block definition of a word
    // on the stack.
    define(env, 'lookup', prim(function (env, stack) {
        let w = pop(stack);
        console.assert(w.t === 'word' || w.t === 'symbol' || w.t === 'string');
        let v = lookup(env, word(w.v));
        let b = (v.t === 'prim' ? v.block : v);
        return push(stack, b);
    }));

    // We'll also need to be able to inspect the type of an item.
    // This doesn't consume the value from the stack, but just places
    // its type on the stack additionally. Note that this implementation
    // is non-ideal since it couples the internal identifiers used for
    // the types into the API for the programmer.
    define(env, 'typeof', prim(function (env, stack) {
        let val = topi(stack, 0);
        return push(stack, string(val.t));
    }));

    // Swaps the top two elements of the stack. Useful near the
    // start of a block.
    define(env, 'swap', prim(function (env, stack) {
        let second = pop(stack), first = pop(stack);
        push(stack, first);
        return push(stack, second);
    }));

    // In the same vein, peeking deeper into the stack is also useful.
    define(env, 'peek', prim(function (env, stack) {
        let n = pop(stack);
        console.assert(n.t === 'number');
        console.assert(n.v >= 0 && n.v < depth(stack));
        return push(stack, topi(stack, n.v));
    }));

    // Making a block is slightly more complex, but we'll adopt a simple
    // strategy that gets us going - we'll mark the block boundaries with
    // a symbol on the stack and ask the block making function to collect
    // all the values on the stack upto the symbol and turn it into a block.
    define(env, 'block', prim(function (env, stack) {
        let delimiter = pop(stack);
        console.assert(val.t === 'symbol');

        // We do something that looks nice in code - we match
        // brackets so that we can do nice delimiters like
        //  :{ .... :} block
        // or even
        //  :(mycode   :mycode) block
        let beginning = delimiter.v;
        switch (delimiter.v[delimiter.v.length - 1]) {
            case ')': beginning = '(' + delimiter.v.substring(0, delimiter.v.length - 1); break;
            case ']': beginning = '[' + delimiter.v.substring(0, delimiter.v.length - 1); break;
            case '}': beginning = '{' + delimiter.v.substring(0, delimiter.v.length - 1); break;
        }

        let terms = [];
        do {
            let term = pop(stack);
            if (term.t === 'symbol' && term.v === beginning) {
                // We've reached the beginning of the block.
                break;
            }
            terms.unshift(term);
        } while (stack.length > 0);

        // Note that the block will also implicitly end when we reach
        // the stack's bottom.
        return push(stack, block(terms));
    }));

    // We'll also include a more literal "make a block with the top N elements".
    define(env, 'blockn', prim(function (env, stack) {
        let n = pop(stack), b = pop(stack);
        console.assert(n.t === 'number');
        console.assert(b.t === 'block');
        console.assert(n.v >= 0 && n.v < depth(stack));
        let items = [];
        for (let i = 0; i < n.v; ++i) {
            items.unshift(pop(stack));
        }
        return push(stack, block(items));
    }));

    // Likewise, it is useful to have the inverse operation of turning a block
    // into a sequence of values on the stack. Note that deblock does not
    // introduce a delimiter automatically on the stack. This is deliberate since
    // we may want to add stuff ahead or later.
    define(env, 'deblock', prim(function (env, stack) {
        let b = pop(stack);
        console.assert(b.t === 'block');
        for (let i = 0; i < b.v.length; ++i) {
            push(stack, b.v[i]);
        }
        return stack;
    }));
});

// With the above defined words 'symbol', 'word' and 'block', we have
// enough of a mechanism to programmatically create functions. As an 
// example, lets create a defining function that will modify the definition
// of a given word that's supposed to be a two-argument function, to 
// working on the arguments swapped.

tests.redef = function () {
    let program = parse_slang(`
        [ [w] args
          :{
            :swap word
            w lookup deblock
          :}
          block w defun
        ] :swapped defun

        [-] :minus defun
        2 3 minus print
        :minus swapped
        2 3 minus print
    `);

    return run(test_env(), program, 0, []);
};