/* Servi — GPS, distâncias, rotas e endereço. */
(function (S) {
  'use strict';

  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;

  function distanceKm(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Ponto a `km` de distância de `origin`, na direção `bearing` (graus). */
  function offset(origin, bearing, km) {
    const br = rad(bearing), d = km / R, la1 = rad(origin.lat), lo1 = rad(origin.lng);
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
    const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: deg(la2), lng: deg(lo2) };
  }

  function etaMin(km) {
    return Math.max(3, Math.round((km / S.config.avgSpeedKmh) * 60) + 2);
  }

  function fetchJson(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }

  /** Posição atual do aparelho. Resolve com `null` se o GPS estiver indisponível ou negado. */
  function locate() {
    return new Promise((resolve) => {
      if (S.config.embedded || !navigator.geolocation) return resolve(null);
      let done = false;
      const finish = (v) => { if (!done) { done = true; clearTimeout(guard); resolve(v); } };
      const guard = setTimeout(() => finish(null), 10000);
      navigator.geolocation.getCurrentPosition(
        (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    });
  }

  /** Converte coordenadas em endereço legível. Resolve com `null` se falhar. */
  async function reverse(pos) {
    const base = S.config.services.geocoding;
    if (!base) return null;
    try {
      const j = await fetchJson(`${base}?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=18&addressdetails=1&accept-language=pt-BR`, 6000);
      const a = j.address || {};
      const street = a.road || a.pedestrian || a.footway || a.neighbourhood || j.name;
      if (!street) return null;
      const sub = [a.suburb || a.neighbourhood || a.city_district, a.city || a.town || a.village || a.municipality].filter(Boolean).join(', ');
      return { label: a.house_number ? `${street}, ${a.house_number}` : street, sub };
    } catch (e) {
      return null;
    }
  }

  /** Rota de reserva (sem serviço de rotas): segue a malha de ruas do mapa ilustrativo.
      Sai da origem até a rua vertical mais próxima, vai até a rua horizontal do destino e chega. */
  function fallbackRoute(a, b) {
    const g = S.config.demoGrid;
    const street = Math.round((a.lng + (b.lng - a.lng) * 0.15) / g.dLng) * g.dLng;
    const cross = Math.round((b.lat + (a.lat - b.lat) * 0.15) / g.dLat) * g.dLat;
    const points = [a, { lat: a.lat, lng: street }, { lat: cross, lng: street }, { lat: cross, lng: b.lng }, b].map((p) => ({ lat: p.lat, lng: p.lng }));
    return { points, road: false };
  }

  const routeCache = {};

  /** Rota pelas ruas entre dois pontos. Sempre resolve (usa rota de reserva se preciso). */
  function route(a, b) {
    const key = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(',');
    if (routeCache[key]) return routeCache[key];
    const base = S.config.services.routing;
    const job = !base ? Promise.resolve(fallbackRoute(a, b)) :
      fetchJson(`${base}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, 6000)
        .then((j) => {
          const r = j.routes && j.routes[0];
          if (!r || !r.geometry || r.geometry.coordinates.length < 2) throw new Error('sem rota');
          const points = r.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
          points.unshift({ lat: a.lat, lng: a.lng });
          points.push({ lat: b.lat, lng: b.lng });
          return { points, road: true };
        })
        .catch(() => fallbackRoute(a, b));
    routeCache[key] = job;
    return job;
  }

  /** Posição ao longo da rota. `t` vai de 0 (início) a 1 (destino). */
  function along(points, t) {
    if (!points._cum) {
      let acc = 0;
      points._cum = [0];
      for (let i = 1; i < points.length; i++) { acc += distanceKm(points[i - 1], points[i]); points._cum.push(acc); }
    }
    const cum = points._cum, total = cum[cum.length - 1], last = points.length - 1;
    if (t <= 0 || total === 0) return { lat: points[0].lat, lng: points[0].lng, index: 0 };
    if (t >= 1) return { lat: points[last].lat, lng: points[last].lng, index: last };
    const target = total * t;
    let i = 1;
    while (i < last && cum[i] < target) i++;
    const seg = cum[i] - cum[i - 1] || 1, f = (target - cum[i - 1]) / seg, p = points[i - 1], q = points[i];
    return { lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f, index: i - 1 };
  }

  S.geo = { distanceKm, offset, etaMin, locate, reverse, route, along };
})(window.Servi = window.Servi || {});
