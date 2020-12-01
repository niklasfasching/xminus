import {t, done} from "../src/test.mjs";
import {parse} from "../src/parser.mjs";

t.describe("parser", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures("./fixtures/parser.json");
  function test(name, input) {
    assertFixture({id: name, vnodes: parse(input)});
  }

  t("should support self closing tags and properties", (name) => {
    test(name, `<input foo>
                <div/>
                <div foo/>`);
  });

  t("should support dynamic keys and values", (name) => {
    test(name, `<div {foo bar}=value key="{foo bar}"></div>`);
  });


  t("should support dynamic tags and children", (name) => {
    test(name, `<{foo bar}>{foo bar}</div>`);
  });

  t("should link the parent vnode from child vnodes", (name) => {
    const [p] = parse(`<p>hello <b>world</b></p>`);
    t.strictEqual(p.children[1].parent, p);
  });

  t("should throw on unclosed tags", () => {
    t.throws(() => parse(`<div>`), /unclosed div/);
  });
});
