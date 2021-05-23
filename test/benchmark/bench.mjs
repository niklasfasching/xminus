async function benchmark(name) {
  const iframe = await openIframe(`/test/benchmark/frameworks/${name}.html`);
  const results = await runTests(iframe.contentWindow);
  document.body.removeChild(iframe);
  return results;
}

async function runTests(window) {
  const {document, store} = window;
  store.callback = () => {};
  const clear = await waitFor(document, "#clear"), results = {};
  await runTest(results, store, document.querySelector("#run"), clear);
  return results;
}

async function runTest(results, store, action, clear, iterations = 10) {
  try {
    let actionMs = 0, clearMs = 0;
    for (let i = 0; i < iterations; i++) {
      actionMs += (await click(action, store))[1];
      clearMs += (await click(clear, store))[1];
    }
    results[action.id] = {action: actionMs / iterations, clear: clearMs / iterations};
  } catch (err) {
    throw new Error(`${action.id}: ${err.message}`);
  }
}

function click(elem, store, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`click on ${elem.id} never finished`)), timeoutMs);
    store.callback = (name, ms) => {
      clearTimeout(timeout);
      resolve([name, ms]);
    };
    elem.click();
  });
}

async function waitFor(document, selector, timeout = 100) {
  const now = Date.now();
  while (true) {
    const el = document.querySelector(selector);
    if (el) return el;
    else if (Date.now() - now > timeout) return null;
    else await new Promise(r => requestAnimationFrame(r));
  }
}

async function main() {
  setTimeout(() => {
    console.log("Timeout after 120s");
    close(1);
  }, 120 * 1000);

  const results = {}, frameworks = [
    "mithril",
    "domc",
    "xminus",
  ];
  for (const framework of frameworks) {
    try {
      console.log(framework);
      results[framework] = await benchmark(framework);
    } catch (err) {
      console.log(`${framework}: ${err.message}`);
      close(1);
    }
  }
  console.log(JSON.stringify(results, null, 2));
  console.log("Finished!");
  close(0);
}

main();
