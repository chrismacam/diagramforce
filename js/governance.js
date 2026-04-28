// SFMC governance view: asset metadata, impact analysis, brain-dots layout, and prompt generation.

import { escHtml } from './persistence.js?v=1.8.0';

let graph, paper, selection, tabs, history, canvas, stencil;
let drawerEl, titleEl, badgeEl, bodyEl;
let stencilHiddenByDrawer = false;

const TYPE_COLORS = {
  DataExtension: '#1D73C9',
  SQL: '#2A9D8F',
  SSJS: '#7F5FBF',
  Automation: '#DA4E55',
  Journey: '#E97628',
  CloudPage: '#E3A008',
  API: '#64748B',
};

export function init(modules) {
  ({ graph, paper, selection, tabs, history, canvas, stencil } = modules);
  buildDrawer();
  selection.onChange(renderSelection);
  tabs.onChange(() => {
    closeDrawer();
    updateToolbarVisibility();
  });
  graph.on('change add remove', () => {
    if (drawerEl?.classList.contains('sf-governance-drawer--open')) renderSelection();
  });
  document.getElementById('btn-governance-layout')?.addEventListener('click', () => applyBrainDotsLayout());
  document.getElementById('btn-governance-prompt')?.addEventListener('click', () => showPromptForSelection());
  updateToolbarVisibility();
}

export function applyBrainDotsLayout(groupBy = 'folderCategory') {
  const assets = getGovernanceAssets();
  if (assets.length === 0) {
    alert('Add SFMC governance assets before using Brain Dots Layout.');
    return;
  }

  const area = document.getElementById('canvas-container')?.getBoundingClientRect();
  const width = Math.max(area?.width || 1200, 900);
  const height = Math.max(area?.height || 700, 560);
  const center = { x: width / 2, y: height / 2 };
  const groups = new Map();

  assets.forEach(cell => {
    const key = cell.get(groupBy) || cell.get('assetType') || 'Uncategorized';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cell);
  });

  history?.startBatch?.();
  try {
    const entries = [...groups.entries()];
    const clusterRadius = Math.max(220, entries.length * 75);
    entries.forEach(([groupName, cells], groupIndex) => {
      const angle = entries.length === 1 ? 0 : (Math.PI * 2 * groupIndex) / entries.length;
      const clusterCenter = {
        x: center.x + Math.cos(angle) * clusterRadius,
        y: center.y + Math.sin(angle) * clusterRadius,
      };
      const localRadius = Math.max(90, cells.length * 26);
      cells.forEach((cell, i) => {
        const localAngle = cells.length === 1 ? 0 : (Math.PI * 2 * i) / cells.length;
        cell.position(
          Math.round(clusterCenter.x + Math.cos(localAngle) * localRadius),
          Math.round(clusterCenter.y + Math.sin(localAngle) * localRadius)
        );
        cell.set('brainDotsGroup', groupName);
      });
    });
  } finally {
    history?.endBatch?.();
  }

  requestAnimationFrame(() => {
    try { canvas?.fitContent?.(); } catch {}
  });
  document.getElementById('display-dropdown')?.classList.remove('sf-toolbar__dropdown--open');
}

export function generatePrompt(cell) {
  if (!isGovernanceAsset(cell)) return '';
  const label = getLabel(cell);
  const type = cell.get('assetType') || 'Asset';
  const up = getLinkedAssets(cell, 'upstream');
  const down = getLinkedAssets(cell, 'downstream');
  const lines = [
    'I am working on a Salesforce Marketing Cloud (SFMC) architecture.',
    `I need to assess or change the asset "${label}" (${type}).`,
  ];

  if (cell.get('externalKey')) lines.push(`External Key: ${cell.get('externalKey')}`);
  if (cell.get('businessUnit')) lines.push(`Business Unit: ${cell.get('businessUnit')}`);
  if (cell.get('folderCategory')) lines.push(`Folder/Category: ${cell.get('folderCategory')}`);
  if (cell.get('assetDescription')) lines.push(`Description: ${cell.get('assetDescription')}`);
  if (cell.get('assetContent')) lines.push(`\nCurrent Code or Configuration:\n\`\`\`\n${cell.get('assetContent')}\n\`\`\``);
  if (up.length) lines.push(`\nUpstream dependencies: ${up.map(formatLinkedAsset).join(', ')}.`);
  if (down.length) lines.push(`Downstream impact: ${down.map(formatLinkedAsset).join(', ')}.`);
  lines.push('\nTask: Identify change risks, dependency impacts, validation steps, and best practices before modifying this SFMC asset.');
  return lines.join('\n');
}

function buildDrawer() {
  drawerEl = document.createElement('aside');
  drawerEl.className = 'sf-governance-drawer';
  drawerEl.setAttribute('aria-label', 'SFMC governance details');
  drawerEl.innerHTML = `
    <div class="sf-governance-drawer__header">
      <div>
        <h2 class="sf-governance-drawer__title"></h2>
        <span class="sf-governance-drawer__badge"></span>
      </div>
      <button class="sf-toolbar__button" type="button" aria-label="Close governance details">
        <svg class="sf-toolbar__icon" aria-hidden="true"><use href="#close"></use></svg>
      </button>
    </div>
    <div class="sf-governance-drawer__body"></div>
  `;
  document.body.appendChild(drawerEl);
  titleEl = drawerEl.querySelector('.sf-governance-drawer__title');
  badgeEl = drawerEl.querySelector('.sf-governance-drawer__badge');
  bodyEl = drawerEl.querySelector('.sf-governance-drawer__body');
  drawerEl.querySelector('button').addEventListener('click', closeDrawer);
}

