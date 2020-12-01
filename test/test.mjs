import * as p from "/src/parser.mjs";
import * as c from "/src/compile.mjs";

async function run(name) {
  const expectedResults = await fetch(`./${name}.json`).then(r => r.json()).catch(() => []);
  const document = await fetch(`./${name}.html`).then(r => r.text()).then(html => new DOMParser().parseFromString(html, "text/html"));
  const templates = document.querySelectorAll(`script[type="text/x-template"][id^=x-]`);
  const actualResults = [...templates].map((t) => {
    const {id, text} = t,
          lex = t.hasAttribute("lex"),
          parse = t.hasAttribute("parse"),
          generate = t.hasAttribute("generate"),
          $ = {create: "", update: "", html: ""};
    if (generate) {
      c.generateChildren({node: "_node", properties: {}, children: p.parse(text)}, $);
    }
    return {
      id,
      tokens: lex ? p.lex(text) : undefined,
      vnodes: parse ? p.parse(text): undefined,
      html: generate ? $.html.split("\n") : undefined,
      create: generate ? $.create.split("\n") : undefined,
      update: generate ? $.update.split("\n") : undefined,
    };
  });

  // if (window.args?.[0] === "update-fixtures");
  console.log(json(actualResults));
  window.close(0);

}

function json(x) {
  const seen = new WeakSet();
  return JSON.stringify(x, (key, value) => {
    if (Object(value) === value) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    return value;
  }, 2);
}

run("testcases/index");
