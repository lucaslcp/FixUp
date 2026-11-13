/* FixUp — banco de trabalhos realizados.

   Guarda um registro para cada serviço concluído por cada profissional. É o que alimenta a busca
   por problema (js/match.js), o histórico no perfil e a contagem de serviços e avaliações.

   Onde fica: no IndexedDB do navegador (banco "fixup", visível em Ferramentas do desenvolvedor >
   Application > IndexedDB). Se o navegador bloquear o IndexedDB, o banco funciona só em memória.

   Tabela "jobs" (chave: id · índices: proId, cat, doneAt)
     id        identificador do registro
     proId     profissional que fez o trabalho ("me" = o usuário no modo profissional)
     cat       categoria (js/data.js)
     kind      grupo do trabalho dentro da categoria ("Geladeira", "Tomadas"...)
     title     o que foi feito ("Troca da placa fonte")
     device    aparelho ("geladeira") · brand ("Electrolux") · model ("DF52")
     problem   o problema, nas palavras do cliente
     price     valor do serviço · min: duração em minutos
     doneAt    data de conclusão (timestamp)
     rating    nota de 1 a 5 (null enquanto o cliente não avalia) · review: comentário
     client    primeiro nome e inicial do cliente
     source    "seed" (dados de exemplo) ou "app" (criado por um pedido feito no app) · orderId

   Em produção, esta tabela fica no servidor (PostgreSQL, por exemplo) com os mesmos campos. */
