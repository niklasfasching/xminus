import {t, done} from "../src/test.mjs";
import {parse, parseValue} from "../src/parser.mjs";

t.describe("parser", () => {
  t.exitAfter();

  function test(input) {
    t.assertFixture({vnodes: parse(input)});
  }

  t("should support self closing tags and properties", () => {
    test(`<div>
            <div void>
              <input implicit>
              <input explicit/>
            </div>
            <div non-void>
              <div with-space />
              <div withou-space/>
            </div>
          </div>`);
  });

  t("should support dynamic keys and values", () => {
    test(`<div {foo bar}=value key="{foo bar}"></div>`);
  });


  t("should support dynamic tags and children", () => {
    test(`<{foo bar}>{foo bar}</>`);
  });

  t("should link the parent vnode from child vnodes", () => {
    const [p] = parse(`<p>hello <b>world</b></p>`);
    t.equal(p.children[1].parent, p);
  });

  t("should throw on unclosed tags", () => {
    t.throws(() => parse(`<div>`), /unclosed div/);
  });

  t("should throw on unexpected closing tags", () => {
    t.throws(() => parse(`<div></foo>`), /unexpected close \/foo for div/);
  });

  t.describe("parseValue", () => {
    t("should work", () => {
      t.jsonEqual(parseValue("{$.foo + $.bar}"), ["($.foo + $.bar)", null, true]);
      t.jsonEqual(parseValue("{ () => {return {};} }"), ["( () => {return {};} )", null, true]);
    });
  });
});
