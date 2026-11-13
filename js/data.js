/* Servi — catálogo de demonstração: categorias, serviços e profissionais.
   Em produção, estes dados viriam da API. */
(function (S) {
  'use strict';

  const C = (id, name, short, icon, keywords, services) => ({
    id, name, short, icon, keywords,
    services: services.map((s, i) => ({ id: `${id}-${i + 1}`, name: s[0], price: s[1], dur: s[2] }))
  });

  const categories = [
    C('eletricista', 'Eletricista', 'Elétrica', 'zap', 'luz tomada interruptor disjuntor chuveiro fiacao curto lampada energia eletrica eletrico ventilador luminaria', [
      ['Instalação de tomada ou interruptor', 80, '40 min'],
      ['Troca de disjuntor', 120, '1 h'],
      ['Instalação de chuveiro elétrico', 110, '50 min'],
      ['Instalação de luminária ou ventilador', 95, '1 h'],
      ['Visita técnica e diagnóstico', 70, '30 min']
    ]),
    C('encanador', 'Encanador', 'Hidráulica', 'droplets', 'vazamento vazando torneira pia entupida entupido cano descarga agua ralo registro esgoto hidraulica', [
      ['Conserto de vazamento', 110, '1 h'],
      ['Desentupimento de pia ou ralo', 130, '1 h'],
      ['Troca de torneira ou registro', 85, '40 min'],
      ['Reparo de descarga', 95, '45 min']
    ]),
    C('limpeza', 'Diarista', 'Limpeza', 'sparkles', 'faxina faxineira limpar limpeza passar roupa pos-obra casa organizar', [
      ['Limpeza residencial (4 h)', 140, '4 h'],
      ['Limpeza pesada (8 h)', 240, '8 h'],
      ['Limpeza pós-obra', 320, '8 h'],
      ['Passar roupas (3 h)', 100, '3 h']
    ]),
    C('montador', 'Montador de móveis', 'Montagem', 'hammer', 'montar montagem movel moveis guarda-roupa armario prateleira suporte tv cama desmontar', [
      ['Montagem de guarda-roupa', 180, '3 h'],
      ['Montagem de móvel pequeno', 80, '1 h'],
      ['Instalação de prateleiras', 70, '45 min'],
      ['Instalação de suporte de TV', 90, '1 h']
    ]),
    C('pintor', 'Pintor', 'Pintura', 'paint-roller', 'pintar pintura parede tinta textura retoque massa corrida', [
      ['Pintura de cômodo', 350, '6 h'],
      ['Pintura de porta ou janela', 120, '2 h'],
      ['Retoque e reparo de parede', 150, '2 h'],
      ['Aplicação de textura', 280, '5 h']
    ]),
    C('chaveiro', 'Chaveiro', 'Chaveiro', 'key-round', 'chave fechadura porta trancada tranca copia abrir segredo', [
      ['Abertura de porta', 90, '30 min'],
      ['Troca de fechadura', 130, '45 min'],
      ['Cópia de chave no local', 40, '20 min'],
      ['Instalação de fechadura digital', 220, '1 h 30']
    ]),
    C('informatica', 'Técnico de informática', 'Informática', 'laptop', 'computador notebook pc formatar formatacao virus wifi wi-fi internet rede impressora lento', [
      ['Formatação e instalação de sistema', 120, '2 h'],
      ['Remoção de vírus e otimização', 90, '1 h'],
      ['Configuração de Wi-Fi e rede', 100, '1 h'],
      ['Diagnóstico de computador', 60, '30 min']
    ]),
    C('climatizacao', 'Técnico de climatização', 'Climatização', 'air-vent', 'ar condicionado ar-condicionado split gas higienizacao gelando clima', [
      ['Limpeza de ar-condicionado split', 160, '1 h 30'],
      ['Instalação de split', 450, '4 h'],
      ['Recarga de gás', 220, '1 h'],
      ['Visita técnica', 80, '30 min']
    ]),
    C('jardinagem', 'Jardineiro', 'Jardinagem', 'leaf', 'jardim grama poda planta plantas arvore horta paisagismo', [
      ['Corte de grama (até 50 m²)', 90, '1 h'],
      ['Poda de plantas e arbustos', 110, '1 h 30'],
      ['Manutenção de jardim', 150, '3 h'],
      ['Plantio e adubação', 130, '2 h']
    ]),
    C('frete', 'Fretes e mudanças', 'Fretes', 'truck', 'frete mudanca carreto transporte carregar van caminhao entrega', [
      ['Carreto pequeno (até 5 km)', 90, '1 h'],
      ['Mudança de quarto ou kitnet', 280, '4 h'],
      ['Transporte de móvel', 120, '1 h 30'],
      ['Ajudante por hora', 50, '1 h']
    ]),
    C('beleza', 'Profissional de beleza', 'Beleza', 'scissors', 'cabelo corte barba manicure pedicure unha escova maquiagem cabeleireiro barbeiro', [
      ['Corte de cabelo em domicílio', 60, '45 min'],
      ['Manicure e pedicure', 70, '1 h 15'],
      ['Escova e hidratação', 90, '1 h 30'],
      ['Maquiagem', 150, '1 h']
    ]),
    C('reformas', 'Pedreiro', 'Reformas', 'hard-hat', 'obra reforma parede piso azulejo reboco gesso alvenaria rachadura infiltracao', [
      ['Pequenos reparos de alvenaria', 160, '3 h'],
      ['Assentamento de piso (por m²)', 45, '1 h'],
      ['Reparo de reboco e gesso', 140, '3 h'],
      ['Visita para orçamento', 60, '30 min']
    ])
  ];

  const P = (id, name, cat, rating, jobs, factor, bearing, km, since, wait, bio) =>
    ({ id, name, cat, rating, jobs, factor, bearing, km, since, wait, bio, verified: jobs >= 100 });

  /* factor = ajuste de preço do profissional · bearing/km = posição relativa ao cliente · wait = minutos até ficar livre */
  const pros = [
    P('p1', 'Carlos Menezes', 'eletricista', 4.9, 312, 1.0, 35, 1.2, 2019, 0, 'Eletricista residencial e predial com certificação NR-10. Atendo emergências e pequenas instalações com garantia de 90 dias.'),
    P('p2', 'Juliana Prado', 'eletricista', 4.8, 187, 0.9, 210, 2.6, 2021, 0, 'Especialista em iluminação e automação residencial. Orçamento transparente antes de começar.'),
    P('p3', 'Roberto Farias', 'encanador', 4.9, 421, 1.05, 120, 0.8, 2016, 0, 'Encanador há 15 anos. Caça-vazamentos, desentupimento e reparos hidráulicos sem quebra-quebra.'),
    P('p4', 'Thiago Nogueira', 'encanador', 4.7, 96, 0.9, 300, 3.4, 2022, 25, 'Atendimento rápido para vazamentos, torneiras e descargas. Trabalho limpo e organizado.'),
    P('p5', 'Ana Beatriz Souza', 'limpeza', 5.0, 538, 1.1, 75, 1.6, 2018, 0, 'Diarista detalhista, levo meus próprios produtos se precisar. Mais de 500 atendimentos pela plataforma.'),
    P('p6', 'Cláudia Ramos', 'limpeza', 4.8, 264, 0.95, 250, 2.9, 2020, 40, 'Limpeza residencial e pós-obra. Pontualidade e capricho em cada cômodo.'),
    P('p7', 'Felipe Andrade', 'montador', 4.9, 203, 1.0, 160, 2.1, 2019, 0, 'Montador de móveis planejados e de loja. Ferramentas próprias e montagem sem sobra de peças.'),
    P('p8', 'Diego Martins', 'montador', 4.6, 88, 0.85, 20, 4.3, 2023, 0, 'Montagem e desmontagem de móveis, instalação de prateleiras e suportes de TV.'),
    P('p9', 'Marcos Vinícius Lopes', 'pintor', 4.8, 142, 1.0, 330, 3.1, 2017, 60, 'Pintura residencial com acabamento fino. Protejo móveis e piso e entrego o ambiente limpo.'),
    P('p10', 'Patrícia Leal', 'pintor', 4.9, 75, 1.1, 95, 4.8, 2021, 0, 'Pintora especializada em texturas e efeitos decorativos. Consultoria de cores inclusa.'),
    P('p11', 'Sérgio Batista', 'chaveiro', 4.9, 610, 1.0, 185, 0.6, 2012, 0, 'Chaveiro 24 horas. Abertura sem danos, troca de segredo e fechaduras digitais.'),
    P('p12', 'Wesley Cardoso', 'chaveiro', 4.7, 133, 0.9, 55, 3.7, 2020, 15, 'Atendimento residencial e automotivo com equipamento para cópias no local.'),
    P('p13', 'Bruno Tavares', 'informatica', 4.9, 289, 1.05, 270, 1.9, 2015, 0, 'Técnico em informática: formatação, redes e recuperação de dados. Atendo PCs e notebooks.'),
    P('p14', 'Larissa Moura', 'informatica', 4.8, 154, 0.95, 140, 3.3, 2020, 0, 'Suporte para home office: Wi-Fi, impressoras e configuração de equipamentos.'),
    P('p15', 'Eduardo Pires', 'climatizacao', 4.8, 176, 1.0, 5, 2.4, 2018, 30, 'Instalação e higienização de ar-condicionado split com bomba de vácuo e garantia.'),
    P('p16', 'Renan Azevedo', 'climatizacao', 4.7, 92, 0.9, 225, 5.1, 2022, 0, 'Manutenção preventiva, recarga de gás e limpeza completa de splits.'),
    P('p17', 'João Pedro Sales', 'jardinagem', 4.9, 118, 1.0, 105, 3.9, 2019, 0, 'Jardineiro e paisagista. Poda, corte de grama e manutenção mensal de jardins.'),
    P('p18', 'Helena Duarte', 'jardinagem', 4.8, 67, 1.1, 315, 4.6, 2021, 45, 'Cuidado de plantas, hortas e jardins verticais para casas e apartamentos.'),
    P('p19', 'Anderson Rocha', 'frete', 4.8, 344, 1.0, 240, 1.4, 2017, 0, 'Fretes e pequenas mudanças com van fechada. Ajudo a carregar e proteger seus móveis.'),
    P('p20', 'Fábio Teixeira', 'frete', 4.6, 121, 0.85, 70, 4.1, 2021, 20, 'Carretos rápidos pela cidade. Preço fechado antes de sair.'),
    P('p21', 'Camila Ferraz', 'beleza', 5.0, 402, 1.15, 150, 1.1, 2016, 0, 'Cabeleireira e maquiadora em domicílio. Materiais profissionais e esterilizados.'),
    P('p22', 'Rodrigo Alves', 'beleza', 4.8, 158, 0.95, 290, 2.7, 2019, 35, 'Barbeiro em domicílio: corte, barba e acabamento sem sair de casa.'),
    P('p23', 'Antônio Barros', 'reformas', 4.9, 231, 1.05, 195, 2.2, 2010, 0, 'Pedreiro com 20 anos de experiência em pequenos reparos, pisos e acabamentos.'),
    P('p24', 'Gilberto Nunes', 'reformas', 4.7, 109, 0.9, 345, 5.4, 2018, 50, 'Reparos de alvenaria, gesso e reboco com orçamento sem compromisso.')
  ];

  const REVIEWS = [
    ['Luciana M.', 5, 'Chegou no horário combinado e resolveu tudo rapidamente. Recomendo!'],
    ['Pedro H.', 5, 'Muito profissional, explicou o problema e deixou tudo limpo.'],
    ['Fernanda T.', 4, 'Serviço bem feito e preço justo. Voltarei a chamar.'],
    ['Gustavo R.', 5, 'Atendimento excelente, acompanhei a chegada pelo mapa.'],
    ['Isabela C.', 5, 'Educado, cuidadoso e caprichoso. Nota 10.'],
    ['Marcelo D.', 4, 'Resolveu o que eu precisava sem enrolação.'],
    ['Tatiane S.', 5, 'O pagamento pelo app foi super prático. Ótimo atendimento.'],
    ['Vinícius A.', 5, 'Rápido e honesto no orçamento. Recomendo de olhos fechados.']
  ];
  const WHEN = ['há 3 dias', 'há 2 semanas', 'há 1 mês'];
  const STOP = ['com', 'para', 'uma', 'que', 'meu', 'minha', 'dos', 'das', 'por', 'nao', 'esta'];

  const catById = {};
  categories.forEach((c) => { catById[c.id] = c; });

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** Monta a lista de profissionais com posição, distância, tempo e preços para um local. */
  function build(loc) {
    return pros.map((p, i) => {
      const services = catById[p.cat].services.map((s) => ({ id: s.id, name: s.name, dur: s.dur, price: Math.round((s.price * p.factor) / 5) * 5 }));
      return Object.assign({}, p, {
        hue: 205 + ((i * 13) % 50),
        pos: S.geo.offset(loc, p.bearing, p.km / 1.3),
        eta: S.geo.etaMin(p.km) + p.wait,
        services,
        fromPrice: Math.min.apply(null, services.map((s) => s.price)),
        availableNow: p.wait === 0,
        availLabel: p.wait === 0 ? 'Disponível agora' : `Livre em ${p.wait} min`,
        reviews: [0, 3, 5].map((k, j) => { const r = REVIEWS[(i + k) % REVIEWS.length]; return { name: r[0], stars: r[1], text: r[2], when: WHEN[j] }; })
      });
    }).sort((a, b) => a.km - b.km);
  }

  let cache = { key: '', list: [] };

  function near() {
    const loc = S.store.state.location;
    const key = loc.lat.toFixed(5) + ',' + loc.lng.toFixed(5);
    if (cache.key !== key) cache = { key, list: build(loc) };
    return cache.list;
  }

  function search(opts) {
    const cat = opts.cat || '', sort = opts.sort || 'near';
    const tokens = norm(opts.q).split(/\s+/).filter((t) => t.length > 2 && STOP.indexOf(t) < 0);
    let list = near();
    if (cat) list = list.filter((p) => p.cat === cat);
    if (tokens.length) {
      list = list.map((p) => {
        const c = catById[p.cat];
        const hay = norm(`${p.name} ${c.name} ${c.short} ${c.keywords}`);
        const svc = p.services.find((s) => tokens.some((t) => norm(s.name).includes(t)));
        if (!svc && !tokens.some((t) => hay.includes(t))) return null;
        return Object.assign({}, p, { match: svc || null });
      }).filter(Boolean);
    }
    const price = (p) => (p.match ? p.match.price : p.fromPrice);
    const by = { near: (a, b) => a.km - b.km, rating: (a, b) => b.rating - a.rating || b.jobs - a.jobs, price: (a, b) => price(a) - price(b) };
    return list.slice().sort(by[sort] || by.near);
  }

  S.data = {
    categories,
    norm,
    build,
    near,
    search,
    cat: (id) => catById[id],
    pro: (id) => near().find((p) => p.id === id)
  };
})(window.Servi = window.Servi || {});
