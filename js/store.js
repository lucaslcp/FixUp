/* Servi — estado da aplicação, salvo no navegador (localStorage).
   Em produção, este estado viria do backend. */
(function (S) {
  'use strict';

  const KEY = 'servi:demo:v1';
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;

  function pastOrder(n, proId, svcIndex, daysAgo, method, stars, comment) {
    const pro = S.data.build(S.config.defaultLocation).find((p) => p.id === proId);
    const svc = pro.services[svcIndex];
    const t0 = Date.now() - daysAgo * DAY - 3 * HOUR;
    const seq = ['searching', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'awaiting', 'completed'];
    const gaps = [0, 1, 2, 2 + pro.eta, 5 + pro.eta, 65 + pro.eta, 68 + pro.eta];
    return {
      id: 'o' + n, code: 'SV-' + (4000 + n * 137),
      proId, catId: pro.cat, serviceId: svc.id, serviceName: svc.name, note: '',
      address: Object.assign({}, S.config.defaultLocation), proStart: pro.pos, km: pro.km, etaMin: pro.eta,
      quote: S.pricing.quote(svc.price, pro.km), method,
      status: 'completed', progress: 1, createdAt: t0,
      timeline: seq.map((s, i) => ({ status: s, at: t0 + gaps[i] * MIN })),
      payStatus: 'released', rating: { stars, tags: ['Pontual', 'Caprichoso'], comment }, chat: []
    };
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
    const job = (n, client, service, gross, at) => {
      const commission = S.pricing.round2(gross * rate);
      return { id: 'j' + n, client, service, gross, commission, net: S.pricing.round2(gross - commission), at };
    };
    const jobs = [
      job(1, 'Beatriz Almeida', 'Instalação de chuveiro elétrico', 118.5, Math.max(today + MIN, now - 1.5 * HOUR)),
      job(2, 'Henrique Dias', 'Troca de disjuntor', 127, Math.max(today + MIN, now - 4 * HOUR)),
      job(3, 'Sofia Carvalho', 'Instalação de tomada ou interruptor', 86.5, now - 1.3 * DAY),
      job(4, 'Lucas Ferreira', 'Instalação de luminária ou ventilador', 101, now - 2.5 * DAY),
      job(5, 'Marta Oliveira', 'Visita técnica e diagnóstico', 76, now - 3.6 * DAY),
      job(6, 'Caio Ribeiro', 'Troca de disjuntor', 125.5, now - 5.4 * DAY)
    ];

    return {
      v: 1,
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
      pro: {
        name: 'Rafael Lima', cat: 'eletricista', rating: 4.9, online: false,
        balance: S.pricing.round2(jobs.reduce((s, j) => s + j.net, 0)),
        jobs,
        withdrawals: []
      }
    };
  }

  const store = S.store = {
    state: null,

    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { saved = null; }
      this.state = saved && saved.v === 1 ? saved : seed();
      this.state.pro.online = false;
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

  store.load();
})(window.Servi = window.Servi || {});
