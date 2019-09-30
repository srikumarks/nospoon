
// # Exports

// We export the few critical functions we need to run slang.
// `env` for making environments,
// `parse` for parsing slang expressions,
// `run` for running slang programs.
try {
    module.exports = {
        run : run,
        parse: parse_slang,
        env: (base) => { return load_stdlib(mk_env(base)); },
        define: define,
        prim: prim,
        word: word,
        number: number,
        string: string,
        symbol: symbol,
        push: push,
        pop: pop,
        topi: topi,
        depth: depth
    };
} catch (e) {
}