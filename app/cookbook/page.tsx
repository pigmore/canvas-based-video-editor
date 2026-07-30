import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CBody Cookbook — Practical canvas UI recipes",
  description:
    "Copyable recipes for markup, reactive bindings, events, CSS layout, lifecycle hooks, and ECS debugging with CBody.",
};

const recipes = [
  {
    id: "first-surface",
    number: "01",
    label: "First surface",
    title: "Turn ordinary markup into one canvas",
    intro:
      "Register the custom element, wrap your interface in <cbody>, and provide a logical canvas size. CBody compiles the source children and detaches them after mounting.",
    tabs: ["HTML", "JS"],
    code: `<cbody width="960" height="540">
  <main class="welcome">
    <h1>Hello from canvas</h1>
    <p>This text is painted, not mounted DOM.</p>
  </main>
</cbody>

<script type="module">
  import { registerCanvasBody } from "./canvas-ecs";
  registerCanvasBody();
</script>`,
    note: "The <cbody> element remains as the canvas host. Its authored child elements do not remain in the document tree.",
  },
  {
    id: "bindings",
    number: "02",
    label: "Bindings",
    title: "Bind nested state with {paths}",
    intro:
      "Any direct text or attribute containing braces becomes a binding. Assign one plain object to data; nested objects are wrapped in reactive proxies.",
    tabs: ["HTML", "JS"],
    code: `<cbody id="app" width="720" height="360">
  <section class="profile" data-plan="{user.plan}">
    <h1>Welcome, {user.name}</h1>
    <p>You have {inbox.unread} unread messages.</p>
  </section>
</cbody>

<script type="module">
  const app = document.querySelector("#app");

  app.data = {
    user: { name: "Maya", plan: "studio" },
    inbox: { unread: 4 }
  };

  // Triggers a new binding/render frame.
  app.data.inbox.unread++;
</script>`,
    note: "Bindings intentionally accept property paths, not arbitrary JavaScript expressions. Compute complex values in your state layer.",
  },
  {
    id: "events",
    number: "03",
    label: "Events",
    title: "Keep familiar click handlers",
    intro:
      "The input system hit-tests pointer coordinates against layout components and dispatches a MouseEvent to the original detached element.",
    tabs: ["HTML", "JS"],
    code: `<button class="counter" onclick="counter.add()">
  Count: {count}
</button>

<script>
  const app = document.querySelector("cbody");

  window.counter = {
    add() {
      app.data.count++;
    }
  };
</script>`,
    note: "For larger applications, expose one small action object instead of many global functions. A future API can replace this bridge with declarative actions.",
  },
  {
    id: "layout",
    number: "04",
    label: "Layout",
    title: "Compose cards with the CSS subset",
    intro:
      "The prototype resolves focused block and flex layouts. Use explicit surface dimensions and predictable component heights while the layout engine is still young.",
    tabs: ["CSS"],
    code: `.dashboard {
  width: 960px;
  height: 540px;
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 20px;
  background: #f2efe7;
}

.sidebar {
  width: 220px;
  height: 500px;
  padding: 18px;
  border-radius: 16px;
  color: #f2efe7;
  background: #17211b;
}

.content {
  height: 500px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}`,
    note: "Supported today: display, flex direction/grow/alignment, width, height, position, spacing, box colors, borders, radius, opacity, typography, and :hover.",
  },
  {
    id: "hover",
    number: "05",
    label: "Interaction",
    title: "Paint hover feedback",
    intro:
      "The style system keeps separate hover rules. Pointer movement changes the hovered entity, recomputes styles, and schedules one canvas frame.",
    tabs: ["CSS"],
    code: `.action {
  width: 160px;
  height: 48px;
  border: 0;
  border-radius: 12px;
  color: #f7f5ff;
  background: #28213e;
  cursor: pointer;
}

.action:hover {
  color: #17211b;
  background: #c8ff62;
}`,
    note: "Hover currently targets one deepest hit-tested entity. Focus, active, and keyboard-navigation states belong in the next input-system milestone.",
  },
  {
    id: "lifecycle",
    number: "06",
    label: "Lifecycle",
    title: "Observe render and click activity",
    intro:
      "CBody emits host-level custom events after frames and pointer clicks. Use them for instrumentation without coupling your app to internal systems.",
    tabs: ["JS"],
    code: `const app = document.querySelector("cbody");

app.addEventListener("cbody:render", (event) => {
  console.log("entities:", event.detail.entities);
});

app.addEventListener("cbody:click", (event) => {
  console.log("source element:", event.detail.element);
});

// Manually schedule a frame when integrating
// with state that is not app.data.
app.invalidate();`,
    note: "Do not run business logic from cbody:render; it may fire often. Treat it as a profiler and integration hook.",
  },
];

