
// # Finite domain constraint programming

// > **Date**: 18 April 2017  
// > **Note**: DRAFT MODE. This section is INCOMPLETE.

// Requires slang_nondet.js and whatever it requires.

// In the previous section on non-deterministic programming, we
// saw how the `choose` operator can be used to generate possibilities
// and the `fail` operator can be used to limit these possibilities.
// This style of programming where you specify a problem not in terms
// of how to solve it, but in terms of what constraints must be met
// is referred to as "constraint programming". One particularly
// useful branch of this is "finite domain constraint programming", where
// the "domain" of variables can take on values only from a finite set.
// In particular, we can model such finite sets as variables which can 
// take on a finite number of integer values.
//
// To start with, we'll first model these "finite domain variables" as
// sets of integers. While a set is a powerful structure, we'll keep it
// simple here by using an integer so that our "sets" can have a maximum
// cardinality of 30 - i.e. we only permit integers in the range 0 to 29
// (inclusive). Extending this with a data structure that supports larger
// finite domains is left as an exercise to the reader. The point of this
// section is to illustrate how to construct constraint solvers with
// programmable strategies.
//

let fdvar = function (dom) {
    if (typeof dom === 'number') {
        return {t: 'fdvar', v: dom}; // `dom` is a bit field.
    }

    // `dom` is an array of pairs of integers - like this -
    // [[2,4],[7,13]] which mean the number from 2 to 4 (inclusive)
    // and from 7 to 13 are to be included in the set.
    
    let bdom = 0; // The bit field.

    for (let i = 0; i < dom.length; ++i) {
        for (let j = dom[i][0]; j <= dom[i][1]; ++j) {
            bdom += 1 << j;
        }
    }

    return {t: 'fdvar', v: bdom};
};

let fd_const = function (n) {
    console.assert(n >= 0 && n < 30);
    return fdvar(1 << n);
};

let fd_bool = function () {
    return fdvar(3);
};

// ## Basic operations of FDVars

// We need some basic operations on these finite domain variables.
// At the minimum, we need union and intersetion of these sets,
// and to be able to work with them like sets.

let fd_universal = 1073741823;

let fd_union = function (v1, v2) {
    return fdvar(v1.v | v2.v);
};

let fd_intersection = function (v1, v2) {
    return fdvar(v1.v & v2.v);
};

let fd_complement = function (v) {
    return fdvar(fd_universal & ~v.v);
};

// ## Finite domain constraints

// Given that our variables are numeric, we can define numeric constraint
// operators on them. For example, "a < b" can e interpreted as a constraint
// on the two fdvars `a` and `b` such that they can only take on values 
// that satisfy the constraint. Therefore, after such a constraint function
// is called, the values of both the fdvars may be modified to reflect the
// constraint.

// ### a < b

// Convention is that the last argument is the one that will be
// affected by the constraint. Implements v1 < v2.
let fdc_lt = function (v2, v1) {
    for (let i = 29; i >= 0; --i) {
        if (v2.v & (1 << i)) {
            // We have the highest set bit.
            // Forbid all values above this for v1.
            v1.v &= fd_universal & ~((1 << i) - 1);
            break;
        }
    }
};

// ### a == b

let fdc_eq = function (v1, v2) {
    v1.v = v2.v = (v1.v & v2.v);
};

// ### a <= b

// As per convention, implements v1 <= v2 where v1 is the last
// argument.
let fdc_lte = function (v2, v1) {
    for (let i = 29; i >= 0; --i) {
        if (v2.v & (1 << i)) {
            // We have the highest set bit.
            // Forbid all values above or equal to this for v1.
            v1.v &= fd_universal & ~((1 << (i+1)) - 1);
            break;
        }
    }
};

// ## Arithmetic constraints

// Arithmetic constraints are somewhat complicated. They deal with three
// finite domain variables, ensuring that some arithmetic relation holds
// between them. Their constraining must necessarily affect all three
// variables. While that is true of general constraints, we're implementing
// primitive constraints here that constrain only the last argument.

// ### a + b = c

let fdc_sum = function (a, b, c) {
    let cposs = 0;

    // This is a really stupid and inefficient algorithm
    // intended to illustrate how the constraining is done.
    for (let i = 0; i < 30; ++i) {
        for (let j = 0; j < 30; ++j) {
            if ((a.v & (1 << i)) && (b.v & (1 << j))) {
                if (i + j < 30) {
                    cposs += (1 << (i + j));
                }
            }
        }
    }

    c.v &= cposs;
};

// ### a - b = c

