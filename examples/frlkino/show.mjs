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
  gap: 1em;
  margin-top: .5em;
  margin-bottom: 3em;
  }

  x-show .meta > * {
  flex: 1;
  text-align: center;
  padding: .25em;
  border: 1px solid var(--fg);
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

  x-show .title {
  display: block;
  }

  x-show :is(.day, .cinema) {
  font-weight: lighter;
  }

  x-show .disabled {
  color: var(--mg);
  text-decoration: line-through;
  pointer-events: none;
  border-color: var(--mg);
  }

  x-show .ticket {
  display: inline-block;
  position: relative;
  font-size: .5em;
  background: var(--lg);
  margin-right: 2em;
  }

  x-show .ticket::before {
  content: "full";
  color: var(--bg);
  display: inline-grid;
  place-content: center;
  background: inherit;
  height: 4ch;
  width: 7ch;
  }

  x-show .ticket::after {
  content: "";
  display: block;
  background: inherit;
  position: absolute;
  top: 0;
  left: 7ch;
  height: 4ch;
  width: 3ch;
  border-left: 1px dashed var(--bg);
  }

  x-show .ticket.bookable {
  background: var(--fg);
  }

  x-show .ticket.bookable::before {
  content: "buy";
  }

  x-show .tags {
  display: flex;
  gap: .5em;
  line-height: 1;
  }

  x-show .tags span {
  padding: 0 .1em;
  border: 1px solid var(--lg);
  color: var(--lg);
  }

  x-show .tags span:first-of-type {
  margin-left: auto;
  }
`;

export function Show({id, shows}) {
  const show = shows[id];
  const alternatives = Object.values(shows).filter((other) => {
    return show.normalizedTitle === other.normalizedTitle &&
           other.timestamp >= Date.now();
  });
  const normalizedTitle = getValue(alternatives, "normalizedTitle");
  const description = getValue(alternatives, "description", true);
  const imgURL = getValue(alternatives, "img", true);
  const trailerURL = getValue(alternatives, "trailer", true);
  const trs = alternatives
    .sort((a, b) => a.timestamp - b.timestamp).map((show) => {
    let [day, date] = show.date.split(",");
      return html`
        <tr>
          <td>
            <a .title href="${show.url}" target="_blank" rel="noopener">
              ${show.title}
              <div .cinema>${show.cinemaShortName}</div>
              <div .tags>
                <div .ticket .bookable=${show.bookable}/>
                ${show.version.original && html`<span>ov</span>`}
                ${show.version.english && html`<span>en</span>`}
              </div>

            </a>
          </td>
          <td .date>${date}</td>
          <td .day>${day}</td>
          <td .time>${show.time}</td>
        </tr>`;
    });

  return html`<x-show>
    <div .main-title>${normalizedTitle}</div>
    <img .full-width src=${imgURL}/>
    <div .meta>
      <a .disabled=${!trailerURL} href="${trailerURL}">
        trailer
      </a>
      <button .share .disabled=${!navigator.share}
              disabled=${!navigator.share}
              onclick=${[onShare, normalizedTitle]}>
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
