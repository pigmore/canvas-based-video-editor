"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasBodyElement, registerCanvasBody } from "./canvas-ecs";

declare global {
  interface Window {
    canvasApp?: {
      increment: () => void;
      decrement: () => void;
      toggleStatus: () => void;
    };
  }
}

const source = String.raw`
<style>
  .canvas-app {
    width: 960px;
    height: 560px;
    display: flex;
    flex-direction: row;
    gap: 18px;
    padding: 18px;
    color: #17211b;
    background: #efece2;
    font-family: Arial, sans-serif;
  }
  .canvas-rail {
    width: 208px;
    height: 524px;
    padding: 22px;
    border-radius: 20px;
    color: #f4f7ee;
    background: #17211b;
  }
  .canvas-brand {
    height: 66px;
    color: #c8ff62;
    font-size: 20px;
    font-weight: 800;
  }
  .canvas-kicker {
    height: 28px;
    color: #8d9b90;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .canvas-nav {
    height: 41px;
    padding: 11px 12px;
    border-radius: 10px;
    color: #bcc7be;
    font-size: 13px;
  }
  .canvas-nav.active {
    color: #17211b;
    background: #c8ff62;
    font-weight: 700;
  }
  .canvas-rail-note {
    height: 220px;
    padding: 142px 0 0;
    color: #718077;
    font-size: 11px;
    line-height: 1.5;
  }
  .canvas-main {
    height: 524px;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
  }
  .canvas-header {
    height: 70px;
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .canvas-heading {
    height: 58px;
    flex: 1;
    color: #17211b;
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
  }
  .canvas-person {
    width: 190px;
    height: 50px;
    padding: 9px 12px;
    border: 1px solid #d2cec2;
    border-radius: 14px;
    color: #48534b;
    background: #f8f6f0;
    font-size: 13px;
    font-weight: 700;
  }
  .canvas-stats {
    height: 148px;
    display: flex;
    flex-direction: row;
    gap: 12px;
  }
  .canvas-card {
    height: 148px;
    flex: 1;
    padding: 18px;
    border: 1px solid #d7d3c8;
    border-radius: 18px;
    background: #faf8f2;
  }
  .canvas-card-label {
    height: 31px;
    color: #7d847e;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .canvas-card-value {
    height: 57px;
    color: #17211b;
    font-size: 38px;
    font-weight: 800;
  }
  .canvas-card-note {
    height: 24px;
    color: #758078;
    font-size: 12px;
  }
  .canvas-card.accent {
    border-color: #17211b;
    color: #f4f7ee;
    background: #17211b;
  }
  .canvas-card.accent .canvas-card-label { color: #8e9b91; }
  .canvas-card.accent .canvas-card-value { color: #c8ff62; }
  .canvas-card.accent .canvas-card-note { color: #a8b2aa; }
  .canvas-workspace {
    height: 278px;
    display: flex;
    flex-direction: row;
    gap: 14px;
  }
  .canvas-counter {
    height: 278px;
    flex: 1;
    padding: 22px;
    border-radius: 20px;
    background: #d9d2ff;
  }
  .canvas-counter-title {
    height: 36px;
    color: #5a5474;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .canvas-counter-value {
    height: 124px;
    color: #28213e;
    font-size: 88px;
    font-weight: 800;
    line-height: 1;
  }
  .canvas-actions {
    height: 58px;
    display: flex;
    flex-direction: row;
    gap: 10px;
  }
  .canvas-button {
    width: 86px;
    height: 48px;
    border: 0;
    border-radius: 12px;
    color: #f7f5ff;
    background: #28213e;
    cursor: pointer;
    font-size: 21px;
    font-weight: 800;
    text-align: center;
  }
  .canvas-button:hover { background: #51466f; }
  .canvas-activity {
    width: 246px;
    height: 278px;
    padding: 22px;
    border: 1px solid #d7d3c8;
    border-radius: 20px;
    background: #faf8f2;
  }
  .canvas-activity-title {
    height: 42px;
    color: #17211b;
    font-size: 16px;
    font-weight: 800;
  }
  .canvas-status {
    height: 58px;
    padding: 18px 14px;
    border-radius: 12px;
    color: #30633d;
    background: #d8f2d8;
    font-size: 13px;
    font-weight: 700;
  }
  .canvas-detail {
    height: 82px;
    padding: 18px 0 0;
    color: #6f7771;
    font-size: 12px;
    line-height: 1.55;
  }
  .canvas-toggle {
    width: 202px;
    height: 43px;
    border: 1px solid #c7c3b8;
    border-radius: 11px;
    color: #27302a;
    background: #f1eee5;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .canvas-toggle:hover { background: #e3dfd4; }
</style>

<div class="canvas-app">
  <aside class="canvas-rail">
    <div class="canvas-brand">C / BODY</div>
    <div class="canvas-kicker">Workspace</div>
    <div class="canvas-nav active">Overview</div>
    <div class="canvas-nav">Entities</div>
    <div class="canvas-nav">Systems</div>
    <div class="canvas-nav">Profiler</div>
    <div class="canvas-rail-note">DOM-shaped input.<br>Canvas-native output.</div>
  </aside>

  <main class="canvas-main">
    <header class="canvas-header">
      <div class="canvas-heading">Good morning, {user.name}</div>
      <div class="canvas-person">{user.name}<br>{user.plan} plan</div>
    </header>

    <section class="canvas-stats">
      <div class="canvas-card accent">
        <div class="canvas-card-label">Renderer</div>
        <div class="canvas-card-value">{fps} FPS</div>
        <div class="canvas-card-note">Single canvas surface</div>
      </div>
      <div class="canvas-card">
        <div class="canvas-card-label">ECS entities</div>
        <div class="canvas-card-value">{entities}</div>
        <div class="canvas-card-note">Compiled once</div>
      </div>
      <div class="canvas-card">
        <div class="canvas-card-label">DOM nodes mounted</div>
        <div class="canvas-card-value">0</div>
        <div class="canvas-card-note">Inside the render tree</div>
      </div>
    </section>

    <section class="canvas-workspace">
      <div class="canvas-counter">
        <div class="canvas-counter-title">Reactive binding demo</div>
        <div class="canvas-counter-value">{count}</div>
        <div class="canvas-actions">
          <button class="canvas-button" onclick="canvasApp.decrement()">−</button>
          <button class="canvas-button" onclick="canvasApp.increment()">+</button>
        </div>
      </div>
      <div class="canvas-activity">
        <div class="canvas-activity-title">Runtime activity</div>
        <div class="canvas-status">{status}</div>
        <div class="canvas-detail">Pointer events are hit-tested against ECS layout components, then dispatched to your original element handlers.</div>
        <button class="canvas-toggle" onclick="canvasApp.toggleStatus()">Toggle status</button>
      </div>
    </section>
  </main>
</div>`;

