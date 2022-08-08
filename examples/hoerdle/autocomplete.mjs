import {html, css} from "../../src/jsxy.mjs";

css`
  x-autocomplete form {
  display: flex;
  }
`;

export function Autocomplete({key = "_", values, cb}, render) {
  function onKeyDown(e) {
    if (e.key === "Enter") e.preventDefault();
  }

  function onClick(e) {
    const input = e.target.closest("x-autocomplete").querySelector("input");
    if (!input.value) cb("<skip>"), e.target.blur();
    else if (values.includes(input.value)) cb(input.value), e.target.blur();
    else alert("bad guess");
    input.value = "";
  }

  return html`
    <x-autocomplete>
      <form>
        <${Input} list=${values}/>
        <button type=button onclick=${onClick}>Ok</button>
      </form>
    </x-autocomplete>
  `;
}

css`
  x-input {
  position: relative;
  width: 100%;
  }

  x-input input {
  width: 100%;
  }

  x-input .results {
  position: absolute;
  background: white;
  width: 100%;
  z-index: 1;
  }

  x-input .results div {
  border: 1px solid black;
  padding: 0.5em;
  }

  x-input .results div:hover {
  background: #eee;
  }
`;

function Input({list}) {
  let suggestions = [];

  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (suggestions.length) e.target.value = suggestions[0];
    onBlur(e);
  }

  function onKeyUp(e) {
    if (e.key === "Escape") return void onBlur(e);
    const v = e.target.value.toLowerCase();
    suggestions = list.filter(x => x.toLowerCase().includes(v));

    const el = e.target.parentNode.querySelector(".results");
    el.style.visibility = "initial";
    el.innerHTML = suggestions
      .sort((a, b) => a.toLowerCase().indexOf(v) - b.toLowerCase().indexOf(v))
      .slice(0, 5).map(x => `<div>${x}</div>`).join("")
  }

  function onBlur(e) {
    const el = e.target.parentNode.querySelector(".results");
    setTimeout(() => el.style.visibility = "hidden", 100);
  }

  function onClick(e) {
    const input = e.target.closest("x-input").querySelector("input");
    input.value = e.target.innerText;
  }

  return html`
    <x-input>
      <input onblur=${onBlur}
             onkeyup=${onKeyUp}
             onkeydown=${onKeyDown}
             autocomplete=off/>
      <div .results onclick=${onClick}/>
    </x-input>`

}
