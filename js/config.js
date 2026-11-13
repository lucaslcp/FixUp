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
    version: '2.0.0',
    embedded,

    /** Comissão da plataforma sobre cada serviço concluído (0.08 = 8%). Não há mensalidade. */
    commissionRate: 0.08,

    /** Taxa de deslocamento cobrada do cliente: valor fixo + valor por km. */
    travelFee: { base: 4, perKm: 1.5 },

    /** Velocidade média urbana usada para estimar o tempo de chegada. */
    avgSpeedKmh: 22,

    /** Raio em que o profissional recebe solicitações. */
    coverageKm: 6,

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

  S.pricing = {
    round2,

    travel(km) {
      const f = S.config.travelFee;
      return Math.round((f.base + f.perKm * km) * 2) / 2;
    },

    /** Serviço de catálogo: valor do serviço + deslocamento, e a divisão entre profissional e plataforma. */
    quote(servicePrice, km) {
      const rate = S.config.commissionRate;
      const travel = this.travel(km);
      const total = round2(servicePrice + travel);
      const commission = round2(total * rate);
      return { service: servicePrice, travel, total, commission, payout: round2(total - commission), rate };
    },

    /** Proposta personalizada combinada no chat: o valor fechado já inclui o deslocamento. */
    quoteFixed(total) {
      const rate = S.config.commissionRate;
      total = round2(total);
      const commission = round2(total * rate);
      return { service: total, travel: 0, total, commission, payout: round2(total - commission), rate, fixed: true };
    },

    percent() {
      return (S.config.commissionRate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    }
  };
})(window.FixUp = window.FixUp || {});
