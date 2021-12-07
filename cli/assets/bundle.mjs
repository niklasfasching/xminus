import {bundle} from "/src/bundler.mjs";

(async () => {
  const [src, dst, basePath] = window.args;
  await window.writeFile(dst, await bundle(src, basePath));
  console.log(`Bundled to ${dst}`);
  window.close(0);
})();
