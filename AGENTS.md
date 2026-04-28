# Repository Guidelines

## Project Structure & Module Organization

Diagramforce is a static, client-only web app. `index.html` is the single-page entry point and loads ES modules from `js/`. Core modules include `js/app.js` for startup, `js/canvas.js` for JointJS graph/paper behavior, `js/shapes.js` for custom diagram shapes, `js/stencil.js` for drag sources, `js/properties.js` for the inspector, and `js/persistence.js` for save/load, import/export, and sharing. Styles are split by UI area in `css/`, with shared tokens in `css/variables.css` and theme overrides in `css/theme.css`. SLDS icon sprites live under `assets/icons/`. `DIAGRAM_JSON_SPEC.md` defines the import/export JSON contract.

## Build, Test, and Development Commands

There is no bundler, package manager, or backend in this repository. Run locally with any static file server from the repo root, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`. Avoid adding build steps unless the project intentionally adopts a toolchain. For quick checks, opening `index.html` directly may work, but a local server is safer for same-origin SVG sprite usage.

## Coding Style & Naming Conventions

Use vanilla JavaScript ES modules with modern `const`/`let`, arrow functions where they improve readability, and `camelCase` for variables and functions. Keep file names lowercase, such as `mermaid-import.js`. JointJS shape type names use the `sf.ShapeName` pattern. CSS should use custom properties from `css/variables.css` and `css/theme.css`; avoid hardcoded colors in JavaScript when a theme variable can be used.

## Testing Guidelines

No automated test suite is currently present. Validate changes manually in a browser, covering light and dark themes, drag-and-drop from the stencil, selection and resize guides, undo/redo, JSON export/import, PNG export, and URL sharing where relevant. When modifying serialization or diagram types, compare behavior against `DIAGRAM_JSON_SPEC.md`.

## Commit & Pull Request Guidelines

Recent commit history uses concise, imperative summaries such as `Add project context documentation for Diagramforce` and version-oriented summaries like `v1.8.0 ...`. Keep commits focused and mention the affected feature or diagram type. Pull requests should include a short description, manual validation steps, linked issues when applicable, and screenshots or screen recordings for UI-visible changes.

## Agent-Specific Instructions

Preserve the no-framework, no-bundler architecture unless explicitly asked to change it. When adding shapes, update `js/shapes.js`, `js/stencil.js`, and any relevant templates or property inspector handling together. Do not change the JSON format without updating `DIAGRAM_JSON_SPEC.md`.
