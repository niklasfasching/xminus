import {t, done} from "/src/test.mjs";

t.describe("html integration tests", () => {
  t.exitAfter();

  t.before("import", async () => {
    const files = await window.readDir("/test/integration");
    for (const f of files) {
      if (f.endsWith(".html")) await openIframe("/test/integration/" + f);
    }
    await openIframe("/modules/app/index.html");
  });
});
