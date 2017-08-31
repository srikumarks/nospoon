
# Error conditions

> **Date**: 26 April 2017  
> **Note**: DRAFT MODE. This section is INCOMPLETE.

Requires `slang_nondet.js` and everything else it requires.

In the section on "non-deterministic programming", we saw how the `choose`
and `fail` operators can cooperate to implement a depth-first search of a
tree of possible code paths in order for the whole program to meet some
stipulated success criterion. While this is not the common way to approach
successful program completion, good system design involves thinking through
and accounting for all the kinds of error conditions that can occur in the
course of its lifetime. The aim of this section is to give an overview of
error management design choices made in various programming languages so
you-the-reader can have some idea of the space of possibilities as well as
the rationale for each.

## What is an error condition?

At the basic level, an error condition occurs when a function is unable to
return a value that will continue the flow of the program. It can express
the fact that it cannot produce a normal value in a number of ways depending
on the system we're looking at, but that's the kind of condition we're
interested in dealing with.

Error conditions are usually associated with a *reason* for their occurrence.
A function may not be able to compute its contract result if its input is
in not valid, ex: dividing by zero, if some system state that it needs to
cross reference its input with is invalid, or if an effect that a procedure
is trying to have on its environment fails, ex: failure to send network packet,
failure to open a file for writing.

A programming system that provides for handling such conditions involves
both detecting the occurrence of an error and taking some action when a
particular type of error occurs - usually referred to as a "handler".
When an error simply cannot be recovered from (ex: system out of memory),
the only possible recourse is to crash the program, which is often a default
behaviour embedded into applications.

## Encoding errors in values

The simplest approach that a function or procedure can take to signal an
error condition is to encode the error condition as a special return value.
This could be a simple numeric code or an entire object which captures more
detailed context about the error so that appropriate action can be taken.

The C programming language and Go, for example, both take the option of 
returning an error code and expecting the caller to detect the condition
and take corrective action if possible. 

Below is a simple example in the C language.

```c
int write_to_file(const char *message, const char *filename) {
FILE *f = fopen(filename, "w");
if (f != NULL) {
return -1; // Nothing written.
}

fprintf(f, "%s", message);
fclose(f);
return 0;
}   
```

The idea of returning special error codes is also a common feature of
languages featuring a strict type system, such as Haskell and Rust,
which feature `Option` or `Maybe` and `Result` or `Either` types.
Below is a trivial example of calculating the width in pixels of each 
column when the total width of all columns and the number of columns
are known.

```hs
columnSize : Int -> Int -> Maybe Int
columnSize width numColumns =
if numColumns == 0 then
Nothing
else
Just (width `div` numColumns)
```

The `columnSize` function withh produce a `Nothing` when presented with
the odd situation of no columns, and give `Just width` when presented with
a valid situation. In this case, we didn't need any further explanation
for the error condition perhaps. If we needed that, we could've used an
`Either` type as follows --

```hs
columnSize : Int -> Int -> Either String Int
columnSize width numColumns =
if numColumns == 0 then
Left "Can't give 0 columns"
else
Right (width `div` numColumns)
```

... where the `Left` value gives some explanation about the error
condition instead of just saying `Nothing`.

At some level, all error management and recovery schemes boil down to
representing error conditions in some data structure and passing it around
to some piece of code which know what to do with it.

## Errors at the system level

Most of our programs are launched by the OS kernel as processes which get
their own address space. Since the kernel is expected to manage the resources
allocated to the processes it launches, when a process exits due to an error
condition, the kernel is expected to behave in such a way that system resources
are not leaked.

Towards ensuring this, the kernel will release all the memory allocated to the
process back to the pool, close all I/O handles such as files and sockets,
release any shared memory or other resources and so on, when a process exits
either in a controlled fashion or in an unexpected fashion.

A process may also register specific handlers for "signals". It may take
specific actions, such as saving its current state, when asked to abruptly
terminate itself due to some error condition. Thus, errors may also be injected
into processes externally.

## try-catch based error management

In languages such as Java, Javascript and C++, we can mark a piece of code
as "error prone" by wrapping it inside a `try` block, with a `catch` clause
specifying code to execute when error conditions occur. Some mock code -

```cpp
int write_to_file(const char *message, const char *filename) {
File *f = NULL;

try {
FILE *f = fopen(filename, "w");
if (f == NULL) { throw -1; }
if (strlen(message) > 100) {
throw -2;
}
fprintf(f, "%s", message);
fclose(f);
return 0;
} catch (int e) {
fclose(f);
return e;
}
}   
```

If the double `fclose` is bothering you as it should, you can use the `finally` clause
to release resources whether the function succeeds or fails.

```cpp
int write_to_file(const char *message, const char *filename) {
File *f = NULL;

try {
FILE *f = fopen(filename, "w");
if (f == NULL) { return -1; }
if (strlen(message) > 100) {
return -2;
}
fprintf(f, "%s", message);
return 0;
} finally {
fclose(f);
}
}   
```

Such a `finally` clause is used in these languages to specify code that must be
executed irrespective of whether the procedure returns normally or via some abnormal
means such as an exception thrown using `throw`.

## Resource Acquisition As Initialization (RAAI)

