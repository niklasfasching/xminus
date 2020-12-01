import {t, done} from "../src/test.mjs";
import {parse} from "../src/parser.mjs";

t.describe("parser", () => {
  t("should support self closing tags and properties", () => {
    t.jsonEqual(parse(`<input foo>`),
                [{tag: "input", properties: {foo: "true"}, children: [], void: true}]);
    t.jsonEqual(parse(`<div/>`), [{tag: "div", properties: {}, children: [], void: false}]);
    t.jsonEqual(parse(`<div foo/>`), [{tag: "div", properties: {foo: "true"}, children: [], void: false}]);
  });

  t("should support dynamic keys and values", () => {
    t.jsonEqual(parse(`<div {foo bar}=value key="{foo bar}"></div>`),
                [{tag: "div", properties: {"{foo bar}": "value", key: "{foo bar}"}, children: [], void: false}]);
  });


  t("should support dynamic tags and children", () => {
    t.jsonEqual(parse(`<{foo bar}>{foo bar}</div>`),
                [{tag: "{foo bar}", properties: {}, children: ["{foo bar}"], void: false}]);
  });

  t("should link the parent vnode from child vnodes", () => {
    const [p] = parse(`<p>hello <b>world</b></p>`);
    t.strictEqual(p.children[1].parent, p);
  });

  t("should throw on unclosed tags", () => {
    t.throws(() => parse(`<div>`), /unclosed div/)
  });
});
