import {t, done} from "/src/test.mjs";

t.describe("html integration tests", () => {
  t.exitAfter();

  t.before("import", async () => {
    const files = await fetch("/test/integration/", {method: "POST"}).then(r => r.json());
    for (const f of files) {
      if (f.endsWith(".html")) await openIframe("/test/integration/" + f);
    }
  });
});