const snippets = {
  markup: `<cbody width="960" height="560">
  <div class="dashboard">
    <h1>Hello, {user.name}</h1>
    <p>Count: {count}</p>
    <button onclick="app.data.count++">
      Increment
    </button>
  </div>
</cbody>`,
  css: `.dashboard {
  display: flex;
  gap: 16px;
  padding: 24px;
  background: #f5f2ea;
}

button:hover {
  background: #51466f;
}`,
  javascript: `const app = document.querySelector("cbody");

app.data = {
  user: { name: "Maya" },
  count: 0
};

// Nested state is reactive.
app.data.count++;`,
  ecs: `BindingSystem → StyleSystem → LayoutSystem
              ↓
InputSystem  →  RenderSystem

Entity 42
├─ Tree      { parent, children, element }
├─ Binding   { text, attributes }
├─ Style     { display, color, gap, ... }
└─ Layout    { x, y, width, height }`,
};

type Tab = keyof typeof snippets;

export function FrameworkDemo() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("markup");
  const [entityCount, setEntityCount] = useState(0);

  useEffect(() => {
    registerCanvasBody();
    if (!previewRef.current) return;
    previewRef.current.innerHTML = `<cbody width="960" height="560" aria-label="Interactive CBody framework demo">${source}</cbody>`;
    const app = previewRef.current.querySelector("cbody") as CanvasBodyElement | null;
    if (!app) return;

    app.data = {
      user: { name: "Maya", plan: "Studio" },
      count: 12,
      fps: 60,
      entities: 28,
      status: "All systems operational",
    };
    window.canvasApp = {
      increment: () => { app.data.count = Number(app.data.count) + 1; },
      decrement: () => { app.data.count = Number(app.data.count) - 1; },
      toggleStatus: () => {
        app.data.status = app.data.status === "All systems operational"
          ? "Binding system updated"
          : "All systems operational";
      },
    };
    const onRender = (event: Event) => {
      const entities = (event as CustomEvent<{ entities: number }>).detail.entities;
      setEntityCount(entities);
    };
    app.addEventListener("cbody:render", onRender);

    return () => {
      app.removeEventListener("cbody:render", onRender);
      delete window.canvasApp;
    };
  }, []);

  return (
    <main className="site-shell">
      <header className="site-nav">
        <a className="site-brand" href="#top" aria-label="CBody home">
          <span className="site-brand-mark">C</span>
          <span>CBody</span>
          <small>Canvas runtime</small>
        </a>
        <nav aria-label="Main navigation">
          <a href="#playground">Playground</a>
          <a href="#architecture">Architecture</a>
          <a href="#start">Quick start</a>
        </nav>
        <a className="site-nav-cta" href="#start">Read the API <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Experimental framework · v0.1</div>
          <h1>Write the web.<br /><em>Render the canvas.</em></h1>
          <p>
            Keep the HTML, CSS, and JavaScript workflow you already know.
            CBody compiles it into an ECS world and paints the final interface
            on one high-performance canvas.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#playground">Try the live canvas <span>↓</span></a>
            <a className="text-link" href="#architecture">See how it works <span>→</span></a>
          </div>
        </div>
        <div className="hero-terminal" aria-label="CBody code example">
          <div className="terminal-top">
            <span><i /><i /><i /></span>
            <span>index.html</span>
            <span>01</span>
          </div>
          <pre><code><b>&lt;cbody</b> <i>width</i>=<q>&quot;960&quot;</q> <i>height</i>=<q>&quot;560&quot;</q><b>&gt;</b>{"\n"}
  <b>&lt;main</b> <i>class</i>=<q>&quot;app&quot;</q><b>&gt;</b>{"\n"}
    <b>&lt;h1&gt;</b>Hello, <mark>{"{user.name}"}</mark><b>&lt;/h1&gt;</b>{"\n"}
    <b>&lt;button</b> <i>onclick</i>=<q>&quot;add()&quot;</q><b>&gt;</b>{"\n"}
      Count: <mark>{"{count}"}</mark>{"\n"}
    <b>&lt;/button&gt;</b>{"\n"}
  <b>&lt;/main&gt;</b>{"\n"}
<b>&lt;/cbody&gt;</b></code></pre>
          <div className="terminal-status"><span>● compiled</span><span>28 entities · 0 DOM nodes</span></div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Framework highlights">
        <span>One canvas</span>
        <span>DOM-shaped authoring</span>
        <span>Reactive {"{}"} bindings</span>
        <span>ECS internals</span>
        <span>Pointer hit-testing</span>
      </section>

      <section className="playground-section" id="playground">
        <div className="section-heading">
          <div>
            <span className="section-index">01 / Live playground</span>
            <h2>This interface is not DOM.</h2>
          </div>
          <p>
            Every card, label, and button below is painted into a single canvas.
            Try the counter—the familiar inline handler still runs.
          </p>
        </div>
        <div className="canvas-frame">
          <div className="frame-toolbar">
            <span><i className="live-dot" /> Canvas output</span>
            <span>{entityCount || 28} entities</span>
            <span>960 × 560</span>
          </div>
          <div className="canvas-preview" ref={previewRef} />
        </div>
      </section>

      <section className="architecture-section" id="architecture">
        <div className="section-heading light">
          <div>
            <span className="section-index">02 / Architecture</span>
            <h2>Small systems.<br />Predictable work.</h2>
          </div>
          <p>
            The compiler turns each element into an entity. Systems operate on
            tightly scoped component maps, so a binding change does not rebuild
            the whole tree.
          </p>
        </div>
        <div className="system-grid">
          {[
            ["01", "Compile", "Walk source elements once, preserve handlers, then detach them from the document."],
            ["02", "Bind", "Resolve {paths} against a deeply reactive state proxy and update only affected data."],
            ["03", "Layout", "Calculate a focused flex and block layout model into numeric box components."],
            ["04", "Paint", "Batch backgrounds, borders, and text into one device-pixel-aware canvas frame."],
          ].map(([index, title, copy]) => (
            <article className="system-card" key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="pipeline">
          <span>Source DOM</span><b>→</b><span>Entity compiler</span><b>→</b><span>Component stores</span><b>→</b><span>Systems</span><b>→</b><span>Canvas</span>
        </div>
      </section>

      <section className="start-section" id="start">
        <div className="start-copy">
          <span className="section-index">03 / Quick start</span>
          <h2>Three familiar files.<br />One different output.</h2>
          <p>
            This prototype deliberately supports a focused subset first:
            block and flex layout, core typography and box styles, hover,
            pointer clicks, and path-based text or attribute bindings.
          </p>
          <div className="feature-list">
            <span><b>✓</b> Source nodes detached after compile</span>
            <span><b>✓</b> Nested proxy state updates</span>
            <span><b>✓</b> High-DPI responsive canvas</span>
            <span><b>✓</b> Standard click handlers</span>
          </div>
        </div>
        <div className="code-panel">
          <div className="code-tabs" role="tablist" aria-label="Quick start code">
            {(Object.keys(snippets) as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item === "javascript" ? "JS" : item}
              </button>
            ))}
          </div>
          <pre><code>{snippets[tab]}</code></pre>
        </div>
      </section>

      <footer>
        <span><b>CBody</b> / Experimental canvas runtime</span>
        <span>Built around entities, not elements.</span>
      </footer>
    </main>
  );
}
