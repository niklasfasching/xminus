import {t, done} from "../src/test.mjs";
import {html, render, useState, useEffect} from "../src/jsxy.mjs";

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
  });

  t.describe("render", () => {
    function reset() {
      document.body.innerHTML = "";
      document.body.hooks = undefined;
    }
    t.beforeEach(reset);
    t.afterEach(reset);

    t("static render", () => {
      const Component = () => {
        return html`<div>hello world</div>`;
      };
      render(document.body, html`<${Component} />`);
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
      render(document.body, html`<${Component} list=${[1,2,3]}/>`);
      t.assertFixture(document.body.innerHTML);
    });

    t("useEffect (even nested)", () => {
      let v;
      const Component = (props) => {
        useEffect((el) => {
          v = "effect";
          return () => v = "cleanup";
        }, []);
        return html`<div></div>`;
      };
      render(document.body, html`<div><${Component} key=1/></div>`);
      t.assert(v === "effect", v);
      render(document.body, null);
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

      render(document.body, html`<div>
        <${Component} key=a/>
        <${Component} key=b/>
      </div>`);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("#a").click();
      document.body.querySelector("#a").click();
      document.body.querySelector("#b").click();
      t.assertFixture(document.body.innerHTML);
    });


    t("dynamic render", () => {
      const Component = (props, render) => {
        const state = useState({n: 0});
        return html`
          <div onclick=${() => { state.n++;  render() } }>
            Count: ${state.n} ${state.n%2 === 1 && html`<b>(uneven!)</b>`}
          </div>
        `;
      };
      render(document.body, html`<${Component} key=counter/>`);
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
      render(document.body, html`<${Component} key=x/>`);
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
      render(document.body, html`<${Component} key=x/>`);
      render(document.body, html`<${Component} key=x/>`);
      t.assertFixture(document.body.innerHTML);
      document.body.querySelector("div").dispatchEvent(new Event("foo"));
      render(document.body, html`<${Component} key=x/>`);
      t.assertFixture(document.body.innerHTML);
    });
  });
});
