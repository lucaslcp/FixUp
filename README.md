# Servi

Protótipo de um marketplace de serviços sob demanda: o cliente busca o tipo de serviço, vê os
profissionais independentes mais próximos, paga pelo app e acompanha a chegada no mapa.
Não há mensalidade: a plataforma retém uma comissão pequena de cada serviço concluído.

## Como abrir

Dê dois cliques em `iniciar.bat`. Ele sobe um servidor local e abre `http://localhost:5173/`.
Não é preciso instalar nada (o servidor usa o PowerShell do próprio Windows).

Também funciona abrindo `index.html` direto, mas pelo servidor o navegador lembra a permissão
de localização e o mapa carrega de forma mais confiável.

É preciso estar conectado à internet: o mapa, os ícones e a fonte vêm de CDNs.

## O que dá para testar

**Como cliente**

1. Buscar por serviço ("torneira vazando", "faxina") ou escolher uma categoria.
2. Ver os profissionais em lista ou no mapa, ou usar "Chamar o mais próximo".
3. Abrir o perfil, escolher o serviço e pagar com Pix, cartão ou saldo.
4. Acompanhar o profissional se deslocando até o endereço em tempo real.
5. Confirmar a conclusão (libera o pagamento), avaliar e ver o comprovante com a divisão do valor.

**Como profissional** (Perfil > "Você presta serviços?", ou o seletor ao lado do aparelho)

1. Ficar online e receber uma solicitação próxima, com o valor líquido já descontada a comissão.
2. Aceitar, deslocar-se pela rota, iniciar e concluir o serviço.
3. Ver os ganhos, o extrato com a comissão de cada serviço e sacar via Pix.

Em Perfil > "Restaurar demonstração" tudo volta ao estado inicial.

## Modelo de negócio

Tudo fica em `js/config.js`:

| Ajuste | Onde | Padrão |
| --- | --- | --- |
| Comissão por serviço | `commissionRate` | 8% |
| Taxa de deslocamento | `travelFee` | R$ 4,00 + R$ 1,50/km |
| Raio de atendimento | `coverageKm` | 6 km |
| Local padrão sem GPS | `defaultLocation` | Av. Paulista, São Paulo |

O cliente paga serviço + deslocamento. A comissão é descontada do repasse ao profissional.

## O que é real e o que é simulado

| Parte | Situação |
| --- | --- |
| GPS do aparelho | Real (API de geolocalização do navegador) |
| Mapa, rota pelas ruas e endereço | Reais (OpenStreetMap, OSRM e Nominatim, serviços públicos de demonstração) |
| Profissionais, preços e avaliações | Dados de exemplo em `js/data.js`, posicionados ao redor do usuário |
| Deslocamento do profissional | Simulado e acelerado (segue a rota real em cerca de 25 segundos) |
| Pagamentos, Pix, cartão, saques | Simulados: nenhum dinheiro é movimentado |
| Contas e dados | Salvos apenas neste navegador (localStorage) |

A localização do usuário é enviada aos serviços de mapa, rota e endereço para que eles funcionem.
Para desligar rota e endereço, deixe `services.routing` e `services.geocoding` vazios em `js/config.js`.

## Versão publicada

`artifact.html` é a mesma aplicação preparada para ser publicada como página do Claude (Artifact).
Esse ambiente bloqueia o GPS do aparelho e o acesso a outros sites, então nessa versão:

- o mapa é ilustrativo (uma malha de ruas desenhada pelo próprio app) e a rota segue essa malha;
- o endereço é escolhido em uma lista de exemplos, em vez de vir do GPS;
- a navegação entre telas fica em memória, sem alterar o endereço da página.

Tudo isso é ligado por `SERVI_EMBED = true` (veja `js/config.js`). O resto do código é o mesmo.

## Site público

A versão completa (mapa real, rota pelas ruas e GPS) está hospedada no Netlify:
https://flourishing-druid-dd582d.netlify.app

Para atualizar, arraste a pasta `servi` de novo na área de deploys do projeto, no painel do Netlify.
Qualquer hospedagem de sites estáticos com HTTPS serve (o GPS do navegador exige HTTPS); a página
é a `index.html`.

## Estrutura

```
index.html        estrutura da página e moldura do aparelho (versão local)
artifact.html     a mesma página, preparada para publicação
css/leaflet-core.css  regras essenciais do mapa para a versão publicada
css/styles.css    identidade visual (paleta azul)
js/config.js      comissão, taxas e provedores de mapa
js/geo.js         GPS, distâncias, rotas e endereço
js/data.js        categorias, serviços e profissionais de exemplo
js/store.js       estado salvo no navegador
js/payment.js     pagamento retido, liberação, estorno e divisão do valor
js/orders.js      pedidos e simulação do atendimento
js/ui.js          formatação, ícones, painéis, avisos e mapa
js/client.js      telas do cliente
js/pro.js         telas do profissional
js/app.js         rotas e navegação
```

## Para virar um produto

- **Backend e contas**: cadastro, login e verificação de identidade dos profissionais.
- **Pagamento**: gateway com split (Mercado Pago, Pagar.me ou Stripe Connect) no lugar de `js/payment.js`.
- **Tempo real**: posição do profissional e status do pedido por WebSocket ou push, no lugar de `js/orders.js`.
- **Mapas**: provedor contratado (Mapbox, Google Maps ou MapTiler); os serviços públicos usados aqui não são para produção.
- **Aplicativo**: empacotar como PWA ou portar as telas para React Native ou Flutter.
