/* FixUp — telas do cliente: início, busca por problema, perfil do profissional, pagamento,
   acompanhamento ao vivo, pedidos, carteira e perfil. (As conversas ficam em js/chat.js.) */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, money = ui.money, icon = ui.icon, km = ui.km, avatar = ui.avatar;
  const A = S.actions, I = S.inputs, screens = S.screens;
  const st = () => S.store.state;
  const catOf = (p) => S.data.cat(p.cat);
  const plain = (s) => s.replace('­', '');
  const qs = (o) => {
    const p = new URLSearchParams();
    Object.keys(o).forEach((k) => { if (o[k]) p.set(k, o[k]); });
    const s = p.toString();
    return s ? '?' + s : '';
  };
  const closeBtn = `<button class="icon-btn soft" data-action="sheet-close" aria-label="Fechar">${icon('x')}</button>`;

  /* =====================================================================
     Blocos reutilizáveis
     ===================================================================== */

  const backBar = (title, right) => `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Voltar">${icon('arrow-left')}</button>
      <h2>${esc(title || '')}</h2>
      ${right || '<span class="icon-btn ghost"></span>'}
    </header>`;

  const missing = (text) => `${backBar('')}
    <div class="empty">
      ${ui.mascot('empty', 84)}
      <h3>${esc(text)}</h3>
      <button class="btn btn-soft" data-go="/home">Voltar ao início</button>
    </div>`;

  /** Cartão de profissional. `hit` (opcional) traz o resultado da busca por problema:
      trabalhos parecidos já realizados, serviço de catálogo correspondente e preço de referência. */
  function proCard(p, hit, query) {
    const h = hit || {}, svc = h.svc || null, found = h.count > 0;
    const to = '/p/' + p.id + qs({ s: svc && !found ? svc.id : '', q: found ? query : '' });
    const top = found ? h.similar[0].job : null;
    return `
      <button class="pro-card" data-go="${esc(to)}">
        <span class="pro-row">
          ${avatar(p, 54)}
          <span class="pro-main">
            <span class="pro-line">
              <span class="pro-name"><span>${esc(p.name)}</span>${p.verified ? ui.verified(16) : ''}</span>
              <strong class="pro-val">${ui.moneyShort(h.price != null ? h.price : p.fromPrice)}</strong>
            </span>
            <span class="pro-line">
              <span class="pro-meta"><span class="pro-cat">${esc(catOf(p).name)}</span><span class="star">${icon('star')}${ui.rating(p.rating)}</span><span class="count">(${p.jobs})</span></span>
              <small class="pro-from">${esc(h.priceLabel || 'a partir de')}</small>
            </span>
            <span class="pro-tags"><span class="avail${p.availableNow ? ' on' : ''}">${esc(p.availLabel)}</span><span>${km(p.km)}</span><span>${p.eta} min</span></span>
            ${svc && !found ? `<span class="pro-match">${icon('check')}<span>${esc(svc.name)}</span></span>` : ''}
          </span>
        </span>
        ${found ? `
        <span class="pro-hit ${h.level}">
          <span class="hit-head">${icon(h.level === 'same' ? 'badge-check' : 'search-check')}<b>${h.level === 'same' ? 'Já resolveu este problema' : 'Fez trabalhos parecidos'}</b><i>${h.count} ${h.count === 1 ? 'registro' : 'registros'}</i></span>
          <span class="hit-job">${esc(ui.jobTitle(top))}</span>
          <span class="hit-when">${ui.ago(top.doneAt)} · ${ui.moneyShort(top.price)}${top.rating ? ` · nota ${top.rating}` : ''}</span>
        </span>` : ''}
      </button>`;
  }

  /* Resumo do que o cliente paga. Preço cego: sem taxa de plataforma nem repasse, só serviço,
     deslocamento (grátis até 15 km pela rota mais curta) e total. */
  const bill = (a) => `
    <dl class="bill">
      <div><dt>Serviço</dt><dd>${money(a.clientServiceAmount)}</dd></div>
      <div><dt>Deslocamento${a.routeKm != null ? ` <small>(${km(a.routeKm)} pela rota)</small>` : ''}</dt><dd>${a.displacementFee ? money(a.displacementFee) : 'Grátis'}</dd></div>
      <div class="bill-total"><dt>Total</dt><dd>${money(a.clientTotalAmount)}</dd></div>
    </dl>
    ${a.displacementFee ? '' : `<p class="bill-note">${icon('route')}Deslocamento grátis até ${S.config.travel.freeKm} km.</p>`}`;

  const methodRow = (m, selected, action) => `
    <button class="method${m.id === selected ? ' selected' : ''}" data-action="${action}" data-arg="${m.id}">
      <span class="row-ic">${icon(m.icon)}</span>
      <span class="row-main"><strong>${esc(m.name)}</strong><small>${esc(m.desc())}</small></span>
      <span class="radio"></span>
    </button>`;

  const PILL = { completed: 'ok', cancelled: 'bad' };
  const statusPill = (o) => `<span class="status-pill ${PILL[o.status] || 'live'}">${esc(S.orders.label(o.status))}</span>`;

  /* Textos do acompanhamento conforme o status do pedido. */
  function trackTexts(o, rt) {
    const n = ui.first(S.data.pro(o.proId).name);
    const eta = rt && rt.etaMin ? rt.etaMin : o.etaMin;
    const left = rt && rt.kmLeft != null ? rt.kmLeft : o.km;
    switch (o.status) {
      case 'searching': return { title: 'Enviando sua solicitação…', sub: `Aguardando a confirmação de ${n}`, badge: `~${o.etaMin} min` };
      case 'accepted': return { title: `${n} aceitou seu pedido`, sub: 'Preparando a saída para o seu endereço', badge: `~${o.etaMin} min` };
      case 'on_the_way': return { title: `${n} está a caminho`, sub: `Chegada em cerca de ${eta} min · ${km(Math.max(left, 0.05))}`, badge: `${eta} min` };
      case 'arrived': return { title: `${n} chegou ao local`, sub: 'Receba o profissional para iniciar o serviço', badge: 'No local' };
      case 'in_progress': return { title: 'Serviço em andamento', sub: o.serviceName, badge: 'Em andamento' };
      case 'awaiting': return { title: 'Serviço finalizado', sub: 'Confirme a conclusão para liberar o pagamento', badge: 'Confirmar' };
      case 'cancelled': return { title: 'Pedido cancelado', sub: 'O valor foi estornado', badge: 'Cancelado' };
      default: return { title: 'Serviço concluído', sub: 'Pagamento liberado ao profissional', badge: 'Concluído' };
    }
  }

  /* Tela de Pix (simulada): QR ilustrativo e confirmação automática. */
  function openPix(amount, title, onPaid) {
    let t1 = null, t2 = null;
    const code = '00020126580014br.gov.bcb.pix0136fixup-demo-' + Math.round(amount * 100) + '5204000053039865802BR6009SAO PAULO';
    ui.sheet.open(`
      <div class="sheet-head"><h3>${esc(title)}</h3>${closeBtn}</div>
      <div class="pix">
        <div class="qr">${ui.fakeQr(Math.round(amount * 100))}</div>
        <strong class="pix-amount">${money(amount)}</strong>
        <button class="pix-code" data-action="pix-copy" data-arg="${esc(code)}"><span>${esc(code)}</span>${icon('copy')}</button>
        <div class="pix-wait" id="pix-wait">${ui.loader(26)}Aguardando pagamento…</div>
        <p class="hint">Demonstração: a confirmação acontece automaticamente em alguns segundos.</p>
      </div>`, { onClose() { clearTimeout(t1); clearTimeout(t2); } });
    t1 = setTimeout(() => {
      const w = document.getElementById('pix-wait');
      if (!w) return;
      w.className = 'pix-wait ok';
      w.innerHTML = icon('circle-check') + 'Pagamento confirmado';
      ui.refreshIcons();
      t2 = setTimeout(() => { ui.sheet.close(); onPaid(); }, 900);
    }, 3000);
  }

  A['pix-copy'] = (el) => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.arg).catch(() => {}); } catch (e) { /* sem acesso à área de transferência */ }
    ui.toast('Código Pix copiado.', 'ok');
  };

  /* Blocos usados também por outras telas (js/chat.js). */
  S.blocks = { backBar, missing, proCard, bill, methodRow, pix: openPix, proPublic: (pro, o) => proPublic(pro, o), showTab: (root) => showTab(root) };

  /* =====================================================================
     Início
     ===================================================================== */

  const EXAMPLES = ['Geladeira não liga', 'Chuveiro queimou', 'Torneira pingando', 'Notebook lento', 'Montar guarda-roupa'];
  const catTile = (c) => `<button class="cat" data-go="/search?cat=${c.id}"><span class="cat-ic${c.art ? ' art' : ''}">${ui.catArt(c)}</span><span>${esc(c.short)}</span></button>`;

  function activeBanner(o) {
    const pro = S.data.pro(o.proId), t = trackTexts(o, S.sim.live(o.id));
    return `
      <button class="active-banner" data-go="/track/${o.id}">
        ${avatar(pro, 42)}
        <span class="ab-text"><strong>${esc(t.title)}</strong><small>${esc(o.serviceName)}</small></span>
        <span class="ab-go">Acompanhar${icon('chevron-right')}</span>
      </button>`;
  }

  screens.home = {
    tab: 'home', mode: 'client', statusBar: 'light',

    render() {
      const loc = st().location, near = S.data.near(), active = S.orders.active();
      return `
        <header class="hero">
          <div class="hero-top">
            <button class="loc" data-action="open-location">
              <span class="loc-ic">${icon('map-pin')}</span>
              <span class="loc-text"><small>${loc.source === 'gps' ? 'Sua localização' : 'Atender em'}</small><strong>${esc(loc.label)}</strong></span>
              ${icon('chevron-down')}
            </button>
            <button class="icon-btn glass" data-action="open-notifs" aria-label="Notificações">${icon('bell')}<i class="badge-dot"></i></button>
          </div>
          <h1 class="hero-title">Qual problema você<br>quer resolver hoje?</h1>
          <button class="searchbar" data-go="/search?focus=1">${icon('search')}<span>Descreva o problema ou o serviço</span></button>
          <div class="hero-chips">${EXAMPLES.slice(0, 4).map((e) => `<button data-go="/search${qs({ q: e })}">${esc(e)}</button>`).join('')}</div>
        </header>

        <div class="banner-slot" id="banner-slot">${active ? activeBanner(active) : ''}</div>

        <section class="section">
          <div class="section-head"><h3>Categorias</h3></div>
          <div class="cats">
            ${S.data.categories.slice(0, 7).map(catTile).join('')}
            <button class="cat" data-action="open-cats"><span class="cat-ic alt">${icon('layout-grid')}</span><span>Ver todas</span></button>
          </div>
        </section>

        <section class="section">
          <button class="trust" data-go="/search?focus=1">
            <span class="trust-ic">${icon('search-check')}</span>
            <span class="trust-text"><strong>Quem já resolveu um caso como o seu</strong><span>Descreva o problema com suas palavras. A busca compara com os trabalhos já realizados por cada profissional.</span></span>
          </button>
        </section>

        <section class="section">
          <div class="section-head">${ui.heading('Perto de você')}<button class="link" data-go="/search?view=map">Ver no mapa</button></div>
          <div class="map-card">
            <div id="home-map" class="map"></div>
            <button class="map-cover" data-go="/search?view=map" aria-label="Abrir mapa"></button>
            <span class="map-chip">${icon('navigation')}${near.filter((p) => p.availableNow).length} disponíveis agora</span>
          </div>
          <div class="list">${near.slice(0, 4).map((p) => proCard(p)).join('')}</div>
          <button class="btn btn-soft btn-block" data-go="/search">Ver todos os profissionais</button>
        </section>

        <section class="section">
          <div class="note">${icon('shield-check')}<span><strong>Pagamento protegido.</strong> Você paga pelo app e o valor só é liberado ao profissional quando o serviço for concluído.</span></div>
        </section>
        <div class="spacer"></div>`;
    },

    mount(root) {
      const loc = st().location;
      const map = S.map.create(root.querySelector('#home-map'), loc, 13, { interactive: false });
      if (map) {
        S.data.near().forEach((p) => S.map.dot(map, p));
        S.map.user(map, loc);
      }
      const onSim = (o, rt, tick) => {
        if (tick) return;
        const slot = root.querySelector('#banner-slot'), active = S.orders.active();
        if (slot) { slot.innerHTML = active ? activeBanner(active) : ''; ui.refreshIcons(); }
      };
      S.sim.on(onSim);
      return () => { S.sim.off(onSim); if (map) map.remove(); };
    }
  };

  A['open-cats'] = () => {
    ui.sheet.open(`
      <div class="sheet-head"><h3>Todas as categorias</h3>${closeBtn}</div>
      <div class="cats">${S.data.categories.map(catTile).join('')}</div>`);
  };

  A['open-notifs'] = () => {
    const items = [
      ['search-check', 'Busque pelo problema', 'Descreva o que aconteceu e veja quem já resolveu casos parecidos.'],
      ['messages-square', 'Combine pelo chat', 'Peça um orçamento, ajuste o escopo e receba uma proposta personalizada.'],
      ['shield-check', 'Pagamento protegido ativo', 'Seus pagamentos ficam retidos até você confirmar a conclusão do serviço.'],
      ['map-pin', 'Acompanhe pelo mapa', 'Veja o profissional se deslocando até você em tempo real.']
    ];
    ui.sheet.open(`
      <div class="sheet-head"><h3>Notificações</h3>${closeBtn}</div>
      <div class="notifs">${items.map((n) => `<div class="row static"><span class="row-ic">${icon(n[0])}</span><span class="row-main"><strong>${n[1]}</strong><small>${n[2]}</small></span></div>`).join('')}</div>`);
  };

  /* ---------- Localização (GPS) ---------- */
  A['open-location'] = () => {
    const loc = st().location;
    if (S.config.embedded) {
      /* Versão publicada: sem acesso ao GPS do aparelho, o usuário escolhe um endereço de exemplo. */
      return ui.sheet.open(`
        <div class="sheet-head"><h3>Local do atendimento</h3>${closeBtn}</div>
        <div class="card flush">
          ${S.config.demoAddresses.map((a, i) => `
            <button class="method${a.label === loc.label ? ' selected' : ''}" data-action="pick-address" data-arg="${i}">
              <span class="row-ic">${icon('map-pin')}</span>
              <span class="row-main"><strong>${esc(a.label)}</strong><small>${esc(a.sub)}</small></span>
              <span class="radio"></span>
            </button>`).join('')}
        </div>
        <p class="hint">Nesta versão de demonstração publicada o GPS do aparelho fica desativado, então escolha um endereço de exemplo. No app instalado, a localização vem do GPS.</p>`);
    }
    ui.sheet.open(`
      <div class="sheet-head"><h3>Local do atendimento</h3>${closeBtn}</div>
      <div class="card row static">
        <span class="row-ic">${icon('map-pin')}</span>
        <span class="row-main"><strong>${esc(loc.label)}</strong><small>${esc(loc.sub || '')}</small></span>
        <span class="status-pill ${loc.source === 'gps' ? 'ok' : 'live'}">${loc.source === 'gps' ? 'GPS' : 'Padrão'}</span>
      </div>
      <button class="btn btn-primary btn-block" data-action="use-gps">${icon('locate-fixed')}Usar minha localização atual</button>
      <p class="hint">Usamos sua localização para mostrar profissionais próximos, calcular o deslocamento e acompanhar a chegada no mapa.</p>`);
  };

  A['pick-address'] = (el) => {
    const a = S.config.demoAddresses[+el.dataset.arg];
    if (!a) return;
    st().location = { lat: a.lat, lng: a.lng, label: a.label, sub: a.sub, source: 'default' };
    S.store.save();
    ui.sheet.close();
    S.app.refresh();
    ui.toast('Endereço de atendimento atualizado.', 'ok');
  };

  A['use-gps'] = async (el) => {
    el.classList.add('loading');
    const ok = await S.app.locateUser();
    if (ok) { ui.sheet.close(); S.app.refresh(); ui.toast('Localização atualizada pelo GPS.', 'ok'); }
    else { el.classList.remove('loading'); ui.toast('Não foi possível obter o GPS. Verifique a permissão de localização.', 'bad'); }
  };

  /* =====================================================================
     Busca por problema (lista + mapa)
     ===================================================================== */

  let sv = { q: '', cat: '', sort: '', view: 'list' };
  let found = null;                      // resultado da última busca
  let searchMap = null, searchLayer = null;
  const SORTS = [['best', 'Mais relevantes'], ['near', 'Mais próximos'], ['rating', 'Melhor avaliados'], ['price', 'Menor preço']];

  const hasText = () => !!sv.q.trim();
  const sortNow = () => sv.sort || (hasText() ? 'best' : 'near');
  const searchPath = () => '/search' + qs({ q: sv.q, cat: sv.cat, sort: sv.sort, view: sv.view === 'map' ? 'map' : '' });

  function runSearch(live) {
    found = S.match.search(sv.q, { cat: sv.cat, sort: sortNow(), live });
    return found;
  }

  function understoodHtml(u) {
    if (!u || (!u.chips.length && !u.fixes.length)) return '';
    return `
      <div class="understood">
        <div class="u-head">${icon('sparkles')}<span>O que entendemos do seu problema</span></div>
        ${u.chips.length ? `<div class="u-chips">${u.chips.map((c) => `<span class="u-chip k-${c.type}">${esc(c.label)}</span>`).join('')}</div>` : ''}
        ${u.fixes.length ? `<small>Buscamos por ${u.fixes.map((f) => `<b>${esc(f.to)}</b> no lugar de “${esc(f.from)}”`).join(', ')}.</small>` : ''}
      </div>`;
  }

  function listHtml(live) {
    const r = runSearch(live), list = r.list, text = hasText();
    const sorts = SORTS.filter((s) => text || s[0] !== 'best');
    const sortbar = `<div class="chips tight">${sorts.map((s) => `<button class="chip sm${sortNow() === s[0] ? ' active' : ''}" data-action="search-sort" data-arg="${s[0]}">${s[1]}</button>`).join('')}</div>`;
    const examples = `<div class="examples"><small>Experimente descrever:</small><div class="chips wrap left">${EXAMPLES.map((e) => `<button class="chip sm" data-action="search-example" data-arg="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`;

    if (!list.length) {
      return `${understoodHtml(r.understood)}
        <div class="empty">
          ${ui.mascot('empty', 84)}
          <h3>Nenhum profissional encontrado</h3>
          <p class="muted">Tente descrever de outro jeito: o que é (aparelho ou serviço) e o que está acontecendo.</p>
          <button class="btn btn-soft" data-action="search-clear">Limpar busca</button>
        </div>${examples}`;
    }

    const card = (x) => proCard(x.pro, x, sv.q);
    if (!text) {
      const where = sv.cat ? 'em ' + esc(plain(S.data.cat(sv.cat).short)) : 'perto de você';
      return `${sv.cat ? '' : examples}${sortbar}
        <button class="quick" data-action="quick-match">
          <span class="quick-ic">${icon('zap')}</span>
          <span class="quick-text"><strong>Chamar o mais próximo</strong><small>Encontramos o melhor profissional disponível agora</small></span>
          ${icon('chevron-right')}
        </button>
        <p class="count-line">${list.length} ${list.length === 1 ? 'profissional' : 'profissionais'} ${where}</p>
        <div class="list">${list.map(card).join('')}</div>`;
    }

    const catName = r.understood && r.understood.cat ? plain(S.data.cat(r.understood.cat).short) : '';
    const split = sortNow() === 'best' && r.matched > 0 && r.matched < list.length;
    const withJobs = split ? list.filter((x) => x.count > 0) : list, others = split ? list.filter((x) => !x.count) : [];
    const headline = r.matched
      ? `${r.matched} ${r.matched === 1 ? 'profissional já resolveu' : 'profissionais já resolveram'} casos parecidos`
      : catName ? `Ainda não há um trabalho igual registrado. Profissionais de ${esc(catName)}:` : `${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}`;
    return `${understoodHtml(r.understood)}${sortbar}
      <p class="count-line">${headline}</p>
      <div class="list">${withJobs.map(card).join('')}</div>
      ${others.length ? `<p class="count-line">Outros profissionais${catName ? ' de ' + esc(catName) : ''}</p><div class="list">${others.map(card).join('')}</div>` : ''}`;
  }

  const mapHtml = () => `<div class="search-mapwrap"><div id="search-map" class="map"></div><div id="map-float" class="map-float"></div></div>`;

  function drawPins(root, live) {
    if (!searchMap) return;
    searchLayer.clearLayers();
    const list = runSearch(live).list, float = root.querySelector('#map-float');
    let active = null;
    const select = (x, marker) => {
      if (active && active.getElement()) active.getElement().querySelector('.pin').classList.remove('active');
      active = marker;
      marker.getElement().querySelector('.pin').classList.add('active');
      marker.setZIndexOffset(900);
      float.innerHTML = proCard(x.pro, x, sv.q);
      ui.refreshIcons();
    };
    const markers = list.map((x) => { const m = S.map.price(searchLayer, x.pro, x.price); m.on('click', () => select(x, m)); return m; });
    if (!list.length) { float.innerHTML = '<div class="map-empty">Nenhum profissional encontrado nesta busca.</div>'; return; }
    S.map.fit(searchMap, [st().location].concat(list.map((x) => x.pro.pos)), ui.wide() ? { t: 48, l: 440, r: 48, b: 48 } : { t: 28, l: 34, r: 34, b: 190 });
    select(list[0], markers[0]);
  }

  function updateResults(live) {
    const root = document.querySelector('.view-search');
    if (!root) return;
    if (sv.view === 'map') return drawPins(root, live);
    root.querySelector('#results').innerHTML = listHtml(live);
    ui.refreshIcons();
  }

  screens.search = {
    tab: 'search', mode: 'client',

    render(p, q) {
      sv = { q: q.q || '', cat: q.cat || '', sort: q.sort || '', view: q.view === 'map' ? 'map' : 'list' };
      const chip = (id, label) => `<button class="chip${sv.cat === id ? ' active' : ''}" data-action="search-cat" data-arg="${id}">${esc(plain(label))}</button>`;
      return `
        <header class="topbar col">
          <div class="search-row">
            <label class="field">${icon('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Ex.: geladeira Electrolux não liga" value="${esc(sv.q)}" data-input="search-q"></label>
            <div class="seg seg-icons">
              <button class="${sv.view === 'list' ? 'active' : ''}" data-action="search-view" data-arg="list" aria-label="Ver em lista">${icon('list')}</button>
              <button class="${sv.view === 'map' ? 'active' : ''}" data-action="search-view" data-arg="map" aria-label="Ver no mapa">${icon('map')}</button>
            </div>
          </div>
          <div class="chips">${chip('', 'Todos')}${S.data.categories.map((c) => chip(c.id, c.short)).join('')}</div>
        </header>
        <div id="results" class="results ${sv.view}">${sv.view === 'map' ? mapHtml() : listHtml(false)}</div>`;
    },

    mount(root, p, q) {
      if (q.focus) root.querySelector('#q').focus();
      const activeChip = root.querySelector('.chips .chip.active');
      if (activeChip && activeChip.scrollIntoView) activeChip.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (sv.view === 'map') {
        searchMap = S.map.create(root.querySelector('#search-map'), st().location, 13);
        if (searchMap) {
          S.map.user(searchMap, st().location);
          searchLayer = window.L.layerGroup().addTo(searchMap);
          drawPins(root, false);
        }
      }
      return () => { if (searchMap) { searchMap.remove(); searchMap = null; searchLayer = null; } };
    }
  };

  I['search-q'] = (el) => { sv.q = el.value; S.app.silent(searchPath()); updateResults(true); };
  A['search-cat'] = (el) => { sv.cat = el.dataset.arg; S.app.replace(searchPath()); };
  A['search-sort'] = (el) => { sv.sort = el.dataset.arg; S.app.replace(searchPath()); };
  A['search-view'] = (el) => { sv.view = el.dataset.arg; S.app.replace(searchPath()); };
  A['search-clear'] = () => { sv.q = ''; sv.cat = ''; sv.sort = ''; S.app.replace(searchPath(), {}); };
  A['search-example'] = (el) => { sv.q = el.dataset.arg; sv.sort = ''; S.app.replace(searchPath(), {}); };

  /* "Chamar o mais próximo": escolhe automaticamente o melhor profissional disponível. */
  A['quick-match'] = () => {
    const list = runSearch(false).list.filter((x) => x.pro.availableNow);
    if (!list.length) return ui.toast('Nenhum profissional disponível agora nesta busca.', 'info');
    const best = list.slice().sort((a, b) => (a.pro.km - (a.pro.rating - 4.5) * 2) - (b.pro.km - (b.pro.rating - 4.5) * 2))[0], pro = best.pro;
    let timer = null;
    ui.sheet.open(`
      <div class="match" id="match">
        ${ui.loader(72)}
        <h3>Procurando o melhor profissional</h3>
        <p class="muted">Comparando distância, avaliação e disponibilidade…</p>
      </div>`, { onClose() { clearTimeout(timer); } });
    timer = setTimeout(() => {
      const box = document.getElementById('match');
      if (!box) return;
      box.innerHTML = `
        <span class="match-ok">${icon('circle-check')}</span>
        <h3>Encontramos ${esc(ui.first(pro.name))} para você</h3>
        <p class="muted">A ${km(pro.km)} do seu endereço · chega em cerca de ${pro.eta} min</p>
        <div class="match-card">${proCard(pro, best, sv.q)}</div>
        <button class="btn btn-primary btn-block btn-lg" data-go="/p/${pro.id}">Continuar</button>`;
      ui.refreshIcons();
    }, 1900);
  };

  /* =====================================================================
     Perfil do profissional
     ===================================================================== */

  /* Avaliação com as fotos do serviço avaliado (prova de veracidade). */
  const reviewCard = (j) => `
    <article class="review">
      <div class="review-top"><strong>${esc(j.client)}</strong><span class="stars">${ui.stars(j.rating)}</span></div>
      ${j.review ? `<p>${esc(j.review)}</p>` : ''}
      ${S.media.strip(S.media.ofJob(j), 4, 'sm')}
      <small class="review-foot"><span class="ok-mark">${icon('badge-check')}Serviço concluído via FixUp</span>${ui.ago(j.doneAt)} · ${esc(j.title)}</small>
    </article>`;

  const PTABS = [['sobre', 'Sobre', 'user-round'], ['cursos', 'Cursos técnicos', 'graduation-cap'], ['portfolio', 'Portfólio', 'images'], ['avaliacoes', 'Avaliações', 'star']];

  /** Perfil profissional público, em abas (Sobre, Cursos técnicos, Portfólio, Avaliações).
      Usado pelo cliente (/p/:id) e pela pré-visualização do próprio profissional (/pro/profile/preview). */
  function proPublic(pro, o) {
    const tab = PTABS.some((t) => t[0] === o.tab) ? o.tab : 'sobre';
    const prof = pro.profile || { years: 0, courses: [], specialties: [], cats: [pro.cat] };
    const jobs = S.db.byPro(pro.id), reviews = jobs.filter((j) => j.rating && (j.review || S.media.ofJob(j).length));
    const avgShown = jobs.filter((j) => j.rating).length;
    const kinds = S.db.kinds(pro.id);
    let body = '';
    if (tab === 'sobre') {
      body = `
        <section class="section">
          <h3 class="h3">Resumo profissional</h3>
          <p class="body">${esc(pro.bio || prof.bio || '')}</p>
          <div class="facts">
            <div>${icon('briefcase')}<strong>${prof.years} ${prof.years === 1 ? 'ano' : 'anos'}</strong><small>de experiência</small></div>
            <div>${icon('circle-check')}<strong>${jobs.length}</strong><small>serviços concluídos na FixUp</small></div>
            <div>${icon('graduation-cap')}<strong>${prof.courses.length}</strong><small>${prof.courses.length === 1 ? 'curso técnico' : 'cursos técnicos'}</small></div>
          </div>
        </section>
        <section class="section">
          <h3 class="h3">Especialidades</h3>
          <div class="tags">${prof.specialties.concat(kinds.slice(0, 4).map((k) => k.label)).filter((t, i, a) => a.indexOf(t) === i).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
          <div class="cats-served">${prof.cats.map((c) => S.data.cat(c)).filter(Boolean).map((c) => `<span>${icon(c.icon)}${esc(c.name)}</span>`).join('')}</div>
        </section>`
        + (o.services || '')
        + `<section class="section">
          <div class="section-head">${ui.heading('Serviços realizados')}<span class="muted sm">${jobs.length} no histórico</span></div>
          <div class="kinds">${kinds.slice(0, 6).map((k) => `<span>${esc(k.label)}<b>${k.count}</b></span>`).join('')}</div>
          <div class="jobs">${jobs.slice(0, 3).map((j) => ui.jobCard(j, null, { provider: o.preview })).join('')}</div>
          ${jobs.length > 3 ? `<button class="btn btn-soft btn-block" data-action="open-jobs" data-arg="${pro.id}">Ver os ${jobs.length} serviços</button>` : ''}
        </section>`;
    } else if (tab === 'cursos') {
      body = `
        <section class="section">
          <h3 class="h3">Formação e cursos técnicos</h3>
          ${prof.courses.length ? `<div class="courses">${prof.courses.slice().sort((a, b) => b.year - a.year).map((c) => `
            <article class="course">
              <span class="row-ic">${icon('graduation-cap')}</span>
              <span class="row-main"><strong class="wrap">${esc(c.name)}</strong><small>${esc(c.institution)}${c.year ? ' · ' + c.year : ''}${c.hours ? ' · ' + esc(c.hours) : ''}</small></span>
            </article>`).join('')}</div>` : `<div class="empty small">${ui.mascot('empty', 72)}<p class="muted">Nenhum curso informado ainda.</p></div>`}
          <p class="hint left">Cursos informados pelo profissional. A FixUp pede o certificado na verificação do cadastro.</p>
        </section>`;
    } else if (tab === 'portfolio') {
      const gallery = S.media.portfolio(pro.id);
      body = `
        <section class="section">
          <div class="section-head">${ui.heading('Galeria de trabalhos')}<span class="muted sm">${gallery.length} ${gallery.length === 1 ? 'foto' : 'fotos'}</span></div>
          ${gallery.length ? S.media.strip(gallery, 12, 'grid') : `<div class="empty small">${ui.mascot('empty', 72)}<p class="muted">Nenhuma foto no portfólio ainda.</p></div>`}
        </section>
        <section class="section">
          <div class="section-head">${ui.heading('Serviços realizados')}<span class="muted sm">${jobs.length} no histórico</span></div>
          <div class="jobs">${jobs.slice(0, 6).map((j) => ui.jobCard(j, null, { provider: o.preview })).join('')}</div>
          ${jobs.length > 6 ? `<button class="btn btn-soft btn-block" data-action="open-jobs" data-arg="${pro.id}">Ver os ${jobs.length} serviços</button>` : ''}
        </section>`;
    } else {
      const shots = S.media.reviewed(pro.id, 24);
      body = `
        <section class="section">
          <div class="section-head">${ui.heading('Fotos de Serviços Avaliados (Veracidade Comprovada)')}</div>
          <p class="muted sm">Cada foto pertence a um serviço contratado e concluído pela FixUp. Toque para ver a avaliação.</p>
          ${shots.length ? S.media.strip(shots, 12, 'grid') : `<div class="empty small">${ui.mascot('empty', 72)}<p class="muted">Ainda não há fotos de serviços avaliados.</p></div>`}
        </section>
        <section class="section">
          <div class="section-head">${ui.heading('Avaliações verificadas')}<span class="muted sm">${ui.rating(pro.rating)} de média · ${avgShown} ${avgShown === 1 ? 'avaliação' : 'avaliações'}</span></div>
          ${reviews.length ? `<div class="reviews">${reviews.slice(0, 12).map(reviewCard).join('')}</div>` : `<p class="muted">Nenhuma avaliação com comentário ainda.</p>`}
        </section>`;
    }
    return `
      <section class="profile-head">
        ${ui.face(pro, 92, 'big')}
        <h1>${esc(pro.name)}${pro.verified ? ui.verified(22) : ''}</h1>
        <p class="muted">${esc(catOf(pro).name)} · na FixUp desde ${pro.since}</p>
        ${o.preview ? '<span class="avail pill on">Como os clientes veem o seu perfil</span>' : `<span class="avail pill${pro.availableNow ? ' on' : ''}">${esc(pro.availLabel)}</span>`}
        <div class="stats">
          <div><strong><span class="star">${icon('star')}</span>${ui.rating(pro.rating)}</strong><small>avaliação</small></div>
          <div><strong>${jobs.length}</strong><small>serviços</small></div>
          <div><strong>${prof.years}</strong><small>anos de experiência</small></div>
        </div>
        <div class="badges">${pro.verified ? `<span class="seal">${ui.mascot('badge', 22)}Profissional Verificado FixUp</span>` : ''}<span>${icon('shield-check')}Pagamento protegido</span></div>
      </section>
      ${o.top || ''}
      <nav class="ptabs" role="tablist">${PTABS.map((t) => `<button role="tab" aria-selected="${t[0] === tab}" class="${t[0] === tab ? 'active' : ''}" data-action="profile-tab" data-arg="${t[0]}">${icon(t[2])}<span>${t[1]}</span></button>`).join('')}</nav>
      ${body}`;
  }

  A['profile-tab'] = (el) => {
    const cur = S.app.current(), path = cur.name === 'proProfile' ? '/p/' + cur.params.id : '/pro/profile/preview';
    S.app.replace(path + qs({ s: cur.query.s, q: cur.query.q, tab: el.dataset.arg }));
  };

  /* Mantém a aba escolhida à vista na barra de abas (no celular ela rola na horizontal). */
  const showTab = (root) => { const t = root.querySelector('.ptabs .active'); if (t) t.parentNode.scrollLeft = t.offsetLeft - 16; };

  screens.proProfile = {
    mode: 'client',
    mount: (root) => { showTab(root); },

    render(p, q) {
      const pro = S.data.pro(p.id);
      if (!pro) return missing('Profissional não encontrado');
      const svc = pro.services.find((x) => x.id === q.s) || pro.services[0];
      const fav = st().favorites.includes(pro.id);
      const similar = q.q ? S.match.forPro(pro.id, q.q, 3) : [];
      const chatTo = esc('/chat/' + pro.id + qs({ q: q.q }));
      const top = similar.length ? `
        <section class="section">
          <div class="match-box">
            <div class="mb-head">${icon('search-check')}<div><strong>${esc(ui.first(pro.name))} já resolveu casos como o seu</strong><small>Você descreveu: “${esc(q.q)}”</small></div></div>
            <div class="jobs">${similar.map((h) => ui.jobCard(h.job, h.level)).join('')}</div>
            <button class="btn btn-primary btn-block" data-go="${chatTo}">${icon('message-circle')}Pedir orçamento pelo chat</button>
            <p class="hint">Você recebe uma proposta com valor fechado e paga pelo app.</p>
          </div>
        </section>` : '';
      const services = `
        <section class="section">
          <div class="section-head"><h3>Serviços com preço fechado</h3></div>
          <div class="svc-list">
            ${pro.services.map((x) => `
              <button class="svc${x.id === svc.id ? ' selected' : ''}" data-action="pick-service" data-arg="${x.id}">
                <span class="radio"></span>
                <span class="svc-main"><strong>${esc(x.name)}</strong><small>${icon('clock')}${esc(x.dur)}</small></span>
                <b>${money(x.price)}</b>
              </button>`).join('')}
          </div>
          <button class="ask" data-go="${chatTo}">${icon('messages-square')}<span><strong>Precisa de algo diferente?</strong><small>Combine pelo chat e receba uma proposta personalizada.</small></span>${icon('chevron-right')}</button>
        </section>`;
      return `
        ${backBar('', `<button class="icon-btn${fav ? ' fav' : ''}" data-action="toggle-fav" data-arg="${pro.id}" aria-label="Favoritar">${icon('heart')}</button>`)}
        ${proPublic(pro, { tab: q.tab, top, services })}
        <div class="cta-bar">
          <button class="btn btn-soft" data-go="${chatTo}">${icon('message-circle')}Conversar</button>
          <button class="btn btn-primary grow" data-action="request" data-arg="${pro.id}/${svc.id}"><span class="cta-label">Solicitar · ${money(svc.price)}</span></button>
        </div>`;
    }
  };

  A['pick-service'] = (el) => {
    const cur = S.app.current();
    S.app.replace('/p/' + cur.params.id + qs({ s: el.dataset.arg, q: cur.query.q }));
  };

  A['open-jobs'] = (el) => {
    const pro = el.dataset.arg === 'me' ? S.blocks.meAsPro() : S.data.pro(el.dataset.arg);
    if (!pro) return;
    const jobs = S.db.byPro(pro.id);
    ui.sheet.open(`
      <div class="sheet-head"><h3>Trabalhos de ${esc(ui.first(pro.name))}</h3>${closeBtn}</div>
      <div class="kinds">${S.db.kinds(pro.id).map((k) => `<span>${esc(k.label)}<b>${k.count}</b></span>`).join('')}</div>
      <div class="jobs">${jobs.slice(0, 40).map((j) => ui.jobCard(j, null, { provider: pro.id === 'me' })).join('')}</div>
      ${jobs.length > 40 ? `<p class="hint">Mostrando os 40 mais recentes de ${jobs.length}.</p>` : ''}`);
  };

  A['toggle-fav'] = (el) => {
    const favs = st().favorites, id = el.dataset.arg, i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    S.store.save();
    el.classList.toggle('fav', i < 0);
    ui.toast(i < 0 ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.', 'info');
  };

  A['request'] = (el) => {
    const active = S.orders.active();
    if (active) {
      ui.toast('Você já tem um pedido em andamento.', 'info');
      return S.app.go('/track/' + active.id);
    }
    if (!S.guard.allow('hire')) return;
    S.app.go('/checkout/' + el.dataset.arg);
  };

  /* =====================================================================
     Confirmação e pagamento (serviço de catálogo)
     ===================================================================== */

  screens.checkout = {
    mode: 'client',

    render(p) {
      const pro = S.data.pro(p.pro), svc = pro && pro.services.find((s) => s.id === p.service);
      if (!svc) return missing('Serviço não encontrado');
      if (!S.draft || S.draft.proId !== pro.id || S.draft.serviceId !== svc.id) {
        S.draft = { proId: pro.id, serviceId: svc.id, note: '', method: st().wallet.defaultMethod };
      }
      const d = S.draft, loc = st().location, routeKm = d.routeKm != null ? d.routeKm : pro.km;
      const q = S.pricing.fromClientPrice(svc.price, S.pricing.defaultDisplacement(routeKm), routeKm);
      return `
        ${backBar('Confirmar pedido')}
        <section class="section first">
          <div class="card summary">
            ${avatar(pro, 48)}
            <span class="row-main"><strong>${esc(svc.name)}</strong><small>${esc(pro.name)} · ${esc(svc.dur)}</small></span>
            <b>${money(svc.price)}</b>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Descreva o problema <small>opcional</small></h3>
          <textarea class="textarea" rows="3" data-input="draft-note" placeholder="Ex.: a tomada da cozinha parou de funcionar depois de um curto.">${esc(d.note)}</textarea>
        </section>

        <section class="section">
          <h3 class="h3">Local do atendimento</h3>
          <div class="card flush">
            <div class="map-card flat"><div id="checkout-map" class="map"></div></div>
            <button class="row" data-action="open-location">
              <span class="row-ic">${icon('map-pin')}</span>
              <span class="row-main"><strong>${esc(loc.label)}</strong><small>${esc(loc.sub || '')}</small></span>
              <span class="link">Alterar</span>
            </button>
            <div class="row static">
              <span class="row-ic">${icon('clock')}</span>
              <span class="row-main"><strong>Atendimento imediato</strong><small id="co-route">Chegada estimada em ${pro.eta} min · ${d.routeKm != null ? km(d.routeKm) + ' pela rota mais curta' : 'calculando a rota…'}</small></span>
            </div>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Forma de pagamento</h3>
          <div class="card flush" id="methods">${S.pay.methods().map((m) => methodRow(m, d.method, 'pick-method')).join('')}</div>
        </section>

        <section class="section">
          <h3 class="h3">Resumo</h3>
          <div class="card">${bill(q)}</div>
          <p class="note">${icon('shield-check')}<span>O valor fica retido pela FixUp e só é liberado ao profissional quando você confirmar a conclusão. O preço que você vê é o preço final.</span></p>
        </section>

        <div class="cta-bar"><button class="btn btn-primary btn-block btn-lg" data-action="pay">Pagar ${money(q.clientTotalAmount)}</button></div>`;
    },

    mount(root, p) {
      const pro = S.data.pro(p.pro);
      if (!pro) return null;
      const loc = st().location;
      const map = S.map.create(root.querySelector('#checkout-map'), loc, 14, { interactive: false });
      if (map) {
        window.L.polyline([S.map.ll(pro.pos), S.map.ll(loc)], { color: S.map.routeColors()[0], weight: 3, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(map);
        S.map.pro(map, pro, pro.pos);
        S.map.user(map, loc);
        S.map.fit(map, [pro.pos, loc], { t: 34, b: 30, l: 40, r: 40 });
      }
      /* Distância da rota mais curta: decide se há taxa de deslocamento (só acima de 15 km). */
      let alive = true;
      if (S.draft && S.draft.routeKm == null) {
        S.geo.shortestRouteKm(pro.pos, loc).then((km2) => { if (alive && S.draft && S.draft.proId === pro.id) { S.draft.routeKm = km2; S.app.refresh(); } });
      }
      return () => { alive = false; if (map) map.remove(); };
    }
  };

  I['draft-note'] = (el) => { if (S.draft) S.draft.note = el.value; };

  A['pick-method'] = (el) => {
    if (!S.draft) return;
    S.draft.method = el.dataset.arg;
    document.querySelectorAll('#methods .method').forEach((b) => b.classList.toggle('selected', b === el));
  };

  A['pay'] = (el) => {
    const d = S.draft;
    if (!d) return;
    const active = S.orders.active();
    if (active) { ui.toast('Você já tem um pedido em andamento.', 'info'); return S.app.go('/track/' + active.id); }
    if (!S.guard.allow('hire')) return;
    const pro = S.data.pro(d.proId), svc = pro.services.find((s) => s.id === d.serviceId);
    const routeKm = d.routeKm != null ? d.routeKm : pro.km;
    const total = S.pricing.fromClientPrice(svc.price, S.pricing.defaultDisplacement(routeKm), routeKm).clientTotalAmount;
    if (!S.pay.canPay(d.method, total)) return ui.toast('Saldo insuficiente. Escolha outra forma de pagamento.', 'bad');

    const finish = () => {
      const order = S.orders.create(d);
      S.draft = null;
      S.app.replace('/track/' + order.id, {});
      ui.toast('Pagamento aprovado. Valor protegido até a conclusão.', 'ok');
    };
    if (d.method === 'pix') return openPix(total, 'Pague com Pix', finish);
    el.classList.add('loading');
    setTimeout(finish, 1400);
  };

  /* =====================================================================
     Acompanhamento ao vivo
     ===================================================================== */

  const STEP = { searching: 0, accepted: 1, on_the_way: 1, arrived: 2, in_progress: 2, awaiting: 3, completed: 4, cancelled: 0 };
  const STEPS = ['Aceito', 'A caminho', 'No local', 'Concluído'];

  const stepsHtml = (step) => `<ol class="steps">${STEPS.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'now' : ''}"><span class="bullet">${i < step ? icon('check') : ''}</span><span>${s}</span></li>`).join('')}</ol>`;

  function panelHtml(o, rt) {
    const pro = S.data.pro(o.proId), t = trackTexts(o, rt);
    return `
      <div class="grip"></div>
      <div class="tp-head">
        <div><h2>${esc(t.title)}</h2><p class="muted" id="tp-sub">${esc(t.sub)}</p></div>
        <span class="eta" id="tp-badge">${esc(t.badge)}</span>
      </div>
      ${stepsHtml(STEP[o.status])}
      <div class="id-card">
        ${ui.face(pro, 64, 'big')}
        <div class="id-main"><small>Confira o rosto na chegada</small><strong>${esc(pro.name)}${pro.verified ? ui.verified(16) : ''}</strong><span>${esc(catOf(pro).name)} · <span class="star">${icon('star')}${ui.rating(pro.rating)}</span> · CPF ${S.cpf.hidden((o.parties || {}).provider ? o.parties.provider.cpf : '')}</span></div>
        <div class="id-actions">
          <button class="icon-btn soft" data-go="/chat/${pro.id}" aria-label="Enviar mensagem">${icon('message-circle')}</button>
          <button class="icon-btn soft" data-action="call-pro" aria-label="Ligar">${icon('phone')}</button>
        </div>
      </div>
      <p class="id-note">${ui.face(st().user, 26)}<span>Sua foto foi enviada a ${esc(ui.first(pro.name))} para que ele reconheça você no local.</span></p>
      <div class="tp-pay">${icon('lock')}<span><strong>${money(o.amounts.clientTotalAmount)}</strong> retidos com segurança · ${esc(S.pay.label(o.method))}</span></div>
      ${o.status === 'awaiting' ? `<button class="btn btn-primary btn-block btn-lg" data-action="confirm-done" data-arg="${o.id}">${icon('circle-check')}Confirmar e liberar pagamento</button>` : ''}
      ${S.orders.canCancel(o) ? `<button class="btn btn-ghost btn-block btn-sm" data-action="cancel-order" data-arg="${o.id}">Cancelar pedido</button>` : ''}`;
  }

  screens.track = {
    mode: 'client',

    render(p) {
      const o = S.orders.get(p.id);
      if (!o) return missing('Pedido não encontrado');
      if (S.orders.isFinal(o)) { setTimeout(() => S.app.replace('/order/' + o.id, {}), 0); return ''; }
      return `
        <div class="track">
          <div id="track-map" class="map"></div>
          <div class="track-top">
            <button class="icon-btn" data-go="/home" aria-label="Voltar ao início">${icon('arrow-left')}</button>
            <span class="track-code">Pedido ${esc(o.code)}</span>
            <button class="icon-btn" data-action="track-info" aria-label="Pagamento protegido">${icon('shield-check')}</button>
          </div>
          <section class="track-panel" id="track-panel"></section>
        </div>`;
    },

    mount(root, p) {
      const o = S.orders.get(p.id);
      const panel = root.querySelector('#track-panel');
      if (!o || !panel) return null;
      const pro = S.data.pro(o.proId), colors = S.map.routeColors();
      const map = S.map.create(root.querySelector('#track-map'), o.address, 14);
      let proMarker = null, lineAll = null, lineLeft = null, last = null;

      /* No celular o painel fica embaixo do mapa; em telas largas, à esquerda. */
      const fit = (pts) => { if (map) S.map.fit(map, pts, ui.wide() ? { t: 90, l: panel.offsetWidth + 72, r: 64, b: 64 } : { t: 96, l: 48, r: 48, b: panel.offsetHeight + 36 }); };

      if (map) {
        const rt0 = S.sim.live(o.id);
        S.map.user(map, o.address);
        proMarker = S.map.pro(map, pro, (rt0 && rt0.pos) || o.proStart);
      }

      function paint(order, rt, tick) {
        if (order.id !== o.id) return;
        if (order.status !== last) {
          last = order.status;
          panel.innerHTML = panelHtml(order, rt);
          ui.refreshIcons();
          fit(rt && rt.route ? rt.route.points : [o.proStart, o.address]);
        } else if (tick) {
          const t = trackTexts(order, rt), sub = panel.querySelector('#tp-sub'), badge = panel.querySelector('#tp-badge');
          if (sub) sub.textContent = t.sub;
          if (badge) badge.textContent = t.badge;
        }
        if (!map || !rt) return;
        if (rt.route && !lineAll) {
          lineAll = S.map.line(map, rt.route.points, colors[1], 6);
          lineLeft = S.map.line(map, rt.route.points, colors[0], 6);
          fit(rt.route.points);
        }
        if (rt.pos) {
          proMarker.setLatLng(S.map.ll(rt.pos));
          if (lineLeft) lineLeft.setLatLngs([S.map.ll(rt.pos)].concat(rt.route.points.slice(rt.pos.index + 1).map(S.map.ll)));
        }
      }

      S.sim.on(paint);
      paint(o, S.sim.live(o.id), false);
      return () => { S.sim.off(paint); if (map) map.remove(); };
    }
  };

  A['track-info'] = () => {
    ui.sheet.open(`
      <div class="dialog">
        <span class="match-ok">${icon('shield-check')}</span>
        <h3>Pagamento protegido</h3>
        <p class="muted">Seu pagamento está retido pela FixUp. O profissional só recebe depois que você confirmar que o serviço foi concluído. Se o pedido for cancelado antes da chegada, o valor é estornado integralmente.</p>
        <button class="btn btn-soft btn-block" data-action="sheet-close">Entendi</button>
      </div>`);
  };

  A['call-pro'] = () => ui.toast('Ligação protegida: seu número não é compartilhado com o profissional.', 'info');

  A['confirm-done'] = (el) => {
    const o = S.orders.get(el.dataset.arg);
    if (!o || o.status !== 'awaiting') return;
    el.classList.add('loading');
    setTimeout(() => { S.orders.confirm(o); openRating(o); }, 900);
  };

  A['cancel-order'] = async (el) => {
    const o = S.orders.get(el.dataset.arg);
    if (!o) return;
    const ok = await ui.confirm({ title: 'Cancelar este pedido?', text: `O valor de ${money(o.amounts.clientTotalAmount)} será estornado integralmente.`, ok: 'Cancelar pedido', cancel: 'Manter pedido', danger: true });
    if (!ok) return;
    if (!S.orders.canCancel(o)) return ui.toast('O profissional já chegou: não é mais possível cancelar por aqui.', 'bad');
    S.orders.cancel(o);
    S.app.replace('/order/' + o.id, {});
    ui.toast('Pedido cancelado. Valor estornado.', 'info');
  };

  /* ---------- Avaliação ---------- */
  const TAGS = ['Pontual', 'Atencioso', 'Caprichoso', 'Preço justo', 'Resolveu rápido'];

  function openRating(o) {
    const pro = S.data.pro(o.proId);
    let starsValue = 5, photos = [];
    const drawPhotos = () => {
      const box = document.getElementById('rate-photos');
      if (box) box.innerHTML = photos.map((src, i) => `<span class="up-thumb"><img src="${src}" alt="Foto ${i + 1} do serviço"><button data-action="rate-photo-del" data-arg="${i}" aria-label="Remover foto">${icon('x')}</button></span>`).join('');
      ui.refreshIcons();
    };
    ui.sheet.open(`
      <div class="rate">
        <span class="match-ok">${icon('circle-check')}</span>
        <h3>Pagamento liberado</h3>
        <p class="muted">${money(o.amounts.clientTotalAmount)} · ${esc(o.serviceName)}</p>
        <div class="rate-pro">${ui.face(pro, 52)}<strong>Como foi o atendimento de ${esc(ui.first(pro.name))}?</strong></div>
        <div class="rate-stars" id="rate-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="on" data-action="rate-star" data-arg="${n}" aria-label="${n} estrelas">${icon('star')}</button>`).join('')}</div>
        <div class="chips wrap" id="rate-tags">${TAGS.map((t) => `<button class="chip sm" data-action="rate-tag" data-arg="${t}">${t}</button>`).join('')}</div>
        <textarea class="textarea" rows="2" id="rate-comment" placeholder="Deixe um comentário (opcional)"></textarea>
        <div class="up-box">
          <div class="up-head"><strong>Fotos do serviço</strong><small>Antes e depois, ou o resultado final. Elas aparecem com a sua avaliação, como prova de que o serviço aconteceu.</small></div>
          <div class="up-list" id="rate-photos"></div>
          <button class="btn btn-soft btn-sm" data-action="rate-photo-add">${icon('camera')}Adicionar fotos</button>
        </div>
        <button class="btn btn-primary btn-block btn-lg" data-action="rate-send">Enviar avaliação</button>
        <p class="hint">O serviço entrou no histórico de trabalhos de ${esc(ui.first(pro.name))}, com a sua avaliação. ${esc(ui.first(pro.name))} também avalia você.</p>
      </div>`, { onClose() { S.app.replace('/order/' + o.id, {}); } });

    A['rate-star'] = (el) => {
      starsValue = +el.dataset.arg;
      document.querySelectorAll('#rate-stars button').forEach((b, i) => b.classList.toggle('on', i < starsValue));
    };
    A['rate-tag'] = (el) => el.classList.toggle('active');
    A['rate-photo-add'] = async () => { photos = photos.concat(await S.media.pick({ multiple: true, limit: 6 - photos.length })).slice(0, 6); drawPhotos(); };
    A['rate-photo-del'] = (el) => { photos.splice(+el.dataset.arg, 1); drawPhotos(); };
    A['rate-send'] = () => {
      const tags = Array.from(document.querySelectorAll('#rate-tags .chip.active')).map((b) => b.dataset.arg);
      if (photos.length && o.jobId) S.media.save(photos, { owner: o.proId, kind: 'job', jobId: o.jobId, by: 'client' });
      S.orders.rate(o, { stars: starsValue, tags, comment: document.getElementById('rate-comment').value.trim() });
      ui.sheet.close();
      ui.toast('Avaliação enviada. Obrigado!', 'ok');
    };
  }

  /* =====================================================================
     Pedidos e comprovante
     ===================================================================== */

  function orderCard(o, activeId) {
    const pro = S.data.pro(o.proId), final = S.orders.isFinal(o);
    return `
      <button class="order-card${o.id === activeId ? ' active' : ''}" data-go="${final ? '/order/' : '/track/'}${o.id}">
        ${avatar(pro, 46)}
        <span class="row-main"><strong>${esc(o.serviceName)}</strong><small>${esc(pro.name)} · ${ui.day(o.createdAt)}, ${ui.time(o.createdAt)}</small></span>
        <span class="order-right"><strong>${money(o.amounts.clientTotalAmount)}</strong>${statusPill(o)}</span>
      </button>`;
  }

  /* Lista + detalhe: no celular aparece um de cada vez; em telas largas, lado a lado. */
  const md = (list, detail, open) => `<div class="md${open ? ' has-detail' : ''}"><aside class="md-list">${list}</aside><section class="md-detail">${detail}</section></div>`;

  function ordersList(activeId) {
    const all = S.orders.all(), live = all.filter((o) => !S.orders.isFinal(o)), past = all.filter(S.orders.isFinal);
    const card = (o) => orderCard(o, activeId);
    return `
      <header class="topbar plain"><h1>Pedidos</h1></header>
      ${live.length ? `<section class="section first"><h3 class="h3">Em andamento</h3><div class="list">${live.map(card).join('')}</div></section>` : ''}
      <section class="section${live.length ? '' : ' first'}">
        <h3 class="h3">Anteriores</h3>
        ${past.length ? `<div class="list">${past.map(card).join('')}</div>` : `<div class="empty small">${ui.mascot('empty', 76)}<p class="muted">Seus pedidos concluídos aparecem aqui.</p></div>`}
      </section>
      <div class="spacer"></div>`;
  }

  screens.orders = {
    tab: 'orders', mode: 'client',

    render() {
      return md(ordersList(null), `<div class="md-empty">${ui.mascot('empty', 76)}<h3>Escolha um pedido</h3><p>Os detalhes e o comprovante aparecem aqui.</p></div>`, false);
    },

    mount() {
      const onSim = (o, rt, tick) => { if (!tick) S.app.refresh(); };
      S.sim.on(onSim);
      return () => S.sim.off(onSim);
    }
  };

  const TIMELINE = {
    searching: 'Pedido enviado e pagamento retido', accepted: 'Aceito pelo profissional', on_the_way: 'Profissional a caminho',
    arrived: 'Chegou ao local', in_progress: 'Serviço iniciado', awaiting: 'Serviço finalizado pelo profissional',
    completed: 'Conclusão confirmada e pagamento liberado', cancelled: 'Pedido cancelado e valor estornado'
  };

  screens.receipt = {
    mode: 'client',

    render(p) {
      const o = S.orders.get(p.id);
      if (!o) return missing('Pedido não encontrado');
      const pro = S.data.pro(o.proId), done = o.status === 'completed', cancelled = o.status === 'cancelled';
      const job = o.jobId ? S.db.get(o.jobId) : null, shots = job ? S.media.ofJob(job) : [];
      return md(ordersList(o.id), `
        ${backBar('Pedido ' + o.code)}
        <section class="receipt-head ${done ? 'ok' : cancelled ? 'bad' : 'live'}">
          <span class="receipt-ic">${icon(done ? 'circle-check' : cancelled ? 'circle-x' : 'clock')}</span>
          <h1>${done ? 'Serviço concluído' : cancelled ? 'Pedido cancelado' : esc(S.orders.label(o.status))}</h1>
          <p class="muted">${ui.day(o.createdAt)}, ${ui.time(o.createdAt)}</p>
        </section>

        <section class="section">
          <div class="card flush">
            <button class="row" data-go="/p/${pro.id}">
              ${avatar(pro, 44)}
              <span class="row-main"><strong>${esc(pro.name)}</strong><small>${esc(catOf(pro).name)}</small></span>
              ${o.rating ? `<span class="star">${icon('star')}${o.rating.stars},0</span>` : icon('chevron-right', 'muted-ic')}
            </button>
            <div class="row static"><span class="row-ic">${icon(o.custom ? 'file-text' : 'wrench')}</span><span class="row-main"><strong class="wrap">${esc(o.serviceName)}</strong><small>${o.note ? esc(o.note) : 'Sem observações'}</small></span></div>
            <div class="row static"><span class="row-ic">${icon('map-pin')}</span><span class="row-main"><strong>${esc(o.address.label)}</strong><small>${esc(o.address.sub || '')}</small></span></div>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Pagamento</h3>
          <div class="card">
            ${bill(o.amounts)}
            <p class="paid-with">${icon(S.pay.method(o.method).icon)}<span>${cancelled ? 'Estornado para' : 'Pago com'} ${esc(S.pay.label(o.method))}</span></p>
          </div>
        </section>

        ${done ? `
        <section class="section">
          <h3 class="h3">Comprovante de pagamento</h3>
          <div class="card rcpt-mini">
            <div class="rm-top">${ui.mascot('badge', 34)}<div><strong>Pagamento liquidado</strong><small>Comprovante com código de autenticação, CPFs mascarados e dados do serviço.</small></div></div>
            ${S.receipts.buttons('order', o.id)}
          </div>
        </section>` : ''}

        ${job ? `
        <section class="section">
          <div class="section-head"><h3>Fotos do serviço</h3><span class="muted sm">${shots.length} ${shots.length === 1 ? 'foto' : 'fotos'}</span></div>
          ${shots.length ? S.media.strip(shots, 8, 'grid') : '<p class="muted sm">Registre o resultado com fotos de antes e depois. Elas aparecem com a sua avaliação no perfil do profissional.</p>'}
          <button class="btn btn-soft btn-block btn-sm" data-action="order-photo-add" data-arg="${o.id}">${icon('camera')}Adicionar fotos do serviço</button>
        </section>` : ''}

        <section class="section">
          <h3 class="h3">Histórico</h3>
          <ol class="timeline">${o.timeline.map((t) => `<li><span>${esc(TIMELINE[t.status] || t.status)}</span><small>${ui.time(t.at)}</small></li>`).join('')}</ol>
        </section>

        <section class="section">
          <button class="btn btn-soft btn-block" data-go="${o.serviceId ? `/p/${pro.id}?s=${o.serviceId}` : `/chat/${pro.id}`}">${icon(o.serviceId ? 'repeat' : 'message-circle')}${o.serviceId ? 'Pedir novamente' : 'Falar com ' + esc(ui.first(pro.name))}</button>
        </section>
        <div class="spacer"></div>`, true);
    }
  };

  /* =====================================================================
     Carteira
     ===================================================================== */

  const TX_STATE = { held: 'Retido', released: 'Pago', refunded: 'Estornado', done: 'Concluído' };

  function txRow(t) {
    const refunded = t.state === 'refunded', o = t.orderId && S.orders.get(t.orderId), receipt = o && o.status === 'completed';
    const tag = receipt ? 'button' : 'div', attr = receipt ? ` data-action="rcpt-order" data-arg="${o.id}" title="Ver comprovante de pagamento"` : '';
    return `
      <${tag} class="tx${receipt ? ' tx-btn' : ''}"${attr}>
        <span class="row-ic ${t.kind === 'topup' ? 'in' : ''}">${icon(t.kind === 'topup' ? 'arrow-down-left' : 'arrow-up-right')}</span>
        <span class="row-main"><strong>${esc(t.title)}</strong><small>${ui.day(t.at)} · ${esc(S.pay.label(t.method))} · ${TX_STATE[t.state]}${receipt ? ' · comprovante' : ''}</small></span>
        <b class="${t.amount > 0 ? 'pos' : refunded ? 'void' : ''}">${t.amount > 0 ? '+ ' : '− '}${money(Math.abs(t.amount))}</b>
      </${tag}>`;
  }

  screens.wallet = {
    mode: 'client',

    render() {
      const w = st().wallet;
      const how = [['smartphone', 'Você paga pelo app', 'Pix, cartão ou saldo, sem dinheiro em mãos.'], ['lock', 'O valor fica retido', 'A FixUp guarda o pagamento durante o atendimento.'], ['circle-check', 'Liberado na conclusão', 'O profissional recebe quando você confirma o serviço.']];
      return `
        ${backBar('Carteira')}
        <section class="section first">
          <div class="wallet-card">
            <small>Saldo FixUp</small>
            <strong>${money(w.balance)}</strong>
            <button class="btn btn-white" data-action="open-topup">${icon('plus')}Adicionar saldo</button>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Forma de pagamento padrão</h3>
          <div class="card flush" id="default-methods">${S.pay.methods().map((m) => methodRow(m, w.defaultMethod, 'set-default-method')).join('')}</div>
        </section>

        <section class="section">
          <h3 class="h3">Como funciona</h3>
          <div class="card flush">${how.map((h, i) => `<div class="row static"><span class="row-ic num">${i + 1}</span><span class="row-main"><strong>${h[1]}</strong><small>${h[2]}</small></span></div>`).join('')}</div>
        </section>

        <section class="section">
          <h3 class="h3">Histórico financeiro</h3>
          <div class="card flush">${w.tx.length ? w.tx.map(txRow).join('') : '<p class="muted pad">Nenhuma movimentação ainda.</p>'}</div>
        </section>
        <div class="spacer"></div>`;
    }
  };

  A['order-photo-add'] = async (el) => {
    const o = S.orders.get(el.dataset.arg);
    if (!o || !o.jobId) return;
    const list = await S.media.pick({ multiple: true, limit: 6 });
    if (!list.length) return;
    S.media.save(list, { owner: o.proId, kind: 'job', jobId: o.jobId, by: 'client' });
    S.app.refresh();
    ui.toast(list.length === 1 ? 'Foto adicionada ao serviço.' : list.length + ' fotos adicionadas ao serviço.', 'ok');
  };

  A['set-default-method'] = (el) => {
    st().wallet.defaultMethod = el.dataset.arg;
    S.store.save();
    document.querySelectorAll('#default-methods .method').forEach((b) => b.classList.toggle('selected', b === el));
  };

  A['open-topup'] = () => {
    ui.sheet.open(`
      <div class="sheet-head"><h3>Adicionar saldo</h3>${closeBtn}</div>
      <p class="muted">Escolha um valor para adicionar via Pix.</p>
      <div class="amounts">${[20, 50, 100, 200].map((v) => `<button class="amount" data-action="topup" data-arg="${v}">${money(v)}</button>`).join('')}</div>`);
  };

  A['topup'] = (el) => {
    const amount = +el.dataset.arg;
    openPix(amount, 'Adicionar saldo via Pix', () => {
      S.pay.topup(amount);
      S.app.refresh();
      ui.toast(`${money(amount)} adicionados ao seu saldo.`, 'ok');
    });
  };

  /* =====================================================================
     Perfil (compartilhado entre cliente e profissional)
     ===================================================================== */

  const THEMES = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];

  screens.profile = {
    tab: 'profile',

    render() {
      const s = st(), isPro = s.mode === 'pro', pref = S.theme.pref(), info = S.db.info();
      const me = isPro ? s.pro : s.user, g = S.guard.status(isPro ? 'provider' : 'client');
      const who = { name: me.name, photo: me.photo, photoDemo: me.photoDemo, hue: isPro ? 252 : 236, sub: isPro ? S.data.cat(s.pro.cat).name + ' · conta profissional' : s.user.email };
      const secSub = g.restriction ? 'Restrição de segurança no CPF' : g.missing.length ? (g.missing.indexOf('photo') >= 0 ? 'Falta a foto do rosto' : 'Falta o CPF') + ' para ' + (isPro ? 'atender' : 'contratar') : 'Verificada · CPF ' + S.cpf.hidden(me.cpf);
      const row = (ic, title, sub, attr) => `<button class="row" ${attr}><span class="row-ic">${icon(ic)}</span><span class="row-main"><strong>${title}</strong><small>${sub}</small></span>${icon('chevron-right', 'muted-ic')}</button>`;
      return `
        <header class="topbar plain"><h1>Perfil</h1></header>
        <section class="section first">
          <div class="card user-card">${ui.face(who, 60)}<span class="row-main"><strong>${esc(who.name)}</strong><small>${esc(who.sub)}</small></span>${!g.missing.length && !g.restriction ? `<span class="seal">${ui.mascot('badge', 22)}Verificada</span>` : `<span class="status-pill ${g.restriction ? 'bad' : 'live'}">${g.restriction ? 'Bloqueada' : 'Pendente'}</span>`}</div>
        </section>

        <section class="section">
          <button class="mode-card" data-action="set-mode" data-arg="${isPro ? 'client' : 'pro'}">
            <span class="mode-ic">${icon(isPro ? 'user' : 'briefcase')}</span>
            <span class="row-main"><strong>${isPro ? 'Voltar para o modo cliente' : 'Você presta serviços?'}</strong><small>${isPro ? 'Contrate profissionais perto de você.' : 'Mude para o modo profissional. Sem mensalidade.'}</small></span>
            ${icon('arrow-right')}
          </button>
        </section>

        <section class="section">
          <div class="card flush">
            ${row(g.restriction ? 'shield-alert' : 'shield-check', 'Conta e segurança', esc(secSub), 'data-go="/account"')}
            ${isPro
              ? row('id-card', 'Perfil profissional', 'Resumo, cursos técnicos, especialidades e portfólio', 'data-go="/pro/profile"') +
                row('banknote', 'Ganhos e saques', 'Saldo disponível: ' + money(s.pro.balance), 'data-go="/pro/earnings"') +
                row('clipboard-list', 'Meus trabalhos realizados', S.db.byPro('me').length + ' registros no seu histórico', 'data-action="open-my-jobs"')
              : row('map-pin', 'Endereço de atendimento', esc(s.location.label), 'data-action="open-location"') +
                row('wallet', 'Pagamentos e carteira', 'Saldo: ' + money(s.wallet.balance) + ' · padrão: ' + esc(S.pay.label(s.wallet.defaultMethod)), 'data-go="/wallet"') +
                row('heart', 'Favoritos', s.favorites.length + (s.favorites.length === 1 ? ' profissional salvo' : ' profissionais salvos'), 'data-action="open-favs"')}
            ${row('receipt-text', 'Como funcionam os preços', isPro ? 'Você vê sempre o valor líquido' : 'O preço que você vê é o preço final', 'data-action="open-fees"')}
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Aparência</h3>
          <div class="card theme-card">
            <span class="row-ic">${icon(S.theme.resolved() === 'dark' ? 'moon' : 'sun')}</span>
            <div class="seg theme-seg">${THEMES.map((t) => `<button class="${pref === t[0] ? 'active' : ''}" data-action="set-theme" data-arg="${t[0]}">${t[1]}</button>`).join('')}</div>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Sobre o app</h3>
          <div class="card flush">
            ${row('sparkles', 'Novidades da versão ' + S.config.version, esc(S.config.releases[0].title), 'data-action="open-news"')}
            ${row('clapperboard', 'Ver a abertura de novo', 'A animação do logo que aparece ao abrir o app', 'data-action="rever-abertura"')}
            ${row('database', 'Banco de trabalhos', info.jobs + ' trabalhos de ' + info.pros + ' profissionais', 'data-action="open-db"')}
            ${row('rotate-ccw', 'Restaurar demonstração', 'Apaga pedidos, conversas e saldos criados no teste', 'data-action="reset-demo"')}
          </div>
          <p class="fine-print">FixUp v${S.config.version} · protótipo de demonstração</p>
        </section>
        <div class="spacer"></div>`;
    }
  };

  A['open-favs'] = () => {
    const favs = st().favorites.map(S.data.pro).filter(Boolean);
    ui.sheet.open(`
      <div class="sheet-head"><h3>Favoritos</h3>${closeBtn}</div>
      ${favs.length ? `<div class="list">${favs.map((p) => proCard(p)).join('')}</div>` : '<p class="muted">Toque no coração no perfil de um profissional para salvá-lo aqui.</p>'}`);
  };

  /* Preço cego: cada lado vê só o seu valor, e a explicação também é diferente para cada um. */
  A['open-fees'] = () => {
    const isPro = st().mode === 'pro', t = S.config.travel;
    const items = isPro
      ? [['wallet', 'Você vê o valor líquido', 'Em solicitações, propostas, ganhos e comprovantes aparece sempre o que entra no seu saldo.'],
        ['route', `Deslocamento grátis até ${t.freeKm} km`, `Pela rota mais curta. Acima disso, você pode cobrar até ${money(t.maxPerExcessKm)} por km excedente, e esse valor é todo seu.`],
        ['badge-percent', 'Sem mensalidade', 'Não há mensalidade, taxa de adesão nem taxa de saque.']]
      : [['receipt-text', 'O preço que você vê é o preço final', 'Já inclui tudo: não aparece nenhuma taxa extra na hora de pagar.'],
        ['route', `Deslocamento grátis até ${t.freeKm} km`, 'Pela rota mais curta entre o profissional e você. Acima disso, a taxa aparece separada no resumo, com teto por km.'],
        ['lock', 'Pagamento protegido', 'O valor fica retido pela FixUp e só é liberado quando você confirma a conclusão.']];
    ui.sheet.open(`
      <div class="sheet-head"><h3>Como funcionam os preços</h3>${closeBtn}</div>
      <div class="card flush">${items.map((h) => `<div class="row static"><span class="row-ic">${icon(h[0])}</span><span class="row-main"><strong class="wrap">${h[1]}</strong><small>${h[2]}</small></span></div>`).join('')}</div>
      <button class="btn btn-soft btn-block" data-action="sheet-close">Entendi</button>`);
  };

  A['open-news'] = () => {
    ui.sheet.open(`
      <div class="sheet-head"><h3>Notas de atualização</h3>${closeBtn}</div>
      ${S.config.releases.map((r, i) => `
        <div class="release">
          <div class="rel-head"><span class="tag${i ? ' off' : ''}">v${r.v}</span><strong>${esc(r.title)}</strong><small>${esc(r.date)}</small></div>
          <ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>`).join('')}`);
  };

  A['open-db'] = () => {
    const info = S.db.info(), m = S.match.stats(), last = S.db.all().filter((j) => j.proId !== 'me').slice(0, 3);
    ui.sheet.open(`
      <div class="sheet-head"><h3>Banco de trabalhos</h3>${closeBtn}</div>
      <div class="db-stats">
        <div><strong>${info.jobs}</strong><small>trabalhos registrados</small></div>
        <div><strong>${info.pros}</strong><small>profissionais</small></div>
        <div><strong>${m.terms}</strong><small>termos no vocabulário</small></div>
      </div>
      <p class="muted">Cada serviço concluído vira um registro com o problema descrito pelo cliente, o aparelho, a marca, o valor e a avaliação. A busca compara o que você escreve com esse histórico para encontrar quem já resolveu casos parecidos.</p>
      <p class="note">${icon('database')}<span>${info.persistent ? 'Os registros ficam no IndexedDB deste navegador (banco “fixup”).' : 'Neste navegador o banco está funcionando apenas em memória.'} Serviços concluídos pelo app entram aqui automaticamente.</span></p>
      <h3 class="h3 tight">Registros mais recentes</h3>
      <div class="jobs">${last.map((j) => ui.jobCard(j)).join('')}</div>`);
  };

  A['reset-demo'] = async () => {
    const ok = await ui.confirm({ title: 'Restaurar a demonstração?', text: 'Pedidos, conversas, saldos e trabalhos criados durante o teste serão apagados.', ok: 'Restaurar', danger: true });
    if (!ok) return;
    S.sim.stopAll();
    if (S.proSim) S.proSim.reset();
    S.chat.reset();
    S.store.reset();
    await S.db.reset();
    S.draft = null;
    S.app.replace('/home', {});
    S.app.locateUser();
    ui.toast('Demonstração restaurada.', 'ok');
  };
})(window.FixUp = window.FixUp || {});
