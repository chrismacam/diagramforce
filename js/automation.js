// SFMC Automation Map — import, visualize, and inspect Automation Studio objects.
// Mirrors the governance.js module pattern.

import { escHtml } from './persistence.js?v=1.8.0';
import { contrastTextColor, getStencilSvgDataUri, SVG as TMPL_SVG } from './templates.js?v=1.8.0';

let graph, paper, selection, tabs, history, canvas, stencil;
let drawerEl, drawerTitleEl, drawerBadgeEl, drawerBodyEl;
let stencilHiddenByDrawer = false;

const ACTIVITY_TYPE_MAP = {
  423: { type: 'SSJS', label: 'SSJS Script', color: '#7F5FBF' },
  300: { type: 'SQL',  label: 'SQL Query',   color: '#2A9D8F' },
  56:  { type: 'SQL',  label: 'SQL Query',   color: '#2A9D8F' },
};

const TYPE_COLORS = {
  Automation:    '#DA4E55',
  AutomationStep:'#6D6875',
  SSJS:          '#7F5FBF',
  SQL:           '#2A9D8F',
  Journey:       '#E97628',
  DataExtension: '#1D73C9',
};

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function init(modules) {
  ({ graph, paper, selection, tabs, history, canvas, stencil } = modules);
  buildDrawer();
  selection.onChange(renderSelection);
  tabs.onChange(() => {
    closeDrawer();
    updateToolbarVisibility();
  });
  graph.on('change add remove', () => {
    if (drawerEl?.classList.contains('sf-automation-drawer--open')) renderSelection();
  });
  document.getElementById('btn-automation-import')?.addEventListener('click', () => {
    showImportModal();
    document.getElementById('display-dropdown')?.classList.remove('sf-toolbar__dropdown--open');
  });
  document.getElementById('btn-automation-layout')?.addEventListener('click', () => {
    applyStepLayout();
    document.getElementById('display-dropdown')?.classList.remove('sf-toolbar__dropdown--open');
  });
  updateToolbarVisibility();
}

