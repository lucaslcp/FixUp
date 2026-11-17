/* FixUp — vocabulário de problemas.
   Cada conceito reúne as várias formas de dizer a mesma coisa ("geladeira", "refrigerador", "frigobar").
   A busca usa esta lista para entender o que o cliente descreveu e comparar com os trabalhos
   já realizados pelos profissionais (veja js/match.js).

   Tipos: device = aparelho ou objeto do serviço · part = peça ou parte · symptom = o que está acontecendo
          action = o que precisa ser feito · brand = marca · place = lugar ou contexto
   cats   = categorias que o termo indica · strong = ação que define a categoria sozinha (ex.: "mudança")
   Os termos são escritos sem acento e em minúsculas; a busca ignora acentos, plurais e conjugações. */
(function (S) {
  'use strict';

  const C = [];
  const add = (type) => (id, label, cats, terms, o) => C.push(Object.assign({ id, type, label, cats: cats ? cats.split(' ') : [], terms: terms.split('|') }, o));
  const D = add('device'), P = add('part'), Y = add('symptom'), A = add('action'), L = add('place');
  const B = (id, label, terms) => C.push({ id, type: 'brand', label, cats: [], terms: (terms || id).split('|') });
  const STRONG = { strong: true };

  /* ---------- Aparelhos e objetos ---------- */
  D('geladeira', 'Geladeira', 'eletrodomesticos', 'geladeira|refrigerador|frigobar|frost free|side by side|duplex');
  D('freezer', 'Freezer', 'eletrodomesticos', 'freezer|congelador');
  D('lavadora', 'Máquina de lavar', 'eletrodomesticos', 'maquina de lavar|maquina de lavar roupa|lavadora|lava roupas|lava e seca|tanquinho');
  D('secadora', 'Secadora', 'eletrodomesticos', 'secadora|secadora de roupas');
  D('lavaloucas', 'Lava-louças', 'eletrodomesticos', 'lava loucas|lava louca|lavaloucas|maquina de lavar louca');
  D('microondas', 'Micro-ondas', 'eletrodomesticos', 'micro ondas|microondas|forno micro ondas');
  D('fogao', 'Fogão', 'eletrodomesticos', 'fogao|cooktop|forno|forno eletrico');
  D('depurador', 'Coifa ou depurador', 'eletrodomesticos', 'coifa|depurador|exaustor');
  D('purificador', 'Purificador de água', 'eletrodomesticos', 'purificador|bebedouro|filtro de agua');

  D('tv', 'TV', 'eletronicos', 'tv|televisao|televisor|smart tv|smarttv');
  D('celular', 'Celular', 'eletronicos', 'celular|smartphone|iphone|galaxy|telefone');
  D('tablet', 'Tablet', 'eletronicos', 'tablet|ipad');
  D('videogame', 'Videogame', 'eletronicos', 'videogame|video game|console|playstation|ps4|ps5|xbox|nintendo');
  D('som', 'Caixa de som', 'eletronicos', 'caixa de som|soundbar|home theater|aparelho de som|fone de ouvido|headset');

  D('computador', 'Computador', 'informatica', 'computador|pc|desktop|cpu|gabinete|pc gamer');
  D('notebook', 'Notebook', 'informatica', 'notebook|laptop|macbook|ultrabook');
  D('impressora', 'Impressora', 'informatica', 'impressora|multifuncional|scanner');
  D('roteador', 'Wi-Fi e rede', 'informatica', 'roteador|wifi|wi fi|internet|rede|modem|repetidor|mesh|cabo de rede');

  D('arcondicionado', 'Ar-condicionado', 'climatizacao', 'ar condicionado|arcondicionado|condicionador de ar|split|ar split|ar de janela|climatizador|condensadora|evaporadora');

  D('chuveiro', 'Chuveiro', 'eletricista', 'chuveiro|ducha|chuveiro eletrico');
  D('tomada', 'Tomada', 'eletricista', 'tomada|plugue|extensao');
  D('interruptor', 'Interruptor', 'eletricista', 'interruptor|dimmer|interruptor paralelo');
  D('disjuntor', 'Disjuntor e quadro de luz', 'eletricista', 'disjuntor|quadro de luz|quadro de energia|quadro eletrico|quadro de disjuntores|dispositivo dr|dr|padrao de energia');
  D('luminaria', 'Iluminação', 'eletricista', 'luminaria|lustre|plafon|spot|lampada|iluminacao|fita de led|arandela|refletor|pendente|reator');
  D('ventilador', 'Ventilador de teto', 'eletricista', 'ventilador|ventilador de teto');
  D('fiacao', 'Fiação elétrica', 'eletricista', 'fiacao|fio|rede eletrica|instalacao eletrica|curto circuito|parte eletrica');
  D('interfone', 'Interfone e portão', 'eletricista', 'interfone|campainha|portao eletronico|portao automatico|motor de portao|cerca eletrica|video porteiro');

  D('torneira', 'Torneira', 'encanador', 'torneira|misturador|monocomando');
  D('pia', 'Pia e ralo', 'encanador', 'pia|cuba|sifao|ralo|tanque');
  D('vaso', 'Vaso sanitário', 'encanador', 'vaso sanitario|vaso|privada|descarga|caixa acoplada|valvula de descarga|bacia sanitaria');
  D('cano', 'Encanamento', 'encanador', 'cano|tubulacao|encanamento|tubo|registro|conexao');
  D('caixadagua', 'Caixa d’água', 'encanador', 'caixa d agua|caixa dagua|caixa de agua|boia|cisterna');
  D('aquecedor', 'Aquecedor', 'encanador', 'aquecedor|aquecedor a gas|boiler|aquecedor solar');
  D('esgoto', 'Esgoto', 'encanador', 'esgoto|fossa|caixa de gordura');

  D('guardaroupa', 'Guarda-roupa', 'montador', 'guarda roupa|guarda roupas|roupeiro|closet');
  D('cama', 'Cama', 'montador', 'cama|beliche|berco|cama box');
  D('movel', 'Móveis', 'montador', 'movel|comoda|estante|rack|escrivaninha|mesa|sapateira|cozinha planejada|armario|armario de cozinha|gaveteiro|painel de tv');
  D('prateleira', 'Prateleiras', 'montador', 'prateleira|nicho');
  D('suportetv', 'Suporte de TV', 'montador', 'suporte de tv|suporte tv|suporte articulado');
  D('cortina', 'Cortina e persiana', 'montador', 'cortina|persiana|varao');
  D('quadro', 'Quadros e espelhos', 'montador', 'quadro|espelho');

  D('fechadura', 'Fechadura', 'chaveiro', 'fechadura|tetra|cilindro|miolo|segredo');
  D('fechaduradigital', 'Fechadura digital', 'chaveiro', 'fechadura digital|fechadura eletronica|fechadura biometrica|smart lock');
  D('chave', 'Chave', 'chaveiro', 'chave|copia de chave|chave codificada');
  D('carro', 'Carro', 'chaveiro', 'carro|veiculo|automovel', { cw: 1 });

  D('estofado', 'Sofá e estofados', 'limpeza', 'sofa|estofado|colchao|tapete|carpete|poltrona');
  D('vidros', 'Vidros e janelas', 'limpeza', 'vidro|janela|vidraca|sacada', { cw: 1.5 });

  D('grama', 'Gramado', 'jardinagem', 'grama|gramado|mato|terreno');
  D('poda', 'Poda', 'jardinagem', 'poda|arvore|arbusto|cerca viva|galho');
  D('jardim', 'Jardim e plantas', 'jardinagem', 'jardim|canteiro|horta|planta|paisagismo|jardim vertical|adubo|adubacao|plantio|jardineira');

  D('piscina', 'Piscina', 'piscina', 'piscina|piscinas|spa|ofuro|hidromassagem|jacuzzi|prainha', { cw: 2.5 });

  D('cabelo', 'Cabelo', 'beleza', 'cabelo|corte de cabelo|escova|hidratacao|progressiva|tintura|mechas|coloracao|penteado');
  D('barba', 'Barba', 'beleza', 'barba|bigode|degrade');
  D('unha', 'Unhas', 'beleza', 'unha|manicure|pedicure|esmaltacao|alongamento de unha');
  D('maquiagem', 'Maquiagem', 'beleza', 'maquiagem|make|maquiadora');
  D('sobrancelha', 'Sobrancelha', 'beleza', 'sobrancelha|cilios|depilacao|henna');

  D('piso', 'Piso e revestimento', 'reformas', 'piso|porcelanato|ceramica|azulejo|revestimento|rejunte|rodape|contrapiso');
  D('alvenaria', 'Alvenaria', 'reformas', 'reboco|alvenaria|tijolo|mureta|muro|concreto|cimento|laje');
  D('gesso', 'Gesso e drywall', 'reformas', 'gesso|drywall|forro|sanca|moldura');
  D('telhado', 'Telhado', 'reformas', 'telhado|telha|calha|goteira|rufo');

  /* ---------- Peças e partes ---------- */
  P('placa', 'Placa / fonte de energia', 'eletrodomesticos eletronicos informatica climatizacao', 'placa|placa eletronica|placa fonte|placa de potencia|placa principal|placa mae|placa logica|fonte|fonte de energia|fonte de alimentacao|modulo eletronico|inversor', { cw: 0.4 });
  P('compressor', 'Compressor', 'eletrodomesticos climatizacao', 'compressor|motor da geladeira|rele|protetor termico', { cw: 0.6 });
  P('gas', 'Gás refrigerante', 'eletrodomesticos climatizacao', 'gas|gas refrigerante|carga de gas|recarga de gas|recarga|filtro secador', { cw: 0.5 });
  P('termostato', 'Termostato / sensor', 'eletrodomesticos climatizacao', 'termostato|sensor|sensor de temperatura|sensor de degelo|degelo|resistencia de degelo|timer', { cw: 0.5 });
  P('borracha', 'Borracha de vedação', 'eletrodomesticos', 'borracha|gaxeta|vedacao|anel de vedacao', { cw: 0.6 });
  P('resistencia', 'Resistência', 'eletricista eletrodomesticos', 'resistencia', { cw: 0.6 });
  P('motor', 'Motor / ventoinha', 'eletrodomesticos informatica eletronicos', 'motor|motor ventilador|ventoinha|cooler|helice|pasta termica', { cw: 0.3 });
  P('bomba', 'Bomba de água', 'eletrodomesticos encanador', 'bomba|bomba de drenagem|bomba d agua|eletrobomba|pressurizador', { cw: 0.5 });
  P('filtropiscina', 'Filtro e bomba da piscina', 'piscina', 'filtro da piscina|bomba da piscina|areia do filtro|pre filtro|skimmer|dispositivo de retorno|ralo de fundo|clorador|casa de maquinas', { cw: 2 });
  P('correia', 'Correia / rolamento', 'eletrodomesticos', 'correia|rolamento|retentor|tambor|cesto|agitador|amortecedor');
  P('valvula', 'Válvula / mangueira', 'eletrodomesticos encanador', 'mangueira|valvula|valvula de entrada|pressostato', { cw: 0.5 });
  P('magnetron', 'Componentes eletrônicos', 'eletrodomesticos eletronicos', 'magnetron|capacitor|diodo|fusivel|transformador|membrana', { cw: 0.8 });
  P('acendedor', 'Acendimento / queimadores', 'eletrodomesticos', 'acendedor|acendimento|acendimento automatico|usina|queimador|boca|trempe|termopar|registro de gas|chama');
  P('tela', 'Tela / display', 'eletronicos informatica', 'tela|display|lcd|touch|backlight|barra de led|vidro trincado|painel', { cw: 1 });
  P('bateria', 'Bateria / carregamento', 'eletronicos informatica', 'bateria|carregador|conector de carga|conector|entrada de carga|nao carrega', { cw: 1 });
  P('hdmi', 'Entrada HDMI', 'eletronicos', 'hdmi|entrada hdmi|porta hdmi');
  P('controle', 'Controle', 'eletronicos', 'controle|controle remoto|joystick|analogico|drift', { cw: 0.8 });
  P('teclado', 'Teclado', 'informatica', 'teclado|touchpad|tecla|carcaca');
  P('armazenamento', 'HD, SSD e memória', 'informatica', 'hd|ssd|memoria|memoria ram|disco|upgrade|recuperacao de dados');
  P('sistema', 'Sistema e programas', 'informatica', 'windows|sistema operacional|formatar|formatacao|backup|driver|office|programa|software|sistema', { cw: 2 });
  P('virus', 'Vírus', 'informatica', 'virus|malware|antivirus|propaganda', { cw: 2 });
  P('cartucho', 'Cartucho / cabeçote', 'informatica', 'cartucho|toner|cabecote|cabecote de impressao');
  P('dreno', 'Dreno / filtros', 'climatizacao eletrodomesticos', 'dreno|bandeja|filtro|serpentina', { cw: 0.5 });
  P('dobradica', 'Dobradiças e corrediças', 'montador', 'dobradica|corredica|gaveta|puxador|trilho');
  P('textura', 'Textura e efeitos', 'pintor', 'textura|grafiato|massa corrida|cimento queimado|esmalte|verniz', { cw: 2.5 });
  P('infiltracao', 'Infiltração e rachadura', 'reformas pintor', 'infiltracao|umidade|mofo|rachadura|fissura|impermeabilizacao|bolor|descascando', { cw: 2 });

  /* ---------- Sintomas ---------- */
  Y('naoliga', 'Não liga', '', 'nao liga|nao funciona|parou de funcionar|parou|nao da sinal|pifou|nao acende|apagou|desliga sozinho|nao inicia|nao da partida|morreu|painel apagado|nao responde');
  Y('queimou', 'Queimou', '', 'queimou|estourou|cheiro de queimado|fumaca|faisca|choque|dando choque|derretendo|curto');
  Y('quebrou', 'Quebrou / com defeito', '', 'quebrou|danificado|estragou|com defeito|defeito|problema|trincou|rachou|caiu|pane');
  Y('naogela', 'Não gela', 'eletrodomesticos climatizacao', 'nao gela|nao resfria|nao refrigera|parou de gelar|gelando pouco|nao congela|esquentando|nao esfria', { cw: 0.8 });
  Y('naoesquenta', 'Não esquenta', '', 'nao esquenta|nao aquece|agua fria|chama fraca');
  Y('vazando', 'Vazamento', 'encanador', 'vazando|pingando|gotejando|escorrendo|transbordando|molhando', { cw: 0.8 });
  Y('entupido', 'Entupimento', 'encanador', 'entupido|desentupir|nao desce|agua parada|agua subindo', { cw: 1 });
  Y('desarma', 'Desarmando / caindo', 'eletricista', 'desarmando|desarma|desarmou|caindo', { cw: 0.8 });
  Y('barulho', 'Barulho', '', 'barulho|ruido|estalo|zumbido|vibrando|trepidando|rangendo|batendo');
  Y('lento', 'Lento / travando', 'informatica', 'lento|travando|devagar|lentidao|demora|reiniciando', { cw: 0.8 });
  Y('naocentrifuga', 'Não centrifuga / não enche', 'eletrodomesticos', 'nao centrifuga|nao bate|nao gira|nao enche|nao drena|nao solta agua|nao escoa', { cw: 1.5 });
  Y('semsinal', 'Sem sinal / sem imagem', 'eletronicos informatica', 'sem sinal|sem internet|nao conecta|sem imagem|sem som|tela preta|listras|cai toda hora', { cw: 0.6 });
  Y('sujo', 'Sujeira / mau cheiro', 'limpeza', 'sujo|mau cheiro|cheiro ruim|mancha|encardido', { cw: 0.5 });
  Y('aguaverde', 'Água verde ou turva', 'piscina', 'agua verde|agua turva|agua leitosa|agua esverdeada|alga|algas|limo|lodo', { cw: 1.5 });
  Y('desregulado', 'Desregulado / solto', '', 'desregulado|frouxo|solto|folga|bambo|desalinhado|torto|saindo do trilho');

  /* ---------- Ações ---------- */
  /* generic = ação comum a qualquer serviço: não diz se dois trabalhos são o mesmo. */
  A('conserto', 'Conserto', '', 'consertar|conserto|concertar|concerto|arrumar|reparar|reparo|manutencao|assistencia|assistencia tecnica|tecnico|resolver|corrigir|revisao', { generic: true });
  A('instalacao', 'Instalação', '', 'instalar|instalacao|colocar|fixar|pendurar');
  A('troca', 'Troca', '', 'trocar|troca|substituir|substituicao');
  A('limpezaleve', 'Limpeza', 'limpeza climatizacao', 'limpeza|limpar|higienizacao|higienizar|lavagem', { cw: 1 });
  A('orcamento', 'Orçamento / visita', '', 'orcamento|visita|visita tecnica|diagnostico|avaliar|avaliacao|vistoria', { generic: true });

  /* exclusive = quando aparece, a categoria é a da ação, não a do objeto ("transportar geladeira" é frete). */
  const ONLY = { strong: true, exclusive: true };
  A('montagem', 'Montagem', 'montador', 'montar|montagem|desmontar|desmontagem|montador|remontagem', STRONG);
  A('faxina', 'Faxina', 'limpeza', 'faxina|faxineira|diarista|limpeza residencial|limpeza pesada|limpeza de casa|limpeza pos obra|pos obra|limpeza de mudanca|passadoria|passar roupa|passar roupas|organizar armarios|organizacao de armarios', ONLY);
  A('pintura', 'Pintura', 'pintor', 'pintar|pintura|repintura|repintar|pintor|demao', ONLY);
  A('frete', 'Frete e mudança', 'frete', 'mudanca|carreto|frete|transportar|transporte|descarregar|caminhao|ajudante|van', ONLY);
  A('jardinagem', 'Jardinagem', 'jardinagem', 'jardineiro|jardinagem|paisagista', STRONG);
  A('piscineiro', 'Piscineiro', 'piscina', 'piscineiro|limpeza de piscina|limpar piscina|limpar a piscina|tratamento de piscina|tratar piscina|tratar a piscina|aspirar piscina|aspirar a piscina|aspiracao|cloro|clorar|algicida|decantar|decantacao', STRONG);
  A('abertura', 'Abertura de porta ou carro', 'chaveiro', 'chaveiro|abrir porta|abertura de porta|abrir a porta|abertura de carro|trancado|tranquei|chave quebrou', STRONG);
  A('eletricista', 'Eletricista', 'eletricista', 'eletricista', STRONG);
  A('encanador', 'Encanador', 'encanador', 'encanador|bombeiro hidraulico|caca vazamento|hidraulica', STRONG);
  A('pedreiro', 'Obra e reforma', 'reformas', 'pedreiro|reforma|reformar|obra|assentar|assentamento|construcao', STRONG);
  A('informatica', 'Informática', 'informatica', 'informatica|tecnico de informatica|suporte tecnico', STRONG);
  A('beleza', 'Beleza', 'beleza', 'cabeleireiro|cabeleireira|barbeiro|salao', STRONG);
  A('eletro', 'Eletrodomésticos', 'eletrodomesticos', 'eletrodomestico|linha branca', STRONG);
  A('eletronica', 'Eletrônicos', 'eletronicos', 'eletronico|eletronica', STRONG);

  /* ---------- Lugares e contexto ---------- */
  L('porta', 'Porta', 'chaveiro', 'porta|portao');
  L('parede', 'Parede', 'pintor reformas', 'parede|teto|fachada|comodo');
  L('energia', 'Energia elétrica', 'eletricista', 'luz|energia|energia eletrica|eletricidade|queda de luz|queda de energia|pico de energia');
  L('casa', 'Casa', 'limpeza', 'casa|apartamento|kitnet|residencia');

  /* ---------- Marcas ---------- */
  B('electrolux', 'Electrolux', 'electrolux|eletrolux');
  B('brastemp', 'Brastemp'); B('consul', 'Consul'); B('samsung', 'Samsung'); B('lg', 'LG'); B('panasonic', 'Panasonic');
  B('midea', 'Midea'); B('philco', 'Philco'); B('britania', 'Britânia'); B('mondial', 'Mondial'); B('atlas', 'Atlas');
  B('dako', 'Dako'); B('fischer', 'Fischer'); B('mueller', 'Mueller'); B('metalfrio', 'Metalfrio'); B('fricon', 'Fricon');
  B('lorenzetti', 'Lorenzetti'); B('hydra', 'Hydra'); B('fame', 'Fame'); B('tramontina', 'Tramontina'); B('docol', 'Docol');
  B('deca', 'Deca'); B('celite', 'Celite'); B('incepa', 'Incepa'); B('tigre', 'Tigre'); B('rinnai', 'Rinnai');
  B('komeco', 'Komeco'); B('bosch', 'Bosch'); B('yale', 'Yale'); B('intelbras', 'Intelbras'); B('papaiz', 'Papaiz');
  B('pado', 'Pado'); B('stam', 'Stam'); B('arouca', 'Arouca'); B('dell', 'Dell'); B('lenovo', 'Lenovo'); B('acer', 'Acer');
  B('asus', 'Asus'); B('hp', 'HP'); B('positivo', 'Positivo'); B('motorola', 'Motorola'); B('xiaomi', 'Xiaomi', 'xiaomi|redmi');
  B('sony', 'Sony'); B('tcl', 'TCL'); B('aoc', 'AOC'); B('springer', 'Springer'); B('gree', 'Gree'); B('elgin', 'Elgin');
  B('fujitsu', 'Fujitsu'); B('daikin', 'Daikin'); B('tplink', 'TP-Link', 'tp link|tplink'); B('multilaser', 'Multilaser');
  B('dancor', 'Dancor'); B('sodramar', 'Sodramar'); B('nautilus', 'Nautilus');
  B('epson', 'Epson'); B('canon', 'Canon'); B('brother', 'Brother'); B('jbl', 'JBL'); B('madesa', 'Madesa'); B('henn', 'Henn');
  B('moval', 'Moval'); B('politorno', 'Politorno'); B('artely', 'Artely'); B('mobly', 'Mobly'); B('siemens', 'Siemens');
  B('schneider', 'Schneider'); B('steck', 'Steck'); B('weg', 'WEG');

  S.lexicon = {
    concepts: C,

    /** Conceitos análogos: um trabalho com um deles conta (com peso menor) para uma busca pelo outro. */
    groups: [
      ['geladeira', 'freezer'], ['lavadora', 'secadora', 'lavaloucas'], ['computador', 'notebook'], ['celular', 'tablet'],
      ['tomada', 'interruptor'], ['luminaria', 'ventilador'], ['disjuntor', 'fiacao'], ['torneira', 'cano'], ['pia', 'vaso', 'esgoto'],
      ['guardaroupa', 'movel', 'cama'], ['prateleira', 'suportetv', 'cortina', 'quadro'], ['fechadura', 'fechaduradigital', 'chave'],
      ['placa', 'magnetron'], ['compressor', 'gas', 'termostato'], ['motor', 'correia', 'bomba'], ['armazenamento', 'sistema', 'virus'],
      ['naoliga', 'queimou', 'quebrou'], ['piso', 'alvenaria'], ['telhado', 'infiltracao'], ['grama', 'poda', 'jardim'], ['cabelo', 'barba']
    ]
  };
})(window.FixUp = window.FixUp || {});
