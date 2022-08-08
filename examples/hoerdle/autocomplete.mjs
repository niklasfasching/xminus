import {html, css} from "../../src/jsxy.mjs";


css`
  x-autocomplete form {
  display: flex;
  }
  x-autocomplete form input {
  flex: 1;
  }
`;

export function Autocomplete({key = "_", values, cb}, render) {
  const options = values.map(v => html`<option>${v}</option>`);

  function onKeyDown(e) {
    if (e.key === "Enter") e.preventDefault();
  }

  function onClick(e) {
    const input = e.target.closest("x-autocomplete").querySelector("input");
    const x = input.value.toLowerCase();
    const suggestions = values.filter(v => v.toLowerCase().includes(x));
    if (!x) cb("<skip>"), e.target.blur();
    else if (suggestions.length) cb(suggestions[0]), e.target.blur();
    else alert("bad guess");
    input.value = "";
  }

  return html`
    <x-autocomplete>
      <form>
        <${Input} list=${values}/>
        <button type=button onclick=${onClick}>Ok</button>
        <datalist id=${key}>${options}</datalist>
      </form>
    </x-autocomplete>
  `;
}

css`
  x-input {
  position: relative;
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
  background: #999;
  }
`;

function Input({list}) {
  let suggestions = [];
  function onKeyUp(e) {
    suggestions = list.filter(x => x.toLowerCase().includes(e.target.value.toLowerCase()));
    const el = e.target.parentNode.querySelector(".results");
    el.style.visibility = "initial";
    el.innerHTML = suggestions.slice(0, 5).map(x => `<div>${x}</div>`).join("")
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
             autocomplete=off/>
      <div .results onclick=${onClick}/>
    </x-input>`

}
