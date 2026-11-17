/* FixUp — utilitários de interface: formatação, ícones, tema, painéis, avisos e mapa. */
(function (S) {
  'use strict';

  S.actions = {};   // cliques:  data-action="nome"
  S.inputs = {};    // digitação: data-input="nome"
  S.screens = {};   // telas registradas

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = (n) => brl.format(n);
  const moneyShort = (n) => 'R$ ' + Math.round(n);
  const icon = (name, cls) => `<i data-lucide="${name}" class="ic${cls ? ' ' + cls : ''}"></i>`;
  const km = (v) => (v < 1 ? `${Math.round(v * 100) * 10} m` : `${v.toFixed(1).replace('.', ',')} km`);
  const rating = (r) => r.toFixed(1).replace('.', ',');
  const first = (name) => name.split(' ')[0];
  const initials = (name) => name.split(' ').filter(Boolean).filter((_, i, a) => i === 0 || i === a.length - 1).map((w) => w[0]).join('').toUpperCase();
  const avatar = (p, size) => `<span class="avatar" style="--s:${size || 48}px;--h:${p.hue == null ? 240 : p.hue}">${esc(initials(p.name))}</span>`;
  const stars = (n) => { let h = ''; for (let i = 1; i <= 5; i++) h += icon('star', i <= n ? 'on' : 'off'); return h; };
  const time = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function day(ts) {
    const d = new Date(ts), n = new Date();
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    const diff = Math.round((n0 - d0) / 864e5);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  /** Tempo decorrido em palavras: "hoje", "há 3 dias", "há 2 meses". */
  function ago(ts) {
    const d = Math.max(0, Math.floor((Date.now() - ts) / 864e5));
    const n = (v, one, many) => (v === 1 ? `há 1 ${one}` : `há ${v} ${many}`);
    if (d === 0) return 'hoje';
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    if (d < 30) return n(Math.floor(d / 7), 'semana', 'semanas');
    if (d < 365) return n(Math.floor(d / 30), 'mês', 'meses');
    return n(Math.floor(d / 365), 'ano', 'anos');
  }

  /** Código QR ilustrativo (não é um QR válido): usado na tela de Pix simulada. */
  function fakeQr(seed) {
    const n = 25;
    let s = (seed % 2147483646) + 1;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    let cells = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    const f = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.4"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx=".8" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".5"/>`;
    return `<svg viewBox="-1 -1 27 27" fill="#08083A" shape-rendering="crispEdges" aria-hidden="true">${cells}${f(0, 0)}${f(n - 7, 0)}${f(0, n - 7)}</svg>`;
  }

  const ui = S.ui = { esc, money, moneyShort, icon, km, rating, first, avatar, stars, time, day, ago, fakeQr, cssVar };

  ui.refreshIcons = function () {
    if (window.lucide) window.lucide.createIcons();
  };

  /* ---------- Trabalhos realizados ---------- */
  const jobExtra = (j) => [j.device, j.brand, j.model].filter(Boolean).join(' ');

  /** Título completo de um trabalho: "Troca da placa fonte — geladeira Electrolux DF52". */
  ui.jobTitle = (j) => { const x = jobExtra(j); return j.title + (x ? ' — ' + x : ''); };

  const LEVEL = { same: ['same', 'Mesmo problema'], similar: ['similar', 'Trabalho parecido'] };

  /** Cartão de um trabalho do banco. `level` (opcional) destaca o quanto ele se parece com a busca. */
  ui.jobCard = function (j, level) {
    const x = jobExtra(j), lv = LEVEL[level];
    return `
      <article class="job${lv ? ' hit' : ''}">
        <div class="job-top"><strong>${esc(j.title)}</strong><b>${moneyShort(j.price)}</b></div>
        ${x ? `<p class="job-dev">${esc(x.charAt(0).toUpperCase() + x.slice(1))}</p>` : ''}
        ${j.problem ? `<p class="job-problem">“${esc(j.problem)}”</p>` : ''}
        <div class="job-meta">
          ${lv ? `<span class="lvl ${lv[0]}">${lv[1]}</span>` : ''}
          ${j.rating ? `<span class="star">${icon('star')}${j.rating},0</span>` : '<span>Aguardando avaliação</span>'}
          <span>${ago(j.doneAt)}</span>${j.client ? `<span>${esc(j.client)}</span>` : ''}
        </div>
      </article>`;
  };

  /* ---------- Tema (claro, escuro ou automático) ---------- */
  const THEME_KEY = 'fixup:theme';
  let themeMem = null;

  S.theme = {
    /** Preferência do usuário: 'auto', 'light' ou 'dark'. */
    pref() {
      if (themeMem) return themeMem;
      try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
    },

    /** Tema em uso. No automático, segue a página que hospeda o app (se houver) ou o aparelho. */
    resolved() {
      const p = this.pref();
      if (p === 'light' || p === 'dark') return p;
      const host = document.documentElement.getAttribute('data-theme');
      if (host === 'light' || host === 'dark') return host;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    apply() {
      const t = this.resolved();
      document.documentElement.setAttribute('data-fx-theme', t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0A0A1F' : '#0404E2');
      document.querySelectorAll('.theme-seg button').forEach((b) => b.classList.toggle('active', b.dataset.arg === this.pref()));
      return t;
    },

    set(p) {
      themeMem = p;
      try { localStorage.setItem(THEME_KEY, p); } catch (e) { /* fica só nesta sessão */ }
      this.apply();
      if (S.app) S.app.refresh();
    },

    /** Reaplica o tema quando o aparelho (ou a página que hospeda o app) muda de claro para escuro. */
    watch() {
      const sync = () => { if (this.pref() === 'auto' && this.apply() && S.app) S.app.refresh(); };
      try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync); } catch (e) { /* navegador antigo */ }
      try { new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* idem */ }
    }
  };

  S.actions['set-theme'] = (el) => S.theme.set(el.dataset.arg);
  S.actions['cycle-theme'] = () => S.theme.set({ auto: 'light', light: 'dark', dark: 'auto' }[S.theme.pref()] || 'auto');

  /** Tela larga (tablet ou computador): mesma medida usada no CSS. */
  ui.wide = () => !!(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);

  /* ---------- Avisos rápidos ---------- */
  ui.toast = function (msg, kind) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    const ic = { ok: 'circle-check', bad: 'circle-alert', info: 'info' }[kind || 'info'];
    el.className = 'toast ' + (kind || 'info');
    el.innerHTML = icon(ic) + `<span>${esc(msg)}</span>`;
    root.innerHTML = '';
    root.appendChild(el);
    ui.refreshIcons();
    setTimeout(() => el.classList.add('out'), 2900);
    setTimeout(() => el.remove(), 3300);
  };

  /* ---------- Painel inferior (bottom sheet) ---------- */
  let sheetOpts = null, closeTimer = null;
  const sheetRoot = () => document.getElementById('sheet-root');

  ui.sheet = {
    isOpen: () => !!sheetOpts,

    open(html, opts) {
      if (sheetOpts) this.close();
      clearTimeout(closeTimer);
      sheetOpts = opts || {};
      const root = sheetRoot();
      root.innerHTML = `<div class="sheet-backdrop"${sheetOpts.locked ? '' : ' data-action="sheet-close"'}></div>
        <div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>${html}</div>`;
      root.className = 'sheet-root open';
      ui.refreshIcons();
    },

    close() {
      const o = sheetOpts;
      if (!o) return;
      sheetOpts = null;
      const root = sheetRoot();
      root.classList.add('closing');
      closeTimer = setTimeout(() => { root.className = 'sheet-root'; root.innerHTML = ''; }, 200);
      if (o.onClose) o.onClose();
    }
  };

  S.actions['sheet-close'] = () => ui.sheet.close();

  /** Pergunta de confirmação. Resolve com true/false. */
  ui.confirm = function (o) {
    return new Promise((resolve) => {
      let answered = false;
      ui.sheet.open(`
        <div class="dialog">
          <h3>${esc(o.title)}</h3>
          <p class="muted">${esc(o.text)}</p>
          <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'} btn-block" data-action="confirm-yes">${esc(o.ok || 'Confirmar')}</button>
          <button class="btn btn-ghost btn-block" data-action="sheet-close">${esc(o.cancel || 'Voltar')}</button>
        </div>`, { onClose() { if (!answered) resolve(false); } });
      S.actions['confirm-yes'] = () => { answered = true; ui.sheet.close(); resolve(true); };
    });
  };

  /* ---------- Mapa (Leaflet) ---------- */
  const pin = (html) => window.L.divIcon({ className: 'pin-wrap', html, iconSize: [0, 0] });
  const ll = (p) => [p.lat, p.lng];

  /* Cores do mapa ilustrativo em cada tema. */
  const DEMO_MAP = {
    light: { bg: '#E6E7F8', park: '#CFE8DF', block: '#D9DAF4', street: '#FFFFFF' },
    dark: { bg: '#14142B', park: '#12332E', block: '#1B1B3D', street: '#2C2C57' }
  };

  /** Mapa ilustrativo desenhado no próprio navegador (sem buscar imagens em outros sites):
      uma malha de ruas, avenidas e praças. Usado quando `config.tiles` está vazio. */
  function demoLayer() {
    const L = window.L, g = S.config.demoGrid, colors = DEMO_MAP[S.theme.resolved()];
    const mod4 = (n) => ((n % 4) + 4) % 4;
    const rnd = (i, j) => {
      let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    const Layer = L.GridLayer.extend({
      createTile(coords) {
        const size = this.getTileSize(), z = coords.z, map = this._map;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tile = document.createElement('canvas');
        tile.width = size.x * dpr;
        tile.height = size.y * dpr;
        const ctx = tile.getContext('2d');
        ctx.scale(dpr, dpr);

        const origin = L.point(coords.x * size.x, coords.y * size.y);
        const nw = map.unproject(origin, z), se = map.unproject(origin.add(size), z);
        const X = (lng) => map.project([0, lng], z).x - origin.x;
        const Y = (lat) => map.project([lat, 0], z).y - origin.y;
        const i0 = Math.floor(nw.lng / g.dLng) - 1, i1 = Math.ceil(se.lng / g.dLng) + 1;
        const j0 = Math.floor(se.lat / g.dLat) - 1, j1 = Math.ceil(nw.lat / g.dLat) + 1;
        const block = X(g.dLng) - X(0);

        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, size.x, size.y);

        if (block >= 5) {
          for (let i = i0; i <= i1; i++) {
            for (let j = j0; j <= j1; j++) {
              const r = rnd(i, j);
              const park = r <= 0.08;
              if (!park && (r < 0.9 || block < 14)) continue;
              ctx.fillStyle = park ? colors.park : colors.block;
              const x = X(i * g.dLng), y = Y((j + 1) * g.dLat);
              ctx.fillRect(x, y, X((i + 1) * g.dLng) - x, Y(j * g.dLat) - y);
            }
          }
        }

        const minor = Math.min(9, Math.max(1, block * 0.16)), major = Math.min(16, Math.max(2, block * 0.32));
        ctx.strokeStyle = colors.street;
        const line = (x0, y0, x1, y1, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
        for (let i = i0; i <= i1; i++) {
          const big = mod4(i) === 0;
          if (big || block >= 14) { const x = X(i * g.dLng); line(x, -2, x, size.y + 2, big ? major : minor); }
        }
        for (let j = j0; j <= j1; j++) {
          const big = mod4(j) === 0;
          if (big || block >= 14) { const y = Y(j * g.dLat); line(-2, y, size.x + 2, y, big ? major : minor); }
        }
        return tile;
      }
    });
    return new Layer({ maxZoom: 19, attribution: 'Mapa ilustrativo' });
  }

  S.map = {
    ll,

    /** Cores da rota no tema atual: [trecho que falta, trecho já percorrido]. */
    routeColors: () => [cssVar('--route') || '#0404E2', cssVar('--route-bg') || '#B9B9FF'],

    /** Cria o mapa. Retorna `null` (e mostra um aviso) se a biblioteca não carregou. */
    create(el, center, zoom, opts) {
      if (!el) return null;
      if (!window.L) {
        el.innerHTML = `<div class="map-fallback">${icon('map')}<span>Mapa indisponível sem conexão</span></div>`;
        ui.refreshIcons();
        return null;
      }
      const live = !opts || opts.interactive !== false;
      const map = window.L.map(el, {
        zoomControl: false, dragging: live, touchZoom: live, scrollWheelZoom: live, doubleClickZoom: live,
        boxZoom: false, keyboard: false, fadeAnimation: false
      }).setView(ll(center), zoom);
      map.attributionControl.setPrefix(false);
      if (S.config.tiles) window.L.tileLayer(S.config.tiles.url, { attribution: S.config.tiles.attribution, maxZoom: 19 }).addTo(map);
      else { el.classList.add('map-demo'); demoLayer().addTo(map); }
      setTimeout(() => { if (el.isConnected) map.invalidateSize(); }, 320);
      return map;
    },

    user: (map, pos) => window.L.marker(ll(pos), { icon: pin('<div class="pin pin-user"></div>'), interactive: false, zIndexOffset: 400 }).addTo(map),
    dest: (map, pos) => window.L.marker(ll(pos), { icon: pin('<div class="pin pin-dest"></div>'), interactive: false, zIndexOffset: 300 }).addTo(map),
    dot: (map, p) => window.L.marker(ll(p.pos), { icon: pin(`<div class="pin pin-dot${p.availableNow ? '' : ' off'}"></div>`), interactive: false }).addTo(map),
    price: (layer, p, value) => window.L.marker(ll(p.pos), { icon: pin(`<div class="pin pin-price">${moneyShort(value == null ? p.fromPrice : value)}</div>`) }).addTo(layer),
    pro: (map, p, pos) => window.L.marker(ll(pos), { icon: pin(`<div class="pin pin-pro">${avatar(p, 40)}</div>`), interactive: false, zIndexOffset: 600 }).addTo(map),

    line(map, points, color, weight) {
      return window.L.polyline(points.map(ll), { color, weight: weight || 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    },

    fit(map, points, pad) {
      const p = Object.assign({ t: 30, r: 30, b: 30, l: 30 }, pad);
      map.fitBounds(window.L.latLngBounds(points.map(ll)), { paddingTopLeft: [p.l, p.t], paddingBottomRight: [p.r, p.b], maxZoom: 16, animate: false });
    }
  };
})(window.FixUp = window.FixUp || {});
