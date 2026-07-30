"use client";

type Entity = number;
type DataModel = Record<string, unknown>;

type TreeComponent = {
  element: HTMLElement;
  parent?: Entity;
  children: Entity[];
};

type BindingComponent = {
  textTemplate: string;
  attributes: Array<{ name: string; template: string }>;
};

type StyleComponent = {
  display: string;
  position: string;
  flexDirection: "row" | "column";
  justifyContent: string;
  alignItems: string;
  gap: number;
  flexGrow: number;
  width: string;
  height: string;
  left: string;
  top: string;
  padding: [number, number, number, number];
  margin: [number, number, number, number];
  background: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  textAlign: CanvasTextAlign;
  textTransform: string;
  opacity: number;
  cursor: string;
};

type LayoutComponent = {
  x: number;
  y: number;
  width: number;
  height: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
};

type Rule = {
  selector: string;
  declarations: Array<[string, string]>;
  hover: boolean;
  specificity: number;
  order: number;
};

const DEFAULT_STYLE: StyleComponent = {
  display: "block",
  position: "static",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "stretch",
  gap: 0,
  flexGrow: 0,
  width: "auto",
  height: "auto",
  left: "auto",
  top: "auto",
  padding: [0, 0, 0, 0],
  margin: [0, 0, 0, 0],
  background: "transparent",
  color: "#111827",
  borderColor: "transparent",
  borderWidth: 0,
  borderRadius: 0,
  fontFamily: "Arial, sans-serif",
  fontSize: 16,
  fontWeight: "400",
  lineHeight: 1.35,
  textAlign: "left",
  textTransform: "none",
  opacity: 1,
  cursor: "default",
};

class World {
  private nextEntity = 1;
  readonly entities = new Set<Entity>();
  readonly tree = new Map<Entity, TreeComponent>();
  readonly bindings = new Map<Entity, BindingComponent>();
  readonly styles = new Map<Entity, StyleComponent>();
  readonly layouts = new Map<Entity, LayoutComponent>();

  create() {
    const entity = this.nextEntity++;
    this.entities.add(entity);
    return entity;
  }
}

function number(value: string | null | undefined, fallback = 0) {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function box(value: string | undefined): [number, number, number, number] {
  const parts = (value || "0").trim().split(/\s+/).map((part) => number(part));
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return [parts[0], parts[1], parts[2], parts[3]];
}

function specificity(selector: string) {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g)?.length ?? 0;
  const tags = selector
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+/g, " ")
    .split(/[\s>+~]+/)
    .filter(Boolean).length;
  return ids * 100 + classes * 10 + tags;
}

function resolveLength(value: string, available: number, fallback: number) {
  if (!value || value === "auto") return fallback;
  if (value.endsWith("%")) return available * number(value) / 100;
  return number(value, fallback);
}

function pathValue(data: DataModel, path: string): unknown {
  const clean = path.trim();
  if (!clean) return "";
  return clean.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return "";
    return (current as Record<string, unknown>)[part];
  }, data);
}

function interpolate(template: string, data: DataModel) {
  return template.replace(/\{([^{}]+)\}/g, (_match, path: string) => {
    const value = pathValue(data, path);
    return value === null || value === undefined ? "" : String(value);
  });
}

function directText(element: HTMLElement) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  context.roundRect(x, y, width, height, r);
}

function createReactive<T extends object>(value: T, invalidate: () => void): T {
  const cache = new WeakMap<object, object>();
  const wrap = (target: object): object => {
    const existing = cache.get(target);
    if (existing) return existing;
    const proxy = new Proxy(target, {
      get(current, property, receiver) {
        const result = Reflect.get(current, property, receiver);
        return result && typeof result === "object" ? wrap(result) : result;
      },
      set(current, property, next, receiver) {
        const changed = Reflect.get(current, property, receiver) !== next;
        const success = Reflect.set(current, property, next, receiver);
        if (changed) invalidate();
        return success;
      },
      deleteProperty(current, property) {
        const success = Reflect.deleteProperty(current, property);
        invalidate();
        return success;
      },
    });
    cache.set(target, proxy);
    return proxy;
  };
  return wrap(value) as T;
}

class BindingSystem {
  constructor(
    private world: World,
    private getData: () => DataModel,
  ) {}

  update() {
    const data = this.getData();
    for (const [entity, binding] of this.world.bindings) {
      const tree = this.world.tree.get(entity);
      if (!tree) continue;
      tree.element.dataset.canvasText = interpolate(binding.textTemplate, data);
      for (const attribute of binding.attributes) {
        tree.element.setAttribute(
          attribute.name,
          interpolate(attribute.template, data),
        );
      }
    }
  }
}