let fdc_sub = function (a, b, c) {
    let cposs = 0;

    // This is a really stupid and inefficient algorithm
    // intended to illustrate how the constraining is done.
    for (let i = 0; i < 30; ++i) {
        for (let j = 0; j < 30; ++j) {
            if ((a.v & (1 << i)) && (b.v & (1 << j))) {
                if (i - j >= 0 && i - j < 30) {
                    cposs += (1 << (i - j));
                }
            }
        }
    }

    c.v &= cposs;
};

// ### a * b = c

let fdc_prod = function (a, b, c) {
    let cposs = 0;

    // intended to illustrate how all three variables are
    // constrained by the arithmetic condition.
    for (let i = 0; i < 30; ++i) {
        for (let j = 0; j < 30; ++j) {
            if ((a.v & (1 << i)) && (b.v & (1 << j))) {
                if (i * j < 30) {
                    cposs += (1 << (i * j));
                }
            }
        }
    }

    c.v &= cposs;
};

// ### a / b = c

let fdc_div = function (a, b, c) {
    let cposs = 0;

    // intended to illustrate how all three variables are
    // constrained by the arithmetic condition.
    for (let i = 0; i < 30; ++i) {
        for (let j = 0; j < 30; ++j) {
            if ((a.v & (1 << i)) && (b.v & (1 << j))) {
                if (i % j === 0 && i / j < 30) {
                    cposs += (1 << Math.round(i / j));
                }
            }
        }
    }

    c.v &= cposs;
};

// ### a != b

// This is an interesting case, because we can only do some
// constraining if one of the fdvars has a domain of cardinality 1.
let fdc_neq = function (a, b) {
    if (a.v & (a.v - 1) === 0) {
        b.v = b.v & ~a.v;
    }
};

// ## Propagators

// So far, we've introduced "constraints" which work to reduce the domains of
// one or more variables participating in the constraint. In a real problem,
// however, we have a network of these constraints. For example, we may have "a
// + b > 10" and "a - b > 3" both needing to be satisfied. If we evaluate these
// constraints in any one particular order, we may end up in a situation where
// one constraint affects another variable which in turn can help reduce
// another variable via some other constraint. 
//
// Constraints, therefore, need to be treated as a network and variable domain
// reductions must *propagate* through this network whenever some domain gets
// reduced.
//
// We can model such propagators as processes which continuously maintain
// constraints on their dependent variables. When one propagator acts to reduce
// the domain of one of its variables, it triggers other propagators attached
// to that variable to try to reduce domains as well. Finally, all variables
// will settle to stable or failed domains, at which point we need to decide to
// do something about it outside the context of propagators. To start with,
// though, propagators are processes that continuously reinforce a constraint
// between their dependent variables.
//
// For another example, our primitive `fdc_neq` constraint only constrains the
// second argument, but if after constraining the second argument, it becomes a
// singleton set, then ideally it should be used to constrain the first
// argument too. This triggering behaviour is what is implemented using
// propagators propagating constraints through a dependency network.

let propagator = function (constraint, variables) {
    let output = variables[variables.length - 1];
    let prop = {
        t: 'propagator',
        v: output,
        variables: variables,
        constraint: constraint,
        run: function () {
            let old_val = output.v;
            constraint.apply(this, variables);
            let new_val = output.v;
            return old_val !== new_val ? 1 : 0
        }
    };

    // Store a reference to the propagator in the variables
    // that must trigger it when they change.
    for (let i = variables.length - 2; i >= 0; --i) {
        variables[i].prop = (variables[i].prop || []);
        variables[i].prop.push(prop);
    }

    return prop;
};

// A simple loop for running constraint propagation until everything
// settles. `variables` is an array of variables to consider.
// Returns 'stable' or 'failed'.
let propagate = function (variables) {
    // We initially mark all variables as changed, so that
    // we don't omit any propagators.
    for (let i = 0; i < variables.length; ++i) {
        variables[i].changed = 1;
    }
    
    let changes = 0;

    // We keep attempting to propagate changes until there
    // are no changes.
    do {
        changes = 0;
        
        for (let i = 0; i < variables.length; ++i) {
            if (variables[i].changed) {
                // Every time we trigger a variable's propagators, we decrement
                // its change count to account for it.
                variables[i].changed--;
                let props = variables[i].prop;
                for (let i = 0; i < props.length; ++i) {
                    let change = props[i].run();
                    props[i].v.changed += change;
                    changes += change;
                }
            }
        }
    } while (changes);

    // We'll come here once no variables change during one
    // iteration. This could happen because the propagators
    // couldn't proceed further, or because they've reached
    // a point of no solution - i.e. at least one of the
    // variables has a zero-sized domain.

    for (let i = 0; i < variables.length; ++i) {
        if (variables[i].v === 0) {
            // Failed propagation. Overconstrained.
            return 'failed';
        }
    }

    return 'stable';
};



