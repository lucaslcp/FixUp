/* FixUp — modo profissional: ficar online, receber solicitações próximas, atender
   (inclusive propostas aceitas no chat) e acompanhar ganhos.
   Preço cego: o profissional vê só o valor líquido que recebe (providerNetAmount). O total pago pelo
   cliente e a parte da plataforma ficam nos registros, mas nunca aparecem nesta tela. */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, money = ui.money, icon = ui.icon, km = ui.km, avatar = ui.avatar;
  const A = S.actions, screens = S.screens;
  const st = () => S.store.state;
  const pr = () => st().pro;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const CLIENTS = ['Beatriz Almeida', 'Lucas Ferreira', 'Sofia Carvalho', 'Henrique Dias', 'Marta Oliveira', 'Caio Ribeiro', 'Jéssica Antunes'];
  const STREETS = ['Rua das Acácias, 214', 'Av. Brasil, 1020 · apto 42', 'Rua Sete de Setembro, 88', 'Alameda das Palmeiras, 455', 'Rua Bela Vista, 37 · casa 2'];
  const REQUEST_SECONDS = 20;
  const TRAVEL_MS = 14000;

  /* Estado em memória do atendimento (não é salvo: recomeça a cada sessão).
     queue = propostas aceitas no chat enquanto outro atendimento está em andamento. */
  const rt = { incoming: null, active: null, queue: [], timer: null, expire: null, tick: null, view: null };

  function todayStats() {
    const d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const jobs = pr().jobs.filter((j) => j.at >= start);
    return { count: jobs.length, net: jobs.reduce((s, j) => s + j.providerNetAmount, 0) };
  }

  const newJob = (o) => Object.assign({
    id: S.store.nextId('r'), eta: S.geo.etaMin(o.km), pos: S.geo.offset(st().location, Math.random() * 360, o.km / 1.3),
    status: 'incoming', route: null, progress: 0
  }, o);

  /* Simula um cliente próximo pedindo um serviço da especialidade do profissional. */
  function makeRequest() {
    const svc = pick(S.data.cat(pr().cat).services);
    const dist = Math.round((0.8 + Math.random() * 2.8) * 10) / 10;
    return newJob({ client: pick(CLIENTS), address: pick(STREETS), service: svc.name, km: dist, amounts: S.pricing.fromClientPrice(svc.price, S.pricing.defaultDisplacement(dist), dist) });
  }

  /* ---------- Blocos da tela ---------- */

  /* Só o valor líquido (e a taxa de deslocamento, quando houver, que é inteira do profissional). */
  const earnHtml = (a) => `
    <div class="earn">
      ${a.displacementFee ? `<div><span>Deslocamento (${km(a.routeKm)})</span><b>${money(a.displacementFee)}</b></div>` : `<div><span>Deslocamento${a.routeKm != null ? ' (' + km(a.routeKm) + ')' : ''}</span><b>grátis até ${S.config.travel.freeKm} km</b></div>`}
      <div class="earn-total"><span>Você recebe</span><b>${money(a.providerNetAmount)}</b></div>
    </div>`;

  /* Identificação presencial: as duas partes se reconhecem pela foto do rosto. */
  function idCard(j) {
    const c = S.accounts.client(j.client), me = pr();
    return `
      <div class="id-card">
        ${ui.face({ name: j.client, hue: c ? 230 + (c.cpf.charCodeAt(3) % 30) : 240 }, 64, 'big')}
        <div class="id-main"><small>Confira o rosto na chegada</small><strong>${esc(j.client)}</strong><span>CPF ${c ? S.cpf.hidden(c.cpf) : 'não informado'} · reputação ${c ? S.accounts.score(c.reputationScore) : '—'}</span></div>
        <div class="id-me">${ui.face(me, 36)}<small>Você</small></div>
      </div>`;
  }

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
          <div class="req-head"><span class="tag ok">${j.fromChat ? 'Proposta aceita' : 'Em atendimento'}</span><span class="req-dist" id="job-status">${esc(s.label)}</span></div>
          <h3>${esc(j.service)}</h3>
          ${jobLine(j)}
          ${idCard(j)}
          <ol class="steps">${STEPS.map((t, i) => `<li class="${i < s.step ? 'done' : i === s.step ? 'now' : ''}"><span class="bullet">${i < s.step ? icon('check') : ''}</span><span>${t}</span></li>`).join('')}</ol>
          <div class="earn-inline">${icon('shield-check')}<span>Você recebe <strong>${money(j.amounts.providerNetAmount)}</strong> · pagamento garantido pela plataforma</span></div>
          <button class="btn btn-primary btn-block btn-lg" data-action="pro-advance">${icon(s.ic)}${s.cta}</button>
          ${rt.queue.length ? `<p class="hint">${rt.queue.length === 1 ? 'Há mais 1 atendimento na fila' : `Há mais ${rt.queue.length} atendimentos na fila`}, de propostas aceitas no chat.</p>` : ''}
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
          ${earnHtml(j.amounts)}
          <div class="row-2">
            <button class="btn btn-soft" data-action="pro-decline">Recusar</button>
            <button class="btn btn-primary" data-action="pro-accept">Aceitar</button>
          </div>
        </div>`;
    }
    if (p.online) {
      return `
        <div class="radar-card">
          ${ui.loader(52)}
          <div><h3>Procurando solicitações</h3><p>Você aparece para clientes em um raio de ${S.config.coverageKm} km.</p></div>
        </div>`;
    }
    return `
      <div class="empty-card">
        ${ui.mascot('empty', 76)}
        <h3>Você está offline</h3>
        <p>Fique online para receber solicitações de clientes próximos.</p>
        <button class="btn btn-primary btn-block" data-action="pro-toggle">Ficar online</button>
      </div>`;
  }

  function kpisHtml() {
    const t = todayStats(), s = S.db.stats('me');
    return `
      <div><small>Ganhos hoje</small><strong>${money(t.net)}</strong></div>
      <div><small>Serviços hoje</small><strong>${t.count}</strong></div>
      <div><small>Avaliação</small><strong>${ui.rating(s.rating || S.data.me.rating)}</strong></div>`;
  }

  const chipText = () => (rt.active ? 'Rota até o cliente' : rt.incoming ? 'Cliente a ' + km(rt.incoming.km) : pr().online ? 'Área de atendimento' : 'Você está offline');

  /* ---------- Mapa ---------- */

  function paintMap() {
    const v = rt.view;
    if (!v || !v.map) return;
    const loc = st().location, job = rt.active || rt.incoming, colors = S.map.routeColors();
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
      S.map.line(v.layer, job.route.points, colors[1], 5);
      v.lineLeft = S.map.line(v.layer, job.route.points, colors[0], 5);
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

  /* Conclusão: o valor líquido entra no saldo, o trabalho entra no banco de trabalhos realizados,
     o repasse ganha comprovante e o profissional avalia o cliente (nota, adimplência e fotos do serviço). */
  function completeJob() {
    const job = rt.active, p = pr(), a = job.amounts, now = Date.now(), who = job.client.split(' ');
    const entry = Object.assign({ id: S.store.nextId('j'), client: job.client, service: job.service, at: now, chatId: job.chatId || null }, a);
    p.jobs.unshift(entry);
    p.balance = S.pricing.round2(p.balance + a.providerNetAmount);
    S.store.save();
    const jobId = 'me-' + job.id;
    S.db.add({
      id: jobId, proId: 'me', cat: p.cat, kind: 'Atendimentos recentes', title: job.service, device: '', brand: '', model: '', problem: '',
      price: a.clientServiceAmount, min: null, doneAt: now, rating: 5, review: '', client: who[0] + ' ' + who[who.length - 1][0] + '.', source: 'app'
    });
    S.accounts.rateMe('provider', 5, true);   // o cliente (simulado) avalia o profissional
    if (job.chatId) S.chat.proReceipt(job.chatId, entry);
    rt.active = rt.queue.shift() || null;
    if (rt.active) rt.active.status = 'accepted';
    paint();
    rateClient(job, entry, jobId);
    if (!rt.active) schedule(9000);
  }

  /* O profissional avalia o cliente: nota, se o combinado foi honrado e fotos do serviço (antes e depois). */
  function rateClient(job, entry, jobId) {
    const c = S.accounts.client(job.client);
    let stars = 5, paidOk = true, photos = [];
    const drawPhotos = () => {
      const box = document.getElementById('rc-photos');
      if (box) box.innerHTML = photos.map((src, i) => `<span class="up-thumb"><img src="${src}" alt="Foto ${i + 1} do serviço"><button data-action="rc-photo-del" data-arg="${i}" aria-label="Remover foto">${icon('x')}</button></span>`).join('');
      ui.refreshIcons();
    };
    ui.sheet.open(`
      <div class="rate">
        <span class="match-ok">${icon('circle-check')}</span>
        <h3>Serviço concluído</h3>
        <p class="muted">${esc(job.service)}</p>
        ${earnHtml(job.amounts)}
        <div class="rate-pro">${ui.face({ name: job.client }, 52)}<strong>Como foi atender ${esc(ui.first(job.client))}?</strong></div>
        <div class="rate-stars" id="rc-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="on" data-action="rc-star" data-arg="${n}" aria-label="${n} estrelas">${icon('star')}</button>`).join('')}</div>
        <div class="seg paid-seg" id="rc-paid" role="radiogroup" aria-label="O cliente honrou o combinado?">
          <button class="active" data-action="rc-paid" data-arg="1">Pagamento e combinado honrados</button>
          <button data-action="rc-paid" data-arg="0">Houve calote ou contestação</button>
        </div>
        <div class="up-box">
          <div class="up-head"><strong>Fotos do serviço</strong><small>Antes e depois. Elas aparecem no seu perfil, junto com a avaliação.</small></div>
          <div class="up-list" id="rc-photos"></div>
          <button class="btn btn-soft btn-sm" data-action="rc-photo-add">${icon('camera')}Adicionar fotos</button>
        </div>
        <button class="btn btn-primary btn-block btn-lg" data-action="rc-send">Enviar avaliação</button>
        <button class="btn btn-ghost btn-block btn-sm" data-action="rc-receipt">${icon('file-check-2')}Ver comprovante de recebimento</button>
      </div>`);
    A['rc-star'] = (el) => { stars = +el.dataset.arg; document.querySelectorAll('#rc-stars button').forEach((b, i) => b.classList.toggle('on', i < stars)); };
    A['rc-paid'] = (el) => { paidOk = el.dataset.arg === '1'; document.querySelectorAll('#rc-paid button').forEach((b) => b.classList.toggle('active', b === el)); };
    A['rc-photo-add'] = async () => { photos = photos.concat(await S.media.pick({ multiple: true, limit: 6 - photos.length })).slice(0, 6); drawPhotos(); };
    A['rc-photo-del'] = (el) => { photos.splice(+el.dataset.arg, 1); drawPhotos(); };
    A['rc-receipt'] = () => S.receipts.open(S.receipts.fromLedger(entry));
    A['rc-send'] = () => {
      if (c) {
        const after = S.accounts.rate(c.cpf, stars, paidOk);
        if (!paidOk) ui.toast(after && after.cpfStatus === 'blocked_debtor' ? 'Ocorrência registrada. O CPF do cliente foi bloqueado para novas contratações.' : 'Ocorrência de inadimplência registrada no CPF do cliente.', 'info');
      }
      if (photos.length) S.media.save(photos, { owner: 'me', kind: 'job', jobId, by: 'provider' });
      ui.sheet.close();
      if (paidOk) ui.toast('Avaliação registrada. Obrigado!', 'ok');
    };
  }

  A['pro-toggle'] = () => {
    const p = pr();
    if (p.online && rt.active) return ui.toast('Conclua o atendimento atual antes de ficar offline.', 'info');
    if (!p.online && !S.guard.allow('serve')) return;
    p.online = !p.online;
    S.store.save();
    clearTimers();
    rt.incoming = null;
    if (p.online && !rt.active) schedule(3500);
    if (p.online) S.chat.lead();
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
    if (!S.guard.allow('serve') || !S.guard.counterpart(S.accounts.client(rt.incoming.client))) return;
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

  A['open-my-jobs'] = () => {
    const jobs = S.db.byPro('me'), s = S.db.stats('me');
    ui.sheet.open(`
      <div class="sheet-head"><h3>Meus trabalhos realizados</h3><button class="icon-btn soft" data-action="sheet-close" aria-label="Fechar">${icon('x')}</button></div>
      <div class="db-stats">
        <div><strong>${s.count}</strong><small>trabalhos no histórico</small></div>
        <div><strong>${ui.rating(s.rating)}</strong><small>avaliação média</small></div>
      </div>
      <p class="muted">É este histórico que os clientes veem no seu perfil. A busca da FixUp também usa esses registros para indicar você a quem tem um problema parecido.</p>
      <div class="kinds">${S.db.kinds('me').map((k) => `<span>${esc(k.label)}<b>${k.count}</b></span>`).join('')}</div>
      <div class="jobs">${jobs.slice(0, 40).map((j) => ui.jobCard(j, null, { provider: true })).join('')}</div>`);
  };

  S.proSim = {
    /** Uma proposta enviada pelo chat foi aceita e paga: vira um atendimento (ou entra na fila). */
    fromProposal(o) {
      const job = newJob({ client: o.client, address: o.address, service: o.service, km: o.km, amounts: o.amounts, chatId: o.chatId, fromChat: true });
      if (rt.active) { rt.queue.push(job); paint(); return; }
      clearTimeout(rt.timer);
      clearTimeout(rt.expire);
      rt.incoming = null;
      rt.active = job;
      job.status = 'accepted';
      paint();
    },

    /** Encerra a sessão do profissional (troca de modo ou restauração da demonstração). */
    reset() {
      clearTimers();
      rt.incoming = null;
      rt.active = null;
      rt.queue = [];
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
              ${ui.face(p, 44)}
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
          <div class="fee-note">${icon('wallet')}<span>Sem mensalidade. Os valores que você vê são sempre o <strong>líquido</strong> que entra no seu saldo.</span></div>
        </section>
        <div class="spacer"></div>`;
    },

    mount(root) {
      const loc = st().location, color = S.map.routeColors()[0];
      const map = S.map.create(root.querySelector('#pro-map'), loc, 12, { interactive: false });
      rt.view = { root, map, layer: null, self: null, circle: null, lineLeft: null };
      if (map) {
        rt.view.circle = window.L.circle(S.map.ll(loc), { radius: S.config.coverageKm * 1000, color, weight: 1.5, fillColor: color, fillOpacity: 0.07, interactive: false }).addTo(map);
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
        net: jobs.reduce((s, j) => s + j.providerNetAmount, 0)
      });
    }
    return days;
  }

  screens.proEarnings = {
    tab: 'earnings', mode: 'pro',

    render() {
      const p = pr(), week = weekData();
      const max = Math.max.apply(null, week.map((x) => x.net).concat(1));
      const sum = { net: week.reduce((a, x) => a + x.net, 0), count: p.jobs.filter((j) => j.at >= Date.now() - 7 * 864e5).length };
      const entries = p.jobs.map((j) => ({ at: j.at, job: j })).concat(p.withdrawals.map((w) => ({ at: w.at, wd: w }))).sort((a, b) => b.at - a.at);
      const entryRow = (e) => (e.job ? `
        <button class="tx tx-btn" data-action="rcpt-ledger" data-arg="${esc(e.job.id)}" title="Ver comprovante de recebimento">
          <span class="row-ic in">${icon('arrow-down-left')}</span>
          <span class="row-main"><strong>${esc(e.job.service)}</strong><small>${ui.day(e.at)} · ${esc(e.job.client)} · comprovante</small></span>
          <b class="pos">+ ${money(e.job.providerNetAmount)}</b>
        </button>` : `
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
              <div><dt>Serviços concluídos</dt><dd>${sum.count}</dd></div>
              <div class="bill-total"><dt>Você recebeu</dt><dd>${money(sum.net)}</dd></div>
            </dl>
          </div>
        </section>

        <section class="section">
          <div class="fee-note">${icon('wallet')}<span>Sem mensalidade e sem taxa de saque. Cada valor aqui já é o líquido que você recebe. Toque em um serviço para ver o comprovante de recebimento.</span></div>
        </section>

        <section class="section">
          <h3 class="h3">Histórico financeiro</h3>
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
})(window.FixUp = window.FixUp || {});