class StyleSystem {
  constructor(
    private world: World,
    private rules: Rule[],
    private hovered: () => Entity | undefined,
  ) {}

  update() {
    for (const entity of this.world.entities) {
      const tree = this.world.tree.get(entity);
      if (!tree) continue;
      const declarations = new Map<string, string>();
      const matching = this.rules
        .filter((rule) => {
          if (rule.hover && this.hovered() !== entity) return false;
          try {
            return tree.element.matches(rule.selector);
          } catch {
            return false;
          }
        })
        .sort((a, b) => a.specificity - b.specificity || a.order - b.order);

      for (const rule of matching) {
        for (const [property, value] of rule.declarations) {
          declarations.set(property, value);
        }
      }
      for (const property of Array.from(tree.element.style)) {
        declarations.set(property, tree.element.style.getPropertyValue(property));
      }

      const get = (property: string, fallback: string) =>
        declarations.get(property) ?? fallback;
      const border = get("border", "");
      const borderWidth = declarations.has("border-width")
        ? number(get("border-width", "0"))
        : number(border);
      const borderColor =
        declarations.get("border-color") ??
        border.match(/(#[\da-f]{3,8}|rgba?\([^)]+\)|[a-z]+)\s*$/i)?.[1] ??
        "transparent";
      const background =
        declarations.get("background-color") ??
        declarations.get("background") ??
        DEFAULT_STYLE.background;

      this.world.styles.set(entity, {
        ...DEFAULT_STYLE,
        display: get("display", DEFAULT_STYLE.display),
        position: get("position", DEFAULT_STYLE.position),
        flexDirection: get("flex-direction", "column") === "row" ? "row" : "column",
        justifyContent: get("justify-content", DEFAULT_STYLE.justifyContent),
        alignItems: get("align-items", DEFAULT_STYLE.alignItems),
        gap: number(get("gap", "0")),
        flexGrow: number(
          get("flex-grow", get("flex", DEFAULT_STYLE.flexGrow.toString())),
        ),
        width: get("width", "auto"),
        height: get("height", "auto"),
        left: get("left", "auto"),
        top: get("top", "auto"),
        padding: box(get("padding", "0")),
        margin: box(get("margin", "0")),
        background,
        color: get("color", DEFAULT_STYLE.color),
        borderColor,
        borderWidth,
        borderRadius: number(get("border-radius", "0")),
        fontFamily: get("font-family", DEFAULT_STYLE.fontFamily),
        fontSize: number(get("font-size", "16"), 16),
        fontWeight: get("font-weight", DEFAULT_STYLE.fontWeight),
        lineHeight: number(get("line-height", ""), DEFAULT_STYLE.lineHeight),
        textAlign: get("text-align", "left") as CanvasTextAlign,
        textTransform: get("text-transform", "none"),
        opacity: number(get("opacity", "1"), 1),
        cursor: get("cursor", "default"),
      });
    }
  }
}

class LayoutSystem {
  constructor(
    private world: World,
    private roots: Entity[],
    private viewport: () => { width: number; height: number },
  ) {}

  update() {
    const viewport = this.viewport();
    for (const root of this.roots) {
      this.layoutNode(root, 0, 0, viewport.width, viewport.height, viewport.width, viewport.height);
    }
  }

  private intrinsicHeight(entity: Entity, availableWidth: number) {
    const tree = this.world.tree.get(entity);
    const style = this.world.styles.get(entity) ?? DEFAULT_STYLE;
    if (style.height !== "auto") return resolveLength(style.height, availableWidth, 0);
    if (!tree?.children.length) {
      const text = tree?.element.dataset.canvasText ?? "";
      const lines = Math.max(1, Math.ceil(text.length / Math.max(8, availableWidth / (style.fontSize * 0.55))));
      return style.padding[0] + style.padding[2] + lines * style.fontSize * style.lineHeight;
    }
    return 0;
  }

  private layoutNode(
    entity: Entity,
    x: number,
    y: number,
    availableWidth: number,
    availableHeight: number,
    forcedWidth?: number,
    forcedHeight?: number,
  ) {
    const tree = this.world.tree.get(entity);
    const style = this.world.styles.get(entity) ?? DEFAULT_STYLE;
    if (!tree || style.display === "none") {
      this.world.layouts.set(entity, {
        x, y, width: 0, height: 0, contentX: x, contentY: y, contentWidth: 0, contentHeight: 0,
      });
      return;
    }

    const width = forcedWidth ?? resolveLength(style.width, availableWidth, availableWidth);
    let height = forcedHeight ?? resolveLength(
      style.height,
      availableHeight,
      this.intrinsicHeight(entity, width),
    );
    if (height <= 0) height = availableHeight;

    const positionedX = style.position === "absolute"
      ? x + resolveLength(style.left, availableWidth, 0)
      : x + style.margin[3];
    const positionedY = style.position === "absolute"
      ? y + resolveLength(style.top, availableHeight, 0)
      : y + style.margin[0];
    const contentX = positionedX + style.padding[3] + style.borderWidth;
    const contentY = positionedY + style.padding[0] + style.borderWidth;
    const contentWidth = Math.max(
      0,
      width - style.padding[1] - style.padding[3] - style.borderWidth * 2,
    );
    const contentHeight = Math.max(
      0,
      height - style.padding[0] - style.padding[2] - style.borderWidth * 2,
    );

    this.world.layouts.set(entity, {
      x: positionedX,
      y: positionedY,
      width,
      height,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
    });

    const children = tree.children.filter(
      (child) => (this.world.styles.get(child) ?? DEFAULT_STYLE).display !== "none",
    );
    if (!children.length) return;

    const isRow = style.display === "flex" && style.flexDirection === "row";
    const mainAvailable = isRow ? contentWidth : contentHeight;
    const crossAvailable = isRow ? contentHeight : contentWidth;
    const normalChildren = children.filter(
      (child) => (this.world.styles.get(child) ?? DEFAULT_STYLE).position !== "absolute",
    );
    const gaps = Math.max(0, normalChildren.length - 1) * style.gap;
    let fixed = 0;
    let grow = 0;

    for (const child of normalChildren) {
      const childStyle = this.world.styles.get(child) ?? DEFAULT_STYLE;
      const mainValue = isRow ? childStyle.width : childStyle.height;
      if (mainValue !== "auto") {
        fixed += resolveLength(mainValue, mainAvailable, 0);
      } else if (childStyle.flexGrow > 0) {
        grow += childStyle.flexGrow;
      } else {
        fixed += isRow ? 0 : this.intrinsicHeight(child, crossAvailable);
      }
      fixed += isRow
        ? childStyle.margin[1] + childStyle.margin[3]
        : childStyle.margin[0] + childStyle.margin[2];
    }

    const remaining = Math.max(0, mainAvailable - fixed - gaps);
    let cursor = 0;
    if (style.justifyContent === "center" && grow === 0) cursor = remaining / 2;
    if (style.justifyContent === "flex-end" && grow === 0) cursor = remaining;
    const distributedGap = style.justifyContent === "space-between" && normalChildren.length > 1
      ? style.gap + remaining / (normalChildren.length - 1)
      : style.gap;

    for (const child of children) {
      const childStyle = this.world.styles.get(child) ?? DEFAULT_STYLE;
      if (childStyle.position === "absolute") {
        this.layoutNode(child, contentX, contentY, contentWidth, contentHeight);
        continue;
      }
      const explicitMain = isRow ? childStyle.width : childStyle.height;
      const mainSize = explicitMain !== "auto"
        ? resolveLength(explicitMain, mainAvailable, 0)
        : childStyle.flexGrow > 0 && grow > 0
          ? remaining * childStyle.flexGrow / grow
          : isRow
            ? 0
            : this.intrinsicHeight(child, crossAvailable);
      const explicitCross = isRow ? childStyle.height : childStyle.width;
      const stretch = style.alignItems === "stretch" && explicitCross === "auto";
      const crossSize = stretch
        ? crossAvailable
        : resolveLength(explicitCross, crossAvailable, crossAvailable);
      let crossOffset = 0;
      if (style.alignItems === "center") crossOffset = (crossAvailable - crossSize) / 2;
      if (style.alignItems === "flex-end") crossOffset = crossAvailable - crossSize;

      if (isRow) {
        this.layoutNode(
          child,
          contentX + cursor,
          contentY + crossOffset,
          contentWidth,
          contentHeight,
          mainSize,
          crossSize,
        );
      } else {
        this.layoutNode(
          child,
          contentX + crossOffset,
          contentY + cursor,
          contentWidth,
          contentHeight,
          crossSize,
          mainSize,
        );
      }
      cursor += mainSize + distributedGap +
        (isRow
          ? childStyle.margin[1] + childStyle.margin[3]
          : childStyle.margin[0] + childStyle.margin[2]);
    }
  }
}

class RenderSystem {
  constructor(
    private world: World,
    private roots: Entity[],
    private context: CanvasRenderingContext2D,
    private viewport: () => { width: number; height: number },
  ) {}

  update() {
    const viewport = this.viewport();
    this.context.clearRect(0, 0, viewport.width, viewport.height);
    for (const root of this.roots) this.renderNode(root);
  }

  private renderNode(entity: Entity) {
    const tree = this.world.tree.get(entity);
    const style = this.world.styles.get(entity);
    const layout = this.world.layouts.get(entity);
    if (!tree || !style || !layout || !layout.width || !layout.height) return;

    const context = this.context;
    context.save();
    context.globalAlpha *= style.opacity;
    if (style.background !== "transparent" && !style.background.includes("gradient")) {
      roundedRect(context, layout.x, layout.y, layout.width, layout.height, style.borderRadius);
      context.fillStyle = style.background;
      context.fill();
    }
    if (style.borderWidth > 0) {
      roundedRect(
        context,
        layout.x + style.borderWidth / 2,
        layout.y + style.borderWidth / 2,
        layout.width - style.borderWidth,
        layout.height - style.borderWidth,
        style.borderRadius,
      );
      context.strokeStyle = style.borderColor;
      context.lineWidth = style.borderWidth;
      context.stroke();
    }

    const text = tree.element.dataset.canvasText ?? "";
    if (text) this.drawText(entity, text, style, layout);
    context.restore();

    for (const child of tree.children) this.renderNode(child);
  }

  private drawText(
    entity: Entity,
    text: string,
    style: StyleComponent,
    layout: LayoutComponent,
  ) {
    const context = this.context;
    const transformed = style.textTransform === "uppercase"
      ? text.toUpperCase()
      : style.textTransform === "lowercase"
        ? text.toLowerCase()
        : text;
    context.fillStyle = style.color;
    context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    context.textBaseline = "top";
    context.textAlign = style.textAlign;

    const maxWidth = Math.max(1, layout.contentWidth);
    const paragraphs = transformed.split("\n");
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && context.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }

    const x = style.textAlign === "center"
      ? layout.contentX + maxWidth / 2
      : style.textAlign === "right" || style.textAlign === "end"
        ? layout.contentX + maxWidth
        : layout.contentX;
    const lineHeight = style.fontSize * style.lineHeight;
    const totalHeight = lines.length * lineHeight;
    const y = this.world.tree.get(entity)?.element.tagName === "BUTTON"
      ? layout.contentY + Math.max(0, (layout.contentHeight - totalHeight) / 2)
      : layout.contentY;
    lines.forEach((line, index) => {
      context.fillText(line, x, y + index * lineHeight, maxWidth);
    });
  }
}

const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as typeof HTMLElement)
    : HTMLElement;

