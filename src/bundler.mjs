import {compile} from "./compiler.mjs";

export async function bundle(url, asDataUrl) {
  const modules = await loadModule(url);
  const code = modules
        .flatMap(({componentTemplates}) => componentTemplates)
        .map(({name, content}) => compile(name, content))
        .join("\n");
  if (asDataUrl) {
    const imports = modules.slice(1)
          .map(m => `//# sourceURL=${new URL(m.url).pathname}.js\n${m.code}`)
          .concat(`//# sourceURL=xmComponents.js\n${code}`)
          .map(src => `import "${dataUrl(src)}";`);
    return dataUrl(imports.join("\n"));
  }
  const document = modules[0].document;
  const scripts = modules.map(m => m.code).concat(code).map(code => {
    return `<script type=module>\n${code}</script>`;
  }).join("\n");
  document.head.innerHTML = "\n" + scripts + document.head.innerHTML;
  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}

export async function loadModule(url, loaded = {}) {
  if (loaded[url]) return [];
  loaded[url] = true;
  const document = url === location ? window.document : await loadDocument(url);
  const templates = [...document.querySelectorAll(`[type*=x-template][id]`)],
        imports = [...document.querySelectorAll(`[type*=x-module][src]`)],
        scripts = [...document.querySelectorAll(`[type*=module]:not([src])`)];
  if (url !== location) [templates, imports, scripts].flat().forEach(el => el.remove());
  if (scripts.length > 1) throw new Error(`One module per file - found ${scripts.length}`);
  const modules = await Promise.all(imports.map(({src}) => loadModule(resolveUrl(src, url), loaded))),
        code = rewriteRelativeImports((scripts[0]?.text || "")),
        componentTemplates = templates.map(({id, text}) => ({name: id, content: text}));
  return [{url: resolveUrl(url), document, code, componentTemplates}, ...modules.flat()];
}

export function dataUrl(string) {
  return `data:text/javascript,${encodeURIComponent(string)}`;
}

function rewriteRelativeImports(script, baseUrl) {
  return script.replaceAll(/^\s*(import\s+(.*from\s+)?)["'](.+)["']/g,
                         (_, from, __, src) => `${from} "${resolveUrl(src, baseUrl)}"`);
}

function resolveUrl(url, baseUrl) {
  if (!baseUrl) baseUrl = location;
  else if (baseUrl.toString().startsWith("data:")) return url;
  return new URL(url, new URL(baseUrl, location)).pathname;
}

function loadDocument(url) {
  return fetch(url).then(async (r) => new DOMParser().parseFromString(await r.text(), "text/html"));
}
