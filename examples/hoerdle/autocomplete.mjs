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
    const input = e.target.form.elements.guess;
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
        <input list=${key}
               onkeydown=${onKeyDown}
               autocomplete=off
               name=guess/>
        <button type=button onclick=${onClick}>Ok</button>
        <datalist id=${key}>${options}</datalist>
      </form>
    </x-autocomplete>
  `;
}
