/* FixUp — chat com proposta personalizada.
   Cliente e profissional combinam o que não cabe em um serviço de preço fechado: mais de um item
   na mesma visita, um conserto específico, prazo e valor. O profissional envia uma proposta; o
   cliente aceita e paga pelo app, e o valor fica retido como em qualquer pedido.

   Nesta demonstração o outro lado da conversa é simulado:
   - no modo cliente, o profissional responde sozinho. Ele lê a mensagem com a busca por problema
     (js/match.js), consulta os trabalhos que já fez e o catálogo dele e monta a proposta;
   - no modo profissional, o cliente responde às perguntas e aceita a proposta se o valor couber
     no orçamento dele.
   Em produção, as mensagens trafegam por WebSocket entre os dois aplicativos. */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, money = ui.money, icon = ui.icon, avatar = ui.avatar;
  const A = S.actions, I = S.inputs, screens = S.screens;
  const st = () => S.store.state;
  const round5 = (n) => Math.round(n / 5) * 5;
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const joinList = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0]);

  const listeners = new Set();
  let typing = {};          // conversas em que o outro lado está escrevendo
  let viewing = null;       // conversa aberta na tela
  let epoch = 0;            // muda quando a demonstração é restaurada: respostas pendentes são descartadas

  function emit(key) {
    Array.from(listeners).forEach((fn) => fn(key));
    if (S.app) S.app.syncTabs();   // atualiza o ponto de "não lidas" na aba Conversas
  }

  function push(c, key, msg) {
    msg.id = S.store.nextId('m');
    msg.at = Date.now();
    c.messages.push(msg);
    c.updatedAt = msg.at;
    if (msg.from === 'them' && viewing !== key) c.unread = (c.unread || 0) + 1;
    S.store.save();
    emit(key);
    return msg;
  }

  /** Resposta do outro lado depois de um tempo, com o indicador de "escrevendo". */
  function later(key, ms, fn) {
    const at = epoch;
    typing[key] = (typing[key] || 0) + 1;
    emit(key);
    setTimeout(() => {
      if (at !== epoch) return;
      typing[key] -= 1;
      fn();
      emit(key);
    }, ms);
  }

  const note = (c, key, text) => push(c, key, { from: 'sys', type: 'system', text });
  const pendingOf = (c) => c.messages.filter((m) => m.type === 'proposal' && m.proposal.status === 'pending').pop() || null;
  const retire = (c, status) => c.messages.forEach((m) => { if (m.type === 'proposal' && m.proposal.status === 'pending') m.proposal.status = status; });

  /* =====================================================================
     Blocos da conversa
     ===================================================================== */

  const P_STATUS = { pending: ['wait', 'Aguardando aceite'], accepted: ['ok', 'Aceita'], declined: ['off', 'Recusada'], replaced: ['off', 'Substituída'], cancelled: ['off', 'Cancelada'] };

  /* Preço cego: o cliente vê o total que paga; o profissional vê só o líquido que recebe. */
  const amountOf = (p, view) => (p.amounts ? (view === 'provider' ? p.amounts.providerNetAmount : p.amounts.clientTotalAmount) : p.price);

  function travelLine(p) {
    const a = p.amounts;
    if (!a || a.routeKm == null) return '';
    return a.displacementFee > 0
      ? `<span class="pp-travel">${icon('route')}Inclui deslocamento de ${money(a.displacementFee)} · ${ui.km(a.routeKm)} pela rota</span>`
      : `<span class="pp-travel">${icon('route')}Deslocamento grátis · ${ui.km(a.routeKm)} pela rota</span>`;
  }

  function proposalCard(m, footer, view) {
    const p = m.proposal, s = P_STATUS[p.status] || P_STATUS.pending;
    return `
      <article class="proposal ${p.status}">
        <div class="pp-top"><span class="pp-label">${icon('file-text')}Proposta personalizada</span><span class="pp-status ${s[0]}">${s[1]}</span></div>
        <h4>${esc(p.title)}</h4>
        <p class="pp-desc">${esc(p.desc)}</p>
        ${travelLine(p)}
        <div class="pp-line"><span class="pp-when">${icon('clock')}${esc(p.when)}</span><span class="pp-amount">${view === 'provider' ? '<small>Você recebe</small>' : ''}<strong>${money(amountOf(p, view))}</strong></span></div>
        ${footer || ''}
      </article>`;
  }

  /* Confirmação de pagamento e repasse liquidados, com o comprovante. */
  function receiptCard(m) {
    const r = m.receipt, provider = r.kind === 'ledger';
    return `
      <article class="chat-rcpt">
        <div class="cr-top">${ui.mascot('badge', 34)}<div><strong>${provider ? 'Repasse liquidado com sucesso' : 'Pagamento liquidado com sucesso'}</strong><small>${esc(r.service)} · ${money(r.amount)}</small></div></div>
        <p>${provider ? 'O valor já está no seu saldo. O comprovante de recebimento tem código de autenticação.' : 'O serviço foi concluído e o pagamento, liberado. O comprovante tem código de autenticação.'}</p>
        ${S.receipts.buttons(r.kind, r.id)}
      </article>`;
  }

  function bubbles(c, key, proposalHtml, intro) {
    const list = c ? c.messages : [];
    const html = list.map((m) => {
      if (m.type === 'system') return `<div class="msg-sys">${icon('shield-check')}<span>${esc(m.text)}</span></div>`;
      if (m.type === 'proposal') return proposalHtml(m);
      if (m.type === 'receipt') return receiptCard(m);
      return `<div class="msg ${m.from === 'me' ? 'me' : 'them'}"><p>${esc(m.text)}</p></div>`;
    }).join('');
    return (list.length ? html : intro) + (typing[key] > 0 ? '<div class="msg them typing" aria-label="Escrevendo"><i></i><i></i><i></i></div>' : '');
  }

  const shell = (o) => `
    <div class="chat">
      <header class="chat-head">
        <button class="icon-btn soft round" data-action="back" aria-label="Voltar">${icon('arrow-left')}</button>
        <div class="chat-id"><strong>${esc(o.title)}</strong><small>${esc(o.sub)}</small></div>
        ${o.right || ''}
      </header>
      <div class="chat-body" id="chat-body"></div>
      <div class="chat-quick" id="chat-quick"></div>
      <div class="chat-compose">
        <input id="chat-text" type="text" autocomplete="off" enterkeyhint="send" placeholder="${esc(o.placeholder)}" value="${esc(o.draft || '')}" data-enter="chat-send">
        <button class="icon-btn primary send" data-action="chat-send" aria-label="Enviar">${icon('send')}</button>
      </div>
    </div>`;

  const quickHtml = (list) => list.map((t) => (t.action
    ? `<button class="chip sm strong" data-action="${t.action}">${icon(t.icon)}${esc(t.label)}</button>`
    : `<button class="chip sm" data-action="chat-quick" data-arg="${esc(t)}">${esc(t)}</button>`)).join('');

  function preview(c, view) {
    const m = c.messages[c.messages.length - 1];
    if (!m) return 'Nenhuma mensagem ainda';
    if (m.type === 'proposal') return `Proposta: ${m.proposal.title} · ${money(amountOf(m.proposal, view))}`;
    if (m.type === 'receipt') return m.receipt.kind === 'ledger' ? 'Repasse liquidado · comprovante disponível' : 'Pagamento liquidado · comprovante disponível';
    return (m.from === 'me' ? 'Você: ' : '') + m.text;
  }

  /* Lista + detalhe: no celular aparece um de cada vez; em telas largas, lado a lado. */
  const md = (list, detail, open) => `<div class="md${open ? ' has-detail' : ''}"><aside class="md-list">${list}</aside><section class="md-detail">${detail}</section></div>`;
  const pickOne = (text) => `<div class="md-empty">${ui.mascot('empty', 76)}<h3>Escolha uma conversa</h3><p>${text}</p></div>`;

  /** Mantém a lista ao lado atualizada enquanto uma conversa está aberta. */
  function keepList(root, html) {
    const fn = () => { const el = root.querySelector('.md-list'); if (el) { el.innerHTML = html(); ui.refreshIcons(); } };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  const chatRow = (path, who, sub, c, active, view) => `
    <button class="chat-row${c.unread ? ' unread' : ''}${active ? ' active' : ''}" data-go="${path}">
      ${avatar(who, 50)}
      <span class="row-main"><strong>${esc(who.name)}</strong><small class="cr-sub">${esc(sub)}</small><small class="cr-last">${esc(preview(c, view))}</small></span>
      <span class="chat-side"><small>${ui.day(c.updatedAt) === 'Hoje' ? ui.time(c.updatedAt) : ui.day(c.updatedAt)}</small>${c.unread ? `<i class="count">${c.unread}</i>` : ''}</span>
    </button>`;

  /** Liga a tela à conversa: redesenha quando chega mensagem e marca como lida. */
  function attach(root, key, getChat, draw) {
    const body = root.querySelector('#chat-body'), quick = root.querySelector('#chat-quick');
    viewing = key;
    const paint = (k) => {
      if (k !== key) return;
      const c = getChat();
      if (c && c.unread) { c.unread = 0; S.store.save(); S.app.syncTabs(); }
      const parts = draw(c);
      body.innerHTML = parts.body;
      quick.innerHTML = quickHtml(parts.quick);
      ui.refreshIcons();
      body.scrollTop = body.scrollHeight;
    };
    listeners.add(paint);
    paint(key);
    return () => { listeners.delete(paint); if (viewing === key) viewing = null; };
  }

  /* =====================================================================
     Modo cliente: conversa com o profissional
     ===================================================================== */

  const cKey = (proId) => 'c:' + proId;

  function chatOf(proId, create) {
    let c = st().chats.find((x) => x.proId === proId);
    if (!c && create) {
      c = { proId, messages: [], scope: [], misses: 0, unread: 0, updatedAt: Date.now() };
      st().chats.unshift(c);
    }
    return c;
  }

  const whenOf = (pro) => (pro.availableNow ? 'Hoje em ~1h' : `Hoje em ~${Math.max(2, Math.ceil((pro.wait + 50) / 60))}h`);

  function sendOffer(c, pro, price, base, intro) {
    const items = c.scope, key = cKey(pro.id);
    const names = items.map((it) => it.desc || lowerFirst(it.name));
    retire(c, 'replaced');
    push(c, key, { from: 'them', type: 'text', text: intro });
    later(key, 1000, () => push(c, key, {
      from: 'them', type: 'proposal',
      proposal: {
        title: items.map((it, i) => (i ? lowerFirst(it.name) : it.name)).join(' + '), price, base, when: whenOf(pro), status: 'pending',
        amounts: S.pricing.fromClientPrice(price, S.pricing.defaultDisplacement(pro.km), pro.km),
        desc: `Inclui ${joinList(names)}${items.length > 1 ? ', tudo na mesma visita' : ''}, com material básico, teste no final e garantia de 90 dias.`
      }
    }));
  }

  function propose(c, pro, need) {
    const before = c.scope.length;
    need.items.forEach((it) => { if (!c.scope.some((s) => s.key === it.key)) c.scope.push(it); });
    if (c.scope.length > 3) c.scope = c.scope.slice(-3);
    if (c.scope.length === before && pendingOf(c)) {
      return push(c, cKey(pro.id), { from: 'them', type: 'text', text: 'Esse serviço já está na proposta acima. Quer incluir mais alguma coisa ou ajustar o prazo?' });
    }
    const sum = c.scope.reduce((s, it) => s + it.price, 0);
    const base = round5(sum * (c.scope.length > 1 ? 0.88 : 1));
    let intro = 'Faço sim! Segue minha proposta com tudo incluso:';
    if (before && c.scope.length > before) intro = 'Consigo sim! Como já vou estar aí com as ferramentas, fecho tudo junto em uma proposta única pra você.';
    else if (need.count) intro = `Já fiz esse tipo de serviço ${need.count === 1 ? 'uma vez' : need.count + ' vezes'} pela FixUp. O mais recente foi “${ui.jobTitle(need.example)}”, ${ui.ago(need.example.doneAt)}. Segue minha proposta:`;
    sendOffer(c, pro, base, base, intro);
  }

  /** Valor citado pelo cliente ("faz por 120?", "R$ 120"). */
  function parseOffer(text) {
    const m = String(text).toLowerCase().match(/(?:r\$\s*|por\s+|pago\s+)(\d{2,4})(?!\s*(?:min|h\b|hora|dia))|(\d{2,4})(?:[.,]\d{1,2})?\s*(?:reais|conto|pila)/);
    const v = m ? +(m[1] || m[2]) : 0;
    return v >= 20 && v <= 5000 ? v : 0;
  }

  function counter(c, pro, m, offer) {
    const p = m.proposal, key = cKey(pro.id), floor = round5((p.base || p.price) * 0.88);
    const say = (text) => push(c, key, { from: 'them', type: 'text', text });
    if (offer && offer >= p.price) return say(`A proposta já está em ${money(p.price)}. É só aceitar por aqui que eu me organizo para ir.`);
    if (offer && offer >= floor) return sendOffer(c, pro, offer, p.base || p.price, `Fechado por ${money(offer)}! Atualizei a proposta.`);
    if (p.price <= floor) return say('Esse já é o meu melhor valor, considerando material, deslocamento e garantia. Se preferir, posso reduzir o escopo.');
    let np = Math.max(floor, round5(p.price * 0.94));
    if (np >= p.price) np = floor;
    sendOffer(c, pro, np, p.base || p.price, offer
      ? `Por ${money(offer)} eu não consigo, por causa do material e do deslocamento. O melhor que eu chego é ${money(np)}, fechando agora.`
      : `Consigo um desconto se fecharmos agora: ${money(np)}. Atualizei a proposta.`);
  }

  function orderReply(o, pro) {
    const rt = S.sim.live(o.id);
    if (o.status === 'on_the_way') return `Estou a caminho! Chego em cerca de ${rt && rt.etaMin ? rt.etaMin : o.etaMin} min.`;
    if (o.status === 'arrived' || o.status === 'in_progress') return 'Já estou no local cuidando do serviço.';
    if (o.status === 'awaiting') return 'Serviço finalizado! Quando puder, confirme a conclusão no app para liberar o pagamento.';
    return `Recebi seu pedido e já estou me preparando para sair. Estou a ${ui.km(pro.km)} de você.`;
  }

  /* O profissional simulado responde à mensagem do cliente. */
  function reply(c, text) {
    const pro = S.data.pro(c.proId);
    if (!pro) return;
    const key = cKey(pro.id), n = ' ' + S.match.norm(text) + ' ', has = (re) => re.test(n);
    const say = (t) => push(c, key, { from: 'them', type: 'text', text: t });
    const pending = pendingOf(c);

    const order = S.orders.all().find((o) => o.proId === pro.id && !S.orders.isFinal(o));
    if (order) return say(orderReply(order, pro));

    const offer = parseOffer(text);
    if (pending && (offer || has(/descont| barat| car[oa] |abaix| menos |melhor preco|negoci|faz por|fecha por/))) return counter(c, pro, pending, offer);

    const need = S.match.quoteFor(pro, text);
    if (need.items.length) { c.misses = 0; return propose(c, pro, need); }
    if (need.other) return say(`Esse tipo de serviço não é a minha área: eu atendo como ${S.data.cat(pro.cat).name.toLowerCase()}. Na busca da FixUp você encontra profissionais de ${need.other.short.replace('­', '')} que já resolveram casos assim.`);

    if (has(/garanti/)) return say('Dou 90 dias de garantia no serviço. Se o problema voltar nesse prazo, eu retorno sem custo.');
    if (has(/ pec[ao]s? |material|inclus/)) return say('O valor da proposta já inclui o material básico. Se precisar de alguma peça diferente, eu aviso antes e mando uma proposta atualizada por aqui.');
    if (has(/ pix |cartao|pagamento| pagar |dinheiro/)) return say('O pagamento é pelo app: Pix, cartão ou saldo. O valor fica retido pela FixUp e só é liberado para mim quando você confirmar que o serviço foi concluído.');
    if (has(/quando|hoje|amanha|horario|disponib|que horas| agora |pode vir|consegue vir/)) {
      return say(pro.availableNow ? `Consigo ir hoje mesmo. Estou a cerca de ${pro.eta} min de você.` : `Hoje ainda consigo: fico livre em uns ${pro.wait} min e levo cerca de ${S.geo.etaMin(pro.km)} min para chegar.`);
    }
    if (has(/obrigad|valeu|agradec/)) return say('Por nada! Qualquer coisa é só chamar por aqui.');
    if (has(/orcamento|quanto|valor|preco|custa| fica /)) {
      return say(pending ? 'A proposta acima já está com tudo incluso. Se quiser mudar o escopo ou o prazo, é só me dizer.'
        : `Claro! Para montar o orçamento, me diga o que precisa ser feito. Por exemplo: “${pro.services[0].name.toLowerCase()}”.`);
    }
    if (has(/^ (oi|ola|bom dia|boa tarde|boa noite|opa|e ai) /)) return say(`Olá, ${ui.first(st().user.name)}! Me conta o que você precisa: qual é o serviço ou o aparelho e o que está acontecendo?`);
    if (has(/ (ok|certo|combinado|fechado|beleza|perfeito|show) /)) return say('Combinado!');

    c.misses = (c.misses || 0) + 1;
    if (c.misses >= 2 && !pending) {
      const visit = pro.services.find((s) => /visita|diagn/i.test(s.name)) || pro.services[pro.services.length - 1];
      c.misses = 0;
      c.scope = [{ key: visit.id, name: visit.name, price: visit.price }];
      return sendOffer(c, pro, visit.price, visit.price, 'Para não chutar um valor, o melhor é eu ver de perto. Segue uma proposta de visita; se você fechar o serviço comigo, eu desconto esse valor.');
    }
    say('Me conta um pouco mais, por favor: o que precisa ser feito e, se for conserto, qual é o aparelho e a marca?');
  }

  function sendClient(proId, text) {
    text = String(text || '').trim();
    if (!text) return;
    const c = chatOf(proId, true), key = cKey(proId);
    push(c, key, { from: 'me', type: 'text', text });
    later(key, 1100 + Math.min(1500, text.length * 16), () => reply(c, text));
  }

  function clientParts(pro, c) {
    const key = cKey(pro.id);
    const order = S.orders.all().find((o) => o.proId === pro.id && !S.orders.isFinal(o));
    const pending = c && pendingOf(c);
    const card = (m) => {
      const p = m.proposal;
      if (p.status === 'pending') {
        return proposalCard(m, `<div class="pp-actions"><button class="btn btn-outline" data-action="proposal-decline" data-arg="${m.id}">Recusar</button><button class="btn btn-primary" data-action="proposal-accept" data-arg="${m.id}">Aceitar e pagar ${money(amountOf(p, 'client'))}</button></div>`, 'client');
      }
      const o = p.orderId && S.orders.get(p.orderId);
      return proposalCard(m, o ? `<button class="btn btn-soft btn-block btn-sm" data-go="${S.orders.isFinal(o) ? '/order/' : '/track/'}${o.id}">${S.orders.isFinal(o) ? 'Ver o pedido' : 'Acompanhar pedido'}</button>` : '', 'client');
    };
    const intro = `
      <div class="chat-intro">
        ${avatar(pro, 56)}
        <strong>Converse com ${esc(ui.first(pro.name))}</strong>
        <p>Descreva o que você precisa. ${esc(ui.first(pro.name))} responde com uma proposta personalizada, e o pagamento é feito pelo app, com o valor protegido até a conclusão.</p>
      </div>`;
    return {
      body: bubbles(c, key, card, intro),
      quick: order ? ['Quanto tempo falta?', 'Pode subir, estou em casa'] : pending ? ['Consegue um desconto?', 'Tem garantia?', 'Pode ser hoje?'] : ['Quero um orçamento', 'Tem disponibilidade hoje?', 'O material está incluso?']
    };
  }

  function clientList(activeId) {
    const list = st().chats.filter((c) => S.data.pro(c.proId)).sort((a, b) => b.updatedAt - a.updatedAt);
    return `
      <header class="topbar plain"><h1>Conversas</h1></header>
      <section class="section first">
        ${list.length ? `<div class="list">${list.map((c) => { const p = S.data.pro(c.proId); return chatRow('/chat/' + p.id, p, S.data.cat(p.cat).name, c, p.id === activeId, 'client'); }).join('')}</div>` : `
        <div class="empty small">${ui.mascot('empty', 76)}<h3>Nenhuma conversa ainda</h3>
          <p class="muted">Abra o perfil de um profissional e toque em “Conversar” para pedir um orçamento sob medida.</p>
          <button class="btn btn-soft" data-go="/search?focus=1">Buscar profissionais</button></div>`}
      </section>
      <section class="section"><p class="note">${icon('shield-check')}<span>Combine tudo por aqui. Propostas aceitas no chat são pagas pelo app e ficam protegidas até a conclusão do serviço.</span></p></section>
      <div class="spacer"></div>`;
  }

  screens.chats = {
    tab: 'chats', mode: 'client',

    render() {
      return md(clientList(null), pickOne('Abra uma conversa para combinar o serviço e receber uma proposta personalizada.'), false);
    },

    mount() {
      const fn = () => S.app.refresh();
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  screens.chat = {
    mode: 'client',

    render(p, q) {
      const pro = S.data.pro(p.id);
      if (!pro) return S.blocks.missing('Profissional não encontrado');
      return md(clientList(pro.id), shell({
        title: pro.name, sub: pro.pitch, draft: q.q || '', placeholder: 'Descreva o serviço, envie dúvidas ou peça orçamento…',
        right: `<button class="pill-btn" data-go="/p/${pro.id}">${icon('user')}Perfil</button>`
      }), true);
    },

    mount(root, p, q) {
      const pro = S.data.pro(p.id);
      if (!pro) return null;
      if (q.q) { const input = root.querySelector('#chat-text'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      const detach = attach(root, cKey(pro.id), () => chatOf(pro.id), (c) => clientParts(pro, c));
      const unlist = keepList(root, () => clientList(pro.id));
      const onSim = (o, rt, tick) => { if (!tick && o.proId === pro.id) emit(cKey(pro.id)); };
      S.sim.on(onSim);
      return () => { S.sim.off(onSim); unlist(); detach(); };
    }
  };

  A['proposal-decline'] = (el) => {
    const proId = S.app.current().params.id, c = chatOf(proId), key = cKey(proId);
    const m = c && c.messages.find((x) => x.id === el.dataset.arg);
    if (!m || m.proposal.status !== 'pending') return;
    m.proposal.status = 'declined';
    note(c, key, 'Você recusou a proposta.');
    later(key, 1200, () => push(c, key, { from: 'them', type: 'text', text: 'Sem problemas! Se quiser, me diga o que posso ajustar: o escopo, o prazo ou o valor.' }));
  };

  A['proposal-accept'] = (el) => {
    const proId = S.app.current().params.id, c = chatOf(proId), key = cKey(proId), pro = S.data.pro(proId);
    const m = c && c.messages.find((x) => x.id === el.dataset.arg);
    if (!m || m.proposal.status !== 'pending') return;
    const active = S.orders.active();
    if (active) { ui.toast('Você já tem um pedido em andamento.', 'info'); return S.app.go('/track/' + active.id); }
    if (!S.guard.allow('hire')) return;

    const p = m.proposal;
    if (!p.amounts) p.amounts = S.pricing.fromClientPrice(p.price, 0, pro.km);
    const total = p.amounts.clientTotalAmount;
    let method = st().wallet.defaultMethod;
    ui.sheet.open(`
      <div class="sheet-head"><h3>Pagar proposta</h3><button class="icon-btn soft" data-action="sheet-close" aria-label="Fechar">${icon('x')}</button></div>
      <div class="card summary">${avatar(pro, 46)}<span class="row-main"><strong>${esc(p.title)}</strong><small>${esc(pro.name)} · ${esc(p.when)}</small></span></div>
      <div class="card flush" id="methods">${S.pay.methods().map((x) => S.blocks.methodRow(x, method, 'pay-method')).join('')}</div>
      <div class="card">${S.blocks.bill(p.amounts)}</div>
      <p class="note">${icon('shield-check')}<span>O valor fica retido pela FixUp e só é liberado ao profissional quando você confirmar a conclusão.</span></p>
      <button class="btn btn-primary btn-block btn-lg" data-action="proposal-pay">Pagar ${money(total)}</button>`);

    A['pay-method'] = (b) => {
      method = b.dataset.arg;
      document.querySelectorAll('#methods .method').forEach((x) => x.classList.toggle('selected', x === b));
    };
    A['proposal-pay'] = (b) => {
      if (p.status !== 'pending') return ui.sheet.close();
      if (!S.pay.canPay(method, total)) return ui.toast('Saldo insuficiente. Escolha outra forma de pagamento.', 'bad');
      const finish = () => {
        const order = S.orders.create({ proId, proposal: p, method });
        p.status = 'accepted';
        p.orderId = order.id;
        c.scope = [];   // o próximo pedido nesta conversa começa um orçamento novo
        note(c, key, `Proposta aceita. ${money(total)} retidos com segurança até a conclusão.`);
        ui.sheet.close();
        S.app.go('/track/' + order.id);
        ui.toast('Pagamento aprovado. Valor protegido até a conclusão.', 'ok');
      };
      if (method === 'pix') return S.blocks.pix(total, 'Pague com Pix', finish);
      b.classList.add('loading');
      setTimeout(finish, 1400);
    };
  };

  /* =====================================================================
     Modo profissional: conversas com clientes e envio de propostas
     ===================================================================== */

  const pKey = (id) => 'p:' + id;
  const pchats = () => st().pro.chats;
  const pchat = (id) => pchats().find((c) => c.id === id);
  const WHEN = ['Hoje em ~1h', 'Hoje à tarde', 'Amanhã de manhã', 'Amanhã à tarde'];

  /* O cliente simulado responde às mensagens do profissional. */
  function clientAnswer(c, text) {
    const say = (t) => push(c, pKey(c.id), { from: 'them', type: 'text', text: t });
    if (/\?/.test(text)) {
      const fact = c.facts[c.fi];
      if (!fact) return say('Isso mesmo. Se precisar de mais algum detalhe, é só falar.');
      c.fi += 1;
      return say(fact);
    }
    if (!c.messages.some((m) => m.type === 'proposal')) return say('Combinado! Pode me mandar a proposta com o valor por aqui?');
    say('Combinado, obrigado!');
  }

  /* ...e decide se aceita a proposta: aceita quando o total (que só ele vê) cabe no orçamento dele. */
  function clientDecides(c, m) {
    const p = m.proposal, key = pKey(c.id), name = ui.first(c.client);
    later(key, 2400, () => {
      if (p.status !== 'pending') return;
      if (p.amounts.clientTotalAmount <= c.budget) {
        p.status = 'accepted';
        note(c, key, `${name} aceitou a proposta e pagou pelo app. Você recebe ${money(p.amounts.providerNetAmount)} na conclusão.`);
        push(c, key, { from: 'them', type: 'text', text: 'Fechado! Já fiz o pagamento pelo app. Te espero aqui.' });
        S.proSim.fromProposal({ client: c.client, address: c.address, km: p.amounts.routeKm || c.km, service: p.title, amounts: p.amounts, chatId: c.id });
      } else {
        p.status = 'declined';
        push(c, key, { from: 'them', type: 'text', text: 'Ficou um pouco acima do que eu esperava. Consegue baixar um pouco o valor?' });
      }
    });
  }

  function sendPro(id, text) {
    text = String(text || '').trim();
    const c = pchat(id);
    if (!text || !c) return;
    push(c, pKey(id), { from: 'me', type: 'text', text });
    later(pKey(id), 1300 + Math.min(1200, text.length * 14), () => clientAnswer(c, text));
  }

  function proParts(c) {
    const card = (m) => {
      const p = m.proposal;
      if (p.status === 'pending') {
        return proposalCard(m, `<p class="pp-earn">${icon('wallet')}Valor líquido: é o que entra no seu saldo quando o serviço for concluído.</p>
          <button class="btn btn-ghost btn-block btn-sm" data-action="pp-cancel" data-arg="${m.id}">Cancelar proposta</button>`, 'provider');
      }
      return proposalCard(m, p.status === 'accepted' ? `<button class="btn btn-soft btn-block btn-sm" data-go="/pro">${icon('navigation')}Ir para o atendimento</button>` : '', 'provider');
    };
    const blocked = S.accounts.restriction(S.accounts.client(c.client));
    return {
      body: (blocked ? `<div class="msg-sys bad">${icon('shield-alert')}<span>Cliente com restrição de segurança no CPF: ${esc(blocked.text)}. Propostas para este cliente estão suspensas.</span></div>` : '') + bubbles(c, pKey(c.id), card, ''),
      quick: [{ action: 'pp-open', icon: 'file-plus-2', label: 'Enviar proposta' }, 'Qual é a marca e o modelo?', 'Qual horário fica melhor para você?']
    };
  }

  function proList(activeId) {
    const list = pchats().slice().sort((a, b) => b.updatedAt - a.updatedAt);
    return `
      <header class="topbar plain"><h1>Conversas</h1></header>
      <section class="section first">
        ${list.length ? `<div class="list">${list.map((c) => chatRow('/pro/chat/' + c.id, { name: c.client, hue: c.hue }, c.topic, c, c.id === activeId, 'provider')).join('')}</div>`
          : `<div class="empty small">${ui.mascot('empty', 76)}<p class="muted">Quando um cliente pedir um orçamento, a conversa aparece aqui.</p></div>`}
      </section>
      <section class="section"><div class="fee-note">${icon('file-plus-2')}<span>Combine o serviço e envie uma <strong>proposta personalizada</strong>. O cliente paga pelo app e o valor fica garantido para você.</span></div></section>
      <div class="spacer"></div>`;
  }

  screens.proChats = {
    tab: 'pchats', mode: 'pro',

    render() {
      return md(proList(null), pickOne('Abra uma conversa para responder o cliente e enviar uma proposta.'), false);
    },

    mount() {
      const fn = () => S.app.refresh();
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  screens.proChat = {
    mode: 'pro',

    render(p) {
      const c = pchat(p.id);
      if (!c) return S.blocks.missing('Conversa não encontrada');
      return md(proList(c.id), shell({
        title: c.client, sub: 'Interesse: ' + c.topic, placeholder: 'Escreva uma mensagem',
        right: `<span class="pill-btn static" id="pc-km" title="Distância pela rota mais curta">${icon('route')}${ui.km(c.routeKm || c.km)}</span>`
      }), true);
    },

    mount(root, p) {
      const c = pchat(p.id);
      if (!c) return null;
      const detach = attach(root, pKey(c.id), () => pchat(p.id), proParts);
      const unlist = keepList(root, () => proList(c.id));
      routeKmOf(c).then((km) => { const el = root.querySelector('#pc-km'); if (el) { el.innerHTML = icon('route') + ui.km(km); ui.refreshIcons(); } });
      return () => { unlist(); detach(); };
    }
  };

  /* ---------- Formulário de proposta ----------
     O profissional informa quanto quer receber (valor líquido). A taxa de deslocamento só é liberada
     quando a rota mais curta até o cliente passa de 15 km, e tem teto por km excedente. */
  let form = null;

  /** Posição do cliente simulado e distância da rota mais curta até ele (shortestRouteDistanceKm). */
  function routeKmOf(c) {
    const loc = st().location, pos = S.geo.offset(loc, c.bearing || 0, c.dist || c.km || 1);
    return S.geo.shortestRouteKm(loc, pos).then((km) => { c.routeKm = km; S.store.save(); return km; });
  }

  const netOf = (svc) => S.pricing.fromClientPrice(svc.price, 0).providerNetAmount;

  function earnBox() {
    const disp = form.km == null ? 0 : S.pricing.clampDisplacement(form.km, form.disp);
    return `
      <div><span>Serviço</span><b>${money(form.net || 0)}</b></div>
      <div><span>Deslocamento</span><b>${disp ? money(disp) : 'grátis'}</b></div>
      <div class="earn-total"><span>Você recebe</span><b>${money((form.net || 0) + disp)}</b></div>`;
  }

  function travelField() {
    if (form.km == null) return `<div class="travel-field wait"><span class="spinner"></span>Calculando a rota mais curta até o cliente…</div>`;
    const t = S.config.travel, kmTxt = ui.km(form.km);
    if (!S.pricing.displacementAllowed(form.km)) {
      return `
        <label class="form-field travel-field locked"><span>Taxa de deslocamento</span>
          <input type="text" value="R$ 0,00" disabled aria-describedby="pp-travel-why">
          <small id="pp-travel-why">${icon('lock')}Deslocamento gratuito até ${t.freeKm} km (distância atual: ${kmTxt}). Taxa liberada apenas para rotas acima de ${t.freeKm} km.</small>
        </label>`;
    }
    const cap = S.pricing.maxDisplacement(form.km);
    return `
      <label class="form-field travel-field"><span>Taxa de deslocamento excedente <small>opcional</small></span>
        <input id="pp-disp" type="number" inputmode="decimal" min="0" max="${cap}" step="0.5" placeholder="0" value="${form.disp || ''}" data-input="pp-disp">
        <small>${icon('route')}Rota de ${kmTxt}: ${ui.km(form.km - t.freeKm)} acima da franquia. Teto: ${money(cap)} (${money(t.maxPerExcessKm)} por km excedente).</small>
      </label>`;
  }

  const syncEarn = () => { const el = document.getElementById('pp-earn'); if (el) el.innerHTML = earnBox(); };
  const syncTravel = () => { const el = document.getElementById('pp-travel'); if (el) { el.innerHTML = travelField(); ui.refreshIcons(); } syncEarn(); };

  A['pp-open'] = () => {
    const c = pchat(S.app.current().params.id);
    if (!c) return;
    if (!S.guard.allow('serve') || !S.guard.counterpart(S.accounts.client(c.client))) return;
    const services = S.data.cat(st().pro.cat).services;
    form = { chatId: c.id, items: [], title: '', desc: '', net: 0, disp: 0, km: null, when: WHEN[0] };
    const f = form;
    routeKmOf(c).then((km) => { if (form === f) { f.km = km; syncTravel(); } });
    ui.sheet.open(`
      <div class="sheet-head"><h3>Proposta para ${esc(ui.first(c.client))}</h3><button class="icon-btn soft" data-action="sheet-close" aria-label="Fechar">${icon('x')}</button></div>
      <p class="muted sm">Toque nos serviços para montar o escopo ou escreva do seu jeito.</p>
      <div class="chips wrap left">${services.map((s) => `<button class="chip sm" data-action="pp-add" data-arg="${s.id}">${esc(s.name)} · ${ui.moneyShort(netOf(s))}</button>`).join('')}</div>
      <label class="form-field"><span>Título</span><input id="pp-title" type="text" maxlength="90" autocomplete="off" placeholder="Ex.: Instalação do chuveiro + troca de 1 tomada" data-input="pp-title"></label>
      <label class="form-field"><span>O que está incluso</span><textarea id="pp-desc" class="textarea" rows="3" placeholder="Descreva o serviço, o material e a garantia." data-input="pp-desc"></textarea></label>
      <div class="form-row">
        <label class="form-field"><span>Você recebe pelo serviço (R$)</span><input id="pp-price" type="number" inputmode="decimal" min="1" step="5" placeholder="0" data-input="pp-price"></label>
        <label class="form-field"><span>Quando</span><select id="pp-when" data-input="pp-when">${WHEN.map((w) => `<option>${w}</option>`).join('')}</select></label>
      </div>
      <div id="pp-travel">${travelField()}</div>
      <div class="earn" id="pp-earn">${earnBox()}</div>
      <button class="btn btn-primary btn-block btn-lg" data-action="pp-send">Enviar proposta</button>`, { onClose() { form = null; } });
  };

  A['pp-add'] = (el) => {
    if (!form) return;
    const svc = S.data.cat(st().pro.cat).services.find((s) => s.id === el.dataset.arg);
    const i = form.items.indexOf(svc);
    if (i >= 0) form.items.splice(i, 1); else form.items.push(svc);
    el.classList.toggle('active', i < 0);
    const names = form.items.map((s) => lowerFirst(s.name));
    form.title = form.items.map((s, k) => (k ? lowerFirst(s.name) : s.name)).join(' + ');
    form.desc = form.items.length ? `Inclui ${joinList(names)}${form.items.length > 1 ? ', tudo na mesma visita' : ''}, com teste no final e garantia de 90 dias.` : '';
    form.net = round5(form.items.reduce((s, x) => s + netOf(x), 0) * (form.items.length > 1 ? 0.88 : 1));
    document.getElementById('pp-title').value = form.title;
    document.getElementById('pp-desc').value = form.desc;
    document.getElementById('pp-price').value = form.net || '';
    syncEarn();
  };

  I['pp-title'] = (el) => { if (form) form.title = el.value; };
  I['pp-desc'] = (el) => { if (form) form.desc = el.value; };
  I['pp-when'] = (el) => { if (form) form.when = el.value; };
  const num = (el) => Math.max(0, Math.round(parseFloat(String(el.value).replace(',', '.')) * 100) / 100 || 0);
  I['pp-price'] = (el) => { if (form) { form.net = num(el); syncEarn(); } };
  /* Taxa de deslocamento: acima do teto, o campo volta para o teto (trava anti-superfaturamento). */
  I['pp-disp'] = (el) => {
    if (!form) return;
    const cap = form.km == null ? 0 : S.pricing.maxDisplacement(form.km);
    form.disp = num(el);
    if (form.disp > cap) { form.disp = cap; el.value = cap; ui.toast(`Teto da taxa para esta rota: ${money(cap)}.`, 'info'); }
    syncEarn();
  };

  A['pp-send'] = () => {
    if (!form) return;
    const c = pchat(form.chatId), title = form.title.trim();
    if (!c) return;
    if (title.length < 4) return ui.toast('Dê um título para a proposta.', 'bad');
    if (form.net < 10) return ui.toast('Informe quanto você quer receber pelo serviço.', 'bad');
    if (form.km == null) return ui.toast('Aguarde o cálculo da rota até o cliente.', 'info');
    const cap = S.pricing.maxDisplacement(form.km);
    if (form.disp > cap) return ui.toast(cap ? `A taxa de deslocamento pode ser de no máximo ${money(cap)} para esta rota.` : 'Dentro de 15 km o deslocamento é gratuito.', 'bad');
    const amounts = S.pricing.fromNet(form.net, S.pricing.clampDisplacement(form.km, form.disp), form.km);
    retire(c, 'replaced');
    const m = push(c, pKey(c.id), {
      from: 'me', type: 'proposal',
      proposal: { title, desc: form.desc.trim() || 'Serviço conforme combinado na conversa.', price: amounts.clientTotalAmount, base: amounts.clientTotalAmount, amounts, when: form.when, status: 'pending' }
    });
    ui.sheet.close();
    ui.toast('Proposta enviada.', 'ok');
    clientDecides(c, m);
  };

  A['pp-cancel'] = (el) => {
    const c = pchat(S.app.current().params.id), m = c && c.messages.find((x) => x.id === el.dataset.arg);
    if (!m || m.proposal.status !== 'pending') return;
    m.proposal.status = 'cancelled';
    note(c, pKey(c.id), 'Você cancelou a proposta.');
  };

  /* ---------- Envio (as duas telas de conversa usam os mesmos botões) ---------- */
  function sendCurrent(text) {
    const cur = S.app.current();
    if (!cur) return;
    if (cur.name === 'proChat') return sendPro(cur.params.id, text);
    if (cur.name !== 'chat') return;
    if (cur.query.q) S.app.silent('/chat/' + cur.params.id);
    sendClient(cur.params.id, text);
  }

  A['chat-send'] = () => {
    const input = document.getElementById('chat-text');
    if (!input || !input.value.trim()) return;
    sendCurrent(input.value);
    input.value = '';
    input.focus();
  };

  A['chat-quick'] = (el) => sendCurrent(el.dataset.arg);

  /* =====================================================================
     Interface para o restante do app
     ===================================================================== */

  S.chat = {
    /** Mensagens não lidas no modo atual (ponto na aba Conversas). */
    unread() {
      const list = st().mode === 'pro' ? pchats() : st().chats;
      return list.reduce((s, c) => s + (c.unread || 0), 0);
    },

    /** Registra um evento do pedido na conversa com o profissional, se ela existir. */
    note(proId, text) {
      const c = chatOf(proId);
      if (c) note(c, cKey(proId), text);
    },

    /** Pedido concluído e pago: confirmação com o comprovante na conversa com o profissional, se ela existir. */
    receipt(proId, orderId) {
      const c = chatOf(proId), o = S.orders.get(orderId);
      if (c && o) push(c, cKey(proId), { from: 'sys', type: 'receipt', receipt: { kind: 'order', id: o.id, service: o.serviceName, amount: o.amounts.clientTotalAmount } });
    },

    /** Atendimento do profissional concluído: confirmação do repasse com o comprovante de recebimento. */
    proReceipt(chatId, entry) {
      const c = pchat(chatId);
      if (c && entry) push(c, pKey(c.id), { from: 'sys', type: 'receipt', receipt: { kind: 'ledger', id: entry.id, service: entry.service, amount: entry.providerNetAmount } });
    },

    /** Um novo cliente puxa conversa quando o profissional fica online (uma vez por demonstração). */
    lead() {
      const p = st().pro, at = epoch;
      if (p.leadSent) return;
      p.leadSent = true;
      setTimeout(() => {
        if (at !== epoch || st().mode !== 'pro') return;
        const now = Date.now();
        const c = {
          id: 'c3', client: 'Tainá Moreira', hue: 250, address: 'Rua Sete de Setembro, 88', km: 2.1, bearing: 300, dist: 1.6, budget: 175, fi: 0, unread: 1, updatedAt: now,
          topic: 'Troca de disjuntor',
          facts: ['É o disjuntor do chuveiro, de 40A. Ele esquenta bastante antes de desarmar.', 'A fiação do chuveiro é antiga, nunca foi trocada.', 'Pode ser hoje, estou em casa o dia todo.'],
          messages: [{ id: S.store.nextId('m'), from: 'them', type: 'text', at: now, text: 'Boa tarde! Meu disjuntor desarma toda vez que ligo o chuveiro. Consegue vir hoje?' }]
        };
        p.chats.unshift(c);
        S.store.save();
        emit(pKey(c.id));
        ui.toast('Nova mensagem de Tainá: pedido de orçamento.', 'info');
      }, 12000);
    },

    reset() {
      epoch += 1;
      typing = {};
      viewing = null;
      form = null;
    }
  };
})(window.FixUp = window.FixUp || {});
