# CBody

CBody is an experimental canvas UI runtime with a familiar authoring model:
write HTML, CSS, and JavaScript inside `<cbody>`, bind data with `{path}`, and
let the framework compile the source into an entity-component-system world.
After compilation, the source elements are detached and the interface is
painted onto a single high-DPI canvas.

The prototype includes:

- A `<cbody>` custom element.
- Deeply reactive path-based bindings.
- ECS component stores for tree, binding, style, and layout data.
- Separate binding, style, flex/block layout, input, and render systems.
- Canvas pointer hit-testing with standard click-handler dispatch.
- A focused CSS subset covering box, typography, flex, and hover styles.

## Run locally

```bash
npm install
npm run dev
```

Open the live playground and use the counter buttons to see canvas hit-testing,
event dispatch, and reactive re-rendering work together.
