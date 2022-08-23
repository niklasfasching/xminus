import {html, css} from "../../src/jsxy.mjs";
css`
  x-show {
  display: block;
  padding: 1em;
  }

  x-show a {
  color: inherit;
  text-decoration: none;
  }

  x-show .main-title {
  display: block;
  margin-top: 2em;
  margin-bottom: 1rem;
  font-size: 1.75em;
  line-height: 1;
  }

  x-show .meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3em;
  }

  x-show .alternatives {
  background: var(--ll);
  padding: 1em;
  margin: 3em 0;
  }

  x-show table {
  position: relative;
  border-collapse: collapse;
  width: 100%;
  }

  x-show img {
  height: 50vh;
  object-fit: cover;
  }

  x-show table caption {
  text-align: left;
  font-size: 1.5em;
  margin-bottom: .5em;
  line-height: 1;
  }

  x-show tr {
  border-top: 1px solid var(--fg);
  border-bottom: 1px solid var(--fg);
  }

  x-show td {
  padding: .5em;
  }

  x-show .date {
  font-weight: bold;
  padding: 0 1em;
  }

  x-show :is(.day, .cinema, .available) {
  font-weight: lighter;
  }

  x-show .share {
  border: none;
  }

  x-show .hidden {
  display: none;
  }

  x-show .disabled {
  color: var(--mg);
  text-decoration: line-through;
  pointer-events: none;
  }
`;

export function Show({id, shows}) {
  const show = shows[id];
  const alternatives = Object.values(shows).filter((other) => {
    return show.normalizedTitle === other.normalizedTitle && other.timestamp >= Date.now();
  });
  const normalizedTitle = getValue(alternatives, "normalizedTitle");
  const description = getValue(alternatives, "description", true);
  const imgURL = getValue(alternatives, "img", true);
  const trailerURL = getValue(alternatives, "trailer", true);
  const trs = alternatives.sort((a, b) => a.timestamp - b.timestamp).map((show) => {
    let [day, date] = show.date.split(",");
    return html`
      <tr>
        <td>
          <a .title href="${show.url}" target="_blank" rel="noopener">
            ${show.title}
          </a>
          <div .cinema>${show.cinemaShortName}</div>
        </td>
        <td .date>${date}</td>
        <td .day>${day}</td>
        <td .time>
          <a href="${show.url}" target="_blank" rel="noopener">
            ${show.time}
            <div .available>${show.bookable ? "bookable": "sold out"}</div>
          </a>
        </td>
      </tr>`;
  });

  return html`<x-show>
    <div .main-title>${normalizedTitle}</div>
    <img .full-width src=${imgURL}/>
    <div .meta>
      <a .disabled=${!trailerURL} href="${trailerURL}">trailer</a>
      <button .share disabled=${!navigator.share} .disabled=${!navigator.share} onclick=${[onShare, normalizedTitle]}>
        share
      </button>
    </div>
    <div .alternatives .full-width>
      <table>
        <caption>Events</caption>
        <tbody>
          ${trs}
        </tbody>
      </table>
    </div>
    <p .description>
      ${description}
    </p>
  </x-show>`;
}

function onShare(_, title) {
  navigator.share({title, url: location.href});
}

function getValue(alternatives, key, longToShort) {
  const sorted = alternatives.sort((a, b) => a[key]?.length || 0 - b[key]?.length || 0);
  if (longToShort) sorted.reverse();
  return sorted[0][key];
}
