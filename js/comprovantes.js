/* FixUp — comprovantes de pagamento (cliente) e de recebimento (profissional).

   Cada serviço pago e concluído gera um comprovante com código de autenticação, data e hora,
   nomes e CPFs mascarados das partes, descrição do serviço e o selo do pica-pau.
   Preço cego também aqui: o comprovante do cliente mostra só o total pago (clientTotalAmount) e o
   do profissional mostra só o valor líquido recebido (providerNetAmount).

   O código de autenticação é calculado a partir dos dados do comprovante: se qualquer dado mudar,
   o código muda. Em produção ele seria assinado pelo servidor e conferido numa página pública. */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, icon = ui.icon, money = ui.money;
  const st = () => S.store.state;

  /* Hash de 80 bits (FNV-1a em cinco sementes) do texto canônico do comprovante. */
  function authCode(text) {
    let out = '';
    [2166136261, 3735928559, 2654435761, 1597334677, 3266489917].forEach((seed) => {
      let h = seed >>> 0;
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
      out += (h >>> 16).toString(16).toUpperCase().padStart(4, '0');
    });
    return out.match(/.{4}/g).join('-');
  }

  const VIEW = {
    client: { title: 'Comprovante de Pagamento FixUp', label: 'Valor total pago', status: 'Pagamento liquidado', file: 'pagamento' },
    provider: { title: 'Comprovante de Recebimento de Serviço FixUp', label: 'Valor líquido recebido', status: 'Repasse liquidado', file: 'recebimento' }
  };

  /** Dados do comprovante de um pedido (visão do cliente). */
  function fromOrder(o) {
    if (!o || o.status !== 'completed') return null;
    const pro = S.data.pro(o.proId);
    const parties = o.parties || { client: { name: st().user.name, cpf: st().user.cpf }, provider: { name: pro ? pro.name : '', cpf: S.cpf.fromSeed('pro:' + o.proId) } };
    const done = (o.timeline.find((t) => t.status === 'completed') || {}).at || o.createdAt;
    return { view: 'client', id: o.code, at: done, service: o.serviceName, parties, amount: o.amounts.clientTotalAmount, method: S.pay.label(o.method) };
  }

  /** Dados do comprovante de um atendimento do extrato do profissional (visão do profissional). */
  function fromLedger(j) {
    if (!j) return null;
    const client = S.accounts.client(j.client);
    return {
      view: 'provider', id: j.code || 'FX-R' + String(j.id).replace(/\D/g, '').padStart(4, '0'), at: j.at, service: j.service,
      parties: { client: { name: j.client, cpf: client ? client.cpf : '' }, provider: { name: st().pro.name, cpf: st().pro.cpf } },
      amount: j.providerNetAmount, method: 'Saldo FixUp'
    };
  }

  function complete(r) {
    const canon = [r.view, r.id, r.at, r.service, r.parties.client.cpf, r.parties.provider.cpf, Math.round(r.amount * 100)].join('|');
    return Object.assign({}, r, { code: authCode(canon), meta: VIEW[r.view] });
  }

  const when = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  /** O comprovante em si (usado na tela, na impressão e no arquivo baixado). */
  function card(r) {
    const m = r.meta;
    return `
      <article class="rcpt">
        <span class="rcpt-mark" aria-hidden="true">${ui.mascot('mark', 260)}</span>
        <header class="rcpt-head">
          <img src="img/logo-fixup.svg" width="40" height="39" alt="">
          <div><strong>${esc(m.title)}</strong><small>Documento gerado pela plataforma FixUp</small></div>
        </header>
        <div class="rcpt-value"><small>${esc(m.label)}</small><strong>${money(r.amount)}</strong><span class="rcpt-ok">${icon('circle-check')}${esc(m.status)}</span></div>
        <dl class="rcpt-data">
          <div><dt>Serviço</dt><dd>${esc(r.service)}</dd></div>
          <div><dt>Data e hora</dt><dd>${when(r.at)}</dd></div>
          <div><dt>Cliente</dt><dd>${esc(r.parties.client.name)}<small>CPF ${S.cpf.hidden(r.parties.client.cpf)}</small></dd></div>
          <div><dt>Profissional</dt><dd>${esc(r.parties.provider.name)}<small>CPF ${S.cpf.hidden(r.parties.provider.cpf)}</small></dd></div>
          <div><dt>${r.view === 'client' ? 'Forma de pagamento' : 'Crédito em'}</dt><dd>${esc(r.method)}</dd></div>
          <div><dt>ID da transação</dt><dd class="mono">${esc(r.id)}</dd></div>
        </dl>
        <footer class="rcpt-auth">
          <span class="seal">${ui.mascot('badge', 22)}Autenticado FixUp</span>
          <div><small>Código de autenticação</small><b class="mono">${r.code}</b></div>
        </footer>
      </article>`;
  }

  /* ---------- Baixar e imprimir ---------- */

  /* Página independente do comprovante, com os estilos e o desenho embutidos (o arquivo abre sem internet). */
  function standalone(r) {
    const css = `body{margin:0;padding:32px 16px;background:#F5F5FC;font:15px/1.45 system-ui,'Segoe UI',Roboto,sans-serif;color:#0B0B2B}
.rcpt{position:relative;overflow:hidden;max-width:520px;margin:0 auto;padding:26px;border-radius:22px;background:#fff;border:1px solid #E4E4F3}
.rcpt-mark{position:absolute;right:-50px;bottom:-40px;opacity:.06;color:#0404E2}.rcpt-mark svg{width:260px;height:260px}
.rcpt-head{display:flex;align-items:center;gap:12px}.rcpt-head strong{display:block;font-size:17px}.rcpt-head small{color:#4A4A6A}
.rcpt-value{margin:22px 0 16px;padding:16px;border-radius:16px;background:#F2F2FF}.rcpt-value small{display:block;color:#4A4A6A}.rcpt-value strong{display:block;font-size:30px;color:#0303B5}
.rcpt-ok{display:inline-flex;gap:6px;align-items:center;margin-top:6px;color:#0B6B4B;font-weight:700;font-size:13px}.rcpt-ok svg,.rcpt-ok i{display:none}
.rcpt-data{display:grid;gap:10px;margin:0}.rcpt-data div{display:flex;justify-content:space-between;gap:16px;border-bottom:1px dashed #D2D2E8;padding-bottom:8px}
.rcpt-data dt{color:#4A4A6A}.rcpt-data dd{margin:0;text-align:right;font-weight:600}.rcpt-data small{display:block;font-weight:500;color:#8787A6}
.rcpt-auth{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px}.rcpt-auth small{display:block;color:#4A4A6A;text-align:right}
.seal{display:inline-flex;align-items:center;gap:7px;padding:4px 12px 4px 4px;border-radius:999px;background:#E7E7FF;color:#0303B5;font-weight:700;font-size:12.5px}
.mono{font-family:ui-monospace,Consolas,monospace}.pp-badge .pp-bg{fill:#0404E2}.pp-badge .pp-n{fill:#fff}.pp-badge .pp-w{fill:#0404E2}`;
    const defs = `<svg width="0" height="0" style="position:absolute"><defs><path id="fx-pp-n" fill-rule="evenodd" d="${S.mascotArt.navy}"/><path id="fx-pp-w" fill-rule="evenodd" d="${S.mascotArt.white}"/><clipPath id="fx-pp-head"><circle cx="215" cy="204" r="114"/></clipPath></defs></svg>`;
    const body = card(r).replace('src="img/logo-fixup.svg"', `src="${new URL('img/logo-fixup.svg', location.href).href}"`);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.meta.title)} ${esc(r.id)}</title><style>${css}</style></head><body>${defs}${body}</body></html>`;
  }

  function download(r) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([standalone(r)], { type: 'text/html' }));
      a.download = `comprovante-${r.meta.file}-${r.id}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      ui.toast('Comprovante baixado.', 'ok');
    } catch (e) { ui.toast('Não foi possível baixar o comprovante neste navegador.', 'bad'); }
  }

  /* Impressão: só o comprovante vai para o papel (ou para "Salvar como PDF"). */
  function print(r) {
    let root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = card(r);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }

  /* ---------- Na tela ---------- */
  let current = null;

  function open(data) {
    if (!data) return ui.toast('O comprovante fica disponível quando o serviço é concluído.', 'info');
    current = complete(data);
    const canSave = !S.config.embedded;
    ui.sheet.open(`
      <div class="sheet-head"><h3>Comprovante</h3><button class="icon-btn soft" data-action="sheet-close" aria-label="Fechar">${icon('x')}</button></div>
      ${card(current)}
      ${canSave ? `
      <div class="row-2 even">
        <button class="btn btn-soft" data-action="rcpt-download">${icon('download')}Baixar</button>
        <button class="btn btn-primary" data-action="rcpt-print">${icon('printer')}Imprimir</button>
      </div>
      <p class="hint">Para guardar em PDF, toque em Imprimir e escolha “Salvar como PDF”.</p>`
      : `<p class="hint">Na página publicada no Claude, baixar e imprimir ficam desativados. No site do FixUp, esses botões aparecem aqui.</p>`}`);
  }

  S.actions['rcpt-download'] = () => { if (current) download(current); };
  S.actions['rcpt-print'] = () => { if (current) print(current); };
  S.actions['rcpt-order'] = (el) => open(fromOrder(S.orders.get(el.dataset.arg)));
  S.actions['rcpt-ledger'] = (el) => open(fromLedger(st().pro.jobs.find((j) => j.id === el.dataset.arg)));

  /** Botões "Visualizar" e "Baixar/Imprimir" para um comprovante. arg = id do pedido ou do lançamento. */
  function buttons(kind, arg) {
    const act = kind === 'ledger' ? 'rcpt-ledger' : 'rcpt-order';
    return `<div class="row-2 even rcpt-btns">
      <button class="btn btn-soft btn-sm" data-action="${act}" data-arg="${esc(arg)}">${icon('file-check-2')}Visualizar comprovante</button>
      <button class="btn btn-outline btn-sm" data-action="${act}" data-arg="${esc(arg)}">${icon(S.config.embedded ? 'eye' : 'download')}${S.config.embedded ? 'Ver detalhes' : 'Baixar/Imprimir'}</button>
    </div>`;
  }

  S.receipts = { fromOrder, fromLedger, open, buttons, code: (data) => complete(data).code };
})(window.FixUp = window.FixUp || {});
