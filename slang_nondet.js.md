# Non-deterministic programming

**Date**: 18 Apri 2017

(Requires slang_concurrency.js and whatever it requires.)

Now that we have control over control flow within "processes",
we can start to play with it in ways we couldn't imagine doing
in our base language. 

Non-deterministic programming refers to programming operations
with "choice points" such that at the time a choice is being
made, we don't know which choice will succeed, as that is expected
to be determined later on as the program continues to run.
As the program runs, a particular choice may end up being seen
as inappropriate and the program then "back tracks" to try
another choice.

```js
let failure = function (val) { return {t: 'fail', v: val}; };

```
## The `choose` and `fail` operators

```js
stddefs(function (env) {

```
The main ingredients of non-deterministic programming
are a "choose" operator which choose one of several code
paths in such a way that the whole program tries not to
"fail". Correspondingly, there is a "fail" operator which
informs the history of choice points whether the current
code path satisfies the program's needs or not.

While this doesn't look very different from branching
at the outset, the critical difference is that it is
a runtime choice and that the criterion for choosing
is not available to the function at the time it has
to make a choice. This information is only available
later on at a higher level in the program. Therefore with
the `choose` operator, functions can now be designed in
such a way that they can produce more than one possible
outcome. In mathematical terms, the `choose` operator
permits creating functions that map one set of inputs to
more than one possible output - i.e. a one-to-many mapping.
The value in such a one-to-many mapping is that the
combinations of such choices that result in the satisfaction
of some globally determined constraints can now be the result
of the program, without the functions being forced to determine
things that they are not well placed to determine.

Our `choose` operator takes a sequence of blocks or values
and picks one that will cause the rest of the program to
succeed if possible ... or it will fail to an earlier
choice point. This gives us "depth-first search" of the
choice tree for possible solutions.

```js
   define(env, "choose", prim(function (env, stack, callback) {
        let options = pop(stack);
        let proc = stack.process;

        console.assert(callback);
        console.assert(options.t === "block");

        if (!proc.choice_points) {
            proc.choice_points = [];
        }

        let current_env = mk_env(env);

```
We model "making a choice" as a function that takes a single
integer value representing which option among the ones it has
been supplied with must be tried. When the function is called,
it will assume that the choice corresponding to the integer
supplied is available. We keep all of this as a stack of choice
points.
```js
        proc.choice_points.push({
            i: 0,
            count: options.v.length,
            fn: function (i) {
```
Fresh environment and stack, discarding all the
other things possibly accumulated in prior choices.
```js
                let cp_env = mk_env(current_env);
                let cp_stack = stack.slice(0);
                cp_stack.process = stack.process;
                
```
If given a block, we evaluate it. If given
any other normal value, we push it on to the stack.
```js
                if (options.v[i].t === "block") {
                    run(cp_env, options.v[i].v, 0, cp_stack, callback);
```
> **Question**: What happens if the block we're running
> itself creates choice points or triggers a fail? Does
> that need specific support in our code? Would it
> behave correctly? If not what kinds of incorrect
> behaviour may result?
```js
                } else {
                    callback(push(stack, options.v[i]));
                }
            }
        });
        
        return back_track(stack, callback);
    }));

```

> **Question**: How will you implement a "breadth-first"
> search strategy? More generally, in the spirit of making
> implementation features available to our language itself,
> how can we make such search strategies programmable?
> 
> As a task, you can take on rewriting `choose` and `fail`
> to work using a breadth-first strategy, or add a new
> operator to use the breadth-first strategy.

 

Our `fail` operator just triggers the back tracking mechanism
to try alternative choices. Typically, you'd use `fail` within
some kind of a conditional so that the failure is triggered only
when some condition isn't met.
```js
    define(env, "fail", prim(function (env, stack, callback) {
        return later(function (stack) { back_track(stack, callback); }, stack);
    }));

```
## Depth-first back tracking

The act of picking a choice involves checking a
choice point and if it is exhausted, moving on to earlier
choice points, and continuing that until we exhaust all
choice points ... at which point we give up.
```js
    function back_track(stack, callback) {
        let proc = stack.process;
        if (proc.choice_points.length === 0) {
```
All choices exhausted. Whole program failure.
```js
            return later(callback, push(stack, failure(symbol('choose'))));
        }

        let choice_point = proc.choice_points[proc.choice_points.length - 1];
        if (choice_point.i < choice_point.count) {
            later(choice_point.fn, choice_point.i);
            choice_point.i++;

```
If we've initiated the last choice, we might
as well remove the choice point from the back tracking
history right away.

> **Question**: Does this help? If so, how? If not, why?
```js
            if (choice_point.i >= choice_point.count) {
                proc.choice_points.pop();
            }
        } else {
            proc.choice_points.pop(); // Choices exhausted.
            later(function () {
                back_track(stack, callback);
            });
        }

        return stack;
    }    
});

```
## Tests

### Test: Constraints on two choice points

This code creates two choice points and the rest of the program
decides to fail if the numbers chosen by these choice points don't
satisfy some numeric criteria.

```js
tests.two_constraints = function () {
    let program = parse_slang(`
        [1 2 3 4 5] choose :x def
        [1 2 3 4 5] choose :y def
        x y + 5 < [fail] if
        x print y print
        x y * 15 < [fail] if
        "result" print
        x print y print
    `);

    return run(test_env(), program, 0, [], function (stack) {
        console.log("done");
    });
};

```
> **Question**: How will you implement an operator that collects
> all possible "solutions" in the above example instead of just
> picking one?

> **Question**: Can you write a "choice point generator" that will
> try all natural numbers? How would you prevent the generation of
> infinite useless choices to try?


## Non-determinism and data-flow-variables

We specified "data flow variables" to be analogous to boxes
that can be filled only once with a value. If we introduce choice
points affecting the contents of data flow variables, then the
side effect of filling these boxes ripples over to other processes
that share the DFVs. 

> **Question**: How would the semantics of data flow variables
> work if the choice operator were to account for them too?
> In particular, how would invalidating the contents of a data flow
> variable in one process impact another process that doesn't have
> any choice points, but has proceeded because one DFV it was
> waiting on got filled?

In general, such choice points do not work well with operators
that have side effects. At other times, the side effects are useful
programming aids too. So actually exploiting such choice points in
production code hasn't seen as wide an adoption as it might have
gotten, had the separation of *specifying* side effecting actions
from their actual performance to cause the side effects become
more common.

> **Question**: What language feature that you're already familiar
> with do such choice points remind you of?