function renderSelection() {
  updateToolbarVisibility();
  const selected = selection.getSelectedElements().find(isGovernanceAsset);
  if (!selected || tabs.getActiveTabType() !== 'governance') {
    closeDrawer();
    return;
  }
  openDrawer(selected);
}

function openDrawer(cell) {
  hideStencilForDrawer();

  const type = cell.get('assetType') || 'Asset';
  titleEl.textContent = getLabel(cell);
  badgeEl.textContent = type;
  badgeEl.style.backgroundColor = TYPE_COLORS[type] || TYPE_COLORS.API;

  const upstream = getLinkedAssets(cell, 'upstream');
  const downstream = getLinkedAssets(cell, 'downstream');
  const content = cell.get('assetContent') || '';

  bodyEl.innerHTML = `
    <section class="sf-governance-section">
      <h3>Description / Metadata</h3>
      <p>${escHtml(cell.get('assetDescription') || 'No description provided.')}</p>
      <dl class="sf-governance-meta">
        ${metaRow('External Key', cell.get('externalKey'))}
        ${metaRow('Business Unit', cell.get('businessUnit'))}
        ${metaRow('Folder/Cat', cell.get('folderCategory'))}
      </dl>
    </section>
    ${content ? `<section class="sf-governance-section"><h3>Code / Configuration</h3><pre class="sf-governance-code">${escHtml(content)}</pre></section>` : ''}
    <section class="sf-governance-section">
      <h3>Impact Analysis (Upstream)</h3>
      ${dependencyList(upstream)}
    </section>
    <section class="sf-governance-section">
      <h3>Impact Analysis (Downstream)</h3>
      ${dependencyList(downstream)}
    </section>
    <section class="sf-governance-section">
      <h3>AI Prompt Generator</h3>
      <button id="sf-governance-generate" class="sf-modal__btn sf-modal__btn--primary" type="button">Generate Context Prompt</button>
      <textarea id="sf-governance-prompt-output" class="sf-governance-prompt" readonly></textarea>
    </section>
  `;

  bodyEl.querySelector('#sf-governance-generate')?.addEventListener('click', () => {
    bodyEl.querySelector('#sf-governance-prompt-output').value = generatePrompt(cell);
  });
  drawerEl.classList.add('sf-governance-drawer--open');
}

function closeDrawer() {
  drawerEl?.classList.remove('sf-governance-drawer--open');
  restoreStencilAfterDrawer();
}

function showPromptForSelection() {
  const selected = selection.getSelectedElements().find(isGovernanceAsset);
  if (!selected) {
    alert('Select an SFMC governance asset first.');
    return;
  }
  openDrawer(selected);
  const output = bodyEl.querySelector('#sf-governance-prompt-output');
  if (output) output.value = generatePrompt(selected);
  document.getElementById('display-dropdown')?.classList.remove('sf-toolbar__dropdown--open');
}

function updateToolbarVisibility() {
  const active = tabs?.getActiveTabType?.() === 'governance';
  ['display-governance-separator', 'btn-governance-layout', 'btn-governance-prompt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = active ? '' : 'none';
  });
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
  if (tabs?.getActiveTabType?.() === 'governance') {
    stencil?.show?.();
  }
}

function isGovernanceAsset(cell) {
  return !!cell?.isElement?.() && cell.get('type') === 'sf.SimpleNode' && !!cell.get('assetType');
}

function getGovernanceAssets() {
  return graph.getElements().filter(isGovernanceAsset);
}

function getLabel(cell) {
  return cell.get('_savedLabel') || cell.attr('label/text') || 'Unnamed Asset';
}

function getLinkedAssets(cell, direction) {
  return graph.getLinks()
    .map(link => {
      const source = graph.getCell(link.get('source')?.id);
      const target = graph.getCell(link.get('target')?.id);
      if (direction === 'upstream' && target?.id === cell.id && isGovernanceAsset(source)) {
        return { cell: source, relation: getRelation(link) };
      }
      if (direction === 'downstream' && source?.id === cell.id && isGovernanceAsset(target)) {
        return { cell: target, relation: getRelation(link) };
      }
      return null;
    })
    .filter(Boolean);
}

function getRelation(link) {
  return link.labels?.()?.[0]?.attrs?.text?.text || link.get('relation') || 'Connected';
}

function formatLinkedAsset(entry) {
  return `${getLabel(entry.cell)} (${entry.cell.get('assetType') || 'Asset'}: ${entry.relation})`;
}

function dependencyList(entries) {
  if (!entries.length) return '<ul class="sf-governance-list"><li>None</li></ul>';
  return `<ul class="sf-governance-list">${entries.map(entry => (
    `<li>${escHtml(getLabel(entry.cell))} <span>(${escHtml(entry.relation)})</span></li>`
  )).join('')}</ul>`;
}

function metaRow(label, value) {
  if (!value) return '';
  return `<dt>${escHtml(label)}</dt><dd>${escHtml(value)}</dd>`;
}
