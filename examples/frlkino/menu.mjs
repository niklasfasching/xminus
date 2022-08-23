import {html, css, route, useEffect} from "../../src/jsxy.mjs";

css`
  x-menu button {
  border: none;
  padding: 0 .25em;
  cursor: pointer;
  }

  x-menu .overlay {
  position: absolute;
  top: 100%;
  left: 0;
  width: 0;
  height: 100vh;
  background: var(--bg);
  padding-top: 2em;
  transform: translateX(100vw);
  overflow: hidden;
  transition: transform .1s ease-in-out, width .1s ease-in-out;
  font-size: 1rem;
  }

  x-menu .open + .overlay {
  transform: translateX(0);
  width: 100vw;
  overflow-y: scroll;
  }

  x-menu a {
  display: inline-block;
  width: 100%;
  color: inherit;
  text-decoration: none;
  font-size: 3em;
  padding: .25em .5em;
  }

  x-menu :is(a:hover, a.active) {
  text-decoration: underline;
  text-underline-offset: .25em;
  }
`;

export function Menu({$, title, links, onclose, openClose = ["☰","✕"]}) {
  const list = links && Object.entries(links).map(([path, title]) =>
    html`<a href="#${path}" .active=${route.path === path}>${title}</a>`);
  const on = (_, state, onRender) => {
    if ($.button.classList.toggle("open", state)) {
      $.button.textContent = openClose[1];
      document.body.style.overflow = "hidden";
    } else {
      $.button.textContent = openClose[0];
      document.body.style.overflow = "initial";
      if (onclose && !onRender) onclose();
    }
  };

  useEffect(() => on(null, false, true), new Date());
  return html`
    <x-menu>
      <button $button onclick=${on}>${openClose[0]}</button>
      <div .overlay>
        ${title && html`<h1>${title}</h1>`}
        <div .list>${list}</div>
        ${$.self.children}
      </div>
    </x-menu>`;
}
