/* FixUp — estado da aplicação, salvo no navegador (localStorage).
   Pedidos, carteira, conversas e a conta profissional de demonstração.
   O histórico de trabalhos dos profissionais fica em outro lugar: o banco de js/db.js.
   Em produção, este estado viria do backend. */
(function (S) {
  'use strict';

  const KEY = 'fixup:demo:v2';
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;

  function pastOrder(n, proId, svcIndex, daysAgo, method, stars, comment) {
    const pro = S.data.build(S.config.defaultLocation).find((p) => p.id === proId);
    const svc = pro.services[svcIndex];
    const t0 = Date.now() - daysAgo * DAY - 3 * HOUR;
    const seq = ['searching', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'awaiting', 'completed'];
    const gaps = [0, 1, 2, 2 + pro.eta, 5 + pro.eta, 65 + pro.eta, 68 + pro.eta];
    return {
      id: 'o' + n, code: 'FX-' + (4000 + n * 137),
      proId, catId: pro.cat, serviceId: svc.id, serviceName: svc.name, note: '',
      address: Object.assign({}, S.config.defaultLocation), proStart: pro.pos, km: pro.km, etaMin: pro.eta,
      quote: S.pricing.quote(svc.price, pro.km), method,
      status: 'completed', progress: 1, createdAt: t0,
      timeline: seq.map((s, i) => ({ status: s, at: t0 + gaps[i] * MIN })),
      payStatus: 'released', rating: { stars, tags: ['Pontual', 'Caprichoso'], comment }
    };
  }

  /* Conversa de exemplo do cliente: uma proposta personalizada aguardando aceite. */
  function clientChats(now) {
    return [{
      proId: 'p1', unread: 1, misses: 0, updatedAt: now - 6 * MIN,
      scope: [{ key: 'eletricista-3', name: 'Instalação do chuveiro', price: 110 }, { key: 'eletricista-1', name: 'Troca de 1 tomada 20A', price: 45 }],
      messages: [
        { id: 'm1', from: 'me', type: 'text', at: now - 9 * MIN, text: 'Oi Carlos! Além do chuveiro, você consegue olhar uma tomada da cozinha na mesma visita?' },
        { id: 'm2', from: 'them', type: 'text', at: now - 7 * MIN, text: 'Consigo sim! Como já vou estar com as ferramentas no banheiro, fecho os dois juntos em uma proposta única pra você.' },
        {
          id: 'm3', from: 'them', type: 'proposal', at: now - 6 * MIN,
          proposal: {
            title: 'Instalação do chuveiro + troca de 1 tomada 20A', price: 135, base: 135, when: 'Hoje em ~1h', status: 'pending',
            desc: 'Instalação completa do chuveiro com conectores cerâmicos, troca da tomada da cozinha para 20A e medição no multímetro.'
          }
        }
      ]
    }];
  }

  /* Conversas de exemplo do profissional: clientes pedindo orçamento.
     budget = até quanto o cliente simulado aceita pagar · facts = respostas dele às perguntas do profissional */
  function proChats(now) {
    return [
      {
        id: 'c1', client: 'Débora Lins', hue: 262, address: 'Rua das Acácias, 214', km: 1.6, budget: 150, fi: 0, unread: 1, updatedAt: now - 4 * MIN,
        topic: 'Instalação de chuveiro elétrico',
        facts: ['É uma tomada de 10A. Quero trocar por uma de 20A para usar o micro-ondas.', 'O chuveiro é um Lorenzetti Acqua Duo, já está comprado.', 'Pode ser hoje à tarde, estou em casa.'],
        messages: [{ id: 'm1', from: 'them', type: 'text', at: now - 4 * MIN, text: 'Oi Rafael! Além do chuveiro, você consegue olhar uma tomada da cozinha na mesma visita?' }]
      },
      {
        id: 'c2', client: 'Rogério Campos', hue: 236, address: 'Av. Brasil, 1020 · apto 42', km: 2.4, budget: 270, fi: 0, unread: 1, updatedAt: now - 38 * MIN,
        topic: 'Instalação de luminária ou ventilador',
        facts: ['O teto é de gesso e já tem o ponto de luz.', 'Os spots e o ventilador já estão comprados, é só instalar.', 'Prefiro amanhã de manhã, se der.'],
        messages: [{ id: 'm2', from: 'them', type: 'text', at: now - 38 * MIN, text: 'Boa tarde! Preciso instalar três spots de LED e um ventilador de teto na sala. Quanto fica?' }]
      }
    ];
  }

  function seed() {
    const now = Date.now();
    const d = new Date();
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const orders = [
      pastOrder(1, 'p5', 0, 3, 'pix', 5, 'Casa impecável, muito atenciosa.'),
      pastOrder(2, 'p11', 1, 12, 'card', 5, 'Chegou em 10 minutos e resolveu.')
    ];
    const rate = S.config.commissionRate;
    const jobs = S.data.myRecent.map((r, i) => {
      const commission = S.pricing.round2(r[2] * rate);
      const at = i < 2 ? Math.max(today + MIN, now - r[3] * HOUR) : now - r[3] * HOUR;
      return { id: 'j' + (i + 1), client: r[0], service: r[1], gross: r[2], commission, net: S.pricing.round2(r[2] - commission), at };
    });

    return {
      v: 2,
      seq: 100,
      mode: 'client',
      user: { name: 'Marina Costa', email: 'marina.costa@exemplo.com' },
      location: Object.assign({ source: 'default' }, S.config.defaultLocation),
      favorites: ['p5'],
      wallet: {
        balance: 150,
        defaultMethod: 'pix',
        tx: [
          { id: 't2', kind: 'service', orderId: 'o1', title: orders[0].serviceName, amount: -orders[0].quote.total, method: 'pix', at: orders[0].createdAt, state: 'released' },
          { id: 't1', kind: 'service', orderId: 'o2', title: orders[1].serviceName, amount: -orders[1].quote.total, method: 'card', at: orders[1].createdAt, state: 'released' },
          { id: 't0', kind: 'topup', title: 'Saldo adicionado', amount: 150, method: 'pix', at: now - 20 * DAY, state: 'done' }
        ]
      },
      orders,
      chats: clientChats(now),
      pro: {
        name: S.data.me.name, cat: S.data.me.cat, online: false,
        balance: S.pricing.round2(jobs.reduce((s, j) => s + j.net, 0)),
        jobs,
        withdrawals: [],
        chats: proChats(now),
        leadSent: false
      }
    };
  }

  const store = S.store = {
    state: null,

    /** Carrega o estado salvo. Deve ser chamado depois que o banco de trabalhos estiver aberto. */
    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { saved = null; }
      this.state = saved && saved.v === 2 ? saved : seed();
      this.state.pro.online = false;
      try { localStorage.removeItem('servi:demo:v1'); } catch (e) { /* nome antigo do app */ }
    },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* armazenamento indisponível: segue em memória */ }
    },

    reset() {
      try { localStorage.removeItem(KEY); } catch (e) { /* idem */ }
      this.state = seed();
    },

    nextId(prefix) {
      this.state.seq += 1;
      return prefix + this.state.seq;
    }
  };
})(window.FixUp = window.FixUp || {});
