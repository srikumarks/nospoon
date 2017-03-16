# A Parser

Requires slang.js
```js
"use strict";

```
In the No Spoon series, we want to start with a mental model, and then move
up through semantics into syntax. The motivation for this approach is that
too often devs get caught up in the syntactic aspects of a language, and if
they're lucky, some semantics which hinder them from reaping the benefits of
the language. By starting with the mental model, our intention is to ensure
that we introduce no new concepts as we move through semantics to syntax.

In that spirit, we'd like to start with our now clear mental model as
expressed in our programs and then make a syntax that is closely aligned
with it with the sole purpose of saving some typing. We will introduce no
new concepts along the way.

```js
let fibonacci_program = [
    block([
        symbol('n2'), word('def'),
        symbol('n1'), word('def'),
        symbol('i'), word('def'),

        word('i'), number(0), word('>'),
        block([
            word('n1'), word('print'),  

            word('i'), number(1), word('-'),
            word('n2'),
            word('n1'), word('n2'), word('+'),

            word('fib')
        ]),
        word('if')
    ]),
    symbol('fib'), word('defun'),

    number(0), number(1), word('fib')
];

```
## String to entity mapping

To start with, our "program" is just a normal Javascript array.
Each entry of the array uses a value constructor to determine what
instruction occurs at that location. The following types of
values need to be supported in our programs.

- words
- numbers
- strings
- symbols
- blocks

To work out a syntax for all instruction types other than blocks, 
it would suffice if we're able to work out the constructor that
we must use given a string representation of the argument of the
constructor. i.e. Given "123", if we can infer it is a number,
given "abc" that it is a word, given "hello world" that it is a
string, and given "x1" that it is a symbol.

Of these, we have an overlap between words, symbols and strings.
Numbers are straightfoward. For blocks, we can just use arrays
anyway.

So we can add something special to identify a symbol given its
string representation. For example, we could infer that all strings
of the form ":abcxyz123" will be symbols (not including the ":"),
that strings are enclosed in double quotes, with everything else
being a word.

For strings, we want to keep it simple and say that the double
quote character won't be used within the string, but we'll 
permit URL-style encoding instead. This makes it easy to 
parse out a string.


## Commitments made already

The problem with starting out with syntax starts very early.
We see already how we're limiting the shape of symbols, how
we're going to represent strings in serialized form and the
specific numeric format we'll use for numbers.

Thankfully, this is where it ends for now. We can make a nice
parser already. Here is our ideal version of our fibonacci
program that would save typing.

```js
let fibonacci_program_rep = [
    [ ':n2', 'def',
      ':n1', 'def',
      ':i', 'def',

      'i', '0', '>',
      [ 'n1', 'print',
        
        'i', '1', '-',
        'n2',
        'n1', 'n2', '+',

        'fib'
      ], 'if',
    ],
    ':fib', 'defun',

    '0', '1', 'fib'
];

```
Now let's write a function to turn each of those array
entries into a valid slang entity.
```js
let parse_entity = function (item) {
    if (typeof item === 'string') {
        if (item[0] === ':') { // Symbol
            return symbol(item.substring(1));
        }
        if (item[0] === '"' && item[item.length-1] === '"') { // String
            return string(item.substring(1, item.length-1));
        }
        let n = parseFloat(item);
        if (!isNaN(n)) { // Number
            return number(n);
        }
        return word(item);
    } else if (item instanceof Array) {
        return block(item.map(parse_entity));
    } else {
        throw new Error('Invalid item serialization');
    }
};

fibonacci_program = fibonacci_program_rep.map(parse_entity);

```
## Flattening to a single string

Now that we've represented each entity in serialized form,
we can just flatten out our array to make a serialized
representation of our entire program. So if we can parse
this flattened out form, then we're done with our parser.

```js
let parse_slang = function (program) {
    let result = [];
    let glyph = /^[^\s\"\[\]]+/;
    do {
```
Kill prefix spaces.
```js
        program = program.replace(/^\s+/, '');

        if (program.length === 0) {
            return result;
        }

```
Check for number.
```js
        let n = parseFloat(program);
        if (!isNaN(n)) {
            result.push(number(n));
            program = program.replace(glyph, '');
            continue;
        }

```
Check for symbol.
```js
        if (program[0] === ':') {
            let sym = glyph.exec(program);
            if (sym) {
                result.push(symbol(sym[0].substring(1)));
                program = program.substring(sym[0].length);
                continue;
            }

            console.error('Hm? Check this out - {' + program.substring(0, 30) + ' ...}');
            program = program.replace(glyph, '');
            continue;
        }

```
Check for string.
```js
        if (program[0] === '"') {
            let i = program.indexOf('"', 1);
            if (i >= 0) {
                result.push(string(decodeURIComponent(program.substring(1, i))));
                program = program.substring(i+1);
                continue;
            }

            console.error('Bad string - {' + program.substring(0, 30) + ' ...}');
            result.push(string(program.substring(1)));
            program = '';
            continue;
        }

```
Check for block start.
```js
        if (program[0] === '[') {
            let b = parse_slang(program.substring(1));
            result.push(block(b.block));
            program = b.rest;
            continue;
        }

```
Check for block end.
```js
        if (program[0] === ']') {
            return { block: result, rest: program.substring(1) };
        }

        let w = glyph.exec(program);
        result.push(word(w[0]));
        program = program.substring(w[0].length);
    } while (program.length > 0);

    return result;
};

```
This makes our fibonacci program quite simple indeed.

```js
fibonacci_program = parse_slang(`
    [ [i n1 n2] args
      i 0 > 
      [ n1 print
        i 1 -
        n2
        n1 n2 +
        fib 
      ] if
    ] :fib defun
    0 1 fib
`);

```
## Printing an item

Given that we can parse a serialized program form, it'll be great
to be able to write out a data item in serialized form so we can
do both.

```js
let show_slang = function (term) {
    if (term instanceof Array) {
        return term.map(show_slang).join(' ');
    }

    switch (term.t) {
        case 'number': return '' + term.v;
        case 'word':   return term.v;
        case 'symbol': return ':' + term.v;
        case 'string': return '"' + encodeURIComponent(term.v) + '"';
        case 'block':  return '[' + show_slang(term.v) + ']';
        case 'prim':   return '<<prim>>';
        default:
            return '<<err>>';
    }
};

```
So `show_slang` and `parse_slang` are expected to be nearly inverses
of each other.


## Adding comments to our parser.

Normally in programming languages, a "comment" is a piece of text that
doesn't add any meaning to the program and can be stripped out without loss
for the computer .. though usually at a great loss to humans.

It would be natural to expect our syntax to support such comments too.
However, instead of adding it at the parser level, we'll just add a comment
primitive that will drop the latest item on the stack.  This way, we can
write -

`"Some code below" ;`

and the string will in essence be of no use to the program.  Here, we're
using the word ';' to mean `comment`. However, this way costs some runtime
overhead to process comments.  Since we can easily remedy that before
passing the program to our interpreter, we won't bother about that.

That said, we need to clarify one behaviour of such a comment that might be
unexpected to those familiar with main stream langauges - that it comments
out the value effect of the *most recent computation* and not the *most
recent term*. So as long as we use `comment` such that the most recent
computation is also the most recent term, programs won't cause any ambiguity
there.

Note that this implementation of commenting is the same as the `drop`
primitive ... just with better wording.

```js
stddefs(function (env) {
    define(env, ";", lookup(env, symbol('drop')));
});



```
