> **Note**: This is a work-in-progress series.

As introduced in the first talk, this series will take folks through
the process of creating programming languages in order to better
design flexible layered systems.

Prerequisite: [Javascript - the really good parts][jskernel]

[jskernel]: https://gitlab.pramati.com/nospoon/talks/wikis/javascript-the-really-good-parts

## FAQ on using Javascript

We'll be using Javascript as the underlying implementation language
in this series. Initially this may feel like "cheating" because we're
already using a language which has some powerful features in it.
However, you'll see how we'll quickly move out of the realm of Javascript
and will be dealing with concepts that you wouldn't have heard of
in the Javascript world.

### Why Javascript as the implementation language?

The reason is simple, really - **no installation required** (usually).

You probably already have a browser installed in your system.
Likely Chrome or Firefox. That's all that will be required to
follow through this series. Both these browsers also have 
great dev and debug environments for Javascript as well,
and expose a rich set of UI and networking features.

### So now I need to learn a complicated language first?

For this series to be meaningful, you do need to be a programmer
with some strong exposure to a main stream programming language like
Java or C++ or Javascript. This series is **not** intended for total
newbies to the programming world.

So buckle up and pickup [a little Javascript][jskernel] first.
We've identified a small, sensible, yet powerful subset of 
Javascript that you should be able to pick up in an hour or so
if you know Java or C++. For those who already know Javascript,
we're going to force you to use this kernel subset only in the
interest of everyone else. 

Resistance is futile. You will be assimilated.

### Great .. now I'll never be able to implement a "real" language

Check out [Emscripten]. It is a compiler that compiles several
programming languages that compile to native code into Javascript!
Yes, including C/C++. Javascript is a "real" programming language.
Get over it.

Seriously, you'll realize how easy it is to "retarget" to any other
compilation system if compiled languages are what you're looking into.

Stepping back, this series is **not** about teaching you to implement
a generic programming language. You might at the end, but it is to
teach you enough principles so that you can create languages appropriate
to various application domains as and when needed and be able to 
articulate the advantages of a language-centric design strategy.

## Ok now what?

Check out the file `slang.js` in the `slang` folder. This is our
starting point for making a language from a very basic idea of
what a program is and actually buliding a working interpreter
for it. If you want to browse the code in a readable manner, you
can view [slang.js.md](slang.js.md).

[Emscripten]: https://github.com/kripken/emscripten









