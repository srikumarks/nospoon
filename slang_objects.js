
// # Object Oriented Programming

// Requires slang.js and slang_vocab.js
"use strict";

// ## The essence of objects

// We're going to *implement* an object oriented system in our language
// using the "vocabulary" mechanism we've just invented. To do this,
// we need to conceptualize what an object oriented system is. If we're
// to go by Alan Kay's expression of the essence of object orientation
// as "messaging" between encapsulated computational processes, we need
// to be able to express such a "message" in our system.
//
// For starters, we don't really need a separate type for messages.
// We can use our good old symbols.

let message = symbol;

// We also need a type for objects which can have a vocabulary to act
// on them and have properties to which we associate values.
// We make a simple generalization here as well - we'll treat any
// type which has a 'vocab' field whose value is a `vocab()` type
// as though it were an object to which we can send "messages".

let object = function (properties, vocabulary) {
    console.assert(vocabulary.t === 'vocab');
    return {t: 'object', v: properties, vocab: vocabulary};
};

// A "message" is identified by a name. Given a message, the only thing we can
// logically do with it is to send it to an object. So we need to implement a
// "send" word which takes a message and a thing to which it can be sent to and
// "sends" it to it. For instructional purposes, we'll implement message
// sending as equivalent to method invocation just so it is in territory that
// everyone is familiar with.

stddefs(function (env) {
    // To "send a message to an object", we look up its vocabulary
    // for the message symbol, take the defined handler and invoke it.
    // If the vocabulary specifies a normal value, we just push it onto
    // the stack.
    //
    // Usage: `thing :message send`
    define(env, 'send', prim(function (env, stack) {
        let msg = pop(stack), thing = pop(stack);
        console.assert(msg.t === 'symbol');

        // We check for the `vocab` field as an indication
        // of "objecthood". This means we can use `send` with
        // other types which have been given a vocabulary also
        // and not just those with type `object`.
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
                return apply(env, method_or_val, stack);
            default:
                return push(stack, method_or_val); // Normal value.
        }
    }));

    // To get a property of an object, we use a symbol to lookup
    // its property list. This also works with vocabularies.
    //
    // Usage: `thing :key get`
    define(env, 'get', prim(function (env, stack) {
        let name = pop(stack), thing = pop(stack);
        console.assert(name.t === 'symbol');
        console.assert(thing.t === 'object' || thing.t === 'vocab');
        return push(stack, thing.v[name.v]);
    }));

    // To change a property of an object, we modify its property
    // list at the given key. At the end, we leave the object on the
    // stack so that multiple put operations can be done.
    //
    // Usage: `thing val :key put`
    define(env, 'put', prim(function (env, stack) {
        let name = pop(stack), val = pop(stack), thing = pop(stack);
        console.assert(name.t === 'symbol');
        console.assert(thing.t === 'object');
        thing.v[name.v] = val;
        return push(stack, thing);
    }));

    // `vocab new`
    //
    // We certainly need some way to create objects!
    // `new` takes the vocabulary on top of the stack and makes
    // an object out of it. If the vocabulary includes a function
    // named `make`, then it will invoke it on the object to build
    // it up.
    define(env, 'new', prim(function (env, stack) {
        let voc = pop(stack);
        console.assert(voc.t === 'vocab');

        let thing = object({}, voc);
        push(stack, thing);

        let make = voc.v['make'];
        if (make && make.t === 'prim') {
            return apply(env, make, stack);
        }

        return stack;
    }));
});

// That's about it. We're done implementing an "object oriented" language!  It
// has objects. You can send messages to these objects and invoke code that
// will respond to these messages. Objects have properties that you can access
// and modify - though this is not really a necessity for them.  You can
// construct vocabularies for objects to model their behaviour. You can combine
// these vocabularies to form new vocabularies.

// > **Discussion**: What kind of an object oriented system
// > have we just created? Does this correspond to any system
// > you know of? Can we change the implementation to support
// > other kinds of "object orientation"?

// ## Invoking super

// If you noticed, our mechanism doesn't give us an explicit notion of "inheritance",
// and so "invoking super" becomes a problem. This is even more of a problem if
// there is "inheritance" from multiple vocabularies involved. This is surprisingly
// easy to get around. 
//
// When we make a new vocabulary by combining existing vocabularies, we can refer
// to them directly, perhaps bound to a symbol. So all we need is a `send*`
// which will explicitly target a vocabulary on a given object, even irrespective of
// whether that vocabulary is part of the object's behaviour.
//
// With `send*`, the invocation of a "super vocabulary" can be done using -
//
// `word('thing'), word('voc'), word('msg'), word('send*')`
//
// where `thing`, `voc` and `msg` are variables bound to values of appropriate
// types. `thing` should be an object, `voc` should be a vocabulary to direct
// when dealing with the object and `msg` is a message to send to the object as
// interpreted by the vocabulary.
//
// > **Note**: The need for such a "send to super" surfaces in an object system
// > purely because the concept of "message sending" has been interpreted as
// > "method invocation". Therefore the question of "which method?" arises, hence
// > the usual inheritance, etc. If message sending is interpreted as a message
// > that is sent between two asynchronous *processes*, then this anomaly vanishes.
// > In fact, in that case, the notion of inheritance, containment, etc. just disappear
// > and merge into the concept of "object networks".

