import {bundle} from "/src/bundler.mjs";

(async () => {
  const [src, dst, basePath] = window.args;
  const [status, body] = await fetch(`/create?path=${dst}`, {
    method: "POST",
    body: await bundle(src, basePath),
  }).then(async (r) => [r.status, await r.text()]);
  if (status >= 300) throw new Error(`bundle failed with ${status}: ${body}`);
  console.log(`Bundled to ${dst}`);
  console.clear(0);
})();
