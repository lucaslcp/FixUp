/* FixUp — conta e segurança (CPF, foto do rosto, reputação) e o perfil profissional do usuário.

   Telas:
   /account              Conta e segurança, no papel atual (cliente ou profissional)
   /pro/profile          editor do perfil profissional: resumo, cursos técnicos, especialidades,
                         categorias atendidas e galeria de portfólio
   /pro/profile/preview  o perfil como os clientes veem */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, icon = ui.icon;
  const A = S.actions, I = S.inputs, screens = S.screens;
  const st = () => S.store.state;
  const pr = () => st().pro;
  const RULES = S.config.security;

  /* =====================================================================
     Conta e segurança
     ===================================================================== */

  const NOTICE = 'Foto de rosto real obrigatória para identificação e segurança presencial no momento do serviço';
  let cpfDraft = null;   // CPF sendo digitado (com máscara)

  /* A própria foto: sem foto enviada, um espaço vazio com câmera (e não o retrato ilustrativo). */
  const ownFace = (a, size) => (a.photo ? ui.face(a, size, 'big') : `<span class="face-empty" style="width:${size}px;height:${size}px">${icon('camera')}</span>`);

  function statusBlock(g, isPro) {
    const a = g.account;
    if (g.restriction) {
      return `<div class="sec-status bad">${icon('shield-alert')}<div><strong>CPF com restrição</strong><small>Motivo: ${esc(g.restriction.text)}. Enquanto ela existir, você não pode ${isPro ? 'prestar' : 'contratar'} serviços.</small></div></div>`;
    }
    if (g.missing.length) {
      const what = g.missing.map((m) => (m === 'cpf' ? 'o CPF' : 'a foto do rosto')).join(' e ');
      return `<div class="sec-status warn">${icon('circle-alert')}<div><strong>Verificação pendente</strong><small>Falta ${what} para ${isPro ? 'atender clientes' : 'contratar serviços'}.</small></div></div>`;
    }
    return `<div class="sec-status ok">${ui.mascot('badge', 30)}<div><strong>Conta verificada</strong><small>CPF ${S.cpf.hidden(a.cpf)} e foto do rosto confirmados. ${isPro ? 'Você pode atender clientes.' : 'Você pode contratar serviços.'}</small></div></div>`;
  }

  screens.account = {
    render() {
      const role = S.accounts.role(), isPro = role === 'provider', g = S.guard.status(role), a = g.account;
      const cpfValue = cpfDraft != null ? cpfDraft : S.cpf.mask(a.cpf);
      const blocked = a.cpfStatus === 'blocked_debtor';
      return `
        ${S.blocks.backBar('Conta e segurança')}
        <section class="section first">
          <div class="card sec-card">
            ${ownFace(a, 72)}
            <div class="row-main"><strong>${esc(a.name)}</strong><small>${isPro ? 'Conta profissional' : 'Conta de cliente'}</small></div>
          </div>
          ${statusBlock(g, isPro)}
        </section>

        <section class="section">
          <h3 class="h3">CPF</h3>
          <div class="card">
            <label class="form-field"><span>CPF vinculado à conta</span>
              <input id="cpf-input" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" value="${esc(cpfValue)}" data-input="cpf-mask" data-enter="cpf-save" aria-describedby="cpf-msg">
            </label>
            <p class="field-msg" id="cpf-msg" role="status"></p>
            <div class="row-2 even">
              <button class="btn btn-primary btn-sm" data-action="cpf-save">${icon('check')}Salvar CPF</button>
              <button class="btn btn-soft btn-sm" data-action="cpf-test">${icon('flask-conical')}Usar CPF de teste</button>
            </div>
            <p class="hint left">O CPF é conferido pelos dígitos verificadores e não pode estar em outra conta. As restrições de segurança valem para o CPF, em qualquer conta. Demonstração: use o CPF de teste. Os dados ficam só neste navegador.</p>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Foto do rosto</h3>
          <div class="card face-card">
            <div class="face-preview">${ownFace(a, 120)}${!a.photo ? '<small>Nenhuma foto enviada</small>' : a.photoDemo ? '<small>Retrato ilustrativo</small>' : ''}</div>
            <p class="notice">${icon('scan-face')}<span>${NOTICE}.</span></p>
            <p class="muted sm">Ela aparece no cartão do atendimento para ${isPro ? 'o cliente' : 'o profissional'} reconhecer você na chegada. Use uma foto de frente, sem óculos escuros e com boa luz.</p>
            <p class="field-msg" id="face-msg" role="status"></p>
            <div class="row-2 even">
              <button class="btn btn-primary btn-sm" data-action="face-camera">${icon('camera')}Tirar foto</button>
              <button class="btn btn-soft btn-sm" data-action="face-gallery">${icon('image-up')}Escolher da galeria</button>
            </div>
            <button class="btn btn-ghost btn-block btn-sm" data-action="face-demo">${icon('user-round')}Usar retrato ilustrativo (só para demonstração)</button>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Reputação ligada ao CPF</h3>
          <div class="rep-grid">
            <div><strong>${S.accounts.score(a.reputationScore)}</strong><small>nota de reputação</small></div>
            <div><strong>${a.ratingsCount}</strong><small>avaliações recebidas</small></div>
            <div class="${a.unpaidDisputesCount ? 'warn' : ''}"><strong>${a.unpaidDisputesCount}</strong><small>ocorrências de inadimplência</small></div>
            <div class="${blocked ? 'bad' : 'ok'}"><strong>${blocked ? 'Bloqueado' : 'Regular'}</strong><small>situação do CPF</small></div>
          </div>
          <p class="hint left">Depois de cada serviço, o cliente avalia o profissional e o profissional avalia o cliente, informando se o combinado foi honrado. O CPF é bloqueado com ${RULES.maxUnpaidDisputes} ocorrências de inadimplência comprovada ou com nota abaixo de ${S.accounts.score(RULES.minReputation)} depois de ${RULES.minRatings} avaliações.</p>
        </section>

        <section class="section">
          <h3 class="h3">Demonstração</h3>
          <div class="card flush">
            <button class="row" data-action="sec-simulate" data-arg="${blocked ? '0' : '1'}">
              <span class="row-ic">${icon(blocked ? 'rotate-ccw' : 'octagon-alert')}</span>
              <span class="row-main"><strong>${blocked ? 'Remover a restrição simulada' : 'Simular restrição por inadimplência'}</strong><small>${blocked ? 'Volta o CPF para a situação regular.' : `Marca o CPF com ${RULES.maxUnpaidDisputes} ocorrências para ver o bloqueio ao ${isPro ? 'atender' : 'contratar'}.`}</small></span>
              ${icon('chevron-right', 'muted-ic')}
            </button>
          </div>
        </section>
        <div class="spacer"></div>`;
    },

    mount() {
      return () => { cpfDraft = null; };
    }
  };

  const msg = (id, text, kind) => { const el = document.getElementById(id); if (el) { el.textContent = text; el.className = 'field-msg' + (kind ? ' ' + kind : ''); } };

  I['cpf-mask'] = (el) => {
    const masked = S.cpf.mask(el.value);
    if (el.value !== masked) el.value = masked;
    cpfDraft = masked;
    const d = S.cpf.digits(masked);
    if (d.length < 11) return msg('cpf-msg', '');
    if (!S.cpf.valid(d)) return msg('cpf-msg', 'CPF inválido: os dígitos verificadores não conferem.', 'bad');
    if (S.accounts.taken(d, S.accounts.role())) return msg('cpf-msg', 'Este CPF já está vinculado a outra conta.', 'bad');
    msg('cpf-msg', 'CPF válido.', 'ok');
  };

  function saveCpf(value) {
    const d = S.cpf.digits(value), role = S.accounts.role(), a = S.accounts.mine(role);
    if (d.length !== 11) return msg('cpf-msg', 'Digite os 11 números do CPF.', 'bad');
    if (!S.cpf.valid(d)) return msg('cpf-msg', 'CPF inválido: os dígitos verificadores não conferem.', 'bad');
    if (S.accounts.taken(d, role)) return msg('cpf-msg', 'Este CPF já está vinculado a outra conta.', 'bad');
    if (d === a.cpf) return ui.toast('Este já é o CPF da conta.', 'info');
    a.cpf = d;
    a.cpfStatus = 'regular';
    a.unpaidDisputesCount = 0;
    S.store.save();
    cpfDraft = null;
    S.app.refresh();
    ui.toast('CPF vinculado à conta.', 'ok');
  }

  A['cpf-save'] = () => { const el = document.getElementById('cpf-input'); if (el) saveCpf(el.value); };
  A['cpf-test'] = () => {
    let d, n = 0;
    do { d = S.cpf.fromSeed('teste:' + Date.now() + ':' + n++); } while (S.accounts.taken(d, S.accounts.role()) && n < 20);
    const el = document.getElementById('cpf-input');
    if (el) { el.value = S.cpf.mask(d); I['cpf-mask'](el); }
  };

  async function takeFace(capture) {
    const list = await S.media.pick({ capture, square: true, max: 480, limit: 1 });
    if (!list.length) return;
    const src = list[0], found = await S.media.hasFace(src);
    if (found === false) return msg('face-msg', 'Não encontramos um rosto nesta foto. Envie uma foto de frente, com o rosto visível.', 'bad');
    const a = S.accounts.mine();
    a.photo = src;
    a.photoDemo = false;
    S.store.save();
    S.app.refresh();
    ui.toast(found ? 'Foto do rosto confirmada.' : 'Foto enviada. A conferência do rosto é feita pela equipe FixUp.', 'ok');
  }

  A['face-camera'] = () => takeFace('user');
  A['face-gallery'] = () => takeFace(null);
  A['face-demo'] = () => {
    const a = S.accounts.mine();
    a.photo = ui.portrait(a.name, S.accounts.role() === 'provider' ? 252 : 236);
    a.photoDemo = true;
    S.store.save();
    S.app.refresh();
    ui.toast('Retrato ilustrativo aplicado (demonstração).', 'info');
  };

  A['sec-simulate'] = (el) => {
    const on = el.dataset.arg === '1';
    S.accounts.simulateBlock(S.accounts.role(), on);
    S.app.refresh();
    ui.toast(on ? 'Restrição simulada: tente contratar ou atender para ver o bloqueio.' : 'Restrição removida.', 'info');
  };

  /* =====================================================================
     Perfil profissional do usuário
     ===================================================================== */

  /** O usuário no formato de um profissional, para a visualização pública. */
  function meAsPro() {
    const p = pr(), stats = S.db.stats('me'), g = S.guard.status('provider');
    return {
      id: 'me', name: p.name, photo: p.photo, photoDemo: p.photoDemo, hue: 252, cat: p.cat, since: 2021,
      verified: !g.missing.length && !g.restriction, rating: stats.rating || S.data.me.rating, jobs: stats.count,
      profile: p.profile, bio: p.profile.bio, availableNow: true, availLabel: 'Disponível agora'
    };
  }

  let saveTimer = null;
  const autosave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { S.store.save(); const el = document.getElementById('pe-saved'); if (el) el.textContent = 'Salvo agora'; }, 400); };

  screens.proEdit = {
    mode: 'pro',

    render() {
      const pf = pr().profile, own = S.media.portfolio('me'), done = S.db.byPro('me').length;
      return `
        ${S.blocks.backBar('Perfil profissional', `<button class="icon-btn" data-go="/pro/profile/preview" aria-label="Ver como o cliente vê">${icon('eye')}</button>`)}
        <section class="section first">
          <button class="ask" data-go="/pro/profile/preview">${icon('eye')}<span><strong>Ver como os clientes veem</strong><small>Abas Sobre, Cursos técnicos, Portfólio e Avaliações.</small></span>${icon('chevron-right')}</button>
          <p class="hint left" id="pe-saved">As alterações são salvas automaticamente.</p>
        </section>

        <section class="section">
          <h3 class="h3">Resumo profissional</h3>
          <div class="card form-stack">
            <label class="form-field"><span>O que você faz</span><textarea class="textarea" rows="4" maxlength="600" data-input="pe-bio" placeholder="Conte o que você faz, como trabalha e que garantia oferece.">${esc(pf.bio)}</textarea></label>
            <div class="form-row">
              <label class="form-field"><span>Anos de experiência</span><input type="number" inputmode="numeric" min="0" max="60" value="${pf.years}" data-input="pe-years"></label>
              <div class="form-field"><span>Serviços concluídos na FixUp</span><output class="readonly">${done}</output></div>
            </div>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Formação e cursos técnicos</h3>
          <div class="courses">
            ${pf.courses.length ? pf.courses.map((c, i) => `
              <article class="course">
                <span class="row-ic">${icon('graduation-cap')}</span>
                <span class="row-main"><strong class="wrap">${esc(c.name)}</strong><small>${esc(c.institution)}${c.year ? ' · ' + c.year : ''}${c.hours ? ' · ' + esc(c.hours) : ''}</small></span>
                <button class="icon-btn soft" data-action="pe-course-del" data-arg="${i}" aria-label="Remover curso">${icon('trash-2')}</button>
              </article>`).join('') : '<p class="muted sm">Nenhum curso ainda.</p>'}
          </div>
          <div class="card form-stack add-course">
            <label class="form-field"><span>Curso ou certificação</span><input id="pc-name" type="text" maxlength="90" placeholder="Ex.: NR-10, refrigeração, instalações hidráulicas" list="pc-list"></label>
            <datalist id="pc-list">${(S.data.courses[pr().cat] || []).map((c) => `<option value="${esc(c[0])}">`).join('')}</datalist>
            <div class="form-row three">
              <label class="form-field"><span>Instituição</span><input id="pc-inst" type="text" maxlength="40" placeholder="Ex.: SENAI, IFES" list="pc-insts"></label>
              <label class="form-field"><span>Ano</span><input id="pc-year" type="number" inputmode="numeric" min="1960" max="2026" placeholder="2020"></label>
              <label class="form-field"><span>Carga</span><input id="pc-hours" type="text" maxlength="12" placeholder="40 h"></label>
            </div>
            <datalist id="pc-insts"><option value="SENAI"><option value="SENAC"><option value="IFES"><option value="SENAR"><option value="SEST SENAT"><option value="Escola técnica estadual"></datalist>
            <button class="btn btn-soft btn-sm" data-action="pe-course-add">${icon('plus')}Adicionar curso</button>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Especialidades</h3>
          <div class="tags editable">${pf.specialties.map((t, i) => `<span>${esc(t)}<button data-action="pe-tag-del" data-arg="${i}" aria-label="Remover ${esc(t)}">${icon('x')}</button></span>`).join('')}</div>
          <div class="tag-add">
            <input id="pe-tag" type="text" maxlength="40" placeholder="Ex.: Quadros de distribuição" data-enter="pe-tag-add">
            <button class="btn btn-soft btn-sm" data-action="pe-tag-add">${icon('plus')}Adicionar</button>
          </div>
        </section>

        <section class="section">
          <h3 class="h3">Categorias atendidas</h3>
          <div class="chips wrap left">${S.data.categories.map((c) => `<button class="chip sm${pf.cats.indexOf(c.id) >= 0 ? ' active' : ''}" data-action="pe-cat" data-arg="${c.id}">${esc(c.short.replace('­', ''))}</button>`).join('')}</div>
        </section>

        <section class="section">
          <div class="section-head">${ui.heading('Galeria de portfólio')}<span class="muted sm">${own.length} ${own.length === 1 ? 'foto' : 'fotos'}</span></div>
          <p class="muted sm">Fotos de trabalhos anteriores que mostram a qualidade do seu serviço.</p>
          ${own.length ? `<div class="pf-grid">${own.map((m) => `<span class="up-thumb big"><img src="${m.src}" alt="Foto do portfólio"><button data-action="pe-photo-del" data-arg="${m.id}" aria-label="Remover foto">${icon('x')}</button></span>`).join('')}</div>` : ''}
          <button class="btn btn-soft btn-block" data-action="pe-photo-add">${icon('image-plus')}Adicionar fotos ao portfólio</button>
        </section>
        <div class="spacer"></div>`;
    }
  };

  screens.proPreview = {
    mode: 'pro',
    mount: (root) => { S.blocks.showTab(root); },
    render(p, q) {
      return `${S.blocks.backBar('Seu perfil público')}${S.blocks.proPublic(meAsPro(), { tab: q.tab, preview: true })}<div class="spacer"></div>`;
    }
  };

  const pf = () => pr().profile;
  I['pe-bio'] = (el) => { pf().bio = el.value; autosave(); };
  I['pe-years'] = (el) => { pf().years = Math.max(0, Math.min(60, parseInt(el.value, 10) || 0)); autosave(); };

  A['pe-course-add'] = () => {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    const name = v('pc-name').trim(), institution = v('pc-inst').trim(), year = parseInt(v('pc-year'), 10), hours = v('pc-hours').trim();
    if (name.length < 3) return ui.toast('Informe o nome do curso.', 'bad');
    if (!institution) return ui.toast('Informe a instituição.', 'bad');
    if (year && (year < 1960 || year > new Date().getFullYear())) return ui.toast('Confira o ano de conclusão.', 'bad');
    pf().courses.push({ name, institution, year: year || null, hours });
    S.store.save();
    S.app.refresh();
    ui.toast('Curso adicionado ao perfil.', 'ok');
  };
  A['pe-course-del'] = (el) => { pf().courses.splice(+el.dataset.arg, 1); S.store.save(); S.app.refresh(); };

  A['pe-tag-add'] = () => {
    const el = document.getElementById('pe-tag'), t = el ? el.value.trim() : '';
    if (t.length < 2) return;
    if (pf().specialties.some((x) => x.toLowerCase() === t.toLowerCase())) return ui.toast('Essa especialidade já está no perfil.', 'info');
    pf().specialties.push(t);
    S.store.save();
    S.app.refresh();
  };
  A['pe-tag-del'] = (el) => { pf().specialties.splice(+el.dataset.arg, 1); S.store.save(); S.app.refresh(); };

  A['pe-cat'] = (el) => {
    const cats = pf().cats, id = el.dataset.arg, i = cats.indexOf(id);
    if (i >= 0 && cats.length === 1) return ui.toast('Mantenha pelo menos uma categoria.', 'info');
    if (i >= 0) cats.splice(i, 1); else cats.push(id);
    S.store.save();
    el.classList.toggle('active', i < 0);
  };

  A['pe-photo-add'] = async () => {
    const list = await S.media.pick({ multiple: true, limit: 8 });
    if (!list.length) return;
    S.media.save(list, { owner: 'me', kind: 'portfolio' });
    S.app.refresh();
    ui.toast(list.length === 1 ? 'Foto adicionada ao portfólio.' : list.length + ' fotos adicionadas ao portfólio.', 'ok');
  };
  A['pe-photo-del'] = (el) => { S.db.removeMedia(el.dataset.arg); S.app.refresh(); };

  S.blocks.meAsPro = meAsPro;
})(window.FixUp = window.FixUp || {});
