import {bundle} from "/src/bundler.mjs";

(async () => {
  console.log(await bundle("./examples/todomvc/index.html", "/xminus/"));
  close();
})()
