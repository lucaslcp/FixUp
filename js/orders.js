/* FixUp — pedidos e simulação do atendimento.
   Um pedido nasce de um serviço de catálogo ou de uma proposta aceita no chat.
   A simulação faz o papel do profissional real: aceita, se desloca pela rota e conclui.
   Em produção, estas mudanças de status e de posição chegariam do app do profissional
   em tempo real (WebSocket / push), com o GPS dele enviando a posição. */
(function (S) {
  'use strict';

  const FINAL = ['completed', 'cancelled'];
  const CANCELLABLE = ['scheduled', 'searching', 'accepted', 'on_the_way'];
  /* Duração de cada etapa na demonstração (ms). O trajeto real levaria minutos. */
  const TIMES = { searching: 2800, accepted: 2200, travel: 24000, arrived: 3500, in_progress: 7000 };
  const NEXT = { searching: 'accepted', accepted: 'on_the_way', arrived: 'in_progress', in_progress: 'awaiting' };

  const LABELS = {
    scheduled: 'Agendado', searching: 'Aguardando profissional', accepted: 'Aceito', on_the_way: 'A caminho', arrived: 'No local',
    in_progress: 'Em andamento', awaiting: 'Aguardando confirmação', completed: 'Concluído', cancelled: 'Cancelado'
  };

  const listeners = new Set();
  const live = {};   // dados em tempo real por pedido: rota, posição, tempo restante

  /* Percorre uma cópia: uma tela pode se redesenhar (e trocar o próprio ouvinte) durante o aviso. */
  const emit = (order, tick) => Array.from(listeners).forEach((fn) => fn(order, live[order.id], !!tick));

  function setStatus(order, status) {
    order.status = status;
    order.timeline.push({ status, at: Date.now() });
    S.store.save();
    emit(order);
  }

  function stop(order) {
    const rt = live[order.id];
    if (!rt) return;
    clearTimeout(rt.timer);
    clearInterval(rt.tick);
  }

  const liveOf = (order) => live[order.id] || (live[order.id] = { pos: null, route: null, etaMin: order.etaMin, kmLeft: order.km });

  /* Pedido agendado: o profissional confirma o horário e, no dia, sai para o atendimento a tempo de
     chegar na hora marcada. Até lá o pedido fica parado, com o pagamento retido. */
  function waitForDay(order) {
    const rt = liveOf(order);
    clearTimeout(rt.timer);
    clearInterval(rt.tick);
    if (!order.confirmedAt) {
      rt.timer = setTimeout(() => {
        order.confirmedAt = Date.now();
        S.store.save();
        emit(order);
        if (S.chat) S.chat.note(order.proId, `Agendamento confirmado: ${S.ui.when(order.scheduledFor)}.`);
        waitForDay(order);
      }, TIMES.searching);
      return;
    }
    const delay = order.scheduledFor - order.etaMin * 60e3 - Date.now();
    if (delay <= 0) { setStatus(order, 'accepted'); run(order); return; }
    rt.timer = setTimeout(() => waitForDay(order), Math.min(delay, 2147483000));   // limite do setTimeout (~24 dias)
  }

  function run(order) {
    if (FINAL.includes(order.status)) return;
    if (order.status === 'scheduled') return waitForDay(order);
    const rt = liveOf(order);
    clearTimeout(rt.timer);
    clearInterval(rt.tick);

    if (!rt.routeJob) {
      rt.routeJob = S.geo.route(order.proStart, order.address).then((r) => {
        rt.route = r;
        rt.pos = S.geo.along(r.points, order.progress || 0);
        emit(order);
      });
    }

    if (order.status === 'on_the_way') {
      const from = order.progress || 0, t0 = Date.now(), dur = TIMES.travel * (1 - from);
      rt.tick = setInterval(() => {
        const t = Math.min(1, from + (1 - from) * ((Date.now() - t0) / dur));
        order.progress = t;
        if (rt.route) rt.pos = S.geo.along(rt.route.points, t);
        rt.etaMin = Math.max(1, Math.ceil(order.etaMin * (1 - t)));
        rt.kmLeft = order.km * (1 - t);
        emit(order, true);
        if (t >= 1) { clearInterval(rt.tick); setStatus(order, 'arrived'); run(order); }
      }, 80);
    } else if (NEXT[order.status]) {
      rt.timer = setTimeout(() => { setStatus(order, NEXT[order.status]); run(order); }, TIMES[order.status]);
    }
  }

  S.sim = {
    on: (fn) => listeners.add(fn),
    off: (fn) => listeners.delete(fn),
    live: (id) => live[id],
    resumeAll() { S.orders.all().forEach(run); },
    stopAll() { S.orders.all().forEach(stop); }
  };

  S.orders = {
    all: () => S.store.state.orders,
    get(id) { return this.all().find((o) => o.id === id); },
    /** Pedido em andamento agora (os agendados para outro momento não contam). */
    active() { return this.all().find((o) => !FINAL.includes(o.status) && o.status !== 'scheduled'); },
    /** Pedidos agendados, do mais próximo para o mais distante. */
    scheduled() { return this.all().filter((o) => o.status === 'scheduled').sort((a, b) => a.scheduledFor - b.scheduledFor); },
    isFinal: (o) => FINAL.includes(o.status),
    canCancel: (o) => CANCELLABLE.includes(o.status),
    label: (status) => LABELS[status] || status,

    /** Cria o pedido e retém o pagamento.
        draft = { proId, serviceId, note, method, routeKm } para um serviço de catálogo,
             ou { proId, proposal, method } para uma proposta combinada no chat.
        Com draft.scheduledFor (data e hora), o pedido fica agendado em vez de começar agora.
        Os valores seguem o preço cego (S.pricing): o pedido guarda os três, cada tela mostra só o seu.
        Os nomes e CPFs das partes ficam registrados no momento do pagamento, para os comprovantes. */
    create(draft) {
      const st = S.store.state, pro = S.data.pro(draft.proId), custom = draft.proposal || null;
      const svc = custom ? null : pro.services.find((s) => s.id === draft.serviceId);
      const loc = st.location, now = Date.now();
      const routeKm = draft.routeKm != null ? draft.routeKm : pro.km;
      const amounts = custom ? custom.amounts : S.pricing.fromClientPrice(svc.price, S.pricing.defaultDisplacement(routeKm), routeKm);
      const order = {
        id: S.store.nextId('o'), code: 'FX-' + (1000 + Math.floor(Math.random() * 9000)),
        proId: pro.id, catId: pro.cat, serviceId: svc ? svc.id : null, custom: !!custom,
        serviceName: custom ? custom.title : svc.name, note: custom ? custom.desc : (draft.note || '').trim(),
        address: { lat: loc.lat, lng: loc.lng, label: loc.label, sub: loc.sub },
        proStart: { lat: pro.pos.lat, lng: pro.pos.lng }, km: pro.km, etaMin: pro.eta,
        amounts, method: draft.method,
        parties: { client: { name: st.user.name, cpf: st.user.cpf }, provider: { name: pro.name, cpf: S.cpf.fromSeed('pro:' + pro.id) } },
        status: draft.scheduledFor ? 'scheduled' : 'searching', scheduledFor: draft.scheduledFor || null, confirmedAt: null,
        progress: 0, createdAt: now, timeline: [{ status: draft.scheduledFor ? 'scheduled' : 'searching', at: now }],
        payStatus: 'held', rating: null
      };
      st.orders.unshift(order);
      S.pay.hold(order);
      S.store.save();
      run(order);
      return order;
    },

    /** O cliente confirma a conclusão: o pagamento retido é liberado e o trabalho entra no banco. */
    confirm(order) {
      stop(order);
      S.pay.release(order);
      const user = S.store.state.user.name.split(' ');
      order.jobId = 'app-' + order.id;
      S.db.add({
        id: order.jobId, proId: order.proId, cat: order.catId, kind: S.data.cat(order.catId).short.replace('­', ''),
        title: order.serviceName, device: '', brand: '', model: '', problem: order.note || '',
        price: order.amounts.clientServiceAmount, min: null, doneAt: Date.now(), rating: null, review: '',
        client: user[0] + ' ' + user[user.length - 1][0] + '.', source: 'app', orderId: order.id
      });
      setStatus(order, 'completed');
      if (S.chat) S.chat.receipt(order.proId, order.id);
    },

    /** Muda o dia e o horário de um pedido agendado. O profissional confirma o novo horário. */
    reschedule(order, when) {
      if (order.status !== 'scheduled') return;
      order.scheduledFor = when;
      order.confirmedAt = null;
      order.timeline.push({ status: 'rescheduled', at: Date.now() });
      S.store.save();
      emit(order);
      run(order);
    },

    /** Demonstração: adianta um pedido agendado para o dia do serviço (o profissional sai agora). */
    startNow(order) {
      if (order.status !== 'scheduled') return;
      stop(order);
      if (!order.confirmedAt) order.confirmedAt = Date.now();
      setStatus(order, 'accepted');
      run(order);
    },

    cancel(order) {
      stop(order);
      S.pay.refund(order);
      setStatus(order, 'cancelled');
      if (S.chat) S.chat.note(order.proId, 'Pedido cancelado. O valor foi estornado.');
    },

    /** Avaliação dos dois lados. A do cliente vai para o registro do trabalho no banco e para a reputação
        do CPF do profissional; em seguida o profissional (simulado) avalia o cliente. */
    rate(order, rating) {
      order.rating = rating;
      S.store.save();
      if (order.jobId) S.db.update(order.jobId, { rating: rating.stars, review: rating.comment || '' });
      S.accounts.rate(order.parties.provider.cpf, rating.stars, true);
      S.accounts.rateMe('client', 5, true);
    }
  };
})(window.FixUp = window.FixUp || {});
