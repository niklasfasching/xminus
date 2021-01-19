import {bundle} from "/src/bundler.mjs";

(async () => {
  const [url, basePath] = window.args;
  console.log(await bundle(url, basePath));
  close();
})()
