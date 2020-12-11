function benchmark(name) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.onload = async () => {
      const results = await runTests(iframe.contentWindow);
      document.body.removeChild(iframe);
      resolve(results);
    };
    iframe.src = `./frameworks/${name}.html`;
    document.body.appendChild(iframe);
  });
}

async function runTests(window) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const {document, store} = window;
  store.callback = () => {};
  const clear = document.querySelector("#clear"), results = {};
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

async function main() {
  setTimeout(() => {
    console.log("Timeout after 120s");
    window.close(1);
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
      window.close(1);
    }
  }
  console.log(JSON.stringify(results, null, 2));
  console.log("Finished!");
  window.close(0);
}

main();
