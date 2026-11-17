/* FixUp — segurança da conta: CPF, foto de rosto, reputação dos dois lados e bloqueio de inadimplentes.

   Regras (limites em js/config.js, em `security`):
   - Para contratar (cliente) ou prestar serviço (profissional), a conta precisa de CPF válido e único
     e de uma foto real do rosto.
   - Depois de cada serviço, um lado avalia o outro e registra se o pagamento foi honrado.
   - Cada conta guarda, ligados ao CPF: cpfStatus ("regular" | "blocked_debtor"),
     unpaidDisputesCount e reputationScore.
   - CPF com inadimplência comprovada, ou com nota abaixo do mínimo, não contrata nem presta serviço.

   Nesta demonstração o cadastro de contas fica no navegador: as contas dos perfis de exemplo são
   geradas aqui e as alterações ficam em `state.accounts`. Em produção, o CPF é conferido e mantido
   único pelo servidor (com consulta a um serviço de validação de identidade). */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, icon = ui.icon;
  const st = () => S.store.state;
  const RULES = S.config.security;
  const round1 = (n) => Math.round(n * 10) / 10;
  const score = (n) => round1(n).toFixed(1).replace('.', ',');

  /* =====================================================================
     CPF
     ===================================================================== */

  const digits = (v) => String(v == null ? '' : v).replace(/\D/g, '').slice(0, 11);

  /** Máscara 000.000.000-00, aplicada enquanto a pessoa digita. */
  function mask(v) {
    const d = digits(v);
    let out = d.slice(0, 3);
    if (d.length > 3) out += '.' + d.slice(3, 6);
    if (d.length > 6) out += '.' + d.slice(6, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  /* Dígito verificador: soma ponderada dos n primeiros dígitos (pesos de n+1 até 2), vezes 10, resto por 11. */
  function checkDigit(d, n) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += +d[i] * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  }

  /** CPF matematicamente válido: 11 dígitos, não todos iguais, e os dois dígitos verificadores corretos. */
  function valid(v) {
    const d = digits(v);
    return d.length === 11 && !/^(\d)\1{10}$/.test(d) && checkDigit(d, 9) === +d[9] && checkDigit(d, 10) === +d[10];
  }

  /** CPF parcialmente oculto, para telas e comprovantes: ***.456.789-** */
  const hidden = (v) => { const d = digits(v); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : 'não informado'; };

  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  /** CPF válido gerado a partir de um texto (sempre o mesmo para o mesmo texto): usado nos perfis de exemplo. */
  function fromSeed(seed) {
    let h = hash('cpf:' + seed);
    const d = [];
    for (let i = 0; i < 9; i++) { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 374761393) >>> 0; d.push(h % 10); }
    if (d.every((x) => x === d[0])) d[8] = (d[8] + 1) % 10;
    d.push(checkDigit(d, 9));
    d.push(checkDigit(d, 10));
    return d.join('');
  }

  S.cpf = { digits, mask, valid, hidden, fromSeed };

  /* =====================================================================
     Contas por CPF
     ===================================================================== */

  const demo = {};       // CPF -> conta de exemplo
  const byName = {};     // nome do cliente simulado -> CPF

  /* Cliente de exemplo com restrição, para demonstrar o bloqueio do lado do profissional. */
  const FLAGGED = { 'Wagner Tavares': { cpfStatus: 'blocked_debtor', unpaidDisputesCount: 2, reputationScore: 2.4, ratingsCount: 5 } };

  function register(key, name, role, extra) {
    const cpf = fromSeed(key);
    demo[cpf] = Object.assign({ cpf, name, role, cpfStatus: 'regular', unpaidDisputesCount: 0, reputationScore: 5, ratingsCount: 0 }, extra);
    return demo[cpf];
  }

  S.data.pros.forEach((p) => register('pro:' + p.id, p.name, 'provider', { reputationScore: p.rating, ratingsCount: p.n }));

  const FIELDS = ['cpfStatus', 'unpaidDisputesCount', 'reputationScore', 'ratingsCount'];

  /** Conta de exemplo pelo CPF, já com as alterações salvas. */
  function get(cpf) {
    const d = digits(cpf), base = demo[d];
    return base ? Object.assign({}, base, st().accounts[d] || {}) : null;
  }

  /** Conta de um cliente simulado (modo profissional), criada na primeira vez em que ele aparece. */
  function client(name) {
    if (!byName[name]) {
      const h = hash(name);
      byName[name] = register('client:' + name, name, 'client', FLAGGED[name] || { reputationScore: 4.6 + (h % 5) / 10, ratingsCount: 3 + (h % 9) }).cpf;
    }
    return get(byName[name]);
  }

  /** Conta de um profissional de exemplo. */
  const provider = (id) => get(fromSeed('pro:' + id));

  /* Regras de bloqueio. */
  function evaluate(a) {
    if (a.unpaidDisputesCount >= RULES.maxUnpaidDisputes) a.cpfStatus = 'blocked_debtor';
    return a;
  }

  /** Motivo pelo qual a conta não pode contratar nem prestar serviço, ou null. */
  function restriction(a) {
    if (a.cpfStatus === 'blocked_debtor') {
      return { code: 'debtor', text: `inadimplência comprovada (${a.unpaidDisputesCount} ${a.unpaidDisputesCount === 1 ? 'ocorrência' : 'ocorrências'})` };
    }
    if (a.ratingsCount >= RULES.minRatings && a.reputationScore < RULES.minReputation) {
      return { code: 'score', text: `nota de reputação ${score(a.reputationScore)}, abaixo do mínimo de ${score(RULES.minReputation)}` };
    }
    return null;
  }

  /* Uma avaliação recebida: atualiza a nota e, se o pagamento não foi honrado, conta uma ocorrência. */
  function applyRating(a, stars, paidOk) {
    a.reputationScore = round1((a.reputationScore * a.ratingsCount + stars) / (a.ratingsCount + 1));
    a.ratingsCount += 1;
    if (!paidOk) a.unpaidDisputesCount += 1;
    return evaluate(a);
  }

  const role = () => (st().mode === 'pro' ? 'provider' : 'client');
  /** A conta do próprio usuário no papel indicado (cliente ou profissional). */
  const mine = (r) => ((r || role()) === 'provider' ? st().pro : st().user);

  S.accounts = {
    get, client, provider, restriction, mine, role, score,

    /** O CPF já pertence a outra conta? (o próprio usuário, no outro papel, também conta como outra conta) */
    taken(cpf, r) {
      const d = digits(cpf), other = mine(r === 'provider' ? 'client' : 'provider');
      return !!demo[d] || digits(other.cpf) === d;
    },

    /** Avaliação de uma conta de exemplo (por exemplo, o profissional avalia o cliente). */
    rate(cpf, stars, paidOk) {
      const a = get(cpf);
      if (!a) return null;
      applyRating(a, stars, paidOk);
      st().accounts[a.cpf] = {};
      FIELDS.forEach((k) => { st().accounts[a.cpf][k] = a[k]; });
      S.store.save();
      return a;
    },

    /** Avaliação recebida pelo próprio usuário. */
    rateMe(r, stars, paidOk) {
      const a = mine(r);
      applyRating(a, stars, paidOk);
      S.store.save();
      return a;
    },

    /** Demonstração: liga ou desliga uma restrição por inadimplência na conta do usuário. */
    simulateBlock(r, on) {
      const a = mine(r);
      a.cpfStatus = on ? 'blocked_debtor' : 'regular';
      a.unpaidDisputesCount = on ? RULES.maxUnpaidDisputes : 0;
      S.store.save();
    }
  };

  /* =====================================================================
     Guarda: confere a conta antes de contratar ou de prestar serviço
     ===================================================================== */

  const VERB = { hire: 'contratar serviços', serve: 'prestar serviços' };

  function openIncomplete(missing, action) {
    const item = (ok, text) => `<div class="row static"><span class="row-ic${ok ? ' in' : ''}">${icon(ok ? 'check' : 'circle-alert')}</span><span class="row-main"><strong class="wrap">${text}</strong></span></div>`;
    ui.sheet.open(`
      <div class="dialog">
        <span class="guard-ic">${icon('shield-check')}</span>
        <h3>Complete sua verificação</h3>
        <p class="muted">Para ${VERB[action]}, a FixUp pede CPF e uma foto real do seu rosto. É assim que as duas partes se reconhecem no local do serviço.</p>
        <div class="card flush guard-list">
          ${item(missing.indexOf('cpf') < 0, 'CPF válido vinculado à conta')}
          ${item(missing.indexOf('photo') < 0, 'Foto real do rosto')}
        </div>
        <button class="btn btn-primary btn-block" data-go="/account">Verificar minha conta</button>
        <button class="btn btn-ghost btn-block" data-action="sheet-close">Agora não</button>
      </div>`);
  }

  function openBlocked(a, why, action) {
    ui.sheet.open(`
      <div class="dialog">
        <span class="guard-ic bad">${icon('shield-alert')}</span>
        <h3>Restrição de segurança</h3>
        <p class="muted">Não é possível ${VERB[action]} com o CPF <strong>${hidden(a.cpf)}</strong>.</p>
        <div class="guard-why">${icon('octagon-alert')}<span>Motivo: ${esc(why.text)}.</span></div>
        <p class="hint">A restrição vale para o CPF, em qualquer conta. Se você discorda, fale com o suporte para revisar o caso.</p>
        <button class="btn btn-soft btn-block" data-action="guard-support">Falar com o suporte</button>
        <button class="btn btn-ghost btn-block" data-action="sheet-close">Entendi</button>
      </div>`);
  }

  S.actions['guard-support'] = () => { ui.sheet.close(); ui.toast('Pedido de revisão enviado. O suporte responde em até 2 dias úteis.', 'info'); };

  S.guard = {
    /** Situação da conta do usuário no papel atual: o que falta e se há restrição. */
    status(r) {
      const a = mine(r), missing = [];
      if (!valid(a.cpf)) missing.push('cpf');
      if (!a.photo) missing.push('photo');
      return { account: a, missing, restriction: restriction(a) };
    },

    /** Pode seguir? Se não, mostra o motivo (verificação pendente ou restrição) e devolve false. */
    allow(action) {
      const s = this.status(action === 'serve' ? 'provider' : 'client');
      if (s.missing.length) { openIncomplete(s.missing, action); return false; }
      if (s.restriction) { openBlocked(s.account, s.restriction, action); return false; }
      return true;
    },

    /** A outra parte (um cliente simulado) pode ser atendida? Se não, avisa e devolve false. */
    counterpart(account) {
      const why = account && restriction(account);
      if (!why) return true;
      ui.sheet.open(`
        <div class="dialog">
          <span class="guard-ic bad">${icon('shield-alert')}</span>
          <h3>Cliente com restrição</h3>
          <p class="muted">O CPF de <strong>${esc(account.name)}</strong> (${hidden(account.cpf)}) está impedido de contratar pela FixUp.</p>
          <div class="guard-why">${icon('octagon-alert')}<span>Motivo: ${esc(why.text)}.</span></div>
          <p class="hint">Para a sua segurança, propostas e atendimentos para este cliente estão suspensos.</p>
          <button class="btn btn-soft btn-block" data-action="sheet-close">Entendi</button>
        </div>`);
      return false;
    }
  };
})(window.FixUp = window.FixUp || {});
