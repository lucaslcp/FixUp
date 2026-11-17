/* FixUp — configuração central e regras de preço.
   Tudo o que define o modelo de negócio fica aqui. */
(function (S) {
  'use strict';

  /* Versão publicada (página hospedada em ambiente restrito): não pode usar o GPS do aparelho
     nem buscar mapas e rotas em outros sites. Nesse modo o app usa um mapa ilustrativo próprio,
     endereços de exemplo e navegação interna. A página publicada define FIXUP_EMBED = true. */
  const embedded = window.FIXUP_EMBED === true;

  S.config = {
    appName: 'FixUp',
    version: '3.1.0',
    embedded,

    /** Parte da plataforma em cada serviço concluído (0.08 = 8%). Não há mensalidade.
        Preço cego: esse valor nunca aparece na tela. O cliente vê só o total que paga e o
        profissional vê só o valor líquido que recebe (veja S.pricing, abaixo). */
    commissionRate: 0.08,

    /** Deslocamento: grátis até `freeKm` pela rota mais curta (o profissional arca com ele).
        Acima disso, o profissional pode cobrar uma taxa opcional, limitada a `maxPerExcessKm`
        por km que passar da franquia. `defaultPerExcessKm` vale para os serviços de preço fechado. */
    travel: { freeKm: 15, maxPerExcessKm: 2.5, defaultPerExcessKm: 1.5 },

    /** Velocidade média urbana usada para estimar o tempo de chegada. */
    avgSpeedKmh: 22,

    /** Raio em que o profissional recebe solicitações. */
    coverageKm: 6,

    /** Segurança por CPF: quando uma conta fica impedida de contratar ou de prestar serviços. */
    security: {
      minReputation: 3.0,       // nota mínima de reputação...
      minRatings: 3,            // ...depois de pelo menos este número de avaliações
      maxUnpaidDisputes: 2      // ocorrências de inadimplência que bloqueiam o CPF
    },

    /** Local usado quando o GPS não está disponível ou a permissão é negada. */
    defaultLocation: { lat: -23.56137, lng: -46.65588, label: 'Av. Paulista, 1578', sub: 'Bela Vista, São Paulo' },

    /** Mapa base (OpenStreetMap, gratuito para demonstração).
        Em produção, troque por um provedor contratado (Mapbox, Google Maps, MapTiler etc.). */
    tiles: embedded ? null : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    },

    /** Serviços públicos de demonstração para rota e endereço. Deixe vazio ('') para desligar. */
    services: {
      routing: embedded ? '' : 'https://router.project-osrm.org/route/v1/driving/',
      geocoding: embedded ? '' : 'https://nominatim.openstreetmap.org/reverse'
    },

    /** Malha de ruas do mapa ilustrativo e da rota de reserva (graus entre uma rua e a próxima). */
    demoGrid: { dLat: 0.0016, dLng: 0.0018 },

    /** Endereços de exemplo oferecidos quando o GPS não pode ser usado (versão publicada). */
    demoAddresses: [
      { lat: -23.56137, lng: -46.65588, label: 'Av. Paulista, 1578', sub: 'Bela Vista, São Paulo' },
      { lat: -23.5619, lng: -46.6683, label: 'Rua Oscar Freire, 379', sub: 'Jardins, São Paulo' },
      { lat: -23.5863, lng: -46.6821, label: 'Av. Brig. Faria Lima, 3477', sub: 'Itaim Bibi, São Paulo' },
      { lat: -23.5701, lng: -46.6402, label: 'Rua Vergueiro, 1000', sub: 'Paraíso, São Paulo' }
    ],

    /** Notas de atualização mostradas em Perfil > Novidades (o histórico completo fica no CHANGELOG.md). */
    releases: [
      {
        v: '3.1.0', date: '17 nov 2026', title: 'Pica-pau nas categorias e limpeza de piscina',
        notes: [
          'Os ícones das categorias viraram ilustrações do pica-pau fazendo cada serviço.',
          'Nova categoria Piscina: limpeza e aspiração, água verde, pH e cloro, filtro e bomba, com dois profissionais.',
          'A busca entende pedidos como "piscina com água verde" e "bomba da piscina fazendo barulho".'
        ]
      },
      {
        v: '3.0.0', date: '17 nov 2026', title: 'Segurança, perfil profissional, preço cego e comprovantes',
        notes: [
          'Tablet e computador: o app ocupa a tela toda, com barra lateral, listas em colunas e conversas e pedidos lado a lado.',
          'Conta e segurança: CPF validado e único, foto do rosto obrigatória para contratar ou atender, reputação dos dois lados e bloqueio de CPF inadimplente.',
          'Perfil profissional completo: resumo, cursos técnicos, especialidades, portfólio e avaliações em abas.',
          'Fotos dos serviços nas avaliações, com galeria e visualização em tela cheia.',
          'Deslocamento grátis até 15 km pela rota mais curta; acima disso, taxa opcional com teto por km.',
          'Preço cego: o cliente vê só o total que paga e o profissional, só o líquido que recebe.',
          'Comprovantes de pagamento e de recebimento com código de autenticação, no chat e no histórico financeiro.',
          'O pica-pau da marca no selo de verificado, nos estados vazios, no carregamento e nos comprovantes.'
        ]
      },
      {
        v: '2.2.0', date: '14 nov 2026', title: 'Novo logo no ícone e na marca',
        notes: [
          'O ícone da aba do navegador e a marca ao lado do aparelho agora usam o novo logo.',
          'Ícone para a tela inicial do iPhone, quando o site é adicionado à tela de início.',
          'Prévia com o logo ao compartilhar o link do site no WhatsApp e nas redes sociais.'
        ]
      },
      {
        v: '2.1.0', date: '14 nov 2026', title: 'Abertura animada com o novo logo',
        notes: [
          'Ao abrir o app, o logo se monta na tela: a casa se desenha, o pássaro sobe e dá duas bicadas e a chave inglesa gira e encaixa.',
          'Um toque na tela pula a animação. Com a opção de reduzir movimento do aparelho ligada, o logo aparece parado por um instante.',
          'Para ver de novo: Perfil > Sobre o app > Ver a abertura de novo.'
        ]
      },
      {
        v: '2.0.0', date: '13 nov 2026', title: 'O app agora se chama FixUp',
        notes: [
          'Busca por problema: descreva o que aconteceu e encontre quem já resolveu casos parecidos.',
          'Banco de trabalhos realizados: o histórico de cada profissional aparece no perfil e alimenta a busca.',
          'Chat com proposta personalizada: negocie escopo, prazo e valor e pague a proposta pelo app.',
          'Modo noturno, com opção automática que segue o aparelho.',
          'Novas categorias: Assistência técnica (eletrodomésticos) e Eletrônicos.',
          'Nova identidade visual com a paleta azul do FixUp.'
        ]
      },
      {
        v: '1.0.0', date: '12 nov 2026', title: 'Primeira versão',
        notes: [
          'Busca por categoria, em lista ou no mapa, com GPS.',
          'Pagamento pelo app com valor retido até a conclusão do serviço.',
          'Acompanhamento do profissional em tempo real.',
          'Modo profissional com ganhos, comissão por serviço e saque via Pix.'
        ]
      }
    ]
  };

  const round2 = (n) => Math.round(n * 100) / 100;
  const upHalf = (n) => Math.ceil(round2(n) * 2) / 2;   // arredonda para cima, de 50 em 50 centavos

  /* Valores de uma transação (o mesmo formato em pedidos, propostas e comprovantes):
       clientTotalAmount    o que o cliente paga (é o único valor que o cliente vê)
       providerNetAmount    o que o profissional recebe (é o único valor que o profissional vê)
       platformFeeAmount    a parte da plataforma: fica só no registro, nunca aparece na tela
       clientServiceAmount  a parte do total que é o serviço (total = serviço + deslocamento)
       displacementFee      taxa de deslocamento, repassada inteira ao profissional
       routeKm              distância da rota mais curta usada no cálculo */
  function amounts(clientService, netService, displacementFee, routeKm) {
    const fee = round2(displacementFee || 0);
    const clientTotalAmount = round2(clientService + fee), providerNetAmount = round2(netService + fee);
    return {
      clientTotalAmount, providerNetAmount, platformFeeAmount: round2(clientTotalAmount - providerNetAmount),
      clientServiceAmount: round2(clientService), displacementFee: fee, routeKm: routeKm == null ? null : round2(routeKm)
    };
  }

  S.pricing = {
    round2,

    /* ---------- Deslocamento (franquia de 15 km) ---------- */

    /** A taxa de deslocamento está liberada para esta distância? (só acima da franquia) */
    displacementAllowed: (km) => km > S.config.travel.freeKm,

    /** Teto da taxa de deslocamento para esta distância: zero dentro da franquia. */
    maxDisplacement(km) {
      const t = S.config.travel;
      return km > t.freeKm ? round2((km - t.freeKm) * t.maxPerExcessKm) : 0;
    },

    /** Aplica a regra: zero até a franquia; acima dela, o valor pedido limitado ao teto. */
    clampDisplacement(km, value) {
      return this.displacementAllowed(km) ? round2(Math.min(Math.max(0, +value || 0), this.maxDisplacement(km))) : 0;
    },

    /** Taxa padrão dos serviços de preço fechado (o profissional não escolhe na hora). */
    defaultDisplacement(km) {
      const t = S.config.travel;
      return this.clampDisplacement(km, upHalf((km - t.freeKm) * t.defaultPerExcessKm));
    },

    /* ---------- Preço cego ---------- */

    /** Serviço com preço de vitrine (o que o cliente vê): o profissional recebe esse valor menos a parte da plataforma. */
    fromClientPrice(servicePrice, displacementFee, routeKm) {
      return amounts(servicePrice, round2(servicePrice * (1 - S.config.commissionRate)), displacementFee, routeKm);
    },

    /** Proposta em que o profissional define quanto quer receber: o cliente vê o valor com a parte da plataforma embutida. */
    fromNet(netService, displacementFee, routeKm) {
      return amounts(upHalf(netService / (1 - S.config.commissionRate)), round2(netService), displacementFee, routeKm);
    }
  };
})(window.FixUp = window.FixUp || {});
