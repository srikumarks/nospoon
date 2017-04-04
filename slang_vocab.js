// # Vocabularies
// **Date**: 15 March 2017

// Requires slang.js
"use strict";

// We've thus far done the traditional stuff with scopes. In most languages,
// your power stops pretty much there .. unless you're using something from
// the LisP family. We'll do something slightly unusual to demonstrate what
// having control over this process can let us do. 
//
// So far, we can define "words" to mean whatever we want them to mean
// and we can do that in a local environment without affecting the surrounding
// environment. This ability lets us reason about blocks in isolation without
// worry about how its execution environment is going to influence the
// behaviour of the block.
//
// One of the most powerful things a language can provide you is to make
// whatever facilities it provides in what is called a "reified" or "first class"
// manner. If we can have local variables, what if we can introduce a type
// using which we can capture the local variables introduced by a block and
// use it wherever we want later on even without the block? In other words,
// what if we could define and use environments *within* our little language?
//
// We can call this a "vocabulary", since we're interested in meanings assigned
// to a set of words. For example, we can use a block to define a set of
// functions that will work with 2D points as xy coordinates pushed on to the
// stack. We can store away these definitions in a vocabulary and call on them
// only when we need them. We introduce a new type called `vocab` for this
// purpose.
//
// ```
// block([...]), word('vocab')
// ```
//
// When the `vocab` word is interpreted, we'll get an object on the stack
// that captures all the bindings that were created within the scope of
// the block, in addition to evaluating the block just like `do` would.

let vocab = function (bindings) { return {t: 'vocab', v: bindings}; };

// We re-define test_env so that the stdlib becomes a common entity instead
// of being copied over and over.
test_env = function () {
    return enter(load_stdlib(mk_env()));
};

// When we're introducing such a "reification" in our system, it is also useful
// to think about what is called the "dual" operation. In our case, `vocab`
// captures a set of bindings made within a block and pulls it into an object
// accessible to our programs. The "dual" or "inverse" of this operation would
// be to take such an object and re-introduce the bindings that it captured
// into an environment. After such a step, the vocabulary's bindings would be
// available like normal within the current block.
//
// We could call this inverse operation `use` because it offer a way to "use"
// the words that a vocabulary defines.
//
// > **Question**: Can you think of other such "reification-dual" pairs in
// > languages that you know?
//
// Whenever we have this kind of matched pair - an operation and its inverse
// where the operation is a communication between two different layers of a
// system, we open ourselves to powerful composition possibilities. In our
// case, for example, we can capture two or more vocabularies, `use` them
// within a block in order to make a composite vocabulary consisting of all the
// words in those vocabularies. This gives us an "algebra of vocabularies".
// We'll see later how we can put this algebra to good use.
//
// What are other such pairs? In Java, for example, the reflection API lifts
// what is normally accessible only to the JVM - the notion of classes,
// methods, properties, etc. - into the Java language, permitting programmers
// to invoke methods and introspect objects without prior knowledge about their
// classes or properties. One "inverse" of this lifting is a way to take some
// data produced by a Java program and reintroduce it to the JVM as a class.
// This is nothing but the "class loader" mechanism. Many frameworks in Java
// exploit class loaders to make programming certain kinds of systems simple.
//
// > **Question**: If you consider the concept of an "iterator" or "enumerator"
// > in languages like C++, Java and C#, what would be the "dual concept"
// > of an iterator?

tests.vocab = function () {
    let program = [
        block([
            block([
                block([word('x1'), word('y1'), word('x2'), word('y2')]), word('args'),
                word('x1'), word('x2'), word('-'),
                word('y1'), word('y2'), word('-'),
                word('length')
            ]), symbol('distance'), word('defun'),

            block([
                block([word('dx'), word('dy')]), word('args'),
                word('dx'), word('dy'), word('dx'), word('dy'), word('dot'),
                word('sqrt')
            ]), symbol('length'), word('defun'),
            
            block([
                block([word('x1'), word('y1'), word('x2'), word('y2')]), word('args'),
                word('x1'), word('x2'), word('*'),
                word('y1'), word('y2'), word('*'),
                word('+')
            ]), symbol('dot'), word('defun')
        ]), word('vocab'), symbol('point'), word('def'),

        block([
            word('point'), word('use'),
            number(2), number(3), number(5), number(7), word('distance')
        ]), word('do')
    ];

    return run(test_env(), program, 0, []);
};

