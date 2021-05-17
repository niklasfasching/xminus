import {t, done} from "../src/test.mjs";

t.describe("t", () => {
  t.exitAfter();

  t.describe("wrappers", () => {

    let beforeAfterString = "";

    t.describe("before and after", () => {
      t.before(() => beforeAfterString += "1");
      t.before(() => beforeAfterString += "2");
      t.before(() => beforeAfterString += "3");

      t.after(() => beforeAfterString += "4");
      t.after(() => beforeAfterString += "5");
      t.after(() => beforeAfterString += "6");

      t("should run befores in order", () => {
        t.equal(beforeAfterString, "123");
      });
    });

    t("should run afters in order", () => {
      t.equal(beforeAfterString, "123456");
    });

    let beforeEachAfterEachString = "";

    t.describe("beforeEach and afterEach", () => {
      t.beforeEach(() => beforeEachAfterEachString += "1");
      t.beforeEach(() => beforeEachAfterEachString += "2");
      t.beforeEach(() => beforeEachAfterEachString += "3");

      t.afterEach(() => beforeEachAfterEachString += "4");
      t.afterEach(() => beforeEachAfterEachString += "5");
      t.afterEach(() => beforeEachAfterEachString += "6");

      t("should run beforeEachs in order", () => {
        t.equal(beforeEachAfterEachString, "123");
      });

      t("should run beforeEachs for each test", () => {
        t.equal(beforeEachAfterEachString, "123456123");
      });
    });

    t("should run afterEachs in order", () => {
      t.equal(beforeEachAfterEachString, "123456123456");
    });
  });

  t.describe("assertions", () => {

    t("should support throws", () => {
      t.throws(() => { throw new Error("yolo") }, /yolo/);
    });

    t("should support assert", () => {
      t.assert(true);
      t.throws(() => t.assert(false), /false == true/);
    });

    t("should support equal (strict equal!)", () => {
      t.equal(1, 1);
      t.throws(() => t.equal(null, undefined), /null === undefined/);
      t.throws(() => t.equal(1, 2), /1 === 2/);
    });

    t("should support fail", () => {
      t.throws(() => t.fail("yolo"), /yolo: fail/);
    });
  });

  t.describe("misc", () => {
    t("should throw on t() or t.describe() inside t()", () => {
      t.throws(() => t("foo"), /t\(\) must not be called async/);
      t.throws(() => t.describe("foo"), /t\.describe\(\) must not be called async/);
    })
  });

  t.describe("json fixtures", () => {
    const assertFixture = t.setupFixtures(new URL("./fixtures/test.json", import.meta.url));

    t("should test actual value against json fixture", (id) => {
      assertFixture({id, value: "hello world"});
    });
  });

  t.describe("dynamic tests", () => {
    let simpleTestFinished,
        simpleDescribeFinished,
        beforeFinished,
        afterFinished,
        iframe;
    t.describe("create dynamic test", () => {
      t.before("create dynamic test", async () => {
        await new Promise(setTimeout);
        t("simple created test", () => simpleTestFinished = true);

        t.describe("simple created describe", () => {
          t("created test", () => simpleDescribeFinished = true);
        });

        t.describe("complex created describe", () => {
          t.before("created before", () => {
            beforeFinished = true;
          });
          t("created test", () => {
            t.assert(beforeFinished);
            beforeFinished = "test was here";
          });
          t.after("created after", () => {
            t.equal(beforeFinished, "test was here");
            beforeFinished = true, afterFinished = true;
          });
        });

        iframe = await openIframe("/test/fixtures/iframe_test.html");
      });
    });

    t("should have run the dynamic test", () => {
      t.assert(simpleTestFinished);
      t.assert(simpleDescribeFinished);
      t.assert(beforeFinished);
      t.assert(afterFinished);
      t.assert(iframe.contentWindow.iframeTestFinished);
    });
  });
});
