import {t, done} from "../src/test.mjs";
import {html, render, useState, useEffect, sub, db, query} from "../src/jsxy.mjs";

t.describe("jsxy", () => {
  t.exitAfter();

  t.describe("html", () => {
    function test(msg, actual) {
      t(msg, () => t.assertFixture(actual));
    }

    test("empty", html``);

    test("simple tags", html`
      <body>
        <div></div>
        <p></p>
        <b/>
        <span/>
        <span />
        <p></>
      </body>
    `);

    test("component tags", html`
    <${() => {}}></>
    `);

    test("simple attributes", html`
      <body>
        <div a b c=value d=${42}></div>
        <div a/>
        <div a=${42}/>
      </body>
    `);

    test("quoted attributes", html`
      <div a="q u o t e d"
           b='q u o t e d'
           c='q u ${"o"} t ${"e"} d'
           d="">
      </div>
    `);

    test("dynamic attribute keys", html`
      <div ${"a"}=1 ${"b"}=2></div>
    `);

    test("...spread props", html`
      <div a b=1 ...=${{c: 2, d: 3}} ...=${{e: 4}}></div>
    `);

    test("--css-var props", html`
      <div --size=1em></div>
    `);

    test("class and id props", html`
      <div>
      <div .foo .bar #baz/>
      <div .foo=${false} .bar=${0} #baz=""/>
      </div>
    `);

    test("children", html`
      <body>
        <div>
          ${"dynamic"} div text
          <b>and a node</b>
        </div>
        ${"dynamic"} body text
      </body>
    `);


    test("array html children", html`
      <div>
        ${[1,2,3].map(x => html`<div>${x}</div>`)}
      </div>
    `);

    test("tag starting with special prop renders as div - but not null value tag", html`
      <div>
        <.class></><.class/>
        <#id></><#id/>
        <--display=contents></><--display=contents/>
        <...=${{x: 10}}></><...=${{x: 10}}/>
        <${null}></><${null}/>
      </div>
    `);
  });

  t.describe("render", () => {
    function reset() {
      document.body.innerHTML = "";
      document.body.hooks = undefined;
      history.replaceState(null, null, " ");
      localStorage.clear();
    }
    t.beforeEach(reset);
    t.afterEach(reset);

    t("static render", () => {
      const Component = () => {
        return html`<div>hello world</div>`;
      };
      render(html`<${Component} />`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("svg", () => {
      render(html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="0" y="0" width="100" height="100" stroke="black"/>
      </svg>`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("vnode/vnode array children render", () => {
      const Component = (props) => {
        return html`
          <ul>
            ${props.list.map(x => html`<li>${x}</li>`)}
            ${html`<li>4</li>`}
          </ul>`;
      };
      render(html`<${Component} list=${[1,2,3]}/>`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("useEffect (even nested)", () => {
      let v;
      const Component = (props) => {
        useEffect((el) => {
          v = "effect";
          return () => v = "cleanup";
        }, []);
        return html`<div/>`;
      };
      render(html`<div><${Component} key=1/></div>`, document.body);
      t.assert(v === "effect", v);
      render(null, document.body);
      t.assert(v === "cleanup", v);
    });

    t("sibling hooks", () => {
      let v;
      const Component = (props) => {
        const state = useState({n: 0});
        return html`
          <div @click=${() => state.n++} #${props.key}>
            Count: ${state.n}
          </div>
        `;
      };

      render(html`<div>
        <${Component} key=a/>
        <${Component} key=b/>
      </div>`, document.body);
      document.body.querySelector("#a").click();
      document.body.querySelector("#b").click();
      t.assertFixture(document.body.innerHTML);

      render(html`<div>
        <${Component} key=a/>
        <${Component} key=b/>
      </div>`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("render array of vnodes", () => {
      render([1,2,3].map(x => html`<div>${x}</div>`), document.body)
      t.assertFixture(document.body.innerHTML);
      render([4,5].map(x => html`<div>${x}</div>`), document.body)
      t.assertFixture(document.body.innerHTML);
    });


    t("dynamic render", () => {
      const Component = ({$}) => {
        const state = useState({n: 0});
        return html`
          <div onclick=${() => { state.n++;  render($) } }>
            Count: ${state.n} ${state.n%2 === 1 && html`<b>(uneven!)</b>`}
          </div>
        `;
      };
      render(html`<${Component} key=counter/>`, document.body);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").click()
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").click()
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").click()
      t.assertFixture(document.body.innerHTML);
    });

    t("@handlers", () => {
      const Component = () => {
        const state = useState({n: 0});
        return html`<div @click=${() => state.n++}>${state.n}</div>`;
      };
      render(html`<${Component} key=x/>`, document.body);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").click();
      t.assertFixture(document.body.innerHTML);
    });

    t("custom event handlers", () => {
      const Component = () => {
        const state = useState({n: 0});
        return html`<div onfoo=${() => state.n++ }>${state.n}</div>`;
      };
      // render twice to set event listener twice (i.e. test if previous is removed)
      render(html`<${Component} key=x/>`, document.body);
      render(html`<${Component} key=x/>`, document.body);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").dispatchEvent(new Event("foo"));
      render(html`<${Component} key=x/>`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("$references", () => {
      let $;
      const Component = (props) => {
        $ = props.$;
        return html`
          <div>
            <button $a>a</button>
            <div><button $b>b</button></div>
          </div>
        `;
      }
      render(html`<${Component}/>`, document.body);
      t.assert($.a.innerText === "a");
      t.assert($.b.innerText === "b");
    });

    t("render root/app from any child", () => {
      let i = 0;
      const App = () => html`<div><${Component}/>${i++}</div>`;
      const Component = ({$}) => html`<button onclick=${() => render($.app)}></button>`;

      render(html`<${App}/>`, document.body);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("button").click();
      t.assertFixture(document.body.innerHTML);
    });

    t("renderChildren works correctly when removing children", () => {
      render(html`<div>${[1, 2, 3]}</div>`, document.body);
      t.assertFixture(document.body.innerHTML);
      render(html`<div>${[1, null, 3]}</div>`, document.body);
      t.assertFixture(document.body.innerHTML);
    });

    t("render removes existing vnode props when necessary", () => {
      render(html`<div .class>hello world</div>`, document.body);
      render(html`<div>hello world</div>`, document.body);
      t.assertFixture(document.body.innerHTML);
    })
  });

  t.describe("db/query", () => {
    t.describe("publish", () => {
      t("publish changes and allow unsubscribing", () => {
        for (let store of [db, query]) {
          const vs = [], k = "k";
          const unsub = sub(store, k, v => vs.push(v))
          store[k] = "bar";
          store[k] = "baz";
          unsub();
          t.assert(vs.join(",") === "bar,baz");
          store[k] = "bam";
          t.assert(vs.join(",") === "bar,baz");
        }
      });

      t("only publish changes that happen outside of subscriptions", async () => {
        for (let store of [db, query]) {
          const vs = [], k = "k";
          const unsub = sub(store, k, v => {
            vs.push(v);
            store[k] = "nope";
          });
          store[k] = "bar";
          unsub();
          t.assert(vs.join(",") === "bar");
        }
      });
    });

    t.describe("query", () => {
      t("preserves path unencoded", () => {
        history.replaceState(null, "", "?/some/path");
        query.foo = "bar"
        t.assert(location.search === "?/some/path&foo=bar")
        delete query.foo
        t.assert(location.search === "?/some/path")
      });
    });
  });
});
