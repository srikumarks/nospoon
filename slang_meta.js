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
    // Strings are a common intermediate representation for communicating
    // with humans. They're often needed in metaprogramming either in the
    // form of symbols or for their concatenative properties. So a word
    // to turn values into strings is broadly useful.
    //
    // `format` will take the top element on the stack, turn it into a
    // string value and push the string on the stack.
    define(env, 'format', prim(function (env, stack) {
        let val = pop(stack);
        return push(stack, string(val.v.toString()));
    }));

    // `concat` is for concatenating the top two strings on the stack.
    // You can repeatedly apply concat to concat multiple strings.
    define(env, 'concat', prim(function (env, stack) {
        let second = pop(stack), first = pop(stack);
        console.assert(first.t === 'string' && second.t === 'string');
        return push(stack, string(first.v + second.v));
    }));

    // Going the other way given a string is needed in cases where
    // we're constructing new words with derived structural properties
    // like namespace prefixes or package names, for example. To do
    // that, we need the ability to take a string and turn it into
    // a symbol that can be used for logical purposes.
    //
    // `symbol` will turn the top-of-stack string value into a symbol.
    define(env, 'symbol', prim(function (env, stack) {
        let val = pop(stack);
        console.assert(val.t === 'string');
        return push(stack, symbol(val.v));
    }));

    // Our definition of a "word" is something that is interpreted as a
    // an operation on the stack. We've defined primitive words and also
    // introduced `define` as a means to add new words to the program's
    // vocabulary. However, a program thus far cannot really store a
    // word on the stack because the interpreter will immediately execute
    // the program it refers to instead of pushing the word on the stack.
    // 
    // The purpose of `word` is to take the symbol or string on the top of
    // the stack, make a word of it, and store it on the stack. That way,
    // further operators can actually work on the word. In particular, we
    // need this facility to put together a bunch of words into a
    // programmatically constructed block.
    define(env, 'word', prim(function (env, stack) {
        let val = pop(stack);
        console.assert(val.t === 'string' || val.t === 'symbol');
        return push(stack, word(val.v));
    }));

    // With the ability to store raw words on the stack, we can now
    // expose what we've had as an internal facility - the ability to
    // lookup the meaning of a word from the environment.
    //
    // `lookup` takes the top word from the stack, finds out the block
    // or value it refers to and pushes it on the stack. The effect of 
    // this is that you can use `word lookup` as a phrase to lookup the
    // definition of a symbol.
    define(env, 'lookup', prim(function (env, stack) {
        let w = pop(stack);
        console.assert(w.t === 'word' || w.t === 'symbol' || w.t === 'string');
        let v = lookup(env, word(w.v));
        let b = (v.t === 'prim' ? v.block : v);
        return push(stack, b);
    }));

    // The process of reflection isn't really complete without the ability
    // to tell, at runtime, the type of a thing we're examining. 
    //
    // So the `typeof` word examines the top of stack and pushes a string
    // describing its type.
    //
    // This doesn't consume the value from the stack, but just places
    // its type on the stack additionally. Note that this implementation
    // is non-ideal since it couples the internal identifiers used for
    // the types into the API for the programmer.
    define(env, 'typeof', prim(function (env, stack) {
        let val = topi(stack, 0);
        return push(stack, string(val.t));
    }));

    // We'll need to do some stack manipulation for meta programming and it is
    // useful to expand our minimal set of stack manipulation operators (we've so
    // far as `dup` and `drop`) with `swap` and `peek`.
    //
    // `swap` exchanges the top two stack items.
    define(env, 'swap', prim(function (env, stack) {
        let second = pop(stack), first = pop(stack);
        push(stack, second);
        return push(stack, first);
    }));

    // `over` is like dup, but duplicates the next-to-top item
    // on the stack.
    define(env, 'over', prim(function (env, stack) {
        let e0 = pop(stack), e1 = pop(stack);
        push(stack, e1);
        push(stack, e0);
        return push(stack, e1);
    }));

    // `n rot` will pull n-deep item on the stack on top and
    // shift the rest down.
    define(env, 'rot', prim(function (env, stack) {
        let n = pop(stack);
        console.assert(n.t === 'number');
        console.assert(n.v >= 0 && n.v < depth(stack));
        let val = topi(stack, n.v);
        stack.splice(depth(stack) - n.v - 1, 1);
        return push(stack, val);
    }));

    // Thus far, we've only been able to make a block directly in the
    // programs code sequence. Our programs have themselves not been able
    // to create blocks with specific code content, which is the point
    // of meta programming facilities. So we need to introduce a `block`
    // operator that takes "data" from the stack and turns it into a block.
    //
    // There are many design options for such a block. We'll choose a
    // simple one where the contents of the block are delimited on the
    // stack by a pair of symbols, so we can write :{ ... :} block to
    // turn the preceding sequence of items placed on the stack into
    // a block. 
    //
    // The main point to note is that whatever occurs between the symbols
    // :{ and :} are all **evaluated**, unlike the case of [ ... ] where
    // the items are just **collected** and made into a block and the block
    // is pushed on to the stack. So [ ... ] is a "literal" block.
    const matching_delimiter = { ')' : '(', ']' : '[', '}' : '{' };

    define(env, 'block', prim(function (env, stack) {
        let delimiter = pop(stack);
        console.assert(delimiter.t === 'symbol');

        let beginning = matching_delimiter[delimiter.v];
        if (!beginning) { beginning = delimiter.v; }

        let terms = [];
        do {
            let term = pop(stack);
            if (term.t === 'symbol' && term.v === beginning) {
                /* We've reached the beginning of the block. */
                break;
            }
            terms.unshift(term);
        } while (stack.length > 0);

        // Note that the block will also implicitly end when we reach
        // the stack's bottom.
        return push(stack, block(terms));
    }));

    // While the delimiter based block calculation is handy, it is also useful
    // to be able to make small blocks without resorting to delimiters, especially
    // if we want to be able to calculate with stack contents without the delimiter
    // standing in the way. For this, we add a `n blockn` that collects the top N
    // elements from the stack and puts them into a block.
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

    // Ok we can make blocks, but how do we get to examine their contents?
    // One way is to make a reflection `vocab` for blocks, which is a good
    // idea. Here, we'll add something a bit more mundane - `deblock` will
    // explode the entities in the block on to the stack. It won't place
    // any delimiters ... and that's for good reason. You may want to
    // combine a block's contents with other content as well and delimiters
    // may stand in the way.
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
          block w
        ] :swapped defun

        [-] :minus defun
        "before" print
        2 3 minus print
        :minus swapped defun
        "after" print
        2 3 minus print
    `);

    return run(test_env(), program, 0, []);
};