(function (S) {
  'use strict';

  const DB_NAME = 'fixup', DB_VERSION = 1, SEED_VERSION = 1;
  const DAY = 864e5, HOUR = 36e5;

  /* =====================================================================
     Modelos dos trabalhos de exemplo
     G(grupo, aparelho, marcas e modelos, [título, problema nas palavras do cliente, preço, minutos])
     ===================================================================== */
  const G = (k, d, b, j) => ({ k, d, b, j });

  const T = {
    eletrodomesticos: [
      G('Geladeira', 'geladeira', ['Electrolux DF52', 'Electrolux DB53', 'Electrolux TF55', 'Brastemp BRM44', 'Brastemp BRE57', 'Consul CRM50', 'Consul CRD37', 'Samsung RT38', 'LG GN-B392', 'Panasonic NR-BT55'], [
        ['Troca da placa fonte', 'Geladeira não liga mais, nem a luz acende. A fonte de energia da placa queimou depois de uma queda de luz.', 340, 90],
        ['Reparo da placa eletrônica', 'Painel da geladeira piscando e desligando sozinha. Placa eletrônica com defeito.', 290, 80],
        ['Recarga de gás e troca do filtro secador', 'Geladeira não gela, o motor fica ligado o tempo todo e o freezer não congela.', 380, 120],
        ['Troca do relé e do protetor térmico do compressor', 'Geladeira parou de gelar e o compressor faz um estalo e não dá partida.', 190, 60],
        ['Troca do sensor e da resistência de degelo', 'Freezer formando muito gelo e a parte de baixo esquentando.', 230, 75],
        ['Troca da borracha de vedação da porta', 'Porta da geladeira não veda, borracha rasgada e suando por fora.', 180, 45],
        ['Desobstrução do dreno', 'Geladeira vazando água por baixo e acumulando água na gaveta de legumes.', 140, 45],
        ['Troca do motor ventilador', 'Geladeira fazendo barulho alto de ventoinha e gelando pouco.', 210, 60],
        ['Troca do termostato', 'Geladeira congelando os alimentos na parte de baixo, termostato desregulado.', 170, 50]
      ]),
      G('Freezer', 'freezer', ['Consul CHB53', 'Electrolux H300', 'Metalfrio DA302', 'Fricon HCED411'], [
        ['Recarga de gás', 'Freezer horizontal não congela mais, só resfria.', 320, 100],
        ['Troca do compressor', 'Freezer não liga, compressor queimado.', 620, 180],
        ['Troca do termostato', 'Freezer não desliga e está congelando demais.', 160, 45]
      ]),
      G('Máquina de lavar', 'máquina de lavar', ['Electrolux LAC11', 'Electrolux LED14', 'Brastemp BWK12', 'Brastemp BWH15', 'Consul CWH12', 'Samsung WW11', 'LG WM11', 'Panasonic NA-F120'], [
        ['Troca da placa eletrônica', 'Máquina de lavar não liga, painel apagado depois de um pico de energia.', 360, 80],
        ['Troca da bomba de drenagem', 'Lavadora não drena a água e para no meio do ciclo.', 190, 50],
        ['Troca da correia e revisão do motor', 'Máquina não centrifuga e faz barulho ao girar.', 220, 70],
        ['Troca da válvula de entrada de água', 'Máquina de lavar não enche, fica só no zumbido.', 160, 45],
        ['Troca do rolamento e do retentor', 'Lavadora fazendo muito barulho na centrifugação e vazando por baixo.', 390, 150],
        ['Troca dos amortecedores', 'Máquina batendo e andando pelo chão na centrifugação.', 210, 60],
        ['Limpeza interna e higienização do cesto', 'Roupas saindo com fiapos e mau cheiro na lavadora.', 170, 70]
      ]),
      G('Micro-ondas', 'micro-ondas', ['Electrolux MEF41', 'Brastemp BMS45', 'Consul CMA20', 'Panasonic NN-ST65', 'Midea MTFE22', 'Philco PMO33'], [
        ['Troca do magnetron', 'Micro-ondas liga, o prato gira, mas não esquenta a comida.', 260, 60],
        ['Troca do fusível e do capacitor', 'Micro-ondas não liga depois de um estouro, fusível queimado.', 150, 40],
        ['Troca da membrana do painel', 'Teclas do painel do micro-ondas não funcionam.', 140, 40],
        ['Troca do motor do prato', 'Prato do micro-ondas não gira.', 110, 30]
      ]),
      G('Fogão', 'fogão', ['Brastemp BFS5', 'Consul CFO4', 'Electrolux 76USQ', 'Atlas Mônaco', 'Dako Supreme', 'Fischer Platinium'], [
        ['Troca do acendimento automático', 'Acendimento automático do fogão não funciona, só acende com fósforo.', 150, 50],
        ['Limpeza e regulagem dos queimadores', 'Bocas do fogão com chama fraca e amarela.', 130, 60],
        ['Troca do registro de gás', 'Cheiro de gás no fogão, registro vazando.', 170, 50],
        ['Reparo do forno (termopar)', 'Forno do fogão não fica aceso, apaga quando solto o botão.', 190, 60]
      ]),
      G('Lava-louças', 'lava-louças', ['Brastemp BLF08', 'Electrolux LV08', 'Midea DWA08'], [
        ['Troca da bomba de drenagem', 'Lava-louças não drena e fica com água parada no fundo.', 240, 70],
        ['Troca da resistência', 'Lava-louças não aquece a água e a louça sai suja.', 260, 70]
      ])
    ],

    eletronicos: [
      G('TV', 'TV', ['Samsung 50" Crystal', 'Samsung 43" Smart', 'LG 55" UHD', 'LG 43" ThinQ', 'Philco 32"', 'TCL 50" P635', 'AOC 43" Roku', 'Sony 55" Bravia'], [
        ['Troca da barra de LED (backlight)', 'TV liga, tem som, mas a tela fica preta.', 320, 120],
        ['Reparo da placa fonte', 'TV não liga, luz vermelha piscando. A fonte queimou em uma tempestade.', 280, 90],
        ['Troca da placa principal', 'TV reiniciando sozinha e travando no logo.', 380, 90],
        ['Instalação e configuração de Smart TV', 'Instalar a TV nova na parede e configurar os aplicativos e o Wi-Fi.', 150, 60],
        ['Reparo da entrada HDMI', 'Entrada HDMI da TV não reconhece o videogame, fica sem sinal.', 190, 70]
      ]),
      G('Celular', 'celular', ['Samsung Galaxy A54', 'Samsung Galaxy S21', 'Motorola G84', 'Xiaomi Redmi Note 12', 'iPhone 11', 'iPhone 13'], [
        ['Troca de tela', 'Celular caiu e a tela trincou, o touch não funciona.', 350, 60],
        ['Troca de bateria', 'Bateria do celular viciada, descarrega em poucas horas.', 180, 40],
        ['Troca do conector de carga', 'Celular não carrega, conector com mau contato.', 150, 45],
        ['Limpeza após contato com água', 'Celular molhou e não liga mais.', 200, 90]
      ]),
      G('Videogame', '', ['PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series S', 'Nintendo Switch'], [
        ['Limpeza interna e troca de pasta térmica', 'Videogame esquentando muito, fazendo barulho e desligando sozinho.', 180, 70],
        ['Reparo da porta HDMI', 'Console liga, mas não dá imagem na TV, fica sem sinal.', 290, 90],
        ['Reparo do controle (analógico)', 'Controle do videogame com o analógico puxando sozinho.', 120, 45]
      ]),
      G('Caixa de som', 'caixa de som', ['JBL Charge 5', 'JBL Flip 6', 'Sony SRS-XB33', 'Philco PCX8000'], [
        ['Troca de bateria', 'Caixa de som não segura a bateria, só funciona na tomada.', 160, 45],
        ['Reparo do conector de carga', 'Caixa de som não carrega mais.', 140, 45]
      ])
    ],

    informatica: [
      G('Notebook', 'notebook', ['Dell Inspiron 15', 'Lenovo IdeaPad 3', 'Acer Aspire 5', 'Samsung Book', 'Asus VivoBook', 'HP 250 G8', 'MacBook Air'], [
        ['Formatação e instalação do Windows', 'Notebook muito lento, travando e cheio de vírus. Precisa formatar com backup.', 130, 120],
        ['Upgrade para SSD e mais memória', 'Notebook demora muito para ligar e abrir os programas.', 180, 60],
        ['Troca de tela', 'Tela do notebook quebrou, está com listras e manchas.', 420, 60],
        ['Troca de teclado', 'Teclado do notebook com teclas que não funcionam depois de cair líquido.', 220, 50],
        ['Reparo do conector de carga', 'Notebook não carrega, só liga se mexer no cabo.', 240, 90],
        ['Limpeza interna e troca de pasta térmica', 'Notebook esquentando muito e desligando sozinho.', 150, 60],
        ['Troca de bateria', 'Bateria do notebook não segura carga nenhuma.', 260, 30]
      ]),
      G('Computador', 'computador', ['Dell Vostro', 'Positivo Master', 'Lenovo ThinkCentre', 'gamer'], [
        ['Troca da fonte de alimentação', 'Computador não liga, fonte queimada depois de uma queda de energia.', 230, 45],
        ['Remoção de vírus e otimização', 'PC lento, abrindo propaganda sozinho.', 100, 60],
        ['Montagem de PC e instalação do sistema', 'Montar um PC gamer com as peças que comprei e instalar o Windows.', 220, 150],
        ['Recuperação de dados de HD', 'HD parou de ser reconhecido, preciso recuperar fotos e documentos.', 320, 180]
      ]),
      G('Wi-Fi e rede', 'roteador', ['TP-Link Archer C6', 'Intelbras Action RG1200', 'TP-Link Deco', 'Multilaser RE160'], [
        ['Configuração de Wi-Fi e rede mesh', 'Wi-Fi não chega nos quartos e a internet cai toda hora.', 140, 70],
        ['Instalação de roteador e repetidor', 'Trocar o roteador e instalar um repetidor no andar de cima.', 120, 60],
        ['Cabeamento de rede', 'Passar cabo de rede até o escritório e crimpar os pontos.', 190, 120]
      ]),
      G('Impressora', 'impressora', ['HP DeskJet 2774', 'Epson EcoTank L3250', 'Canon G3110', 'Brother DCP-T420'], [
        ['Instalação e configuração no Wi-Fi', 'Impressora não conecta no Wi-Fi e não imprime do notebook.', 100, 45],
        ['Desentupimento do cabeçote de impressão', 'Impressora imprimindo com falhas e listras.', 150, 60]
      ])
    ],

    climatizacao: [
      G('Ar-condicionado', 'ar-condicionado', ['Samsung WindFree 12000', 'LG Dual Inverter 9000', 'Springer Midea 12000', 'Consul 9000', 'Electrolux 12000', 'Gree Eco Garden 18000', 'Elgin Eco Inverter 12000', 'Fujitsu 9000', 'Daikin 12000', 'Philco 12000'], [
        ['Limpeza e higienização completa', 'Ar-condicionado com cheiro ruim e pingando água dentro do quarto.', 170, 90],
        ['Instalação de split', 'Instalar ar-condicionado split novo no quarto, com suporte e tubulação.', 480, 240],
        ['Recarga de gás', 'Ar-condicionado liga, mas não gela, só solta vento.', 240, 70],
        ['Desobstrução do dreno', 'Ar-condicionado vazando água pela evaporadora.', 150, 50],
        ['Reparo da placa eletrônica', 'Ar-condicionado não liga e não responde ao controle. Placa queimada.', 330, 90],
        ['Troca do capacitor do compressor', 'A condensadora não dá partida, só faz um zumbido.', 190, 50],
        ['Remoção e reinstalação', 'Tirar o ar-condicionado do quarto antigo e instalar no novo endereço.', 420, 210],
        ['Troca do sensor de temperatura', 'Ar-condicionado desligando sozinho e piscando erro no display.', 180, 50],
        ['Manutenção preventiva', 'Revisão geral do ar-condicionado antes do verão.', 150, 60]
      ])
    ],

    eletricista: [
      G('Chuveiro', '', ['Lorenzetti Advanced', 'Lorenzetti Acqua Duo', 'Hydra Fit', 'Fame Super Ducha', 'Lorenzetti Maxi Ducha'], [
        ['Instalação de chuveiro elétrico', 'Instalar chuveiro novo com fiação e disjuntor adequados.', 110, 50],
        ['Troca de resistência do chuveiro', 'Chuveiro não esquenta mais, resistência queimada.', 60, 25],
        ['Troca da fiação do chuveiro', 'Fio do chuveiro derretendo e com cheiro de queimado.', 160, 70]
      ]),
      G('Tomadas', '', null, [
        ['Troca de tomada para 20A', 'Tomada da cozinha esquentando ao usar o micro-ondas.', 80, 40],
        ['Instalação de tomadas novas', 'Preciso de três tomadas novas no escritório.', 180, 90],
        ['Reparo de tomada em curto', 'Tomada parou de funcionar depois de um curto e de uma faísca.', 90, 40],
        ['Instalação de interruptor paralelo', 'Quero acender a luz do corredor pelos dois lados.', 140, 70]
      ]),
      G('Quadro de luz', '', null, [
        ['Troca de disjuntor', 'Disjuntor desarmando toda vez que ligo o chuveiro.', 120, 50],
        ['Instalação de dispositivo DR', 'Instalar DR no quadro de luz para evitar choque.', 210, 80],
        ['Troca do quadro de disjuntores', 'Quadro de energia antigo, com fios soltos e sem identificação.', 420, 180]
      ]),
      G('Iluminação', '', null, [
        ['Instalação de luminária', 'Instalar lustre e dois spots de LED na sala.', 110, 60],
        ['Instalação de ventilador de teto', 'Instalar ventilador de teto com luminária no quarto.', 130, 70],
        ['Instalação de fita de LED', 'Colocar fita de LED na sanca da sala.', 170, 90],
        ['Troca de lâmpadas e reatores', 'Lâmpadas piscando e que não acendem na garagem.', 90, 40]
      ]),
      G('Instalação elétrica', '', null, [
        ['Reparo de curto-circuito', 'Luz da casa caindo e cheiro de queimado na fiação.', 190, 90],
        ['Passagem de fiação nova', 'Trocar a fiação antiga de um quarto.', 320, 180],
        ['Instalação de interfone', 'Interfone não funciona, quero trocar por um novo.', 180, 90],
        ['Visita técnica e diagnóstico', 'Conta de luz alta e tomadas dando choque.', 70, 30]
      ])
    ],

    encanador: [
      G('Torneiras', '', ['Deca', 'Docol', 'Lorenzetti', 'Tramontina'], [
        ['Troca de torneira', 'Torneira da cozinha pingando sem parar.', 85, 40],
        ['Troca do reparo da torneira', 'Torneira do banheiro vazando pela base.', 60, 30],
        ['Instalação de misturador monocomando', 'Instalar misturador novo na pia da cozinha.', 130, 60]
      ]),
      G('Pias e ralos', '', null, [
        ['Desentupimento de pia', 'Pia da cozinha entupida, a água não desce.', 130, 50],
        ['Troca de sifão e válvula', 'Sifão da pia vazando dentro do armário.', 80, 35],
        ['Desentupimento de ralo', 'Ralo do banheiro entupido e com mau cheiro.', 120, 45]
      ]),
      G('Vaso sanitário', 'vaso sanitário', ['Deca', 'Celite', 'Incepa', 'Icasa'], [
        ['Reparo de descarga', 'Descarga disparando e vazando água o tempo todo.', 95, 45],
        ['Troca do mecanismo da caixa acoplada', 'Caixa acoplada não enche e a descarga está fraca.', 120, 50],
        ['Desentupimento', 'Vaso sanitário entupido, com a água subindo.', 150, 50],
        ['Troca do anel de vedação', 'Vaso vazando pela base e com mau cheiro.', 140, 60]
      ]),
      G('Encanamento', '', null, [
        ['Conserto de vazamento', 'Vazamento no cano dentro da parede, com mancha de umidade.', 180, 120],
        ['Caça-vazamento', 'Conta de água alta por causa de um vazamento que não aparece.', 220, 90],
        ['Troca de registro', 'Registro do banheiro não fecha mais.', 110, 50],
        ['Limpeza de caixa d’água', 'Limpar e higienizar a caixa d’água de 1000 litros.', 200, 120],
        ['Troca da boia da caixa d’água', 'Caixa d’água transbordando, boia quebrada.', 90, 40]
      ]),
      G('Aquecedor', '', ['Rinnai', 'Lorenzetti', 'Komeco', 'Bosch'], [
        ['Manutenção de aquecedor a gás', 'Aquecedor não esquenta a água e apaga sozinho.', 210, 80],
        ['Instalação de aquecedor a gás', 'Instalar aquecedor novo com a tubulação.', 380, 180]
      ])
    ],

    limpeza: [
      G('Limpeza', '', null, [
        ['Limpeza residencial', 'Faxina completa em apartamento de dois quartos.', 150, 240],
        ['Limpeza pesada', 'Faxina pesada com limpeza de vidros, azulejos e fogão.', 250, 480],
        ['Limpeza pós-obra', 'Apartamento novo cheio de pó e respingos, entregue pela construtora.', 330, 480],
        ['Passadoria', 'Passar roupas da semana, cerca de 40 peças.', 100, 180],
        ['Limpeza de vidros e janelas', 'Limpar as janelas e a porta de vidro da sacada.', 130, 150],
        ['Higienização de sofá', 'Sofá de três lugares com manchas e cheiro de pet.', 190, 120],
        ['Limpeza de mudança', 'Limpar o apartamento vazio antes de devolver o imóvel.', 220, 300],
        ['Organização de armários', 'Organizar os armários do quarto e da cozinha.', 160, 240]
      ])
    ],

    montador: [
      G('Guarda-roupa', '', ['Madesa 6 portas', 'Henn casal', 'Moval 4 portas', 'Santos Andirá', 'planejado'], [
        ['Montagem de guarda-roupa', 'Montar guarda-roupa novo que chegou na caixa.', 190, 180],
        ['Desmontagem e remontagem de guarda-roupa', 'Desmontar o guarda-roupa e montar no apartamento novo.', 260, 240],
        ['Regulagem de portas e troca de dobradiças', 'Portas do guarda-roupa desalinhadas e com dobradiças soltas.', 110, 60],
        ['Troca de corrediças das gavetas', 'Gavetas do guarda-roupa emperrando e saindo do trilho.', 120, 60]
      ]),
      G('Móveis', '', ['Tok&Stok', 'Madesa', 'Politorno', 'Artely', 'Mobly'], [
        ['Montagem de cama box com baú', 'Montar cama box baú de casal.', 110, 60],
        ['Montagem de escrivaninha', 'Montar mesa de escritório e gaveteiro.', 90, 60],
        ['Montagem de rack e painel de TV', 'Montar rack com painel e fixar na parede.', 140, 90],
        ['Montagem de berço e cômoda', 'Montar berço e cômoda do quarto do bebê.', 170, 120],
        ['Montagem de armário de cozinha', 'Montar e fixar os armários aéreos da cozinha.', 230, 180]
      ]),
      G('Fixação na parede', '', null, [
        ['Instalação de suporte de TV', 'Fixar suporte articulado e TV de 55 polegadas na parede.', 95, 60],
        ['Instalação de prateleiras', 'Instalar quatro prateleiras e nichos na sala.', 80, 50],
        ['Instalação de cortina e persiana', 'Instalar varão de cortina e persiana no quarto.', 90, 50],
        ['Instalação de espelho e quadros', 'Pendurar espelho grande e quadros no corredor.', 70, 40]
      ])
    ],

    pintor: [
      G('Pintura', '', null, [
        ['Pintura de quarto', 'Pintar um quarto de 12 m², paredes e teto.', 360, 360],
        ['Pintura de apartamento', 'Pintar apartamento de dois quartos antes de devolver o imóvel.', 1250, 1440],
        ['Pintura de porta e janela', 'Pintar portas de madeira e janelas com acabamento acetinado.', 130, 150],
        ['Reparo de parede com massa corrida', 'Parede com furos e marcas, precisa de massa e retoque.', 160, 150],
        ['Aplicação de textura e grafiato', 'Fazer textura na parede da sala.', 290, 300],
        ['Pintura de fachada e muro', 'Pintar o muro e a fachada da casa.', 520, 480],
        ['Tratamento de mofo e repintura', 'Parede com mofo e pintura descascando por causa de umidade.', 240, 240],
        ['Efeito cimento queimado', 'Fazer parede de cimento queimado no quarto.', 340, 300]
      ])
    ],

    chaveiro: [
      G('Fechaduras', '', ['Papaiz', 'Pado', 'Stam', 'Yale', 'Arouca'], [
        ['Abertura de porta', 'Estou trancado fora de casa, perdi a chave.', 95, 25],
        ['Troca de fechadura', 'Fechadura emperrando, a chave não gira.', 130, 45],
        ['Troca de segredo (miolo)', 'Quero trocar o segredo depois de perder as chaves.', 90, 30],
        ['Extração de chave quebrada', 'A chave quebrou dentro da fechadura.', 100, 30],
        ['Instalação de fechadura auxiliar (tetra)', 'Instalar uma tranca tetra extra na porta de entrada.', 140, 50]
      ]),
      G('Fechadura digital', '', ['Yale YDM 4109', 'Intelbras FR 320', 'Papaiz Smart Lock', 'Samsung SHP-DH538'], [
        ['Instalação de fechadura digital', 'Instalar fechadura digital com biometria na porta de entrada.', 230, 90],
        ['Configuração e troca de pilhas da fechadura digital', 'Fechadura digital apitando e não reconhece a senha.', 110, 40]
      ]),
      G('Chaves', '', null, [
        ['Cópia de chave no local', 'Preciso de três cópias da chave de casa.', 45, 20],
        ['Chave codificada de carro', 'Perdi a chave do carro, preciso de uma codificada nova.', 320, 60],
        ['Abertura de carro', 'Tranquei a chave dentro do carro.', 120, 25]
      ])
    ],

    jardinagem: [
      G('Jardinagem', '', null, [
        ['Corte de grama', 'Cortar a grama do quintal, cerca de 50 m².', 95, 60],
        ['Poda de árvores e arbustos', 'Podar a cerca viva e os galhos encostando no telhado.', 140, 120],
        ['Manutenção mensal de jardim', 'Cuidar do jardim uma vez por mês: poda, adubo e limpeza.', 160, 180],
        ['Plantio e adubação', 'Plantar flores e montar canteiros na frente da casa.', 140, 120],
        ['Montagem de horta', 'Montar uma horta em jardineiras na varanda.', 150, 120],
        ['Jardim vertical', 'Instalar jardim vertical na parede da sacada.', 320, 180],
        ['Controle de pragas em plantas', 'Plantas com cochonilha e formigas.', 110, 60],
        ['Limpeza de terreno', 'Tirar o mato alto e limpar o terreno.', 220, 240]
      ])
    ],

    frete: [
      G('Fretes', '', null, [
        ['Carreto pequeno', 'Carreto de uma geladeira e um fogão para outro bairro.', 100, 60],
        ['Mudança de kitnet', 'Mudança de kitnet com poucos móveis, prédio sem elevador.', 290, 240],
        ['Mudança de apartamento', 'Mudança de apartamento de dois quartos com desmontagem.', 620, 420],
        ['Transporte de sofá', 'Transportar um sofá da loja até em casa.', 120, 70],
        ['Transporte de máquina de lavar', 'Transportar a máquina de lavar e instalar no destino.', 110, 60],
        ['Frete de materiais de construção', 'Frete de sacos de cimento e pisos até a obra.', 150, 90],
        ['Ajudante para carregar e descarregar', 'Ajudante para carregar caixas e móveis no caminhão.', 90, 120]
      ])
    ],

    beleza: [
      G('Beleza', '', null, [
        ['Corte de cabelo feminino', 'Cortar o cabelo em casa, corte em camadas.', 70, 50],
        ['Corte masculino e barba', 'Corte degradê e barba em domicílio.', 60, 45],
        ['Escova e hidratação', 'Escova modelada e hidratação profunda.', 95, 90],
        ['Manicure e pedicure', 'Fazer mãos e pés com esmaltação comum.', 70, 75],
        ['Alongamento de unhas', 'Alongamento de unhas em fibra.', 130, 120],
        ['Maquiagem para festa', 'Maquiagem e penteado para casamento.', 180, 90],
        ['Design de sobrancelha', 'Design de sobrancelha com henna.', 50, 30],
        ['Coloração e retoque de raiz', 'Retocar a raiz e fazer tonalizante.', 140, 120]
      ])
    ],

    reformas: [
      G('Piso', '', null, [
        ['Assentamento de porcelanato', 'Assentar porcelanato na sala, cerca de 20 m².', 900, 960],
        ['Troca de piso quebrado', 'Trocar três peças de piso trincadas na cozinha.', 180, 150],
        ['Rejuntamento de piso e azulejo', 'Rejunte do banheiro escuro e soltando.', 160, 180]
      ]),
      G('Paredes', '', null, [
        ['Reparo de reboco', 'Reboco da parede soltando e esfarelando.', 170, 180],
        ['Fechamento de rasgos e buracos', 'Fechar os rasgos na parede depois da troca da tubulação.', 150, 150],
        ['Tratamento de rachadura', 'Rachadura na parede do quarto aumentando.', 210, 180],
        ['Construção de mureta', 'Levantar uma mureta de tijolos no quintal.', 380, 360]
      ]),
      G('Gesso', '', null, [
        ['Reparo de forro de gesso', 'Forro de gesso com mancha de infiltração e rachadura.', 190, 150],
        ['Instalação de sanca de gesso', 'Fazer sanca de gesso com iluminação na sala.', 480, 360],
        ['Parede de drywall', 'Dividir um quarto com parede de drywall.', 620, 420]
      ]),
      G('Telhado', '', null, [
        ['Reparo de goteira', 'Goteira no telhado quando chove forte.', 220, 150],
        ['Impermeabilização de laje', 'Infiltração na laje, teto do quarto com mofo.', 540, 360],
        ['Limpeza de calhas', 'Calhas entupidas com folhas e a água transbordando.', 140, 90]
      ])
    ]
  };

  const CLIENTS = ['Luciana M.', 'Pedro H.', 'Fernanda T.', 'Gustavo R.', 'Isabela C.', 'Marcelo D.', 'Tatiane S.', 'Vinícius A.', 'Renata P.', 'Diego L.', 'Carolina B.', 'Rafael N.',
    'Juliana F.', 'André G.', 'Patrícia V.', 'Thiago E.', 'Aline K.', 'Bruno Z.', 'Sabrina O.', 'Leandro J.', 'Mônica Q.', 'Felipe W.', 'Daniela I.', 'Otávio U.'];
  const REVIEWS = {
    5: ['Chegou no horário combinado e resolveu tudo rapidamente. Recomendo!', 'Muito profissional, explicou o problema e deixou tudo limpo.', 'Atendimento excelente, acompanhei a chegada pelo mapa.',
      'Atendimento educado e muito caprichado. Nota 10.', 'O pagamento pelo app foi super prático. Ótimo atendimento.', 'Orçamento honesto e serviço rápido. Recomendo de olhos fechados.',
      'Resolveu de primeira o que outros dois não conseguiram.', 'Trouxe a peça certa e testou tudo antes de ir embora.'],
    4: ['Serviço bem feito e preço justo. Voltarei a chamar.', 'Resolveu o que eu precisava sem enrolação.', 'Bom atendimento, só atrasou alguns minutos.', 'Ficou ótimo, mas demorou um pouco mais que o previsto.'],
    3: ['Resolveu, mas precisei esperar mais do que o combinado.', 'O serviço ficou bom, a comunicação poderia ser melhor.']
  };

  /* Números pseudoaleatórios reprodutíveis: os mesmos registros de exemplo a cada instalação. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  function seedFor(p, now) {
    const groups = T[p.cat], rnd = rng(hash('fixup:' + p.id)), out = [];
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const pool = [];
    groups.forEach((g, gi) => g.j.forEach(() => pool.push(gi)));

    /* Notas distribuídas para que a média fique próxima da avaliação do profissional. */
    const lowShare = Math.max(0, 4.75 - p.rating) * 0.3;
    const three = Math.round(p.n * lowShare), four = Math.round(p.n * Math.max(0, 5 - p.rating - 2 * lowShare));
    const ratings = new Array(p.n).fill(5);
    for (let placed = 0, guard = 0; placed < three + four && guard < 500; guard++) {
      const k = Math.floor(rnd() * p.n);
      if (ratings[k] === 5) { ratings[k] = placed < three ? 3 : 4; placed += 1; }
    }

    for (let k = 0; k < p.n; k++) {
      const pin = p.pins[k];
      const gi = pin ? pin[0] : (p.focus && rnd() < 0.72 ? pick(p.focus) : pick(pool));
      const g = groups[gi], t = g.j[pin ? pin[1] : Math.floor(rnd() * g.j.length)];
      const bm = g.b ? (pin ? g.b[pin[2] % g.b.length] : pick(g.b)) : '';
      const lower = bm && bm[0] === bm[0].toLowerCase() && bm[0] !== bm[0].toUpperCase();
      const cut = bm.indexOf(' ');
      const days = 1 + Math.pow(k / p.n, 1.5) * 520 + k * 0.6 + rnd() * 3;
      const rating = ratings[k];
      out.push({
        id: p.id + '-' + (k + 1), proId: p.id, cat: p.cat, kind: g.k, title: t[0], device: g.d,
        brand: lower ? '' : (cut < 0 ? bm : bm.slice(0, cut)), model: lower ? bm : (cut < 0 ? '' : bm.slice(cut + 1)),
        problem: t[1], price: Math.max(30, Math.round((t[2] * p.factor * (0.92 + rnd() * 0.16)) / 5) * 5), min: t[3],
        doneAt: Math.round(now - days * DAY - rnd() * 8 * HOUR), rating, review: rnd() < 0.5 ? pick(REVIEWS[rating]) : '',
        client: pick(CLIENTS), source: 'seed'
      });
    }
    return out;
  }

  function seedJobs() {
    const now = Date.now();
    let out = [];
    S.data.pros.concat([S.data.me]).forEach((p) => { out = out.concat(seedFor(p, now - (p.id === 'me' ? 6 * DAY : 0))); });
    S.data.myRecent.forEach((r, i) => {
      const parts = r[0].split(' ');
      out.push({
        id: 'me-r' + (i + 1), proId: 'me', cat: S.data.me.cat, kind: 'Atendimentos recentes', title: r[1], device: '', brand: '', model: '', problem: '',
        price: r[2], min: 60, doneAt: Math.round(now - r[3] * HOUR), rating: 5, review: '', client: parts[0] + ' ' + parts[parts.length - 1][0] + '.', source: 'seed'
      });
    });
    return out;
  }

  /* =====================================================================
     IndexedDB
     ===================================================================== */
  const done = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const txDone = (tx) => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

  function openIdb() {
    return new Promise((resolve) => {
      let finished = false;
      const finish = (v) => { if (!finished) { finished = true; resolve(v); } };
      try {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('jobs')) {
            const jobs = db.createObjectStore('jobs', { keyPath: 'id' });
            jobs.createIndex('proId', 'proId');
            jobs.createIndex('cat', 'cat');
            jobs.createIndex('doneAt', 'doneAt');
          }
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        };
        r.onsuccess = () => finish(r.result);
        r.onerror = () => finish(null);
        r.onblocked = () => finish(null);
      } catch (e) { finish(null); }
      setTimeout(() => finish(null), 2500);
    });
  }

  const getAll = (idb, store) => done(idb.transaction(store).objectStore(store).getAll());

  function putAll(idb, store, rows) {
    const tx = idb.transaction(store, 'readwrite'), os = tx.objectStore(store);
    rows.forEach((r) => os.put(r));
    return txDone(tx);
  }

  function clearStore(idb, store) {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    return txDone(tx);
  }

  /* =====================================================================
     Banco em uso (cópia em memória + gravação no IndexedDB)
     ===================================================================== */
  let idb = null, mem = [], byPro = {}, statsCache = {};

  function reindex() {
    mem.sort((a, b) => b.doneAt - a.doneAt);
    byPro = {};
    statsCache = {};
    mem.forEach((j) => { (byPro[j.proId] || (byPro[j.proId] = [])).push(j); });
  }

  const persist = (job) => { if (idb) putAll(idb, 'jobs', [job]).catch(() => { /* segue em memória */ }); };

  const db = S.db = {
    /** true quando os dados estão gravados no IndexedDB; false quando só em memória. */
    persistent: false,

    async open() {
      idb = await openIdb();
      if (idb) {
        try {
          const meta = (await getAll(idb, 'meta')).find((m) => m.key === 'seed');
          if (!meta || meta.v !== SEED_VERSION) {
            const keep = (await getAll(idb, 'jobs')).filter((j) => j.source === 'app');
            await clearStore(idb, 'jobs');
            await putAll(idb, 'jobs', seedJobs().concat(keep));
            await putAll(idb, 'meta', [{ key: 'seed', v: SEED_VERSION, at: Date.now() }]);
          }
          mem = await getAll(idb, 'jobs');
          db.persistent = true;
        } catch (e) {
          console.warn('FixUp: IndexedDB indisponível, usando o banco em memória.', e);
          idb = null;
        }
      }
      if (!idb) { mem = seedJobs(); db.persistent = false; }
      reindex();
    },

    all: () => mem,
    byPro: (proId) => byPro[proId] || [],
    get: (id) => mem.find((j) => j.id === id),

    /** Quantidade de trabalhos e média das avaliações de um profissional. */
    stats(proId) {
      if (statsCache[proId]) return statsCache[proId];
      const jobs = byPro[proId] || [], rated = jobs.filter((j) => j.rating);
      const avg = rated.length ? rated.reduce((s, j) => s + j.rating, 0) / rated.length : 0;
      return (statsCache[proId] = { count: jobs.length, rating: Math.round(avg * 10) / 10 });
    },

    /** Trabalhos de um profissional agrupados por tipo, do mais frequente ao menos frequente. */
    kinds(proId) {
      const count = {};
      (byPro[proId] || []).forEach((j) => { count[j.kind] = (count[j.kind] || 0) + 1; });
      return Object.keys(count).map((k) => ({ label: k, count: count[k] })).sort((a, b) => b.count - a.count);
    },

    /** Registra um trabalho concluído. */
    add(job) {
      mem.push(job);
      reindex();
      persist(job);
      if (S.match) S.match.add(job);
      S.data.invalidate();
      return job;
    },

    /** Atualiza um registro (por exemplo, quando o cliente avalia o serviço). */
    update(id, patch) {
      const job = db.get(id);
      if (!job) return null;
      Object.assign(job, patch);
      statsCache = {};
      persist(job);
      S.data.invalidate();
      return job;
    },

    /** Apaga tudo e recria os dados de exemplo. */
    async reset() {
      mem = seedJobs();
      reindex();
      if (idb) {
        try {
          await clearStore(idb, 'jobs');
          await putAll(idb, 'jobs', mem);
          await putAll(idb, 'meta', [{ key: 'seed', v: SEED_VERSION, at: Date.now() }]);
        } catch (e) { /* segue em memória */ }
      }
      S.data.invalidate();
      if (S.match) S.match.build();
    },

    info: () => ({ name: DB_NAME, jobs: mem.length, pros: Object.keys(byPro).length, persistent: db.persistent })
  };
})(window.FixUp = window.FixUp || {});
