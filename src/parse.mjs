// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const voidTags = {area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1};


export function parseValue(input) {
  const [parts, isDynamic] = parseValueParts(input);
  return [parts.length === 1 ? parts[0][0] : parts.map(p => p[0]).join(" + "),
          isDynamic ?  null : parts[0][1],
          isDynamic];
}

export function parseValueParts(input) {
  let parts = [], part = "", lvl = 0, push = () => {
    if (part) parts.push([lvl === 1 ? `(${part})` : `"${part}"`, part, lvl === 1]);
    part = "";
  };
  for (let c of input) {
    if (c === "{" && lvl === 0) push(), lvl++;
    else if (c === "}" && lvl === 1) push(), lvl--;
    else part +=c;
  }
  push();
  return [parts, parts.some(p => p[2])];
}

export function parse(template) {
  const tokens = lex(template), vnodes = [], parents = [];
  for (let i = 0, [$, x] = tokens[0]; i < tokens.length; i++, [$, x] = tokens[i] || []) {
    if ($ === "open") {
      const vchild = {tag: x, properties: {}, children: [], parent: parents[0]};
      (parents[0]?.children || vnodes).push(vchild);
      parents.unshift(vchild);
    } else if ($ === "close") {
      parents.shift();
    } else if ($ === "child") {
      (parents[0]?.children || vnodes).push(...parseValueParts(x)[0]);
    } else if ($ === "key") {
      parents[0].properties[x] = tokens[++i][1];
    } else throw "unexpected: " + $;
  }
  if (parents.length) throw new Error(`unclosed ${parents[0].tag}: ${template}`);
  return vnodes;
}

export function lex(template) {
  let $ = "child", tag = "", tmp = "", tokens = [], push = ($next) => {
    if (tmp.trim()) tokens.push([$, tmp]);
    if ($ === "open") tag = tmp;
    $ = $next, tmp = "";
  };
  for (let i = 0, c = template[0]; i < template.length; i++, c = template[i]) {
    if ($ === "child" && c === "<") {
      push(template[i+1] === "/" ? "close" : "open");
    } else if ($ !== "child" && (c === ">" || c === "/" && template[i+1] === ">")) {
      push("child");
      if (c === "/") i++;
      if (c === "/" || voidTags[tag]) tokens.push(["close", "/"]);
    } else if ($ !== "child" && (c === " " || c === "\n")) {
      push("key");
      if (tokens[tokens.length-1][0] === "key") tokens.push(["value", "true"]);
    } else if ($ === "value" && (c === "'" || c === '"')) {
      while (template[++i] !== c) tmp += template[i];
      tmp = tmp || "true";
      push("key");
    } else if ($ === "key" && c === "=") {
      push("value");
    } else {
      tmp += c;
    }
  }
  push();
  return tokens;
}
