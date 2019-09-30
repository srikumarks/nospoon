// # Coreferences
// **Date**: 4 September 2019

// Requires slang.js
"use strict";

// We're now going to do something fun that you don't usually
// find in many programming languages - a feature we call
// "coreferences" and something we do fantastically well 
// in natural language when we refer to things based on
// context without having to invent names for them all the
// time.

// For example, in natural language, we don't say something like
//
// > Let X be Gandhi's wife. X's name was Kasturba. Let D be the
// > event named "Dandi March". X marched in D.
//
// Instead, we just say -
//
// > Gandhi's wife's name was Kasturba. She marched in the Dandi March.
//
// where we easily associate "She" with "Kasturba" by context.

// To mimic that, what we're going to do is to introduce a primitive called
// "the" which will look at its next word and will result in the most recent
// computation by that word being placed on the stack. This is pretty much the
// first time we're breaking the postfix rule.

// We introduce a "compiler" type of primitive. This primitive, once
// encountered, is repeatedly given the following words one by one by the
// interpreter loop until the primitive returns false. The primitive's
// implementation can process the words one by one as a state machine until it
// chooses to exit the "compilation mode".
let compiler = function (fn) { return { t: 'compiler', v: fn }; };

// We'll use a special known symbol as the key into the current
// environment to keep track of recent computation results.
const the = Symbol('the');

// We store the recent computation in the current environment under 
// the `the` symbol above as a map from the name of the word that 
// did the recent computation, to the result top-of-stack.
//
// `get_recent` fetches the recent computation identified in the
// current environment by `word` and `store_recent` stores a recently
// computed value in the same. Note that we do this only with the
// current environment.
let get_recent = function (env, word) {
    console.assert(word.t === 'word' || word.t === 'symbol');
    let cenv = current_bindings(env);
    let the_recents = (cenv[the] || (cenv[the] = {}));
    return the_recents[word.v];
};

let store_recent = function (env, word, value) {
    console.assert(word.t === 'word' || word.t === 'symbol');
    let cenv = current_bindings(env);
    let the_recents = (cenv[the] || (cenv[the] = {}));
    return (the_recents[word.v] = value);
};

// This "new" run implementation is pretty much the same as that encountered in
// the concurrency module. We want to implement support for the new 'compiler'
// primitive.
run = function (env, program, pc, stack, callback) {
    if (!stack.process) {
        stack.process = process(env, block(program));
    }

    for (; pc < program.length; ++pc) {
        let instr = program[pc];
        let sym = null;
 
        if (instr.t === 'word') {
            let deref = lookup(env, instr);
            if (!deref) {
                console.error('Undefined word "' + instr.v + '" at instruction ' + pc);
            }
            sym = instr;
            instr = deref;
        }

        switch (instr.t) {
            case 'compiler':
                // Compiler instructions always act synchronously.
                for (++pc; pc < program.length; ++pc) {
                    push(stack, program[pc]);
                    if (!instr.v(env, stack)) { break; }
                }
                break;

            case 'prim':
                // Whenever we perform an operation based on a defined word,
                // we take the result off top of the stack and store it as
                // the result of the word's performance. This is not always
                // the case, though and I'm not sure how to deal with the
                // more general case where a word may do anything to the
                // stack - as with, say, `dup` and `swap` - but the
                // top-of-stack rule is useful enough I think for more usual
                // operations that leave the result on the stack.
                if (callback && instr.v.length === 3) {
                    return apply(env, instr, stack, function (stack) {
                        if (sym) {
                            store_recent(env, sym, topi(stack, 0));
                        }
                        return run(env, program, pc+1, stack, callback);
                    });
                } else {
                    stack = apply(env, instr, stack);
                    if (sym) {
                        store_recent(env, sym, topi(stack, 0));
                    }
                    break;
                }

            case 'block':
                let bound_block = block(instr.v);
                bound_block.bindings = instr.bindings || copy_bindings_for_block(bound_block, env, {});
                push(stack, bound_block);
                break;

            default:
                push(stack, instr);
                break;
        }
    }

    if (callback) {
        return later(callback, stack);
    }

    return stack;
}



stddefs(function (env) {
    // The basic idea behind coreferences is to be able to
    // reference a recently computed result. The way we do
    // that is to use the form `the word` which will result
    // in the most recent computation done by the operation
    // the `word` refers to being fetched and placed on
    // the stack. Since the implementation of `the` will
    // have to refer to the **following** word, i.e. we're
    // breaking postfix notation here, we make it a "compiler"
    // type which enters its own capture loop, grabs the
    // following word, looks it up in the recent computations
    // and places the result on the stack.
    //
    // The lookup is done only in the current environment without
    // following the environment chain. This is because it will
    // break encapsulation to permit `the` in an environment to
    // refer to a computation done in the enclosing environment
    // by name.
    //
    // Another thing to note is that these recent values won't
    // be released for the garbage collector to collect until
    // the end of the environment in which they were calculated.
    define(env, 'the', compiler(function (env, stack) {
        let w = pop(stack);
        console.assert(w.t === 'word');
        let val = get_recent(env, w);
        if (val) {
            push(stack, val);
        } else {
            console.error("ERROR: No such coreference " + w.v);
            push(stack, undefined);
        }

        /* We only consume one word following a `the`. */
        return false;
    }));

    // While at it, it is also useful to modify the behaviours of
    // the `get`, `send`, `put` words to store their values under the
    // key they access instead of those words themselves.
    function with_recent_capture_by_key(word_str) {
        let curr_impl = lookup(env, word(word_str));
        if (!curr_impl) { return; }
        console.assert(curr_impl.t === 'prim');
        let curr_fn = curr_impl.v;
        curr_impl.v = function (env, stack, callback) {
            let key = topi(stack, 0);
            console.assert(key.t === 'symbol');
            if (callback && curr_fn.length === 3) {
                curr_fn(env, stack, function (stack) {
                    store_recent(env, key, topi(stack, 0));
                    callback(stack);
                });
            } else {
                stack = curr_fn(env, stack);
                store_recent(env, key, topi(stack, 0));
                if (callback) { callback(stack); }
            }
            return stack;
        };
    }

    ['get', 'put', 'send'].forEach(with_recent_capture_by_key);

});