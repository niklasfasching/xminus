import {rebaseURL, dataURL, rebaseModuleImports, loadXModules, bundle} from "/src/bundler.mjs";
import * as compiler from "/src/compiler.mjs";
import {t} from "/src/test.mjs";

const baseURL = "http://example.com";

t.describe("bundler", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures(new URL("./fixtures/bundler.json", import.meta.url));

  t.describe("rebaseURL", () => {
    t("should rebase (root) relative urls given a basePath", () => {
      t.equal(rebaseURL("foo", baseURL, "/"), "/foo");
      t.equal(rebaseURL("bar", `${baseURL}/foo/index.html`, "/"), "/foo/bar");
      t.equal(rebaseURL("./bar", `${baseURL}/foo/index.html`, "/"), "/foo/bar");
      t.equal(rebaseURL("/bar", `${baseURL}/foo/index.html`, "/"), "/bar");

      t.equal(rebaseURL("baz", `${baseURL}/bar/index.html`, "/foo"), "/foo/bar/baz");
      t.equal(rebaseURL("./baz", `${baseURL}/bar/index.html`, "/foo"), "/foo/bar/baz");
      t.equal(rebaseURL("/baz", `${baseURL}/bar/index.html`, "/foo"), "/foo/baz");
    });

    t("should turn (root) relative urls into full urls when no basePath is given", () => {
      t.equal(rebaseURL("foo", baseURL), baseURL + "/foo");
    });

    t("should never modify full / absolute urls", () => {
      t.equal(rebaseURL("http://foo.bar", baseURL, "/foo"), "http://foo.bar");
      t.equal(rebaseURL("data:text/javascript,1", baseURL, "/foo"), "data:text/javascript,1");
    });
  });

  t.describe("rebaseModuleImports", () => {
    function test(id, baseURL, basePath, code) {
      assertFixture({id, module: rebaseModuleImports(code, baseURL, basePath).split(/\n\s*/g)});
    }

    t("should rewrite relative imports", (id) => {
      test(id, `${baseURL}/base/index.html`, "/rebase", `
        import * from '/module.js';
        import * from '/dir/module.js';
        import * from './module.js';
        import * from './dir/module.js';

        import {foo, bar} from "/module.js";
        import * as module from '/module.js';
        import "/module.js";
      `);
    });

    t("should not modify absolute imports", (id) => {
      const baseURL2 = "http://foo.bar";
      test(id, `${baseURL}/base/index.html`, "/rebase", `
        import * from '${baseURL2}/module.js';
        import {foo, bar} from '${baseURL2}/module.js';
        import * as module from '${baseURL2}/module.js';
        import '${baseURL2}/module.js';
      `);
    });
  });

  t.describe("loadXModules", () => {
    const grandChildXModuleHTML = `<script type=x-template id=x-grand-child>grandChildTemplate</script>`;
    const childXModuleHTML = `<script type=x-template id=x-child>childTemplate</script>
                              <script type=x-module src="${dataURL(grandChildXModuleHTML)}"></script>`;
    const parentXModuleHTML = `<script type=x-template id=x-parent>parentTemplate</script>
                               <script type=x-module src="${dataURL(childXModuleHTML)}"></script>`;
    t("should load xModule with all child xModules recursively", async () => {
      const xModules = await loadXModules(dataURL(parentXModuleHTML))
      t.equal(xModules.length, 3);
    });

    t("should deduplicate modules / load each module only once", async () => {
      const duplicatedXChildModuleHTML = `${parentXModuleHTML}
                                          <script type=x-module src="${dataURL(childXModuleHTML)}"></script>`;
      const xModules = await loadXModules(dataURL(duplicatedXChildModuleHTML));
      t.equal(xModules.length, 3);
    });

    t("should rebase src urls of style elements and inside js modules");
  });

  t.describe("bundle", () => {
    t("should bundle into an html file", async (id) => {
      compiler.resetPrefixId();
      const html = await bundle(new URL("./fixtures/index.html", import.meta.url));
      assertFixture({id, html: html.split(/\n\s*/g)});
    });

    t("should bundle into a data url", async (id) => {
      compiler.resetPrefixId();
      const dataURL = await bundle(new URL("./fixtures/index.html", import.meta.url), null);
      assertFixture({id, code: unescape(unescape(dataURL)).split(/\n\s*/g)});
    });
  });
});