export class CanvasBodyElement extends HTMLElementBase {
  private world = new World();
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private roots: Entity[] = [];
  private rules: Rule[] = [];
  private frame = 0;
  private hoveredEntity?: Entity;
  private pressedEntity?: Entity;
  private resizeObserver?: ResizeObserver;
  private model: DataModel = {};
  private bindingSystem?: BindingSystem;
  private styleSystem?: StyleSystem;
  private layoutSystem?: LayoutSystem;
  private renderSystem?: RenderSystem;

  get data() {
    return this.model;
  }

  set data(value: DataModel) {
    this.model = createReactive(value, () => this.invalidate());
    this.invalidate();
  }

  connectedCallback() {
    if (this.canvas) return;
    queueMicrotask(() => this.mount());
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  invalidate() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.update());
  }

  private mount() {
    if (this.canvas || !this.isConnected) return;
    this.rules = this.collectRules();
    const sourceChildren = Array.from(this.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.tagName !== "STYLE",
    );
    this.roots = sourceChildren.map((child) => this.compile(child));

    this.replaceChildren();
    const shadow = this.attachShadow({ mode: "open" });
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      this.getAttribute("aria-label") ?? "Canvas-rendered application",
    );
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";
    shadow.append(canvas);
    this.canvas = canvas;
    this.context = canvas.getContext("2d") ?? undefined;
    this.style.display = "block";
    this.style.aspectRatio = `${this.logicalWidth} / ${this.logicalHeight}`;

    this.bindingSystem = new BindingSystem(this.world, () => this.model);
    this.styleSystem = new StyleSystem(this.world, this.rules, () => this.hoveredEntity);
    this.layoutSystem = new LayoutSystem(this.world, this.roots, () => ({
      width: this.logicalWidth,
      height: this.logicalHeight,
    }));
    if (this.context) {
      this.renderSystem = new RenderSystem(this.world, this.roots, this.context, () => ({
        width: this.logicalWidth,
        height: this.logicalHeight,
      }));
    }

    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerleave", () => {
      this.hoveredEntity = undefined;
      this.pressedEntity = undefined;
      this.invalidate();
    });
    canvas.addEventListener("pointerdown", (event) => {
      this.pressedEntity = this.hitTest(event);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("click", (event) => event.preventDefault());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.resize();
  }

  private get logicalWidth() {
    return number(this.getAttribute("width"), 960);
  }

  private get logicalHeight() {
    return number(this.getAttribute("height"), 540);
  }

  private collectRules() {
    const rules: Rule[] = [];
    let order = 0;
    const styleElements = Array.from(document.querySelectorAll("style"));
    for (const styleElement of styleElements) {
      let cssRules: CSSRuleList | undefined;
      try {
        cssRules = styleElement.sheet?.cssRules;
      } catch {
        cssRules = undefined;
      }
      if (!cssRules) continue;
      for (const cssRule of Array.from(cssRules)) {
        if (!(cssRule instanceof CSSStyleRule)) continue;
        for (const rawSelector of cssRule.selectorText.split(",")) {
          const hover = rawSelector.includes(":hover");
          const selector = rawSelector.replace(/:hover/g, "").trim();
          const declarations = Array.from(cssRule.style).map(
            (property) =>
              [property, cssRule.style.getPropertyValue(property)] as [string, string],
          );
          rules.push({
            selector,
            declarations,
            hover,
            specificity: specificity(selector) + (hover ? 10 : 0),
            order: order++,
          });
        }
      }
    }
    return rules;
  }

  private compile(element: HTMLElement, parent?: Entity): Entity {
    const entity = this.world.create();
    const children = Array.from(element.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map((child) => this.compile(child, entity));
    this.world.tree.set(entity, { element, parent, children });
    this.world.bindings.set(entity, {
      textTemplate: directText(element),
      attributes: Array.from(element.attributes)
        .filter((attribute) => attribute.value.includes("{"))
        .map((attribute) => ({ name: attribute.name, template: attribute.value })),
    });
    return entity;
  }

  private resize() {
    if (!this.canvas || !this.context) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.logicalWidth * ratio);
    this.canvas.height = Math.round(this.logicalHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.invalidate();
  }

  private update() {
    if (!this.context) return;
    this.bindingSystem?.update();
    this.styleSystem?.update();
    this.layoutSystem?.update();
    this.renderSystem?.update();
    this.dispatchEvent(new CustomEvent("cbody:render", {
      detail: { entities: this.world.entities.size },
    }));
  }

  private pointerPosition(event: PointerEvent) {
    const bounds = this.canvas!.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * this.logicalWidth / bounds.width,
      y: (event.clientY - bounds.top) * this.logicalHeight / bounds.height,
    };
  }

  private hitTest(event: PointerEvent) {
    const point = this.pointerPosition(event);
    const entities = Array.from(this.world.entities).reverse();
    return entities.find((entity) => {
      const layout = this.world.layouts.get(entity);
      const style = this.world.styles.get(entity);
      if (!layout || !style || style.display === "none") return false;
      return point.x >= layout.x &&
        point.x <= layout.x + layout.width &&
        point.y >= layout.y &&
        point.y <= layout.y + layout.height;
    });
  }

  private onPointerMove(event: PointerEvent) {
    const next = this.hitTest(event);
    if (next === this.hoveredEntity) return;
    this.hoveredEntity = next;
    const style = next ? this.world.styles.get(next) : undefined;
    if (this.canvas) this.canvas.style.cursor = style?.cursor ?? "default";
    this.invalidate();
  }

  private onPointerUp(event: PointerEvent) {
    const released = this.hitTest(event);
    if (released && released === this.pressedEntity) {
      const tree = this.world.tree.get(released);
      tree?.element.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
      }));
      this.dispatchEvent(new CustomEvent("cbody:click", {
        detail: { element: tree?.element },
      }));
      this.invalidate();
    }
    this.pressedEntity = undefined;
  }
}

export function registerCanvasBody() {
  if (typeof customElements !== "undefined" && !customElements.get("cbody")) {
    customElements.define("cbody", CanvasBodyElement);
  }
}
