/* Servi — pagamento integrado (SIMULADO).
   Fluxo: o cliente paga pelo app -> o valor fica retido pela plataforma -> ao concluir,
   o valor é dividido entre o profissional (repasse) e a plataforma (comissão).

   Em produção, cada função abaixo vira uma chamada ao backend, que conversa com um
   gateway com suporte a split de pagamento (ex.: Mercado Pago, Pagar.me, Stripe Connect). */
(function (S) {
  'use strict';

  const wallet = () => S.store.state.wallet;
  const money = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const METHODS = [
    { id: 'pix', name: 'Pix', icon: 'qr-code', desc: () => 'Aprovação imediata' },
    { id: 'card', name: 'Cartão de crédito', icon: 'credit-card', desc: () => 'Visa final 4242' },
    { id: 'wallet', name: 'Saldo Servi', icon: 'wallet', desc: () => 'Disponível: ' + money(wallet().balance) }
  ];

  const findTx = (order) => wallet().tx.find((t) => t.orderId === order.id && t.kind === 'service');

  S.pay = {
    methods: () => METHODS,
    method: (id) => METHODS.find((m) => m.id === id) || METHODS[0],
    label(id) { return this.method(id).name; },

    canPay(methodId, amount) {
      return methodId !== 'wallet' || wallet().balance >= amount;
    },

    /** Autoriza o pagamento e retém o valor até a conclusão do serviço. */
    hold(order) {
      const w = wallet();
      if (order.method === 'wallet') w.balance = S.pricing.round2(w.balance - order.quote.total);
      w.tx.unshift({ id: S.store.nextId('t'), kind: 'service', orderId: order.id, title: order.serviceName, amount: -order.quote.total, method: order.method, at: Date.now(), state: 'held' });
      order.payStatus = 'held';
    },

    /** Serviço concluído: libera o repasse ao profissional e retém a comissão da plataforma. */
    release(order) {
      const tx = findTx(order);
      if (tx) tx.state = 'released';
      order.payStatus = 'released';
    },

    /** Pedido cancelado: devolve o valor integral ao cliente. */
    refund(order) {
      const w = wallet(), tx = findTx(order);
      if (order.method === 'wallet') w.balance = S.pricing.round2(w.balance + order.quote.total);
      if (tx) tx.state = 'refunded';
      order.payStatus = 'refunded';
    },

    topup(amount) {
      const w = wallet();
      w.balance = S.pricing.round2(w.balance + amount);
      w.tx.unshift({ id: S.store.nextId('t'), kind: 'topup', title: 'Saldo adicionado', amount, method: 'pix', at: Date.now(), state: 'done' });
      S.store.save();
    }
  };
})(window.Servi = window.Servi || {});
