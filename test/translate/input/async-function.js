async function f(a, b, c) {

    await 0;
}

({ async f() { await 0; } });

async x => await y;
