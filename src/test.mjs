let node = {children: []};

export function t(name, f) {
  node.children.push({name, f});
}

Object.assign(t, {
  describe(name, f) {
    const parent = node;
    node = {name, children: []};
    const result = f?.();
    if (result) throw new Error(`unexpected return value from describe: ${result}`);
    parent.children.push(node);
    node = parent;
  },

  assert(x, msg) {
    if (!x) t.fail(msg, `${x} == true`);
  },

  assertEqual(x, y, msg) {
    if (x != y) t.fail(msg, `${x} == ${y}`);
  },

  assertStrictEqual(x, y, msg) {
    if (x != y) t.fail(msg, `${x} === ${y}`);
  },

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },
});

async function run(lvl, node) {
  if (lvl) log(lvl, "", node.name);
  lvl += 2;
  for (let child of node.children) {
    if (child.children) await run(lvl, child);
    else await runTest(lvl, child.name, child.f);
  }
}

async function runTest(lvl, name, f) {
  try {
    const start = performance.now();
    await f?.();
    const ms = performance.now() - start;
    if (f) log(lvl, "color: green", `✓ ${name} (${ms.toFixed()}ms)`);
    else log(lvl, "color: yellow", `✓ ${name}`);
  } catch (err) {
    log(lvl, "color: red", `x ${name}`, ...err.stack.split("\n"));
  }
}

function log(lvl, color, line, ...lines) {
  console.info("%c" + " ".repeat(lvl) + line, color);
  for (let l of lines) console.info("%c" + " ".repeat(lvl + 2) + l, "color: grey");
}

setTimeout(() => run(0, node));
