/* FixUp — fotos: envio pela câmera ou pela galeria, fotos dos serviços e visualização em tela cheia.

   As fotos enviadas são reduzidas no próprio aparelho e guardadas no banco do navegador
   (tabela "media" de js/db.js). Os trabalhos de exemplo não têm fotos reais: eles mostram
   imagens ilustrativas, marcadas como tal. */
(function (S) {
  'use strict';

  const ui = S.ui, esc = ui.esc, icon = ui.icon;

  /* =====================================================================
     Envio
     ===================================================================== */

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
    img.src = url;
  });

  /** Reduz a imagem para caber em `max` pixels (e recorta um quadrado central, se pedido). Devolve um JPEG em data URL. */
  async function shrink(file, max, square) {
    const img = await loadImage(file);
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (square) { const side = Math.min(sw, sh); sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }

  async function fromFiles(files, opts) {
    opts = opts || {};
    const out = [];
    for (const f of Array.from(files || []).slice(0, opts.limit || 6)) {
      if (!/^image\//.test(f.type)) continue;
      try { out.push(await shrink(f, opts.max || 1100, opts.square)); } catch (e) { /* arquivo que não é imagem: ignora */ }
    }
    return out;
  }

  /** Abre a câmera (`capture`) ou a galeria e devolve as imagens já reduzidas. Lista vazia se a pessoa desistir. */
  function pick(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = !!opts.multiple;
      if (opts.capture) input.setAttribute('capture', opts.capture);
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async () => { const list = await fromFiles(input.files, opts); input.remove(); resolve(list); });
      input.addEventListener('cancel', () => { input.remove(); resolve([]); });
      input.click();
    });
  }

  /** Há um rosto na foto? true/false quando o navegador sabe detectar rostos; null quando não sabe. */
  async function hasFace(src) {
    if (!window.FaceDetector) return null;
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      return (await new window.FaceDetector({ fastMode: true }).detect(img)).length > 0;
    } catch (e) { return null; }
  }

  /* =====================================================================
     Fotos dos serviços
     ===================================================================== */

  const uid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /** Guarda fotos enviadas. owner = profissional dono do trabalho ou do portfólio; jobId = trabalho, se houver. */
  function save(list, info) {
    return list.map((src) => S.db.addMedia(Object.assign({ id: uid(), src, at: Date.now() }, info)));
  }

  /** Fotos de um trabalho: as enviadas e, nos trabalhos de exemplo, as ilustrativas. */
  function ofJob(job) {
    const sent = S.db.media().filter((m) => m.jobId === job.id).map((m) => ({ id: m.id, src: m.src, job }));
    if (sent.length || !job.shots) return sent;
    const cat = S.data.cat(job.cat);
    return Array.from({ length: job.shots }, (_, i) => ({ id: job.id + ':' + i, demo: true, icon: cat.icon, tag: job.shots === 1 ? 'Resultado' : ['Antes', 'Depois'][i], job }));
  }

  /** Fotos de serviços avaliados de um profissional (prova de que o serviço aconteceu). */
  function reviewed(proId, limit) {
    let out = [];
    S.db.byPro(proId).forEach((j) => { if (j.rating && out.length < (limit || 60)) out = out.concat(ofJob(j)); });
    return out;
  }

  /** Portfólio geral: fotos que o profissional enviou e, nos perfis de exemplo, uma seleção ilustrativa. */
  function portfolio(proId) {
    const own = S.db.media().filter((m) => m.owner === proId && m.kind === 'portfolio').sort((a, b) => b.at - a.at)
      .map((m) => ({ id: m.id, src: m.src, caption: m.caption || '', stored: true }));
    if (own.length || proId === 'me') return own;
    const seen = {}, out = [];
    S.db.byPro(proId).forEach((j) => {
      if (out.length >= 6 || seen[j.title]) return;
      seen[j.title] = true;
      out.push({ id: j.id + ':p', demo: true, icon: S.data.cat(j.cat).icon, tag: 'Portfólio', caption: ui.jobTitle(j) });
    });
    return out;
  }

  /* Grupos de fotos abertos na tela: a visualização em tela cheia navega dentro do grupo. */
  let groups = {}, seq = 0;

  const art = (m) => (m.demo
    ? `<span class="shot-art">${icon(m.icon)}</span><b class="shot-tag">${esc(m.tag)}</b><small class="shot-note">Imagem ilustrativa</small>`
    : `<img src="${m.src}" alt="${esc(m.caption || (m.job ? m.job.title : 'Foto do serviço'))}" loading="lazy">`);

  /** Miniaturas clicáveis de uma lista de fotos. `max` limita quantas aparecem (o restante vira "+N"). */
  function strip(list, max, cls) {
    if (!list.length) return '';
    const id = 'g' + (++seq);
    if (seq % 300 === 0) groups = {};
    groups[id] = list;
    const shown = list.slice(0, max || list.length), more = list.length - shown.length;
    return `<div class="shots${cls ? ' ' + cls : ''}">${shown.map((m, i) => `
      <button class="shot${m.demo ? ' demo' : ''}${m.demo && m.tag === 'Antes' ? ' before' : ''}" data-action="shot-open" data-group="${id}" data-index="${i}" aria-label="Ver foto">
        ${art(m)}${more && i === shown.length - 1 ? `<span class="shot-more">+${more}</span>` : ''}
      </button>`).join('')}</div>`;
  }

  /* ---------- Tela cheia ---------- */
  let open = null;   // { list, index }
  const lbRoot = () => document.getElementById('lightbox-root');

  function draw() {
    const m = open.list[open.index], j = m.job, many = open.list.length > 1;
    lbRoot().innerHTML = `
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Foto do serviço">
        <button class="lb-close" data-action="lb-close" aria-label="Fechar">${icon('x')}</button>
        <div class="lb-stage">
          ${many ? `<button class="lb-nav prev" data-action="lb-prev" aria-label="Foto anterior">${icon('chevron-left')}</button>` : ''}
          <div class="lb-photo${m.demo ? ' demo' : ''}${m.demo && m.tag === 'Antes' ? ' before' : ''}">${art(m)}</div>
          ${many ? `<button class="lb-nav next" data-action="lb-next" aria-label="Próxima foto">${icon('chevron-right')}</button>` : ''}
        </div>
        <div class="lb-meta">
          ${j ? `
            <span class="seal ok">${ui.mascot('badge', 22)}Serviço concluído via FixUp</span>
            <strong>${esc(ui.jobTitle(j))}</strong>
            <div class="lb-line">${j.rating ? `<span class="stars">${ui.stars(j.rating)}</span>` : ''}<b>${esc(j.client || 'Cliente FixUp')}</b><span>${new Date(j.doneAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            ${j.review ? `<p>“${esc(j.review)}”</p>` : ''}`
          : `<strong>${esc(m.caption || 'Foto do portfólio')}</strong>`}
          <small>${many ? `${open.index + 1} de ${open.list.length}` : ''}${m.demo ? `${many ? ' · ' : ''}Imagem ilustrativa: os perfis de exemplo não têm fotos reais.` : ''}</small>
        </div>
      </div>`;
    ui.refreshIcons();
  }

  function show(list, index) {
    if (!list || !list.length) return;
    open = { list, index: Math.max(0, Math.min(list.length - 1, index || 0)) };
    lbRoot().classList.add('open');
    draw();
  }
  function close() { open = null; const r = lbRoot(); r.classList.remove('open'); r.innerHTML = ''; }
  function step(d) { if (!open) return; open.index = (open.index + d + open.list.length) % open.list.length; draw(); }

  S.actions['shot-open'] = (el) => show(groups[el.dataset.group], +el.dataset.index);
  S.actions['lb-close'] = close;
  S.actions['lb-prev'] = () => step(-1);
  S.actions['lb-next'] = () => step(1);
  document.addEventListener('keydown', (ev) => {
    if (!open) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowLeft') step(-1);
    else if (ev.key === 'ArrowRight') step(1);
  });

  S.media = { pick, fromFiles, hasFace, save, ofJob, reviewed, portfolio, strip, show, close, isOpen: () => !!open };
})(window.FixUp = window.FixUp || {});
