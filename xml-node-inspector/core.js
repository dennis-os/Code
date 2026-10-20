/* XML Node Inspector - shared core (tree + occurrence panel) */
(function (global) {
  'use strict';

  const NS = 'xni';

  /* ---------- helpers ---------- */

  function blankOut(src) {
    // Replace comment/CDATA content with spaces (keep newlines) so line scanning
    // does not pick up tags inside them.
    return src.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, m =>
      m.replace(/[^\n]/g, ' ')
    );
  }

  function buildLineIndex(src) {
    // tagName -> [line, line, ...] in document order
    const cleaned = blankOut(src);
    const lines = new Map();
    const re = /<([A-Za-z_][\w.\-:]*)/g;
    let m, line = 1, last = 0;
    while ((m = re.exec(cleaned)) !== null) {
      for (let i = last; i < m.index; i++) if (cleaned.charCodeAt(i) === 10) line++;
      last = m.index;
      const name = m[1];
      if (!lines.has(name)) lines.set(name, []);
      lines.get(name).push(line);
    }
    return lines;
  }

  function assignLines(root, lineIndex) {
    const counters = new Map();
    const walk = el => {
      const n = el.nodeName;
      const i = counters.get(n) || 0;
      counters.set(n, i + 1);
      const arr = lineIndex.get(n);
      el.__xniLine = arr && arr[i] ? arr[i] : null;
      for (const c of el.children) walk(c);
    };
    walk(root);
  }

  function directText(el) {
    let out = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3 || n.nodeType === 4) out += n.nodeValue;
    }
    return out.trim();
  }

  function pathOf(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let idx = 1;
      let sib = cur.previousElementSibling;
      while (sib) { if (sib.nodeName === cur.nodeName) idx++; sib = sib.previousElementSibling; }
      let many = idx > 1;
      if (!many) {
        let n = cur.nextElementSibling;
        while (n) { if (n.nodeName === cur.nodeName) { many = true; break; } n = n.nextElementSibling; }
      }
      parts.unshift(cur.nodeName + (many ? `[${idx}]` : ''));
      cur = cur.parentElement;
    }
    return '/' + parts.join('/');
  }

  function shapeOf(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1) { parts.unshift(cur.nodeName); cur = cur.parentElement; }
    return '/' + parts.join('/');
  }

  function attrString(el) {
    return Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function csvCell(s) {
    s = s == null ? '' : String(s);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ---------- app ---------- */

  function mount(container, xmlSource, meta) {
    const doc = new DOMParser().parseFromString(xmlSource, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err || !doc.documentElement) {
      container.innerHTML = `<div class="${NS}-fatal"><h2>XML konnte nicht geparst werden</h2><pre>${esc(err ? err.textContent : 'Kein Wurzelelement gefunden.')}</pre></div>`;
      return;
    }

    const root = doc.documentElement;
    assignLines(root, buildLineIndex(xmlSource));

    // index all elements by tag name and by structural path
    const byName = new Map();
    const byShape = new Map();
    let total = 0;
    (function idx(el) {
      total++;
      if (!byName.has(el.nodeName)) byName.set(el.nodeName, []);
      byName.get(el.nodeName).push(el);
      const sh = shapeOf(el);
      if (!byShape.has(sh)) byShape.set(sh, []);
      byShape.get(sh).push(el);
      for (const c of el.children) idx(c);
    })(root);

    container.innerHTML = `
<div class="${NS}-app">
  <header class="${NS}-bar">
    <span class="${NS}-logo">XML Node Inspector</span>
    <span class="${NS}-meta">${esc(meta && meta.name ? meta.name : location.href.split('/').pop() || 'Dokument')}
      &middot; ${total.toLocaleString('de-DE')} Elemente
      &middot; ${byName.size.toLocaleString('de-DE')} Knotentypen</span>
    <span class="${NS}-spacer"></span>
    <input class="${NS}-treefilter" type="search" placeholder="Baum filtern (Tag oder Text)">
    <button class="${NS}-btn" data-act="expand">Alle aufklappen</button>
    <button class="${NS}-btn" data-act="collapse">Alle zuklappen</button>
  </header>
  <div class="${NS}-body">
    <section class="${NS}-tree" tabindex="0" aria-label="XML-Baum"></section>
    <div class="${NS}-split" role="separator" aria-orientation="vertical"></div>
    <aside class="${NS}-panel" aria-live="polite">
      <div class="${NS}-empty">
        <h3>Knoten anklicken</h3>
        <p>Klick links auf einen Tag-Namen. Rechts erscheinen alle Vorkommen dieses Knotens im gesamten Dokument &ndash; mit Wert, Attributen, XPath und Zeilennummer.</p>
      </div>
    </aside>
  </div>
</div>`;

    const treeEl = container.querySelector(`.${NS}-tree`);
    const panelEl = container.querySelector(`.${NS}-panel`);

    /* ---- tree rendering (lazy) ---- */

    function nodeRow(el, depth) {
      const row = document.createElement('div');
      row.className = `${NS}-node`;
      row.style.setProperty('--d', depth);
      row.__el = el;

      const kids = el.children.length;
      const tw = document.createElement('button');
      tw.className = `${NS}-tw`;
      tw.type = 'button';
      tw.setAttribute('aria-label', 'Auf-/zuklappen');
      tw.textContent = kids ? '▸' : '';
      if (!kids) tw.classList.add(`${NS}-tw-leaf`);

      const tag = document.createElement('button');
      tag.className = `${NS}-tag`;
      tag.type = 'button';
      tag.textContent = el.nodeName;
      tag.title = 'Alle Vorkommen dieses Knotens anzeigen';

      const count = document.createElement('span');
      count.className = `${NS}-count`;
      count.textContent = '×' + byName.get(el.nodeName).length;

      const head = document.createElement('div');
      head.className = `${NS}-head`;
      head.append(tw, tag, count);

      if (el.attributes.length) {
        const at = document.createElement('span');
        at.className = `${NS}-attrs`;
        at.textContent = attrString(el);
        head.append(at);
      }
      const dt = directText(el);
      if (dt) {
        const v = document.createElement('span');
        v.className = `${NS}-val`;
        v.textContent = dt.length > 160 ? dt.slice(0, 160) + '…' : dt;
        head.append(v);
      }
      if (el.__xniLine) {
        const ln = document.createElement('span');
        ln.className = `${NS}-line`;
        ln.textContent = 'Z' + el.__xniLine;
        head.append(ln);
      }

      const children = document.createElement('div');
      children.className = `${NS}-children`;
      children.hidden = true;

      row.append(head, children);

      let built = false;
      row.__toggle = force => {
        const open = force !== undefined ? force : children.hidden;
        if (open && !built) {
          built = true;
          const frag = document.createDocumentFragment();
          for (const c of el.children) frag.append(nodeRow(c, depth + 1));
          children.append(frag);
        }
        children.hidden = !open;
        tw.textContent = kids ? (open ? '▾' : '▸') : '';
        row.classList.toggle(`${NS}-open`, open);
      };

      tw.addEventListener('click', e => { e.stopPropagation(); if (kids) row.__toggle(); });
      head.addEventListener('dblclick', () => { if (kids) row.__toggle(); });
      tag.addEventListener('click', e => {
        e.stopPropagation();
        treeEl.querySelectorAll(`.${NS}-sel`).forEach(n => n.classList.remove(`${NS}-sel`));
        head.classList.add(`${NS}-sel`);
        showOccurrences(el);
      });

      return row;
    }

    const rootRow = nodeRow(root, 0);
    treeEl.append(rootRow);
    rootRow.__toggle(true);

    function walkRows(fn) {
      treeEl.querySelectorAll(`.${NS}-node`).forEach(fn);
    }

    container.querySelector('[data-act="expand"]').addEventListener('click', () => {
      if (total > 20000 && !confirm(`${total.toLocaleString('de-DE')} Elemente aufklappen kann langsam werden. Fortfahren?`)) return;
      // repeat because expansion is lazy
      for (let pass = 0; pass < 60; pass++) {
        const closed = Array.from(treeEl.querySelectorAll(`.${NS}-node:not(.${NS}-open)`));
        const todo = closed.filter(r => r.__el.children.length);
        if (!todo.length) break;
        todo.forEach(r => r.__toggle(true));
      }
    });
    container.querySelector('[data-act="collapse"]').addEventListener('click', () => {
      walkRows(r => { if (r !== rootRow) r.__toggle(false); });
      rootRow.__toggle(true);
    });

    const tf = container.querySelector(`.${NS}-treefilter`);
    let tfTimer;
    tf.addEventListener('input', () => {
      clearTimeout(tfTimer);
      tfTimer = setTimeout(() => {
        const q = tf.value.trim().toLowerCase();
        if (!q) { walkRows(r => r.classList.remove(`${NS}-hidden`)); return; }
        walkRows(r => {
          const el = r.__el;
          const hit = el.nodeName.toLowerCase().includes(q) ||
            directText(el).toLowerCase().includes(q) ||
            attrString(el).toLowerCase().includes(q);
          r.classList.toggle(`${NS}-hidden`, !hit);
          if (hit) {
            let p = r.parentElement;
            while (p && p !== treeEl) {
              if (p.classList.contains(`${NS}-node`)) { p.classList.remove(`${NS}-hidden`); p.__toggle(true); }
              p = p.parentElement;
            }
          }
        });
      }, 180);
    });

    /* ---- occurrence panel ---- */

    let state = null;

    function showOccurrences(el) {
      state = { name: el.nodeName, shape: shapeOf(el), mode: 'name', query: '', onlyValues: false };
      renderPanel();
    }

    function currentList() {
      const list = state.mode === 'name'
        ? (byName.get(state.name) || [])
        : (byShape.get(state.shape) || []);
      return list.map((n, i) => ({
        i: i + 1,
        el: n,
        path: pathOf(n),
        shape: shapeOf(n),
        value: directText(n),
        attrs: attrString(n),
        line: n.__xniLine
      }));
    }

    function renderPanel() {
      const all = currentList();
      const q = state.query.toLowerCase();
      let rows = all.filter(r =>
        (!state.onlyValues || r.value !== '') &&
        (!q || r.value.toLowerCase().includes(q) || r.attrs.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
      );

      const uniq = new Set(all.map(r => r.value)).size;
      const withVal = all.filter(r => r.value !== '').length;

      panelEl.innerHTML = `
<div class="${NS}-phead">
  <h2>&lt;${esc(state.name)}&gt;</h2>
  <div class="${NS}-stats">
    <b>${all.length.toLocaleString('de-DE')}</b> Vorkommen ·
    <b>${uniq.toLocaleString('de-DE')}</b> verschiedene Werte ·
    <b>${withVal.toLocaleString('de-DE')}</b> mit Textinhalt
  </div>
  <div class="${NS}-modes">
    <label><input type="radio" name="${NS}-mode" value="name" ${state.mode === 'name' ? 'checked' : ''}> überall im Dokument</label>
    <label><input type="radio" name="${NS}-mode" value="shape" ${state.mode === 'shape' ? 'checked' : ''}> nur unter gleichem Pfad</label>
  </div>
  <code class="${NS}-shape">${esc(state.shape)}</code>
  <div class="${NS}-ptools">
    <input class="${NS}-pfilter" type="search" placeholder="In Treffern filtern" value="${esc(state.query)}">
    <label class="${NS}-chk"><input type="checkbox" ${state.onlyValues ? 'checked' : ''}> nur mit Wert</label>
    <button class="${NS}-btn" data-p="copyvals">Werte kopieren</button>
    <button class="${NS}-btn" data-p="copyxpath">XPath kopieren</button>
    <button class="${NS}-btn" data-p="csv">CSV</button>
  </div>
</div>
<div class="${NS}-plist">
  <table class="${NS}-table">
    <thead><tr><th>#</th><th>Wert</th><th>Attribute</th><th>XPath</th><th>Zeile</th></tr></thead>
    <tbody>
      ${rows.length ? rows.map(r => `<tr data-i="${r.i}">
        <td class="${NS}-n">${r.i}</td>
        <td class="${NS}-v">${r.value ? esc(r.value) : `<i class="${NS}-none">leer</i>`}</td>
        <td class="${NS}-a">${r.attrs ? esc(r.attrs) : ''}</td>
        <td class="${NS}-p"><code>${esc(r.path)}</code></td>
        <td class="${NS}-l">${r.line ? 'Z' + r.line : ''}</td>
      </tr>`).join('') : `<tr><td colspan="5" class="${NS}-none">Keine Treffer für diesen Filter.</td></tr>`}
    </tbody>
  </table>
</div>`;

      panelEl.querySelectorAll(`input[name="${NS}-mode"]`).forEach(r =>
        r.addEventListener('change', () => { state.mode = r.value; renderPanel(); }));

      const pf = panelEl.querySelector(`.${NS}-pfilter`);
      let t;
      pf.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { state.query = pf.value; const pos = pf.selectionStart; renderPanel();
          const nf = panelEl.querySelector(`.${NS}-pfilter`); nf.focus(); nf.setSelectionRange(pos, pos); }, 200);
      });
      panelEl.querySelector(`.${NS}-chk input`).addEventListener('change', e => {
        state.onlyValues = e.target.checked; renderPanel();
      });

      panelEl.querySelector('[data-p="copyvals"]').addEventListener('click', () =>
        navigator.clipboard.writeText(rows.map(r => r.value).join('\n')));
      panelEl.querySelector('[data-p="copyxpath"]').addEventListener('click', () =>
        navigator.clipboard.writeText('//' + state.name));
      panelEl.querySelector('[data-p="csv"]').addEventListener('click', () =>
        download(`${state.name}.csv`,
          '\uFEFF' + ['#;Wert;Attribute;XPath;Zeile'].concat(
            rows.map(r => [r.i, r.value, r.attrs, r.path, r.line || ''].map(csvCell).join(';'))
          ).join('\n'), 'text/csv;charset=utf-8'));

      // click a result row -> reveal in tree
      panelEl.querySelectorAll(`.${NS}-table tbody tr[data-i]`).forEach(tr => {
        tr.addEventListener('click', () => {
          const r = rows.find(x => x.i === +tr.dataset.i);
          if (r) reveal(r.el);
        });
      });
    }

    function reveal(el) {
      const chain = [];
      let cur = el;
      while (cur && cur !== root) { chain.unshift(cur); cur = cur.parentElement; }
      let row = rootRow;
      row.__toggle(true);
      for (const target of chain) {
        const next = Array.from(row.querySelector(`.${NS}-children`).children)
          .find(c => c.__el === target);
        if (!next) break;
        next.__toggle(true);
        row = next;
      }
      treeEl.querySelectorAll(`.${NS}-flash`).forEach(n => n.classList.remove(`${NS}-flash`));
      const head = row.querySelector(`.${NS}-head`);
      head.classList.add(`${NS}-flash`);
      head.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    /* ---- resizable split ---- */
    const split = container.querySelector(`.${NS}-split`);
    const body = container.querySelector(`.${NS}-body`);
    let dragging = false;
    split.addEventListener('pointerdown', e => { dragging = true; split.setPointerCapture(e.pointerId); });
    split.addEventListener('pointermove', e => {
      if (!dragging) return;
      const r = body.getBoundingClientRect();
      const pct = Math.min(80, Math.max(20, ((e.clientX - r.left) / r.width) * 100));
      body.style.gridTemplateColumns = `${pct}% 6px 1fr`;
    });
    split.addEventListener('pointerup', () => { dragging = false; });
  }

  global.XNI = { mount };
})(window);
