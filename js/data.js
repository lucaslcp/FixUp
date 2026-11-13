/* FixUp — catálogo de demonstração: categorias, serviços de preço fechado e profissionais.
   O histórico de trabalhos de cada profissional fica no banco (js/db.js).
   Em produção, estes dados viriam da API. */
(function (S) {
  'use strict';

  const C = (id, name, short, icon, keywords, services) => ({
    id, name, short, icon, keywords,
    services: services.map((s, i) => ({ id: `${id}-${i + 1}`, name: s[0], price: s[1], dur: s[2] }))
  });

  /* A ordem define o que aparece primeiro na tela inicial. */
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
    C('eletrodomesticos', 'Técnico de eletrodomésticos', 'Eletro­domésticos', 'refrigerator', 'geladeira freezer maquina de lavar lavadora microondas fogao forno lava loucas conserto assistencia tecnica', [
      ['Conserto de geladeira ou freezer', 180, '1 h 30'],
      ['Conserto de máquina de lavar', 170, '1 h 30'],
      ['Conserto de micro-ondas', 130, '1 h'],
      ['Conserto de fogão ou forno', 140, '1 h'],
      ['Visita técnica e diagnóstico', 80, '40 min']
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
    C('climatizacao', 'Técnico de climatização', 'Climatização', 'air-vent', 'ar condicionado ar-condicionado split gas higienizacao gelando clima', [
      ['Limpeza de ar-condicionado split', 160, '1 h 30'],
      ['Instalação de split', 450, '4 h'],
      ['Recarga de gás', 220, '1 h'],
      ['Visita técnica', 80, '30 min']
    ]),
    C('eletronicos', 'Técnico de eletrônicos', 'Eletrônicos', 'tv', 'tv televisao celular smartphone videogame console caixa de som tela bateria', [
      ['Conserto de TV', 220, '2 h'],
      ['Troca de tela de celular', 300, '1 h'],
      ['Manutenção de videogame', 180, '1 h 30'],
      ['Instalação de Smart TV na parede', 150, '1 h'],
      ['Diagnóstico de aparelho', 70, '30 min']
    ]),
    C('informatica', 'Técnico de informática', 'Informática', 'laptop', 'computador notebook pc formatar formatacao virus wifi wi-fi internet rede impressora lento', [
      ['Formatação e instalação de sistema', 120, '2 h'],
      ['Remoção de vírus e otimização', 90, '1 h'],
      ['Configuração de Wi-Fi e rede', 100, '1 h'],
      ['Diagnóstico de computador', 60, '30 min']
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

  /* rating = média desejada das avaliações · n = trabalhos de exemplo gerados no banco · factor = ajuste de preço
     bearing/km = posição relativa ao cliente · wait = minutos até ficar livre · pitch = frase de apresentação (usada no chat)
     focus = grupos de trabalhos em que o profissional é especialista · pins = trabalhos recentes garantidos [grupo, trabalho, marca]
     (grupos e trabalhos são os de TEMPLATES em js/db.js) */
  const P = (id, name, cat, rating, n, factor, bearing, km, since, wait, pitch, bio, focus, pins) =>
    ({ id, name, cat, rating, n, factor, bearing, km, since, wait, pitch, bio, focus: focus || null, pins: pins || [], verified: n >= 20 });

  const pros = [
    P('p1', 'Carlos Menezes', 'eletricista', 4.9, 38, 1.0, 35, 1.2, 2019, 0, 'Eu instalo ou troco seu chuveiro elétrico com segurança e garantia', 'Eletricista residencial e predial com certificação NR-10. Atendo emergências e pequenas instalações com garantia de 90 dias.', [0, 1], [[0, 0, 0], [1, 0, 0]]),
    P('p2', 'Juliana Prado', 'eletricista', 4.8, 26, 0.9, 210, 2.6, 2021, 0, 'Eu cuido da iluminação da sua casa, do lustre à fita de LED', 'Especialista em iluminação e automação residencial. Orçamento transparente antes de começar.', [3]),
    P('p3', 'Roberto Farias', 'encanador', 4.9, 44, 1.05, 120, 0.8, 2016, 0, 'Eu encontro e conserto vazamentos sem quebra-quebra', 'Encanador há 15 anos. Caça-vazamentos, desentupimento e reparos hidráulicos sem quebra-quebra.', [3, 1]),
    P('p4', 'Thiago Nogueira', 'encanador', 4.7, 16, 0.9, 300, 3.4, 2022, 25, 'Eu troco torneiras e conserto descargas no mesmo dia', 'Atendimento rápido para vazamentos, torneiras e descargas. Trabalho limpo e organizado.', [0, 2]),
    P('p5', 'Ana Beatriz Souza', 'limpeza', 5.0, 48, 1.1, 75, 1.6, 2018, 0, 'Eu deixo sua casa impecável, com capricho em cada cômodo', 'Diarista detalhista, levo meus próprios produtos se precisar. Uma das profissionais mais bem avaliadas da plataforma.'),
    P('p6', 'Cláudia Ramos', 'limpeza', 4.8, 30, 0.95, 250, 2.9, 2020, 40, 'Eu faço limpeza residencial e pós-obra com pontualidade', 'Limpeza residencial e pós-obra. Pontualidade e capricho em cada cômodo.'),
    P('p7', 'Felipe Andrade', 'montador', 4.9, 28, 1.0, 160, 2.1, 2019, 0, 'Eu monto seus móveis sem sobrar nenhuma peça', 'Montador de móveis planejados e de loja. Ferramentas próprias e montagem sem sobra de peças.', [0, 1]),
    P('p8', 'Diego Martins', 'montador', 4.6, 14, 0.85, 20, 4.3, 2023, 0, 'Eu instalo suportes de TV, prateleiras e cortinas', 'Montagem e desmontagem de móveis, instalação de prateleiras e suportes de TV.', [2]),
    P('p9', 'Marcos Vinícius Lopes', 'pintor', 4.8, 22, 1.0, 330, 3.1, 2017, 60, 'Eu pinto seu ambiente com acabamento fino e entrego tudo limpo', 'Pintura residencial com acabamento fino. Protejo móveis e piso e entrego o ambiente limpo.'),
    P('p10', 'Patrícia Leal', 'pintor', 4.9, 15, 1.1, 95, 4.8, 2021, 0, 'Eu faço texturas e efeitos decorativos nas suas paredes', 'Pintora especializada em texturas e efeitos decorativos. Consultoria de cores inclusa.'),
    P('p11', 'Sérgio Batista', 'chaveiro', 4.9, 52, 1.0, 185, 0.6, 2012, 0, 'Eu abro sua porta sem danos, a qualquer hora', 'Chaveiro 24 horas. Abertura sem danos, troca de segredo e fechaduras digitais.', [0]),
    P('p12', 'Wesley Cardoso', 'chaveiro', 4.7, 20, 0.9, 55, 3.7, 2020, 15, 'Eu instalo fechaduras digitais e faço chaves no local', 'Atendimento residencial e automotivo com equipamento para cópias no local.', [1, 2]),
    P('p13', 'Bruno Tavares', 'informatica', 4.9, 34, 1.05, 270, 1.9, 2015, 0, 'Eu conserto seu notebook e deixo ele rápido de novo', 'Técnico em informática: formatação, redes e recuperação de dados. Atendo PCs e notebooks.', [0, 1]),
    P('p14', 'Larissa Moura', 'informatica', 4.8, 22, 0.95, 140, 3.3, 2020, 0, 'Eu resolvo seu Wi-Fi, sua rede e sua impressora', 'Suporte para home office: Wi-Fi, impressoras e configuração de equipamentos.', [2, 3]),
    P('p15', 'Eduardo Pires', 'climatizacao', 4.8, 26, 1.0, 5, 2.4, 2018, 30, 'Eu instalo e higienizo seu ar-condicionado com garantia', 'Instalação e higienização de ar-condicionado split com bomba de vácuo e garantia.'),
    P('p16', 'Renan Azevedo', 'climatizacao', 4.7, 15, 0.9, 225, 5.1, 2022, 0, 'Eu faço manutenção e recarga de gás do seu split', 'Manutenção preventiva, recarga de gás e limpeza completa de splits.'),
    P('p17', 'João Pedro Sales', 'jardinagem', 4.9, 20, 1.0, 105, 3.9, 2019, 0, 'Eu cuido do seu jardim: poda, grama e manutenção mensal', 'Jardineiro e paisagista. Poda, corte de grama e manutenção mensal de jardins.'),
    P('p18', 'Helena Duarte', 'jardinagem', 4.8, 13, 1.1, 315, 4.6, 2021, 45, 'Eu monto hortas e jardins verticais para casas e apartamentos', 'Cuidado de plantas, hortas e jardins verticais para casas e apartamentos.'),
    P('p19', 'Anderson Rocha', 'frete', 4.8, 36, 1.0, 240, 1.4, 2017, 0, 'Eu faço seu frete ou sua mudança com van fechada', 'Fretes e pequenas mudanças com van fechada. Ajudo a carregar e proteger seus móveis.'),
    P('p20', 'Fábio Teixeira', 'frete', 4.6, 18, 0.85, 70, 4.1, 2021, 20, 'Eu faço carretos rápidos com preço fechado', 'Carretos rápidos pela cidade. Preço fechado antes de sair.'),
    P('p21', 'Camila Ferraz', 'beleza', 5.0, 42, 1.15, 150, 1.1, 2016, 0, 'Eu faço cabelo e maquiagem na sua casa', 'Cabeleireira e maquiadora em domicílio. Materiais profissionais e esterilizados.'),
    P('p22', 'Rodrigo Alves', 'beleza', 4.8, 24, 0.95, 290, 2.7, 2019, 35, 'Eu faço corte e barba em domicílio', 'Barbeiro em domicílio: corte, barba e acabamento sem sair de casa.'),
    P('p23', 'Antônio Barros', 'reformas', 4.9, 30, 1.05, 195, 2.2, 2010, 0, 'Eu faço pequenos reparos, pisos e acabamentos', 'Pedreiro com 20 anos de experiência em pequenos reparos, pisos e acabamentos.', [0, 1]),
    P('p24', 'Gilberto Nunes', 'reformas', 4.7, 17, 0.9, 345, 5.4, 2018, 50, 'Eu conserto gesso, reboco e infiltrações', 'Reparos de alvenaria, gesso e reboco com orçamento sem compromisso.', [2, 3]),
    P('p25', 'Paulo Henrique Sato', 'eletrodomesticos', 4.9, 46, 1.05, 60, 1.5, 2014, 0, 'Eu conserto sua geladeira ou seu freezer no mesmo dia', 'Técnico em refrigeração há 12 anos. Conserto geladeiras e freezers de todas as marcas, com peças novas e garantia de 90 dias.', [0, 0, 1], [[0, 0, 0], [0, 0, 3], [0, 1, 2]]),
    P('p26', 'Simone Guedes', 'eletrodomesticos', 4.8, 33, 0.95, 200, 2.8, 2018, 0, 'Eu conserto sua máquina de lavar e seu micro-ondas em casa', 'Técnica em eletrodomésticos: lavadoras, lava e seca, micro-ondas e lava-louças. Orçamento sem compromisso.', [2, 2, 3], [[2, 0, 0]]),
    P('p27', 'Jorge Amaral', 'eletrodomesticos', 4.7, 19, 0.9, 320, 4.4, 2021, 20, 'Eu faço a manutenção do seu fogão, da sua geladeira e da sua lavadora', 'Assistência multimarcas para a linha branca. Atendo fogões, geladeiras e máquinas de lavar.', [4, 0, 2], [[0, 0, 5]]),
    P('p28', 'Vitor Nakamura', 'eletronicos', 4.9, 37, 1.05, 130, 1.8, 2016, 0, 'Eu conserto sua TV e seu videogame', 'Técnico em eletrônica: TVs de LED, placas e videogames. Bancada própria e garantia no reparo.', [0, 0, 2]),
    P('p29', 'Aline Rezende', 'eletronicos', 4.8, 21, 0.95, 280, 3.6, 2020, 15, 'Eu troco a tela e a bateria do seu celular na hora', 'Assistência técnica de celulares e áudio. Troca de tela, bateria e conector com peças de qualidade.', [1, 1, 3])
  ];

  /* O profissional que o usuário assume no modo profissional. */
  const me = { id: 'me', name: 'Rafael Lima', cat: 'eletricista', rating: 4.9, n: 18, factor: 1, focus: [0, 1, 2, 3], pins: [] };

  /* Últimos atendimentos dele: aparecem no extrato de ganhos e no banco de trabalhos. [cliente, serviço, valor, horas atrás] */
  const myRecent = [
    ['Beatriz Almeida', 'Instalação de chuveiro elétrico', 118.5, 1.5],
    ['Henrique Dias', 'Troca de disjuntor', 127, 4],
    ['Sofia Carvalho', 'Instalação de tomada ou interruptor', 86.5, 31],
    ['Lucas Ferreira', 'Instalação de luminária ou ventilador', 101, 60],
    ['Marta Oliveira', 'Visita técnica e diagnóstico', 76, 86],
    ['Caio Ribeiro', 'Troca de disjuntor', 125.5, 130]
  ];

  const catById = {};
  categories.forEach((c) => { catById[c.id] = c; });

  /** Monta a lista de profissionais com posição, distância, tempo, preços e números vindos do banco. */
  function build(loc) {
    return pros.map((p, i) => {
      const services = catById[p.cat].services.map((s) => ({ id: s.id, name: s.name, dur: s.dur, price: Math.round((s.price * p.factor) / 5) * 5 }));
      const stats = S.db.stats(p.id);
      return Object.assign({}, p, {
        hue: 228 + ((i * 11) % 38),
        rating: stats.count ? stats.rating : p.rating,
        jobs: stats.count,
        pos: S.geo.offset(loc, p.bearing, p.km / 1.3),
        eta: S.geo.etaMin(p.km) + p.wait,
        services,
        fromPrice: Math.min.apply(null, services.map((s) => s.price)),
        availableNow: p.wait === 0,
        availLabel: p.wait === 0 ? 'Disponível agora' : `Livre em ${p.wait} min`
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

  S.data = {
    categories,
    pros,
    me,
    myRecent,
    build,
    near,
    /** Chamado quando o banco muda (novo trabalho ou avaliação): os números dos profissionais são recalculados. */
    invalidate() { cache = { key: '', list: [] }; },
    cat: (id) => catById[id],
    pro: (id) => near().find((p) => p.id === id)
  };
})(window.FixUp = window.FixUp || {});
