/* Servi — configuração central e regras de preço.
   Tudo o que define o modelo de negócio fica aqui. */
(function (S) {
  'use strict';

  /* Versão publicada (página hospedada em ambiente restrito): não pode usar o GPS do aparelho
     nem buscar mapas e rotas em outros sites. Nesse modo o app usa um mapa ilustrativo próprio,
     endereços de exemplo e navegação interna. A página publicada define SERVI_EMBED = true. */
  const embedded = window.SERVI_EMBED === true;

  S.config = {
    appName: 'Servi',
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
    ]
  };

  const round2 = (n) => Math.round(n * 100) / 100;

  S.pricing = {
    round2,

    travel(km) {
      const f = S.config.travelFee;
      return Math.round((f.base + f.perKm * km) * 2) / 2;
    },

    /** Calcula o valor pago pelo cliente e a divisão entre profissional e plataforma. */
    quote(servicePrice, km) {
      const rate = S.config.commissionRate;
      const travel = this.travel(km);
      const total = round2(servicePrice + travel);
      const commission = round2(total * rate);
      return { service: servicePrice, travel, total, commission, payout: round2(total - commission), rate };
    },

    percent() {
      return (S.config.commissionRate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    }
  };
})(window.Servi = window.Servi || {});