As we saw, resource cleanup is one of the important actions to be taken when
errors happen. The above ways of testing for error conditions and managing
resource cleanup is quite onerous on the programmer and usually leads to
omissions that translate into resource leaks.

C++ provides an elegant solution to this problem through the idea of 
block scoping associated with objects allocated on the stack. When code
within a block scope (portion within `{}` curly braces) completes, either
abnormally or normally, the C++ compiler automatically inserts the necessary
instructions to release all the objects that were allocated on the stack
within that block. Since C++ has the notion of "destructor" for objects,
which is a procedure called when an object is released or "destroyed",
we can combine these two concepts to provide for automatic and almost
code-free resource cleanup. The destructors of these stack allocated
objects are called in the reverse allocation sequence automatically.

So what we have to do is to model resources as objects that can be allocated
on the stack, and put in their cleanup code within the destructors of the
classes of these objects. For example -

```cpp
void write_to_file(const std::string &filename, const std::string &message) {
std::ostream file(filename);
if (message.length() > 100) {
throw std::error("Message too big");
}
file.write(message);
}
```

Since the `file` object is allocated on the stack, if the allocation failed,
an exception will be thrown from within `write_to_file` and none of the
other lines of code will run. When we `throw std::error("Message too big")`
as well, that marks the end of the `file` object's scope and its destructor
will be called before the `write_to_file` exits with an exception. If we get
to the end of the function normally, the end of scope will take care of
closing the file as well. This makes of succinct management of resource and
leaves little room for programmer error.

Due to the determinate nature of C++ (i.e. non-garbage collected runtime),
we can build robust systems layer by layer.

## Concurrent error management

The above cases all treated error management in single-threaded programs.
When we deal with highly concurrent systems, we need to resort to different
strategies. The language Erlang is used to build massively distributed and
highly available telephony systems and it features an error management
approach that is closer to the way the unix kernel treats processes than any
of the other languages.

Erlang features light weight "processes" which are not the same as unix
kernel level processed. A small amount of stack and heap is associated with
an Erlang process when it starts (as little as 300 bytes) and multiple such
processes can run on a single core machine. The Erlang runtime rations
function call executions (called "reductions" in the Erlang world) between
these processes so that fine grained concurrency is possible. Each Erlang
process also has an associated "mailbox" into which it can receive messages
from other processes, even if they're across the network.

One interesting feature of the Erlang system is that usually the code for
processes will consist of only the happy path and processes are recommended
to crash in the case of error! This may sound like blasphemy to experts in
other languages, but this is the basis for the high availability strategy
that is implemented in Erlang's OTP library. OTP is an application
architecture that facilitates setting up Erlang processes in supervisor
hierarchies. That is, if a process `S` is marked as the supervisor of
another process `P`, then when `P` dies by crashing, `S` gets notified by a
message, based on which it can choose a variety of actions. For example, `S`
itself can choose to crash if it doesn't know how to recover from `P`
crashing, or it may choose to restart `P` in a stable state and keep
chugging along as though nothing happened. `S` itself may be supervised by
another process which can apply similar logic to it child tree of processes.
Therefore, garbage collection in Erlang happens through process exit, in
addition to smaller collections within processes. Since processes share
nothing between them (messages between them are copied), there is almost no
inter-process analysis that needs to be done that can delay garbage
collection.

In real world engineering, this "just crash and let the supervisor tree do
its thing" strategy is surprisingly effective to ensure system robustness.
Not all systems can be designed with this philosophy though, and Erlang's
low latency scheduler is a critical component that makes this strategy work
as effectively as it does.

## Contextual recovery stratgies

We saw how in the C/C++/Java/Javascript language families exceptions propagate
"up the call stack" until one reaches code that can do something about them.
This implies that the local context in which the error occurs is no longer
available when it comes time to determining what to do about the error.

There are many situations in programming where this is not acceptable.
Many situations do not require the entire job to be restarted for certain
kinds of errors, but need to do it for other kinds. For example, if writing
to a log file raised an exception, it might be ignorable in a system where
the log file is not a critical component, but cannot be ignored in cases
where the log is, say, used as a transaction log. This means that the library
that features such a logging cannot decide for itself what to do, and must
necessarily delegate that responsibility to the caller. Local context destruction
through stack unwinding is a bad fit for these kinds of problems.

A more general error handling approach is to maintain a stack of handlers and
include error handling options as part of a function's calling interface.
When an error occurs, the appropriate handler is selected and called **in-situ**,
without local context destruction. The handler can then **choose** whether to
unwind the call stack and destroy context, or adopt some other recovery strategy
that permits the program to continue from the point at which the error occurs.

Common Lisp's "conditions" provide such a mechanism. This mechanism is 
strictly more general than the mechanisms offered by the other languages
discussed thus far, apart from Erlang.

> For good examples of using Common Lisp's condition system, see the book
> ["Practical Common Lisp" by Peter Seibel][seibel].

[seibel]: http://www.amazon.in/Practical-Common-Lisp-Books-Professionals/dp/1590592395

The error mechanism built into [muSE] is also similar in expressive power and
is described [here][muSE-ex].

[muSE]: https://github.com/srikumarks/muSE
[muSE-ex]: https://github.com/srikumarks/muSE/wiki/ExceptionHandling


## Error management in Slang

TODO: Implement Common Lisp-like error handling mechanism in Slang that is
also process aware.

