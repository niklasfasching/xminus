import {html, css, render, query, useEffect, sub} from "../../src/jsxy.mjs";

css`
  x-filters form {
  display: flex;
  position: relative;
  background: var(--ll);
  border-top: 1px solid var(--mg);
  border-bottom: 1px solid var(--mg);
  }

  x-filters .item > button {
  position: relative;
  padding: .5em 1em;
  border: none;
  border-right: 1px solid var(--mg);
  background: var(--ll);
  }

  x-filters .item > button.enabled::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: .125em;
  background: var(--fg);
  }

  x-filters .item.active > button {
  background: var(--bg);
  border-bottom: 1px solid var(--bg);
  margin-bottom: -1px;
  }

  x-filters .item:last-of-type.active > button {
  border-right: 1px solid var(--mg);
  }

  x-filters .dropdown {
  display: none;
  }

  x-filters .active .dropdown {
  position: absolute;
  display: block;
  background: var(--bg);
  top: calc(100% + 1px);
  left: 0;
  width: 100%;
  border-bottom: 1px solid var(--fg);
  }

  x-filters .active .cinemas {
  display: flex;
  gap: 1em;
  flex-wrap: wrap;
  padding: 4em 1em 1em 1em;
  }

  x-filters .cinema input {
  display: none;
  }

  x-filters .cinemas .clear {
  position: absolute;
  top: 0;
  right: 0;
  margin: 1em;
  border: none;
  background: var(--fg);
  color: var(--bg);
  }

  x-filters .cinema label {
  border: 1px solid var(--fg);
  padding: .25em;
  }

  x-filters .cinema input:checked + label {
  color: var(--bg);
  background: var(--fg);
  }

  x-filters .active .search {
  padding: 1em;
  display: flex;
  justify-content: stretch;
  }

  x-filters .search input {
  width: 100%;
  border: 1px solid var(--fg);
  padding: .25em;
  }

  x-filters .search .clear {
  border: 1px solid var(--fg);
  border-left: none;
  padding: 0 1em;
  }

  x-filters .lang input {
  display: none;
  }

  x-filters .lang label {
  display: block;
  padding: .5em 1em;
  border-right: 1px solid var(--mg);
  }

  x-filters .lang input:checked + label {
  background: var(--fg);
  color: var(--bg);
  }
`;

export function Filters({$, cinemas}) {
  useEffect(() => {
    function updateButtons() {
      const config = query.config || {};
      $.cinemasButton.classList.toggle("enabled", Object.keys(config.cinemas || {}).length);
      $.searchButton.classList.toggle("enabled", !!config.searchTitle);
    }
    updateButtons();
    return sub("query", "config", updateButtons);
  });

  function toggle(e) {
    const node = e.target.parentNode;
    for (let el of $.filters.querySelectorAll(".active")) {
      if (el !== node) el.classList.toggle("active", 0);
    }
    node.classList.toggle("active");
  }

  function onCinemaClear() {
    query.config = {...query.config, cinemas: {}};
    render($);
  }

  function onSearchClear() {
    query.config = {...query.config, searchTitle: null};
    render($);
  }

  const tags = cinemas.map(x => {
    return html`
      <div .cinema>
        <input type=checkbox name=cinemas id="cinema-${x}" value=${x}/>
        <label for="cinema-${x}">${x}</label>
      </div>`
  });

  return html`
    <x-filters $filters>
      <form :store:query:config>
        <div .item .lang .ov>
          <input type=checkbox name=ov id="ov"/>
          <label for="ov">OV</label>
        </div>
        <div .item .lang .en>
          <input type=checkbox name=en id="en"/>
          <label for="en">EN</label>
        </div>
        <div .item>
          <button $cinemasButton onclick=${toggle}>
            cinemas
          </button>
          <div .dropdown .cinemas>
            <button .clear onclick=${onCinemaClear}>clear</button>
            ${tags}
          </div>
        </div>
        <div .item>
          <button $searchButton onclick=${toggle}>
            search
          </button>
          <div .dropdown .search>
            <input id=searchTitle name=searchTitle placeholder=title/>
            <button .clear onclick=${onSearchClear}>clear</button>
          </div>
        </div>
      </form>
    </x-filters>
  `;
}
