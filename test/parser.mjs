import {t, done} from "../src/test.mjs";
import {parse} from "../src/parser.mjs";

t.describe("parser", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures("./fixtures/parser.json");
  function test(id, input) {
    assertFixture({id, vnodes: parse(input)});
  }

  t("should support self closing tags and properties", (id) => {
    test(id, `<input foo>
                <div/>
                <div foo/>`);
  });

  t("should support dynamic keys and values", (id) => {
    test(id, `<div {foo bar}=value key="{foo bar}"></div>`);
  });


  t("should support dynamic tags and children", (id) => {
    test(id, `<{foo bar}>{foo bar}</>`);
  });

  t("should link the parent vnode from child vnodes", (id) => {
    const [p] = parse(`<p>hello <b>world</b></p>`);
    t.equal(p.children[1].parent, p);
  });

  t("should throw on unclosed tags", () => {
    t.throws(() => parse(`<div>`), /unclosed div/);
  });

  t("should throw on unexpected closing tags", () => {
    t.throws(() => parse(`<div></foo>`), /unexpected close \/foo for div/);
  });
});