const support = [
  ["Layout", "block flow, flex row/column, grow, gap, alignment, absolute positioning"],
  ["Visual", "backgrounds, borders, radius, opacity, text color and casing"],
  ["Typography", "family, size, weight, line height, alignment, basic wrapping"],
  ["Input", "pointer hover, pointer capture, click dispatch, cursor styles"],
  ["Binding", "direct text and attribute interpolation with nested property paths"],
];

export default function CookbookPage() {
  return (
    <main className="cookbook-shell" id="top">
      <header className="cookbook-topbar">
        <Link className="site-brand" href="/" aria-label="Back to CBody home">
          <span className="site-brand-mark">C</span>
          <span>CBody</span>
          <small>Cookbook</small>
        </Link>
        <div className="cookbook-top-actions">
          <span><i /> Local prototype</span>
          <Link href="/">Back to playground →</Link>
        </div>
      </header>

      <div className="cookbook-layout">
        <aside className="cookbook-sidebar">
          <div className="cookbook-sidebar-label">Recipes</div>
          <nav aria-label="Cookbook recipes">
            {recipes.map((recipe) => (
              <a href={`#${recipe.id}`} key={recipe.id}>
                <span>{recipe.number}</span>
                {recipe.label}
              </a>
            ))}
            <a href="#support"><span>07</span>Support matrix</a>
            <a href="#production"><span>08</span>Production notes</a>
          </nav>
          <div className="cookbook-sidebar-card">
            <b>Prototype rule</b>
            <p>Prefer small, explicit canvas surfaces before attempting a full browser-layout replacement.</p>
          </div>
        </aside>

        <article className="cookbook-content">
          <section className="cookbook-hero">
            <span className="section-index">CBody / Practical guide</span>
            <h1>Canvas UI<br /><em>cookbook.</em></h1>
            <p>
              Copyable patterns for building interfaces with normal markup,
              CSS, JavaScript, reactive data, and an ECS-powered canvas runtime.
            </p>
            <div className="cookbook-jump">
              <a href="#first-surface">Start with recipe 01 <span>↓</span></a>
              <span>8 recipes · focused v0.1 API</span>
            </div>
          </section>

          <section className="cookbook-principle">
            <div>
              <span>Author</span>
              <strong>HTML + CSS + JS</strong>
            </div>
            <b>→</b>
            <div>
              <span>Compile</span>
              <strong>Entities + components</strong>
            </div>
            <b>→</b>
            <div>
              <span>Output</span>
              <strong>One canvas</strong>
            </div>
          </section>

          {recipes.map((recipe) => (
            <section className="recipe" id={recipe.id} key={recipe.id}>
              <div className="recipe-copy">
                <span className="recipe-number">{recipe.number} / {recipe.label}</span>
                <h2>{recipe.title}</h2>
                <p>{recipe.intro}</p>
                <div className="recipe-note">
                  <b>Good to know</b>
                  <span>{recipe.note}</span>
                </div>
              </div>
              <div className="recipe-code">
                <div className="recipe-code-top">
                  <div>
                    {recipe.tabs.map((tab, index) => (
                      <span className={index === 0 ? "active" : ""} key={tab}>{tab}</span>
                    ))}
                  </div>
                  <span>copy / adapt</span>
                </div>
                <pre><code>{recipe.code}</code></pre>
              </div>
            </section>
          ))}

          <section className="support-section" id="support">
            <span className="recipe-number">07 / Support matrix</span>
            <h2>Know the current boundary.</h2>
            <p>
              CBody v0.1 is a framework spike, not a complete browser engine.
              Its focused subset is enough to validate the ECS and rendering model.
            </p>
            <div className="support-table">
              {support.map(([area, detail]) => (
                <div key={area}>
                  <strong>{area}</strong>
                  <span>{detail}</span>
                  <b>Available</b>
                </div>
              ))}
            </div>
          </section>

          <section className="production-section" id="production">
            <div>
              <span className="recipe-number">08 / Production notes</span>
              <h2>What to build next.</h2>
            </div>
            <ol>
              <li><b>Accessibility mirror</b><span>Expose semantic controls and focus order without visually rendering DOM content.</span></li>
              <li><b>Text engine</b><span>Add shaping, selection, editing, measurement caches, and font-loading invalidation.</span></li>
              <li><b>Incremental queries</b><span>Track dirty components so bindings do not force every style and layout system to run.</span></li>
              <li><b>Worker renderer</b><span>Move layout and painting toward OffscreenCanvas after the API stabilizes.</span></li>
            </ol>
          </section>

          <footer className="cookbook-footer">
            <span><b>CBody cookbook</b> / local development edition</span>
            <a href="#top">Back to top ↑</a>
          </footer>
        </article>
      </div>
    </main>
  );
}