// Now for the definitions of `vocab` and `use`.
stddefs(function (env) {
    // `vocab` needs to run the block on the stack just like
    // `do` does, except that before the local environment of the
    // block is thrown away, it is captured into a separate `bindings`
    // hash and stored away as part of the vocabulary.
    define(env, 'vocab', prim(function (env, stack) {
        let defs = pop(stack);
        console.assert(defs.t === 'block');

        // Execute the block and capture its definitions before
        // we leave it.
        enter(env);
        stack = run(env, defs.v, 0, stack);
        let bindings = copy_bindings(current_bindings(env), {});
        leave(env);

        // We don't want to preserve the scope chain in this case, so
        // delete the parent scope entry.
        delete bindings[parent_scope_key];

        return push(stack, vocab(bindings));
    }));

    // The way we're implementing `use`, the vocabulary is
    // "immutable" - i.e. you cannot change the bindings
    // in a vocabulary in a block that "uses" a vocabulary.
    // Once the block in which the `use` operation occurs
    // finishes, the introduced bindings will no longer be
    // in effect. So the effect of `use` is said to be 
    // "locally scoped", just like `def` and `defun`.
    define(env, 'use', prim(function (env, stack) {
        let vocab = pop(stack);
        console.assert(vocab.t === 'vocab');

        copy_bindings(vocab.v, current_bindings(env));
        return stack;
    }));
});

// > **Concept**: Such a "vocabulary" is equivalent to "modules" or "packages" in
// > many languages. However, many languages don't let modules be "first class"
// > in that they cannot be passed around. Javascript is a language which permits
// > you to pass around modules defined in a certain way. Languages like C++
// > ("modules" = "namespaces") and Java ("modules" = "pakages") don't. You could
// > consider "classes" to be modules in a twisted sense, but the notion of a
// > class has additional machinery that doesn't befit the notion of a
// > vocabulary.


// > **Question**: How would you implement a "mutable" vocabulary in *slang*?

// ## The structure of vocabularies

// While it looks like we've introduced the "vocabulary" concept to illustrate
// that we can now play with scope in our language, we've already done what would
// be considered to be "fantastic" features in some programming languages.
//
// 1. Our vocabularies are "first class".
// 2. Our vocabularies can be combined to make new vocabularies.
// 3. Our vocabularies can be parameterized.
//
// We already talked about (1). What is worth pointing out though is that we can
// pass vocabularies to functions/blocks to customize their behaviour by injecting
// values into the function scope.
//
// (2) is simply the fact that invoking the `use` word introduces a vocabulary into
// the current scope. This means we can invoke more than one vocabulary and have them
// all combine in the order of invocation. If this were itself within a block, then
// we can use that block to define a new vocabulary, like this -
//
// ```
// block([word('a'), word('use'), word('b'), word('use')]), word('vocab')
// ```
//
// This gives us a kind of "inheritance" like the way object oriented languages
// combine classes to form new ones. 
// 
// (3) is a consequence of the way we chose to define our vocabularies - by 
// evaluating blocks. This means we can formulate a vocabulary that uses
// values on the stack to customize what gets defined. Our vocabularies don't
// even need to have names because they can be passed around by value. Parameterized
// modules are a powerful feature of the language [OCaml].
//
// [OCaml]: https://ocaml.org/
//
// > **Golden rule**: Whenever you come up with an aspect of your
// > system which has this characteristic, you know you have 
// > something powerful on your hands. The characteristic is that
// > you have some operation using which you an combine two or
// > more entities of a type to form a new entity of the same type.


