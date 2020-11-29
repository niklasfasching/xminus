import {t, done} from "../src/test.mjs";

done.then(({countFailed}) => {
  window.close(countFailed && 1);
});

t.describe("t", () => {
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
        t.assertEqual(beforeAfterString, "123");
      });
    });

    t("should run afters in order", () => {
      t.assertEqual(beforeAfterString, "123456");
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
        t.assertEqual(beforeEachAfterEachString, "123");
      });

      t("should run beforeEachs for each test", () => {
        t.assertEqual(beforeEachAfterEachString, "123456123");
      });
    });

    t("should run afterEachs in order", () => {
      t.assertEqual(beforeEachAfterEachString, "123456123456");
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

    t("should support assertEqual", () => {
      t.assertEqual(1, 1);
      t.assertEqual(null, undefined);
      t.throws(() => t.assertEqual(1, 2), /1 == 2/);
    });

    t("should support assertStrictEqual", () => {
      t.assertStrictEqual(1, 1);
      t.throws(() => t.assertStrictEqual(null, undefined), /null === undefined/);
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
  })
});
