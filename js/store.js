/* FixUp — estado da aplicação, salvo no navegador (localStorage).
   Pedidos, carteira, conversas e a conta profissional de demonstração.
   O histórico de trabalhos dos profissionais fica em outro lugar: o banco de js/db.js.
   Em produção, este estado viria do backend. */
(function (S) {
  'use strict';

  const KEY = 'fixup:demo:v3';
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
  /* CPF de teste da cliente de exemplo: gerado pelo app, válido pelo cálculo dos dígitos verificadores. */
  const testCpf = () => S.cpf.fromSeed('cliente:marina');

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
      amounts: S.pricing.fromClientPrice(svc.price, 0, pro.km), method,
      parties: { client: { name: 'Marina Costa', cpf: testCpf() }, provider: { name: pro.name, cpf: S.cpf.fromSeed('pro:' + proId) } },
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
            amounts: S.pricing.fromClientPrice(135, 0, 1.2),
            desc: 'Instalação completa do chuveiro com conectores cerâmicos, troca da tomada da cozinha para 20A e medição no multímetro.'
          }
        }
      ]
    }];
  }

  /* Conversas de exemplo do profissional: clientes pedindo orçamento.
     budget = até quanto o cliente simulado aceita pagar (no total, que só ele vê) · facts = respostas dele às perguntas
     bearing/dist = direção e distância em linha reta a partir do profissional (a rota real é calculada na hora) */
  function proChats(now) {
    return [
      {
        id: 'c1', client: 'Débora Lins', hue: 262, address: 'Rua das Acácias, 214', km: 1.6, bearing: 40, dist: 1.2, budget: 150, fi: 0, unread: 1, updatedAt: now - 4 * MIN,
        topic: 'Instalação de chuveiro elétrico',
        facts: ['É uma tomada de 10A. Quero trocar por uma de 20A para usar o micro-ondas.', 'O chuveiro é um Lorenzetti Acqua Duo, já está comprado.', 'Pode ser hoje à tarde, estou em casa.'],
        messages: [{ id: 'm1', from: 'them', type: 'text', at: now - 4 * MIN, text: 'Oi Rafael! Além do chuveiro, você consegue olhar uma tomada da cozinha na mesma visita?' }]
      },
      {
        id: 'c2', client: 'Rogério Campos', hue: 236, address: 'Av. Brasil, 1020 · apto 42', km: 2.4, bearing: 250, dist: 1.8, budget: 270, fi: 0, unread: 1, updatedAt: now - 38 * MIN,
        topic: 'Instalação de luminária ou ventilador',
        facts: ['O teto é de gesso e já tem o ponto de luz.', 'Os spots e o ventilador já estão comprados, é só instalar.', 'Prefiro amanhã de manhã, se der.'],
        messages: [{ id: 'm2', from: 'them', type: 'text', at: now - 38 * MIN, text: 'Boa tarde! Preciso instalar três spots de LED e um ventilador de teto na sala. Quanto fica?' }]
      },
      {
        /* Cliente com o CPF bloqueado por inadimplência: a proposta é barrada pela verificação de segurança. */
        id: 'c4', client: 'Wagner Tavares', hue: 244, address: 'Rua Bela Vista, 37 · casa 2', km: 3.2, bearing: 170, dist: 2.4, budget: 400, fi: 0, unread: 0, updatedAt: now - 3 * HOUR,
        topic: 'Troca de disjuntor',
        facts: ['É o quadro inteiro, tem uns oito disjuntores.', 'Pode ser ainda hoje.'],
        messages: [{ id: 'm4', from: 'them', type: 'text', at: now - 3 * HOUR, text: 'Preciso trocar o quadro de disjuntores com urgência. Você faz hoje?' }]
      },
      {
        /* Cliente a mais de 15 km pela rota: a taxa de deslocamento excedente fica liberada na proposta. */
        id: 'c5', client: 'Fernanda Lopes', hue: 232, address: 'Rua das Figueiras, 1200 · Santo André', km: 19.8, bearing: 138, dist: 15.6, budget: 560, fi: 0, unread: 1, updatedAt: now - 70 * MIN,
        topic: 'Troca de disjuntor',
        facts: ['São oito disjuntores, o quadro é dos anos 90.', 'A casa tem chuveiro elétrico e forno elétrico.', 'Pode ser amanhã de manhã.'],
        messages: [{ id: 'm5', from: 'them', type: 'text', at: now - 70 * MIN, text: 'Oi! Moro em Santo André e quero trocar o quadro de disjuntores antigo. Você atende aqui?' }]
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
    /* Extrato do profissional: cada linha guarda os três valores, mas a tela dele mostra só o líquido. */
    const jobs = S.data.myRecent.map((r, i) => {
      const at = i < 2 ? Math.max(today + MIN, now - r[3] * HOUR) : now - r[3] * HOUR;
      return Object.assign({ id: 'j' + (i + 1), client: r[0], service: r[1], at }, S.pricing.fromClientPrice(r[2], 0));
    });

    return {
      v: 3,
      seq: 100,
      mode: 'client',
      /* Conta da cliente. Tem CPF de teste, mas ainda não enviou a foto do rosto: a verificação é pedida
         antes da primeira contratação (Perfil > Conta e segurança). */
      user: {
        name: 'Marina Costa', email: 'marina.costa@exemplo.com', cpf: testCpf(), photo: '', photoDemo: false,
        cpfStatus: 'regular', unpaidDisputesCount: 0, reputationScore: 4.9, ratingsCount: 2
      },
      /* Alterações nas contas de exemplo (avaliações e ocorrências registradas durante o uso). */
      accounts: {},
      location: Object.assign({ source: 'default' }, S.config.defaultLocation),
      favorites: ['p5'],
      wallet: {
        balance: 150,
        defaultMethod: 'pix',
        tx: [
          { id: 't2', kind: 'service', orderId: 'o1', title: orders[0].serviceName, amount: -orders[0].amounts.clientTotalAmount, method: 'pix', at: orders[0].createdAt, state: 'released' },
          { id: 't1', kind: 'service', orderId: 'o2', title: orders[1].serviceName, amount: -orders[1].amounts.clientTotalAmount, method: 'card', at: orders[1].createdAt, state: 'released' },
          { id: 't0', kind: 'topup', title: 'Saldo adicionado', amount: 150, method: 'pix', at: now - 20 * DAY, state: 'done' }
        ]
      },
      orders,
      chats: clientChats(now),
      pro: {
        name: S.data.me.name, cat: S.data.me.cat, online: false,
        /* Conta do profissional: já verificada (CPF de teste e retrato ilustrativo no lugar da foto real). */
        cpf: S.cpf.fromSeed('me'), photo: S.ui.portrait(S.data.me.name, 252), photoDemo: true,
        cpfStatus: 'regular', unpaidDisputesCount: 0, reputationScore: 4.9, ratingsCount: 24,
        profile: S.data.myProfile(),
        balance: S.pricing.round2(jobs.reduce((s, j) => s + j.providerNetAmount, 0)),
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
      this.state = saved && saved.v === 3 ? saved : seed();
      this.state.pro.online = false;
      try { localStorage.removeItem('servi:demo:v1'); localStorage.removeItem('fixup:demo:v2'); } catch (e) { /* versões antigas */ }
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
