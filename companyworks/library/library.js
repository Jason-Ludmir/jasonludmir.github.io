'use strict';
const $ = id => document.getElementById(id);
const size = 40;
let data = [], page = 0, timer;
const params = new URLSearchParams(location.search);
$('query').value = params.get('q') || '';
for (const id of ['source', 'topic']) {
  const value = params.get(id) || '';
  if ([...$(id).options].some(option => option.value === value)) $(id).value = value;
}
page = Math.max(0, (Number.parseInt(params.get('page'), 10) || 1) - 1);
function link(text, url) {
  const a = document.createElement('a'); a.textContent = text; a.href = url;
  a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
function render() {
  const words = $('query').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const source = $('source').value, topic = $('topic').value;
  const matches = data.filter(row => (!source || row.source === source) && (!topic || row.tags.includes(topic)) && words.every(word => row.search.includes(word)));
  const pages = Math.max(1, Math.ceil(matches.length / size)); page = Math.min(page, pages - 1);
  const start = page * size, end = Math.min(start + size, matches.length);
  $('status').textContent = matches.length ? `${matches.length.toLocaleString()} documents · Showing ${(start + 1).toLocaleString()}–${end.toLocaleString()}` : 'No matching documents';
  $('page-label').textContent = `Page ${page + 1} of ${pages}`;
  $('previous').disabled = page === 0; $('next').disabled = page >= pages - 1;
  const fragment = document.createDocumentFragment();
  for (const row of matches.slice(start, end)) {
    const article = document.createElement('article'); article.className = 'result';
    const sourceLabel = document.createElement('div'); sourceLabel.className = 'source'; sourceLabel.textContent = row.source === 'REF2021' ? 'REF 2021' : row.source;
    const heading = document.createElement('h2'); heading.append(link(row.title, row.url));
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = [row.kind, row.institution, row.subject].filter(Boolean).join(' · ');
    article.append(sourceLabel, heading, meta);
    for (const tag of row.tags) { const badge = document.createElement('span'); badge.className = 'tag'; badge.textContent = tag; article.append(badge); }
    const actions = document.createElement('div'); actions.className = 'result-actions'; actions.append(link('Read original ↗', row.url));
    article.append(actions); fragment.append(article);
  }
  if (!matches.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Try a broader term or clear the source and topic filters.'; fragment.append(empty); }
  $('results').replaceChildren(fragment);
  const state = new URLSearchParams();
  if ($('query').value.trim()) state.set('q', $('query').value.trim());
  if (source) state.set('source', source); if (topic) state.set('topic', topic);
  if (page) state.set('page', String(page + 1));
  history.replaceState(null, '', location.pathname + (state.size ? '?' + state : ''));
}
async function load() {
  $('error').hidden = true; $('status').textContent = 'Loading the library…';
  try {
    const response = await fetch('catalog.json'); if (!response.ok) throw new Error('Catalog unavailable');
    data = await response.json();
    for (const row of data) row.search = [row.title, row.kind, row.institution, row.subject, row.id, ...row.tags].filter(Boolean).join(' ').toLocaleLowerCase();
    render();
  } catch { $('error').hidden = false; $('status').textContent = 'Library unavailable'; }
}
$('filters').addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); page = 0; render(); });
$('query').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 0; render(); }, 120); });
for (const id of ['source', 'topic']) $(id).addEventListener('change', () => { page = 0; render(); });
$('reset').addEventListener('click', () => { clearTimeout(timer); $('query').value = ''; $('source').value = ''; $('topic').value = ''; page = 0; render(); $('query').focus(); });
for (const [id, delta] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => { page += delta; render(); $('filters').scrollIntoView({behavior:'smooth'}); });
$('retry').addEventListener('click', load);
load();
