# Diagramforce Project Context

Free browser-based visual diagramming tool for Salesforce architects and consultants. It allows creating architecture diagrams, data models, process flows, org charts, Gantt charts, and UML sequence diagrams entirely client-side.

## Technology Stack

- **Diagramming Engine:** [JointJS v4](https://www.jointjs.com/) (Open Source)
- **UI Framework:** [Salesforce Lightning Design System (SLDS) v2.29](https://www.lightningdesignsystem.com/)
- **Language:** Vanilla JavaScript (ES Modules)
- **Styling:** CSS Custom Properties (Variables) with Dark/Light theme support
- **Persistence:** Local Storage (via `persistence.js`) and JSON/PNG export

## Core Architecture

The application is structured as a set of decoupled ES modules initialized in `js/app.js`:

### Graphics & Layout
- `js/canvas.js`: Core JointJS logic (Paper, Graph), pan/zoom, grid, and auto-layout.
- `js/shapes.js`: Custom JointJS shape definitions (SimpleNode, DataObject, SequenceParticipant, etc.).
- `js/stencil.js`: The "Stencil" panel on the left where users drag shapes from.
- `js/selection.js`: Logic for multi-select, rubber-band selection, and resize alignment guides.

### UI & Features
- `js/properties.js`: The right-side Property Inspector for editing shape attributes.
- `js/tabs.js`: Manages multiple diagram tabs with independent undo/redo stacks.
- `js/history.js`: Command-based undo/redo implementation.
- `js/clipboard.js`: Copy, paste, and duplicate functionality.
- `js/toolbar.js`: Top toolbar event handlers.
- `js/theme.js`: Theme switching (light/dark) logic.

### Data & Integration
- `js/persistence.js`: Handles browser storage, JSON import/export, and URL sharing.
- `js/mermaid-import.js`: Parser and converter for Mermaid.js syntax (Graph, Flowchart, Sequence, ER).
- `js/templates.js`: Pre-configured Salesforce-specific component templates.

## Coding Standards & Conventions

### JavaScript (ES Modules)
- **Vanilla JS:** No frameworks (React/Vue/Angular) or bundlers (Vite/Webpack) are used in production.
- **Modern JS:** Modern ES6+ (Arrow functions, `const/let`, Template literals) is standard.
- **Naming:**
    - Files: `lowercase.js`
    - Variables/Functions: `camelCase`
    - Shape Types: `sf.ShapeName` (e.g., `sf.SimpleNode`)

### JointJS Integration
- When defining new shapes in `js/shapes.js`, always include standard ports (top, right, bottom, left) unless it's a non-connectable shape like `sf.TextLabel` or `sf.Zone`.
- Use `attrs` for SVG styling and `markup` for defining the DOM structure of shapes.
- Leverage JointJS `ToolsView` for interactive handles (resize, connect) implemented in `js/selection.js`.

### CSS & Theme
- All colors must use CSS variables defined in `css/variables.css` and `css/theme.css`.
- Avoid hardcoding hex colors in JS; use `var(--color-name)` in shape attributes where possible.
- The project supports **Light** and **Dark** modes. Verify visibility in both when making UI changes.

## Development Workflow

1. **Adding a Shape:**
    - Define the shape in `js/shapes.js`.
    - Add the shape to the appropriate category in `js/stencil.js`.
    - (Optional) Create a template for it in `js/templates.js`.
    - Ensure the Property Inspector in `js/properties.js` can handle its specific attributes.

2. **Persistence:**
    - The diagram state is serialized as a JSON object defined in `DIAGRAM_JSON_SPEC.md`.
    - If adding a new shape property, ensure it's captured in the JointJS `toJSON()` output and handled during `fromJSON()`.

3. **Validation:**
    - Test drag-and-drop from stencil.
    - Verify undo/redo after property changes.
    - Confirm JSON export and re-import results in the same diagram state.