function updateToolbarVisibility() {
  const active = tabs?.getActiveTabType?.() === 'automation';
  ['display-automation-separator', 'btn-automation-import', 'btn-automation-layout'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = active ? '' : 'none';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function buildDrawer() {
  drawerEl = document.createElement('aside');
  drawerEl.className = 'sf-automation-drawer';
  drawerEl.setAttribute('aria-label', 'SFMC automation details');
  drawerEl.innerHTML = `
    <div class="sf-governance-drawer__header">
      <div>
        <h2 class="sf-governance-drawer__title"></h2>
        <span class="sf-governance-drawer__badge"></span>
      </div>
      <button class="sf-toolbar__button" type="button" aria-label="Close automation details">
        <svg class="sf-toolbar__icon" aria-hidden="true"><use href="#close"></use></svg>
      </button>
    </div>
    <div class="sf-governance-drawer__body"></div>
  `;
  document.body.appendChild(drawerEl);
  drawerTitleEl = drawerEl.querySelector('.sf-governance-drawer__title');
  drawerBadgeEl = drawerEl.querySelector('.sf-governance-drawer__badge');
  drawerBodyEl  = drawerEl.querySelector('.sf-governance-drawer__body');
  drawerEl.querySelector('button').addEventListener('click', closeDrawer);
}

function renderSelection() {
  updateToolbarVisibility();
  const selected = selection.getSelectedElements().find(isAutomationNode);
  if (!selected || tabs.getActiveTabType() !== 'automation') {
    closeDrawer();
    return;
  }
  openDrawer(selected);
}

function openDrawer(cell) {
  hideStencilForDrawer();
  const nodeType = cell.get('automationNodeType') || 'Asset';
  drawerTitleEl.textContent = getLabel(cell);
  drawerBadgeEl.textContent = nodeType;
  drawerBadgeEl.style.backgroundColor = TYPE_COLORS[nodeType] || '#64748B';

  let sectionsHtml = '';

  if (nodeType === 'Automation') {
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Automation Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('Status', cell.get('automationStatus'))}
          ${metaRow('Type', cell.get('automationType'))}
          ${metaRow('Key', cell.get('automationKey'))}
          ${metaRow('Description', cell.get('automationDescription'))}
          ${metaRow('SFMC ID', cell.get('sfmcId'))}
        </dl>
      </section>`;
  } else if (nodeType === 'AutomationStep') {
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Step Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('Step #', String(cell.get('stepNumber') || ''))}
          ${metaRow('SFMC ID', cell.get('sfmcId'))}
        </dl>
      </section>`;
  } else if (nodeType === 'SSJS') {
    const script = cell.get('scriptContent') || '';
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Script Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('Status', cell.get('scriptStatus'))}
          ${metaRow('Key', cell.get('automationKey'))}
          ${metaRow('Folder', cell.get('folderPath'))}
          ${metaRow('SFMC ID', cell.get('sfmcId'))}
        </dl>
      </section>
      ${script ? `<section class="sf-governance-section"><h3>Script Content</h3><pre class="sf-governance-code">${escHtml(script)}</pre></section>` : ''}`;
  } else if (nodeType === 'SQL') {
    const query = cell.get('queryText') || '';
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Query Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('Key', cell.get('automationKey'))}
          ${metaRow('Target DE', cell.get('targetDE'))}
          ${metaRow('SFMC ID', cell.get('sfmcId'))}
        </dl>
      </section>
      ${query ? `<section class="sf-governance-section"><h3>Query Text</h3><pre class="sf-governance-code">${escHtml(query)}</pre></section>` : ''}`;
  } else if (nodeType === 'Journey') {
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Journey Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('Type', cell.get('journeyType'))}
          ${metaRow('Mode', cell.get('journeyMode'))}
          ${metaRow('Entry Key', cell.get('journeyEntryKey'))}
          ${metaRow('Interactions', String(cell.get('journeyInteractionCount') || 0))}
          ${metaRow('SFMC ID', cell.get('sfmcId'))}
        </dl>
      </section>`;
  } else if (nodeType === 'DataExtension') {
    const fields = cell.get('fields') || [];
    sectionsHtml = `
      <section class="sf-governance-section">
        <h3>Data Extension Info</h3>
        <dl class="sf-governance-meta">
          ${metaRow('DE ID', cell.get('deId'))}
          ${metaRow('Field Count', String(fields.length))}
        </dl>
      </section>`;
  }

  const upstream = getLinkedNodes(cell, 'upstream');
  const downstream = getLinkedNodes(cell, 'downstream');
  sectionsHtml += `
    <section class="sf-governance-section">
      <h3>Upstream</h3>
      ${dependencyList(upstream)}
    </section>
    <section class="sf-governance-section">
      <h3>Downstream</h3>
      ${dependencyList(downstream)}
    </section>`;

  drawerBodyEl.innerHTML = sectionsHtml;
  drawerEl.classList.add('sf-automation-drawer--open');
}

function closeDrawer() {
  drawerEl?.classList.remove('sf-automation-drawer--open');
  restoreStencilAfterDrawer();
}

function hideStencilForDrawer() {
  if (stencilHiddenByDrawer) return;
  if (stencil?.isHidden && !stencil.isHidden()) {
    stencil.hide();
    stencilHiddenByDrawer = true;
  }
}

function restoreStencilAfterDrawer() {
  if (!stencilHiddenByDrawer) return;
  stencilHiddenByDrawer = false;
  if (tabs?.getActiveTabType?.() === 'automation') stencil?.show?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Modal
// ─────────────────────────────────────────────────────────────────────────────

export function showImportModal() {
  document.querySelector('.sf-automation-import-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'sf-automation-import-modal sf-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="sf-modal__overlay"></div>
    <div class="sf-modal__dialog" style="width:680px;max-width:94vw">
      <div class="sf-modal__header">
        <h2 class="sf-modal__title">Import SFMC JSON</h2>
        <button class="sf-toolbar__button sf-autoimport-close" aria-label="Close">
          <svg class="sf-toolbar__icon"><use href="#close"></use></svg>
        </button>
      </div>
      <div class="sf-modal__body" style="padding:var(--spacing-md) var(--spacing-lg)">
        <div class="sf-autoimport-tabs">
          <button class="sf-autoimport-tab sf-autoimport-tab--active" data-panel="automation">Automation</button>
          <button class="sf-autoimport-tab" data-panel="journey">Journey</button>
          <button class="sf-autoimport-tab" data-panel="de">Data Extension</button>
          <button class="sf-autoimport-tab" data-panel="ssjs">SSJS Script</button>
        </div>

        <div class="sf-autoimport-panel" data-panel="automation">
          <p class="sf-autoimport-hint">Paste the response from <code>GET /automation/v1/automations/{id}</code></p>
          <textarea class="sf-autoimport-input" data-for="automation" rows="10" spellcheck="false"
            placeholder='{"id":"...","name":"...","steps":[...]}'></textarea>
        </div>

        <div class="sf-autoimport-panel sf-autoimport-panel--hidden" data-panel="journey">
          <p class="sf-autoimport-hint">Paste the response from <code>GET /interaction/v1/eventDefinitions/{key}</code></p>
          <textarea class="sf-autoimport-input" data-for="journey" rows="10" spellcheck="false"
            placeholder='{"id":"...","type":"APIEvent","name":"...","dataExtensionId":"..."}'></textarea>
        </div>

        <div class="sf-autoimport-panel sf-autoimport-panel--hidden" data-panel="de">
          <p class="sf-autoimport-hint">Paste the response from <code>GET /data/v1/customobjectdata/key/{de-key}/rowset</code> or fields endpoint.</p>
          <input class="sf-autoimport-de-name" type="text" placeholder="Data Extension name (required)">
          <textarea class="sf-autoimport-input" data-for="de" rows="8" spellcheck="false"
            placeholder='{"fieldCount":10,"id":"...","fields":[{"name":"...","type":"Text",...}]}'></textarea>
        </div>

        <div class="sf-autoimport-panel sf-autoimport-panel--hidden" data-panel="ssjs">
          <p class="sf-autoimport-hint">Paste the response from <code>GET /automation/v1/scripts/{key}</code></p>
          <textarea class="sf-autoimport-input" data-for="ssjs" rows="10" spellcheck="false"
            placeholder='{"ssjsActivityId":"...","name":"...","script":"..."}'></textarea>
        </div>

        <p class="sf-autoimport-msg"></p>
      </div>
      <div class="sf-modal__footer" style="justify-content:space-between">
        <button class="sf-modal__btn sf-autoimport-example">Load Example</button>
        <div style="display:flex;gap:8px">
          <button class="sf-modal__btn sf-autoimport-cancel">Cancel</button>
          <button class="sf-modal__btn sf-modal__btn--primary sf-autoimport-submit">Add to Canvas</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const allTabs   = overlay.querySelectorAll('.sf-autoimport-tab');
  const allPanels = overlay.querySelectorAll('.sf-autoimport-panel');
  allTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      allTabs.forEach(t => t.classList.remove('sf-autoimport-tab--active'));
      allPanels.forEach(p => p.classList.add('sf-autoimport-panel--hidden'));
      tab.classList.add('sf-autoimport-tab--active');
      overlay.querySelector(`.sf-autoimport-panel[data-panel="${tab.dataset.panel}"]`)
             .classList.remove('sf-autoimport-panel--hidden');
    });
  });

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.sf-modal__overlay').addEventListener('click', close);
  overlay.querySelector('.sf-autoimport-close').addEventListener('click', close);
  overlay.querySelector('.sf-autoimport-cancel').addEventListener('click', close);

  overlay.querySelector('.sf-autoimport-example').addEventListener('click', () => {
    loadExampleDiagram();
    close();
  });

  const msgEl = overlay.querySelector('.sf-autoimport-msg');
  overlay.querySelector('.sf-autoimport-submit').addEventListener('click', () => {
    const automText = overlay.querySelector('.sf-autoimport-input[data-for="automation"]').value.trim();
    const journText = overlay.querySelector('.sf-autoimport-input[data-for="journey"]').value.trim();
    const deText    = overlay.querySelector('.sf-autoimport-input[data-for="de"]').value.trim();
    const ssjsText  = overlay.querySelector('.sf-autoimport-input[data-for="ssjs"]').value.trim();
    const deName    = overlay.querySelector('.sf-autoimport-de-name').value.trim();

    if (!automText && !journText && !deText && !ssjsText) {
      msgEl.style.color = 'var(--color-error,#ba0517)';
      msgEl.textContent = 'Paste at least one JSON response.';
      return;
    }

    const descriptors = [];
    try {
      if (automText) descriptors.push(...parseAutomationJSON(JSON.parse(automText)));
      if (journText) descriptors.push(parseJourneyJSON(JSON.parse(journText)));
      if (deText) {
        if (!deName) { msgEl.style.color = 'var(--color-error,#ba0517)'; msgEl.textContent = 'Enter the Data Extension name.'; return; }
        descriptors.push(parseDEFieldsJSON(JSON.parse(deText), deName));
      }
      if (ssjsText) descriptors.push(parseSSJSJSON(JSON.parse(ssjsText)));
    } catch (err) {
      msgEl.style.color = 'var(--color-error,#ba0517)';
      msgEl.textContent = `JSON parse error: ${err.message}`;
      return;
    }

    commitToGraph(descriptors.filter(Boolean));
    close();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseAutomationJSON(json) {
  const nodes = [];

  nodes.push({
    nodeType: 'Automation',
    label: json.name || 'Automation',
    color: TYPE_COLORS.Automation,
    stencilSvg: TMPL_SVG.sfmcAutomation,
    props: {
      automationNodeType: 'Automation',
      automationStatus: json.status || '',
      automationType: json.type || '',
      automationKey: json.key || '',
      automationDescription: json.description || '',
      sfmcId: json.id || '',
    },
  });

  for (const step of (json.steps || [])) {
    nodes.push({
      nodeType: 'AutomationStep',
      label: step.name || `Step ${step.step}`,
      color: TYPE_COLORS.AutomationStep,
      stencilSvg: TMPL_SVG.zone,
      props: {
        automationNodeType: 'AutomationStep',
        stepNumber: step.step || 0,
        sfmcId: step.id || '',
      },
      parentAutomationName: json.name,
    });

    for (const activity of (step.activities || [])) {
      const info = ACTIVITY_TYPE_MAP[activity.objectTypeId] || { type: 'SSJS', label: 'Activity', color: '#64748B' };
      nodes.push({
        nodeType: info.type,
        label: activity.name || info.label,
        color: info.color,
        stencilSvg: info.type === 'SQL' ? TMPL_SVG.sfmcSql : TMPL_SVG.sfmcSsjs,
        props: {
          automationNodeType: info.type,
          sfmcId: activity.activityObjectId || '',
          displayOrder: activity.displayOrder || 0,
        },
        parentStepName: step.name || `Step ${step.step}`,
        parentAutomationName: json.name,
      });
    }
  }

  return nodes;
}

function parseJourneyJSON(json) {
  return {
    nodeType: 'Journey',
    label: json.name || 'Journey',
    color: TYPE_COLORS.Journey,
    stencilSvg: TMPL_SVG.sfmcJourney,
    props: {
      automationNodeType: 'Journey',
      journeyType: json.type || '',
      journeyMode: json.mode || '',
      journeyEntryKey: json.eventDefinitionKey || '',
      journeyInteractionCount: json.interactionCount || 0,
      sfmcId: json.id || '',
      linkedDEId: json.dataExtensionId || '',
      linkedDEName: json.dataExtensionName || '',
    },
  };
}

function parseDEFieldsJSON(json, deName) {
  const fields = (json.fields || []).map(f => ({
    label: f.name,
    apiName: f.name,
    type: f.type + (f.length ? `(${f.length})` : ''),
    keyType: f.isPrimaryKey ? 'pk' : null,
  }));
  return {
    nodeType: 'DataExtension',
    label: deName,
    useDataObject: true,
    props: {
      automationNodeType: 'DataExtension',
      sfmcId: json.id || '',
      objectName: deName,
      headerColor: TYPE_COLORS.DataExtension,
      fields,
      deId: json.id || '',
    },
  };
}

function parseSSJSJSON(json) {
  return {
    nodeType: 'SSJS',
    label: json.name || 'SSJS Script',
    color: TYPE_COLORS.SSJS,
    stencilSvg: TMPL_SVG.sfmcSsjs,
    props: {
      automationNodeType: 'SSJS',
      automationKey: json.key || '',
      scriptContent: json.script || '',
      scriptStatus: json.status || '',
      folderPath: json.folderLocationText || '',
      sfmcId: json.ssjsActivityId || '',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Commit
// ─────────────────────────────────────────────────────────────────────────────

function commitToGraph(descriptors) {
  if (!descriptors.length) return;

  const COL_W = 280, ROW_H = 160;
  const rowMap = { Automation: 0, AutomationStep: 1, SSJS: 2, SQL: 2, DataExtension: 3, Journey: 1 };
  const colCounters = {};
  const nodeIndex = new Map();
  const created = [];

  history?.startBatch?.();
  try {
    for (const nd of descriptors) {
      const row = rowMap[nd.nodeType] ?? 4;
      const col = colCounters[row] ?? 0;
      colCounters[row] = col + 1;
      const pos = { x: 80 + col * COL_W, y: 80 + row * ROW_H };

      let cell;
      if (nd.useDataObject) {
        const fieldCount = (nd.props.fields || []).length;
        const h = Math.max(80, 32 + fieldCount * 22 + 4);
        cell = new joint.shapes.sf.DataObject({
          position: pos,
          size: { width: 260, height: h },
          fields: nd.props.fields || [],
          attrs: {
            header: { fill: nd.props.headerColor || '#1D73C9' },
            headerLabel: { text: nd.label || 'DE', fill: '#FFFFFF' },
          },
        });
        for (const [k, v] of Object.entries(nd.props)) cell.set(k, v);
      } else {
        const textColor = contrastTextColor(nd.color) || '#FFFFFF';
        const iconHref = nd.stencilSvg ? getStencilSvgDataUri(nd.stencilSvg, textColor) : '';
        cell = new joint.shapes.sf.SimpleNode({
          position: pos,
          attrs: {
            label:    { text: nd.label || nd.nodeType, fill: textColor },
            subtitle: { text: nd.nodeType, fill: textColor, opacity: 0.7 },
            body:     { fill: nd.color || '#64748B' },
            icon:     { href: iconHref },
          },
        });
        for (const [k, v] of Object.entries(nd.props)) cell.set(k, v);
      }

      graph.addCell(cell);
      created.push({ cell, nd });
      nodeIndex.set(nd.label, cell);
      if (nd.props?.sfmcId) nodeIndex.set(nd.props.sfmcId, cell);
    }

    // Auto-connect: Automation → Steps
    const automCell = created.find(e => e.nd.nodeType === 'Automation')?.cell;
    for (const { cell, nd } of created) {
      if (nd.nodeType === 'AutomationStep' && automCell) {
        addLink(automCell, cell, 'contains');
      }
      if (['SSJS', 'SQL'].includes(nd.nodeType) && nd.parentStepName) {
        const stepCell = nodeIndex.get(nd.parentStepName);
        if (stepCell) addLink(stepCell, cell, 'runs');
      }
    }

    // Auto-connect: Journey → DE
    for (const { cell, nd } of created) {
      if (nd.nodeType === 'Journey') {
        const deCell = nodeIndex.get(nd.props.linkedDEName) || nodeIndex.get(nd.props.linkedDEId);
        if (deCell) addLink(cell, deCell, 'entry data');
      }
    }

    // Auto-connect: SSJS → DE by name match in script
    for (const { cell: ssjsCell, nd: ssjsNd } of created) {
      if (ssjsNd.nodeType !== 'SSJS') continue;
      const script = ssjsNd.props.scriptContent || '';
      for (const { cell: deCell, nd: deNd } of created) {
        if (deNd.nodeType !== 'DataExtension') continue;
        if (deNd.label && script.includes(deNd.label)) {
          addLink(ssjsCell, deCell, 'reads/writes');
        }
      }
    }

  } finally {
    history?.endBatch?.();
  }

  requestAnimationFrame(() => { try { canvas?.fitContent?.(); } catch {} });
}

function addLink(source, target, relation) {
  const link = new joint.shapes.standard.Link({
    source: { id: source.id },
    target: { id: target.id },
    labels: [{ attrs: { text: { text: relation } }, position: 0.5 }],
    attrs: { line: { stroke: '#94A3B8', strokeWidth: 1.5, strokeDasharray: '5 3' } },
  });
  graph.addCell(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Layout
// ─────────────────────────────────────────────────────────────────────────────

export function applyStepLayout() {
  const nodes = graph.getElements().filter(isAutomationNode);
  if (nodes.length === 0) {
    alert('Add SFMC Automation nodes before using Arrange by Step.');
    return;
  }

  const COL_W = 280, rowY = [80, 240, 400, 560];
  const colCounters = {};

  history?.startBatch?.();
  try {
    const byType = nodeType => nodes.filter(c => c.get('automationNodeType') === nodeType);
    const automations = byType('Automation');
    const steps = byType('AutomationStep').sort((a, b) => (a.get('stepNumber') || 0) - (b.get('stepNumber') || 0));
    const activities = [...byType('SSJS'), ...byType('SQL')];
    const des = byType('DataExtension');
    const journeys = byType('Journey');

    const placeRow = (cells, row) => {
      colCounters[row] = colCounters[row] || 0;
      cells.forEach(c => { c.position(80 + colCounters[row]++ * COL_W, rowY[row]); });
    };
    placeRow(automations, 0);
    placeRow(steps, 1);
    placeRow(activities, 2);
    placeRow(des, 3);
    const journeyCol = Math.max(colCounters[1] || 0, 3);
    journeys.forEach((c, i) => c.position(80 + (journeyCol + i) * COL_W, rowY[1]));
  } finally {
    history?.endBatch?.();
  }

  requestAnimationFrame(() => { try { canvas?.fitContent?.(); } catch {} });
}

// ─────────────────────────────────────────────────────────────────────────────
// Example Template
// ─────────────────────────────────────────────────────────────────────────────

export function loadExampleDiagram() {
  const automationJSON = {
    id: '276644de-a04a-4f6a-ab14-1c17cb0e1da0',
    name: 'dynamicDE_AssetsCreation',
    description: 'Dynamically creates and configures Data Extensions based on a catalog.',
    key: '460fd97d-f7e5-2a73-0263-298dfdc73fc4',
    type: 'scheduled',
    status: 'Ready',
    steps: [
      {
        id: 'fe197021-5b3d-4492-850e-0f8b6cdea94f',
        name: 'Create Data Extensions',
        step: 1,
        activities: [
          { id: '75e90394-c5d8-4276-8336-a756f604d5a7', name: 'ssjs_DynamicDE_CreateDE', activityObjectId: '456e8d0f-19b8-42e8-ac10-f035aebd4f92', objectTypeId: 423, displayOrder: 1 },
        ],
      },
      {
        id: 'e8640d92-5181-441a-ba40-948526d0ef3c',
        name: 'Add Fields',
        step: 2,
        activities: [
          { id: '97b254bc-ab78-4390-a912-de7130f2ad18', name: 'ssjs_DynamicDE_AddFields', activityObjectId: 'b0056c5f-2082-411d-9a8c-34754b2112f1', objectTypeId: 423, displayOrder: 1 },
        ],
      },
    ],
  };

  const journeyJSON = {
    id: '94b3bff6-f892-4386-a1ff-f0ec64feed71',
    type: 'APIEvent',
    name: '[JOURNEY] - BOAS VINDAS',
    mode: 'Production',
    eventDefinitionKey: 'APIEvent-687778e2-62b0-8bcd-b535-6ba507da8753',
    dataExtensionId: '6a46475b-25fe-ed11-b866-f40343c98788',
    dataExtensionName: 'Jornada Boas Vindas',
    interactionCount: 1,
  };

  const deJSON = {
    id: '6a46475b-25fe-ed11-b866-f40343c98788',
    fieldCount: 6,
    fields: [
      { name: 'Subscriberkey', type: 'Text', length: 254, isPrimaryKey: true, isNullable: false, ordinal: 0 },
      { name: 'VeevaID',       type: 'Text', length: 50,  isPrimaryKey: false, isNullable: true, ordinal: 1 },
      { name: 'EmailAddress',  type: 'EmailAddress', length: 254, isPrimaryKey: false, isNullable: true, ordinal: 2 },
      { name: 'Specialty',     type: 'Text', length: 250, isPrimaryKey: false, isNullable: true, ordinal: 3 },
      { name: 'DataAtualizacao', type: 'Date', isPrimaryKey: false, isNullable: true, ordinal: 4 },
      { name: 'NaoEntregavelSMS', type: 'Boolean', isPrimaryKey: false, isNullable: true, ordinal: 5 },
    ],
  };

  const ssjsJSON = {
    ssjsActivityId: '456e8d0f-19b8-42e8-ac10-f035aebd4f92',
    name: 'ssjs_DynamicDE_CreateDE',
    key: '6f3b1044-11f6-437b-b929-47a892089a2c',
    status: 'Active',
    script: `<script runat="server">
Platform.Load("core","1.1.1");
var ListDEName = "dynamicDE_Catalog_V_";
var configDEName = "dynamicDE_Config_V_";
var folderName = "Valtech";

var newDEList = DataExtension.Init(ListDEName);
var ConfigDE = DataExtension.Init(configDEName);

function createDE(deName, templateName){
  var guid = Platform.Function.GUID();
  var fieldRows = ConfigDE.Rows.Lookup(["template_Name"], [templateName]);
  var fields = [];
  for (var i = 0; i < fieldRows.length; i++) {
    fields.push(buildField(fieldRows[i]));
  }
  DataExtension.Add({"CustomerKey": guid, "Name": deName, "Fields": fields});
  return guid;
}
</script>`,
    folderLocationText: 'Scripts/Products/Dynamic DE',
  };

  const descriptors = [
    ...parseAutomationJSON(automationJSON),
    parseJourneyJSON(journeyJSON),
    parseDEFieldsJSON(deJSON, 'Jornada Boas Vindas'),
    parseSSJSJSON(ssjsJSON),
  ].filter(Boolean);

  history?.startBatch?.();
  graph.clear();
  history?.endBatch?.();

  commitToGraph(descriptors);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function isAutomationNode(cell) {
  return !!cell?.isElement?.() && !!cell.get('automationNodeType');
}

function getLabel(cell) {
  return cell.get('_savedLabel')
    || cell.attr('label/text')
    || cell.attr('headerLabel/text')
    || cell.get('objectName')
    || 'Unnamed';
}

function getLinkedNodes(cell, direction) {
  return graph.getLinks().map(link => {
    const src = graph.getCell(link.get('source')?.id);
    const tgt = graph.getCell(link.get('target')?.id);
    if (direction === 'upstream'   && tgt?.id === cell.id && isAutomationNode(src)) return { cell: src, relation: getRelation(link) };
    if (direction === 'downstream' && src?.id === cell.id && isAutomationNode(tgt)) return { cell: tgt, relation: getRelation(link) };
    return null;
  }).filter(Boolean);
}

function getRelation(link) {
  return link.labels?.()?.[0]?.attrs?.text?.text || link.get('relation') || 'Connected';
}

function dependencyList(entries) {
  if (!entries.length) return '<ul class="sf-governance-list"><li>None</li></ul>';
  return `<ul class="sf-governance-list">${entries.map(e =>
    `<li>${escHtml(getLabel(e.cell))} <span>(${escHtml(e.relation)})</span></li>`
  ).join('')}</ul>`;
}

function metaRow(label, value) {
  if (!value && value !== 0) return '';
  return `<dt>${escHtml(label)}</dt><dd>${escHtml(String(value))}</dd>`;
}