stddefs(function (env) {
    define(env, 'send*', prim(function (env, stack) {
        let msg = pop(stack), voc = pop(stack);
        console.assert(msg.t === 'symbol');
        console.assert(voc.t === 'vocab');

        let method_or_val = voc.v[msg.v];
        if (!method_or_val) {
            console.error('Vocabulary doesn\'t accept message "' + msg.v + '"');
            return stack;
        }

        if (method_or_val.t === 'prim') {
            return apply(env, method_or_val, stack);
        }

        return push(stack, method_or_val);
    }));
});

// Alternatively, we can provide the ability to cast
// a spell on an object so that it can speak a given
// vocabulary. This would also permit us to make
// explicit super message sends.

// `thing vocab cast`
//
// Endows the `thing` with the given vocabulary and leaves
// it on the stack for further operations.
//
// Options -
//
// 1. We can superimpose the given vocabulary on top of an
//    existing vocabulary by adding words.
//
// 2. We can replace existing vocabulary entirely.
//
// We choose the latter for simplicity. If you want (1),
// you can always make a new vocabulary that mixes multiple
// vocabularies and then use `cast`.
//
// `cast` is intended to sound like "cast spells" rather than
// "type cast", though you could also think of it as the latter.
//
// Once a thing has been casted, you can `send` messages to
// it using the vocabulary which it was casted with. This adds
// some cheap object orientation to the existing types we've
// defined. For example, you can do -
//
// `2.34 complex cast`
//
// where `complex` is a vocabulary for complex number operations.
// We don't touch the original value. This way, we can use this
// mechanism to do a "super send" in the case where multiple
// vocabularies are given to an object.
//
// `thing super2 cast :message send`
stddefs(function (env) {
    define(env, 'cast', prim(function (env, stack) {
        let voc = pop(stack), thing = pop(stack);
        console.assert(voc.t === 'vocab');
        let copy = copy_bindings(thing, {});
        copy.vocab = voc;
        return push(stack, copy);
    }));
});

// ## Making a complete object system

// We have an asymmetry within our system. We have our new-fangled
// "objects" on the one hand, and on the other we have our numbers,
// strings, symbols and such "primitive objects". This is quite an
// unnecessary distinction as we can merge the two systems into a 
// single system with the following rule -
//
// > Every value is associated with a vocabulary.
//
// In object-oriented languages like Smalltalk and Ruby, this principle
// is usually articulated as -
//
// > Everything is an object.
//
// So how do we convert our system into such a unified system?
//
// As a first step, we can just modify all our "primitive object"
// constructors to produce entities which come along with a vocabulary.
// That would permit us to use `send` with all our primitive values
// as well. Our current implementation of `send` already accommodates
// this. 
//
// This seems simple, until we consider what we need to do with out "vocabulary
// objects". Since our vocabularies are also values, each vocabulary also need
// to have an associated vocabulary that tells the programmer how to talk to
// vocabularies!
//
// - A value has a vocabulary that says how to talk to the value.
// - A vocabulary is a value. So a vocabulary has a vocabulary that says
//   how to talk to vocabularies.
//
// ```js
// n = {t: "number", v:5, vocab: howToTalkToNumber}
// howToTalkToNumber = {t: "vocab", v: {..number methods..}, vocab: howToTalkToVocabulary}
// howToTalkToVocabulary = {t: "vocab", v: {..vocab methods..}, vocab: ??}
// ```
//
// What value should be in the `??` place? The simplest solution to that is -
//
// ```js
// howToTalkToVocabulary = {t: "vocab", v: {..vocab methods..}, vocab: howToTalkToVocabulary}
// ```
//
// The snake must eat its own tail!
//
// In a language like Smalltalk, the sequence is quite similar, and goes like -
//
// - object is instance(class).
// - class is instance(metaclass) is classOf(object).
// - metaclass is instance(Metaclass) is metaclassOf(object).
// - Metaclass is instance(Class)
// - metaclassOf(Metaclass) is instance(Metaclass).
// 
// Ruby is less thorough in this matter, though it also adopts the "everything is an object"
// mindset. The notion of "metaclass" in Ruby is, for practical purposes, non-existent.
// Even so, Ruby still manages to expose considerable power to the programmer by working
// close enough to this territory. 
//
// > **Book**: [The Art of the Metaobject Protocol] details the value of having such a
// > meta-object system in an "object oriented language". Though it discusses this in
// > the context of the Common Lisp Object System (CLOS), which is one of the most
// > thorough object-oriented systems designed to date, the concepts elucidated in it
// > are generic enough to be applied to other languages and systems. Be warned that
// > the book is not for the faint of heart, but if you survive it, you'll come out
// > with a different brain :)
//
// [The Art of the Metaobject Protocol]: https://en.wikipedia.org/wiki/The_Art_of_the_Metaobject_Protocol
//
// With such a unification via a metaobject mechanism, our system is further simplified
// by eliminating the `new` primitive. `new` can now be a message that we can `send` to
// a vocabulary object to make a new object that has that vocabulary.

