/* Servi — modo profissional: ficar online, receber solicitações próximas,
   atender e acompanhar ganhos (com a comissão da plataforma sempre visível). */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, money = ui.money, icon = ui.icon, km = ui.km, avatar = ui.avatar;
  const A = S.actions, screens = S.screens;
  const st = () => S.store.state;
  const pr = () => st().pro;
  const pct = () => S.pricing.percent();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const CLIENTS = ['Beatriz Almeida', 'Lucas Ferreira', 'Sofia Carvalho', 'Henrique Dias', 'Marta Oliveira', 'Caio Ribeiro', 'Débora Lins'];
  const STREETS = ['Rua das Acácias, 214', 'Av. Brasil, 1020 · apto 42', 'Rua Sete de Setembro, 88', 'Alameda das Palmeiras, 455', 'Rua Bela Vista, 37 · casa 2'];
  const REQUEST_SECONDS = 20;
  const TRAVEL_MS = 14000;

  /* Estado em memória do atendimento (não é salvo: recomeça a cada sessão). */
  const rt = { incoming: null, active: null, timer: null, expire: null, tick: null, view: null };

  function todayStats() {
    const d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const jobs = pr().jobs.filter((j) => j.at >= start);
    return { count: jobs.length, net: jobs.reduce((s, j) => s + j.net, 0) };
  }

  /* Simula um cliente próximo pedindo um serviço da especialidade do profissional. */
  function makeRequest() {
    const svc = pick(S.data.cat(pr().cat).services);
    const dist = Math.round((0.8 + Math.random() * 2.8) * 10) / 10;
    return {
      id: S.store.nextId('r'), client: pick(CLIENTS), address: pick(STREETS), service: svc.name, dur: svc.dur,
      km: dist, eta: S.geo.etaMin(dist), pos: S.geo.offset(st().location, Math.random() * 360, dist / 1.3),
      quote: S.pricing.quote(svc.price, dist), status: 'incoming', route: null, progress: 0
    };
  }

  /* ---------- Blocos da tela ---------- */

  const earnHtml = (q) => `
    <div class="earn">
      <div><span>Valor do serviço</span><b>${money(q.total)}</b></div>
      <div><span>Comissão Servi (${pct()})</span><b>− ${money(q.commission)}</b></div>
      <div class="earn-total"><span>Você recebe</span><b>${money(q.payout)}</b></div>
    </div>`;

  const jobLine = (j) => `<p class="req-client"><span>${icon('user')}${esc(j.client)}</span><span>${icon('map-pin')}${esc(j.address)}</span></p>`;

  const JOB = {
    accepted: { step: 1, label: 'Solicitação aceita', cta: 'Iniciar deslocamento', ic: 'navigation' },
    on_the_way: { step: 1, label: 'A caminho do cliente', cta: 'Cheguei ao local', ic: 'map-pin' },
    arrived: { step: 2, label: 'No local', cta: 'Iniciar serviço', ic: 'play' },
    in_progress: { step: 2, label: 'Serviço em andamento', cta: 'Concluir serviço', ic: 'circle-check' }
  };
  const STEPS = ['Aceito', 'A caminho', 'No local', 'Concluído'];

  function stateHtml() {
    const p = pr();
    if (rt.active) {
      const j = rt.active, s = JOB[j.status];
      return `
        <div class="job-card">
          <div class="req-head"><span class="tag ok">Em atendimento</span><span class="req-dist" id="job-status">${esc(s.label)}</span></div>
          <h3>${esc(j.service)}</h3>
          ${jobLine(j)}
          <ol class="steps">${STEPS.map((t, i) => `<li class="${i < s.step ? 'done' : i === s.step ? 'now' : ''}"><span class="bullet">${i < s.step ? icon('check') : ''}</span><span>${t}</span></li>`).join('')}</ol>
          <div class="earn-inline">${icon('shield-check')}<span>Você recebe <strong>${money(j.quote.payout)}</strong> · pagamento garantido pela plataforma</span></div>
          <button class="btn btn-primary btn-block btn-lg" data-action="pro-advance">${icon(s.ic)}${s.cta}</button>
        </div>`;
    }
    if (rt.incoming) {
      const j = rt.incoming;
      return `
        <div class="req-card">
          <div class="req-timer"><span style="animation-duration:${REQUEST_SECONDS}s"></span></div>
          <div class="req-head"><span class="tag">Nova solicitação</span><span class="req-dist">${icon('navigation')}${km(j.km)} · ${j.eta} min</span></div>
          <h3>${esc(j.service)}</h3>
          ${jobLine(j)}
          ${earnHtml(j.quote)}
          <div class="row-2">
            <button class="btn btn-soft" data-action="pro-decline">Recusar</button>
            <button class="btn btn-primary" data-action="pro-accept">Aceitar</button>
          </div>
        </div>`;
    }
    if (p.online) {
      return `
        <div class="radar-card">
          <span class="radar"><i></i><i></i><i></i>${icon('navigation')}</span>
          <div><h3>Procurando solicitações</h3><p>Você aparece para clientes em um raio de ${S.config.coverageKm} km.</p></div>
        </div>`;
    }
    return `
      <div class="empty-card">
        <span class="empty-ic">${icon('power')}</span>
        <h3>Você está offline</h3>
        <p>Fique online para receber solicitações de clientes próximos.</p>
        <button class="btn btn-primary btn-block" data-action="pro-toggle">Ficar online</button>
      </div>`;
  }

  function kpisHtml() {
    const t = todayStats();
    return `
      <div><small>Ganhos hoje</small><strong>${money(t.net)}</strong></div>
      <div><small>Serviços hoje</small><strong>${t.count}</strong></div>
      <div><small>Avaliação</small><strong>${ui.rating(pr().rating)}</strong></div>`;
  }

  const chipText = () => (rt.active ? 'Rota até o cliente' : rt.incoming ? 'Cliente a ' + km(rt.incoming.km) : pr().online ? 'Área de atendimento' : 'Você está offline');

  /* ---------- Mapa ---------- */

  function paintMap() {
    const v = rt.view;
    if (!v || !v.map) return;
    const loc = st().location, job = rt.active || rt.incoming;
    v.layer.clearLayers();
    v.lineLeft = null;
    v.circle.setStyle({ opacity: pr().online && !job ? 1 : 0, fillOpacity: pr().online && !job ? 0.07 : 0 });
    if (!job) {
      v.self.setLatLng(S.map.ll(loc));
      v.map.setView(S.map.ll(loc), 12, { animate: false });
      return;
    }
    S.map.dest(v.layer, job.pos);
    if (job.route) {
      S.map.line(v.layer, job.route.points, '#A9C5FF', 5);
      v.lineLeft = S.map.line(v.layer, job.route.points, '#1557E6', 5);
    }
    v.self.setLatLng(S.map.ll(job.at || loc));
    S.map.fit(v.map, [loc, job.pos], { t: 44, b: 30, l: 40, r: 40 });
  }

  function paint() {
    const v = rt.view;
    if (!v) return;
    const p = pr(), root = v.root, sw = root.querySelector('#pro-switch');
    root.querySelector('#pro-state').innerHTML = stateHtml();
    root.querySelector('#pro-kpis').innerHTML = kpisHtml();
    root.querySelector('#pro-chip').textContent = chipText();
    sw.classList.toggle('on', p.online);
    sw.setAttribute('aria-checked', String(p.online));
    sw.querySelector('.switch-label').textContent = p.online ? 'Online' : 'Offline';
    ui.refreshIcons();
    paintMap();
  }

  /* ---------- Fluxo de solicitações ---------- */

  function clearTimers() {
    clearTimeout(rt.timer);
    clearTimeout(rt.expire);
    clearInterval(rt.tick);
  }

  function schedule(delay) {
    clearTimeout(rt.timer);
    rt.timer = setTimeout(() => {
      if (!pr().online || rt.active || rt.incoming) return;
      rt.incoming = makeRequest();
      rt.expire = setTimeout(() => {
        rt.incoming = null;
        paint();
        if (rt.view) ui.toast('A solicitação expirou.', 'info');
        schedule(5000);
      }, REQUEST_SECONDS * 1000);
      paint();
      if (rt.view) rt.view.root.querySelector('#pro-state').scrollIntoView({ block: 'end' });
      else ui.toast('Nova solicitação de serviço perto de você.', 'info');
    }, delay);
  }

  function setJob(status) {
    rt.active.status = status;
    paint();
  }

  function startTravel() {
    const job = rt.active, loc = st().location, t0 = Date.now();
    job.status = 'on_the_way';
    S.geo.route(loc, job.pos).then((r) => { if (rt.active === job) { job.route = r; paintMap(); } });
    clearInterval(rt.tick);
    rt.tick = setInterval(() => {
      if (rt.active !== job || job.status !== 'on_the_way') return clearInterval(rt.tick);
      const t = Math.min(1, (Date.now() - t0) / TRAVEL_MS), v = rt.view;
      job.progress = t;
      if (job.route) {
        job.at = S.geo.along(job.route.points, t);
        if (v && v.map) {
          v.self.setLatLng(S.map.ll(job.at));
          if (v.lineLeft) v.lineLeft.setLatLngs([S.map.ll(job.at)].concat(job.route.points.slice(job.at.index + 1).map(S.map.ll)));
        }
      }
      const label = v && v.root.querySelector('#job-status');
      if (label) label.textContent = `Chegada em ${Math.max(1, Math.ceil(job.eta * (1 - t)))} min`;
      if (t >= 1) { clearInterval(rt.tick); setJob('arrived'); }
    }, 80);
    paint();
  }

  function completeJob() {
    const job = rt.active, p = pr(), q = job.quote;
    p.jobs.unshift({ id: S.store.nextId('j'), client: job.client, service: job.service, gross: q.total, commission: q.commission, net: q.payout, at: Date.now() });
    p.balance = S.pricing.round2(p.balance + q.payout);
    S.store.save();
    rt.active = null;
    paint();
    ui.sheet.open(`
      <div class="dialog">
        <span class="match-ok">${icon('circle-check')}</span>
        <h3>Serviço concluído</h3>
        <p class="muted">${esc(job.service)} · ${esc(job.client)}</p>
        ${earnHtml(q)}
        <p class="hint">O valor já está no seu saldo e pode ser sacado via Pix a qualquer momento.</p>
        <button class="btn btn-primary btn-block" data-action="sheet-close">Continuar</button>
      </div>`);
    schedule(7000);
  }

  A['pro-toggle'] = () => {
    const p = pr();
    if (p.online && rt.active) return ui.toast('Conclua o atendimento atual antes de ficar offline.', 'info');
    p.online = !p.online;
    S.store.save();
    clearTimers();
    rt.incoming = null;
    if (p.online) schedule(3500);
    paint();
    ui.toast(p.online ? 'Você está online. Buscando solicitações…' : 'Você está offline.', p.online ? 'ok' : 'info');
  };

  A['pro-decline'] = () => {
    clearTimeout(rt.expire);
    rt.incoming = null;
    paint();
    schedule(5000);
  };

  A['pro-accept'] = () => {
    if (!rt.incoming) return;
    clearTimeout(rt.expire);
    rt.active = rt.incoming;
    rt.incoming = null;
    rt.active.status = 'accepted';
    paint();
    ui.toast('Solicitação aceita. O pagamento do cliente já está retido.', 'ok');
  };

  A['pro-advance'] = () => {
    const job = rt.active;
    if (!job) return;
    if (job.status === 'accepted') return startTravel();
    if (job.status === 'on_the_way') { clearInterval(rt.tick); job.at = job.pos; return setJob('arrived'); }
    if (job.status === 'arrived') return setJob('in_progress');
    completeJob();
  };

  S.proSim = {
    /** Encerra a sessão do profissional (troca de modo ou restauração da demonstração). */
    reset() {
      clearTimers();
      rt.incoming = null;
      rt.active = null;
      pr().online = false;
    }
  };

  /* =====================================================================
     Início do profissional
     ===================================================================== */

  screens.proHome = {
    tab: 'pro', mode: 'pro', statusBar: 'light',

    render() {
      const p = pr();
      return `
        <header class="hero hero-pro">
          <div class="hero-top">
            <div class="pro-id">
              ${avatar({ name: p.name, hue: 228 }, 44)}
              <span><strong>${esc(p.name)}</strong><small>${esc(S.data.cat(p.cat).name)} · modo profissional</small></span>
            </div>
            <button class="switch${p.online ? ' on' : ''}" id="pro-switch" data-action="pro-toggle" role="switch" aria-checked="${p.online}">
              <span class="switch-label">${p.online ? 'Online' : 'Offline'}</span><span class="knob"></span>
            </button>
          </div>
          <div class="kpis" id="pro-kpis">${kpisHtml()}</div>
        </header>

        <section class="section first">
          <div class="map-card tall">
            <div id="pro-map" class="map"></div>
            <span class="map-chip" id="pro-chip">${esc(chipText())}</span>
          </div>
        </section>

        <section class="section" id="pro-state">${stateHtml()}</section>

        <section class="section">
          <div class="fee-note">${icon('percent')}<span>Sem mensalidade. Você só paga <strong>${pct()}</strong> de comissão sobre os serviços que concluir.</span></div>
        </section>
        <div class="spacer"></div>`;
    },

    mount(root) {
      const loc = st().location;
      const map = S.map.create(root.querySelector('#pro-map'), loc, 12, { interactive: false });
      rt.view = { root, map, layer: null, self: null, circle: null, lineLeft: null };
      if (map) {
        rt.view.circle = window.L.circle(S.map.ll(loc), { radius: S.config.coverageKm * 1000, color: '#1557E6', weight: 1.5, fillColor: '#1557E6', fillOpacity: 0.07, interactive: false }).addTo(map);
        rt.view.layer = window.L.layerGroup().addTo(map);
        rt.view.self = S.map.user(map, loc);
        paintMap();
      }
      return () => { rt.view = null; if (map) map.remove(); };
    }
  };

  /* =====================================================================
     Ganhos
     ===================================================================== */

  function weekData() {
    const d = new Date(), today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), DAY = 864e5;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const start = today - i * DAY;
      const jobs = pr().jobs.filter((j) => j.at >= start && j.at < start + DAY);
      days.push({
        label: new Date(start).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
        today: i === 0,
        gross: jobs.reduce((s, j) => s + j.gross, 0),
        commission: jobs.reduce((s, j) => s + j.commission, 0),
        net: jobs.reduce((s, j) => s + j.net, 0)
      });
    }
    return days;
  }

  screens.proEarnings = {
    tab: 'earnings', mode: 'pro',

    render() {
      const p = pr(), week = weekData();
      const max = Math.max.apply(null, week.map((x) => x.net).concat(1));
      const sum = week.reduce((a, x) => ({ gross: a.gross + x.gross, commission: a.commission + x.commission, net: a.net + x.net }), { gross: 0, commission: 0, net: 0 });
      const entries = p.jobs.map((j) => ({ at: j.at, job: j })).concat(p.withdrawals.map((w) => ({ at: w.at, wd: w }))).sort((a, b) => b.at - a.at);
      const entryRow = (e) => (e.job ? `
        <div class="tx">
          <span class="row-ic in">${icon('arrow-down-left')}</span>
          <span class="row-main"><strong>${esc(e.job.service)}</strong><small>${ui.day(e.at)} · ${esc(e.job.client)} · comissão ${money(e.job.commission)}</small></span>
          <b class="pos">+ ${money(e.job.net)}</b>
        </div>` : `
        <div class="tx">
          <span class="row-ic">${icon('landmark')}</span>
          <span class="row-main"><strong>Saque via Pix</strong><small>${ui.day(e.at)}, ${ui.time(e.at)}</small></span>
          <b>− ${money(e.wd.amount)}</b>
        </div>`);
      return `
        <header class="topbar plain"><h1>Ganhos</h1></header>
        <section class="section first">
          <div class="wallet-card dark">
            <small>Disponível para saque</small>
            <strong>${money(p.balance)}</strong>
            <button class="btn btn-white" data-action="pro-withdraw">${icon('landmark')}Sacar via Pix</button>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h3>Últimos 7 dias</h3><span class="muted sm">${money(sum.net)} líquidos</span></div>
          <div class="card">
            <div class="bars">${week.map((x) => `<div class="bar${x.today ? ' today' : ''}"><span style="height:${Math.round(4 + (x.net / max) * 72)}px"></span><small>${esc(x.label)}</small></div>`).join('')}</div>
            <dl class="bill">
              <div><dt>Valor dos serviços</dt><dd>${money(sum.gross)}</dd></div>
              <div><dt>Comissão Servi (${pct()})</dt><dd>− ${money(sum.commission)}</dd></div>
              <div class="bill-total"><dt>Você recebeu</dt><dd>${money(sum.net)}</dd></div>
            </dl>
          </div>
        </section>

        <section class="section">
          <div class="fee-note">${icon('percent')}<span>Sem mensalidade e sem taxa de saque. A Servi cobra apenas <strong>${pct()}</strong> por serviço concluído.</span></div>
        </section>

        <section class="section">
          <h3 class="h3">Extrato</h3>
          <div class="card flush">${entries.length ? entries.map(entryRow).join('') : '<p class="muted pad">Nenhum serviço concluído ainda.</p>'}</div>
        </section>
        <div class="spacer"></div>`;
    }
  };

  A['pro-withdraw'] = async () => {
    const p = pr(), amount = p.balance;
    if (amount <= 0) return ui.toast('Você não tem saldo disponível para saque.', 'info');
    const ok = await ui.confirm({ title: `Sacar ${money(amount)}?`, text: 'O valor é enviado via Pix para a sua chave cadastrada. Saques não têm custo.', ok: 'Confirmar saque' });
    if (!ok) return;
    p.withdrawals.unshift({ id: S.store.nextId('w'), amount, at: Date.now() });
    p.balance = 0;
    S.store.save();
    S.app.refresh();
    ui.toast('Saque solicitado. O Pix cai em instantes.', 'ok');
  };
})(window.Servi = window.Servi || {});
