/* FixUp — inicialização, rotas e navegação. */
(function (S) {
  'use strict';

  const ui = S.ui, A = S.actions;

  const ROUTES = [
    ['/home', 'home'], ['/search', 'search'], ['/p/:id', 'proProfile'], ['/checkout/:pro/:service', 'checkout'],
    ['/track/:id', 'track'], ['/orders', 'orders'], ['/order/:id', 'receipt'], ['/wallet', 'wallet'], ['/profile', 'profile'],
    ['/chats', 'chats'], ['/chat/:id', 'chat'],
    ['/pro', 'proHome'], ['/pro/earnings', 'proEarnings'], ['/pro/chats', 'proChats'], ['/pro/chat/:id', 'proChat']
  ].map(([pattern, name]) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    return { re, keys, name };
  });

  const TABS = {
    client: [['home', '/home', 'house', 'Início'], ['search', '/search', 'search', 'Buscar'], ['chats', '/chats', 'message-circle', 'Conversas'], ['orders', '/orders', 'receipt-text', 'Pedidos'], ['profile', '/profile', 'user', 'Perfil']],
    pro: [['pro', '/pro', 'house', 'Início'], ['pchats', '/pro/chats', 'message-circle', 'Conversas'], ['earnings', '/pro/earnings', 'banknote', 'Ganhos'], ['profile', '/profile', 'user', 'Perfil']]
  };

  let current = null, cleanup = null, depth = 0, ready = false;

  /* Na versão publicada a rota fica em memória (o endereço da página não pode ser alterado);
     na versão local ela fica no endereço (#/tela), o que permite voltar e compartilhar links. */
  const EMBED = S.config.embedded;
  let mem = '';
  const stack = [];

  const state = () => S.store.state;
  const homeOf = () => (state().mode === 'pro' ? '/pro' : '/home');
  const screenEl = () => document.getElementById('screen');
  const currentPath = () => (EMBED ? mem : location.hash.replace(/^#/, ''));
  const setPath = (path) => { if (EMBED) mem = path; else history.replaceState(null, '', '#' + path); };

  function parse() {
    const raw = currentPath();
    const cut = raw.indexOf('?');
    const query = {};
    new URLSearchParams(cut >= 0 ? raw.slice(cut + 1) : '').forEach((v, k) => { query[k] = v; });
    return { path: cut >= 0 ? raw.slice(0, cut) : raw, query };
  }

  function match(path) {
    for (const r of ROUTES) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { name: r.name, params };
      }
    }
    return null;
  }

  function renderTabs(active) {
    const bar = document.getElementById('tabbar');
    bar.hidden = !active;
    if (!active) return;
    const live = state().mode === 'client' && S.orders.active();
    const unread = S.chat.unread();
    const dot = (id) => ((id === 'orders' && live) || ((id === 'chats' || id === 'pchats') && unread) ? '<i class="tab-dot"></i>' : '');
    bar.innerHTML = TABS[state().mode].map(([id, path, ic, label]) =>
      `<button class="tab${id === active ? ' active' : ''}" data-go="${path}">${ui.icon(ic)}<span>${label}</span>${dot(id)}</button>`).join('');
    ui.refreshIcons();
  }

  /** Redesenha só a barra de abas (por exemplo, quando chega uma mensagem). */
  function syncTabs() {
    if (ready && current) renderTabs(current.screen.tab);
  }

  /* Barra de status: clara sobre o cabeçalho azul, sólida quando o conteúdo rola por baixo dela. */
  function syncStatusBar() {
    const device = document.getElementById('device'), el = screenEl(), hero = el.querySelector('.hero');
    const past = !!hero && el.scrollTop > hero.offsetHeight - 38;
    device.dataset.sb = hero && !past ? 'light' : (current.screen.statusBar === 'light' && !hero ? 'light' : 'dark');
    device.classList.toggle('sb-solid', past);
  }

  function syncMode() {
    document.querySelectorAll('#mode-seg button').forEach((b) => b.classList.toggle('active', b.dataset.arg === state().mode));
  }

  function render(opts) {
    if (!ready) return;
    opts = opts || {};
    const loc = parse(), m = match(loc.path);
    if (!m) { setPath(homeOf()); return render(); }
    const screen = S.screens[m.name];
    if (screen.mode && screen.mode !== state().mode) { state().mode = screen.mode; S.store.save(); }

    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    ui.sheet.close();

    const el = screenEl(), y = el.scrollTop;
    current = { name: m.name, params: m.params, query: loc.query, screen };
    el.innerHTML = `<div class="view view-${m.name}${opts.keepScroll ? '' : ' enter'}">${screen.render(m.params, loc.query)}</div>`;
    el.scrollTop = opts.keepScroll ? y : 0;
    syncStatusBar();
    renderTabs(screen.tab);
    syncMode();
    ui.refreshIcons();
    if (screen.mount) cleanup = screen.mount(el.firstElementChild, m.params, loc.query) || null;
  }

  /* ---------- Navegação ---------- */
  function go(path) {
    if (currentPath() === path) return render();
    if (EMBED) {
      stack.push(mem);
      if (stack.length > 60) stack.shift();
      mem = path;
      return render();
    }
    depth += 1;
    location.hash = path;
  }
  function replace(path, opts) {
    setPath(path);
    render(opts || { keepScroll: true });
  }
  function silent(path) { setPath(path); }
  function back() {
    if (EMBED) {
      if (!stack.length) return replace(homeOf(), {});
      mem = stack.pop();
      return render();
    }
    if (depth > 0) { depth -= 1; history.back(); } else replace(homeOf(), {});
  }
  function refresh() { render({ keepScroll: true }); }

  /* ---------- Localização do usuário (GPS) ---------- */
  function softRefresh() {
    if (!current || ['home', 'search', 'checkout', 'proHome'].indexOf(current.name) < 0) return;
    const focus = document.activeElement && document.activeElement.tagName;
    if (ui.sheet.isOpen() || focus === 'INPUT' || focus === 'TEXTAREA') return;
    refresh();
  }

  async function locateUser() {
    const pos = await S.geo.locate();
    if (!pos) return false;
    state().location = { lat: pos.lat, lng: pos.lng, label: 'Localização atual', sub: 'Obtida pelo GPS do aparelho', source: 'gps' };
    S.store.save();
    softRefresh();
    const addr = await S.geo.reverse(pos);
    if (addr) {
      Object.assign(state().location, addr);
      S.store.save();
      softRefresh();
    }
    return true;
  }

  S.app = { go, replace, silent, back, refresh, syncTabs, locateUser, current: () => current };

  /* ---------- Ações globais ---------- */
  A['back'] = back;

  A['set-mode'] = (el) => {
    const mode = el.dataset.arg;
    if (!ready || (mode === state().mode && current && current.name !== 'profile')) return;
    if (mode === 'client') S.proSim.reset();
    state().mode = mode;
    S.store.save();
    depth = 0;
    stack.length = 0;
    if (EMBED) { mem = homeOf(); render(); }
    else if (location.hash === '#' + homeOf()) render();
    else location.hash = homeOf();
    ui.toast(mode === 'pro' ? 'Modo profissional ativado.' : 'Modo cliente ativado.', 'info');
  };

  /* ---------- Eventos (delegados) ---------- */
  document.addEventListener('click', (ev) => {
    const go_ = ev.target.closest('[data-go]'), act = ev.target.closest('[data-action]');
    const el = go_ && act ? (go_.contains(act) ? act : go_) : (go_ || act);
    if (!el) return;
    ev.preventDefault();
    if (el.hasAttribute('data-action')) {
      const fn = A[el.dataset.action];
      if (fn) fn(el, ev);
    } else if (ready) {
      ui.sheet.close();
      go(el.dataset.go);
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-input]');
    if (el && S.inputs[el.dataset.input]) S.inputs[el.dataset.input](el, ev);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') return ui.sheet.close();
    if (ev.key !== 'Enter') return;
    const el = ev.target.closest('[data-enter]');
    if (el && A[el.dataset.enter]) { ev.preventDefault(); A[el.dataset.enter](el, ev); }
  });

  if (!EMBED) window.addEventListener('hashchange', () => render());
  screenEl().addEventListener('scroll', () => { if (current) syncStatusBar(); }, { passive: true });

  /* ---------- Abertura animada ----------
     A abertura já está na página (index.html) com o SVG embutido.
     Ela só começa quando o app termina o boot (e reaparece sempre ao reabrir o app).
     Um toque na tela pula a animação. */
  const ABERTURA_MS = 2450;
  let aberturaHtml = '';
  let aberturaTimer = null;

  function fecharAbertura() {
    clearTimeout(aberturaTimer);
    aberturaTimer = null;
    const el = document.getElementById('abertura');
    if (!el || el.classList.contains('saindo')) return;
    el.classList.add('saindo');
    document.getElementById('device').classList.remove('com-abertura');
    setTimeout(() => el.remove(), 500);
  }

  function agendarAbertura() {
    const el = document.getElementById('abertura');
    if (!el) return;
    clearTimeout(aberturaTimer);
    el.addEventListener('click', fecharAbertura);
    requestAnimationFrame(() => {
      if (!el.isConnected || el.classList.contains('saindo')) return;
      el.dataset.t = performance.now();
      el.classList.add('pronto');
      aberturaTimer = setTimeout(fecharAbertura, ABERTURA_MS);
    });
  }

  /** Mostra a abertura de novo (Perfil > Sobre o app e reabertura no Android). */
  function reverAbertura() {
    if (!aberturaHtml) return;
    clearTimeout(aberturaTimer);
    const device = document.getElementById('device'), old = document.getElementById('abertura');
    if (old) old.remove();
    const box = document.createElement('div');
    box.innerHTML = aberturaHtml;
    const el = box.firstElementChild;
    el.classList.remove('saindo', 'pronto');
    delete el.dataset.t;
    device.appendChild(el);
    device.classList.add('com-abertura');
    void el.offsetWidth;
    ui.sheet.close();
    agendarAbertura();
  }

  A['rever-abertura'] = reverAbertura;

  /* ---------- Início ---------- */
  function clock() {
    const el = document.getElementById('sb-time');
    if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: 'numeric', minute: '2-digit' });
  }

  /* Ordem: tema -> banco de trabalhos -> estado salvo -> índice da busca -> primeira tela. */
  async function boot() {
    const ab = document.getElementById('abertura');
    if (ab) {
      const copia = ab.cloneNode(true);
      copia.classList.remove('pronto', 'saindo');
      copia.removeAttribute('data-t');
      aberturaHtml = copia.outerHTML;
    }
    S.theme.apply();
    S.theme.watch();
    document.querySelectorAll('[data-bind="commission"]').forEach((el) => { el.textContent = S.pricing.percent(); });
    clock();
    setInterval(clock, 20000);

    await S.db.open();
    S.store.load();
    S.match.build();

    if (EMBED) mem = homeOf();
    else if (!location.hash) history.replaceState(null, '', '#' + homeOf());
    ready = true;
    render();
    agendarAbertura();
    S.sim.resumeAll();
    locateUser();
  }

  boot().catch((e) => {
    console.error(e);
    fecharAbertura();
    screenEl().innerHTML = '<div class="empty"><h3>Não foi possível iniciar o app</h3><p class="muted">Recarregue a página para tentar de novo.</p></div>';
  });
})(window.FixUp = window.FixUp || {});
