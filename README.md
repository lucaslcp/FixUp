# FixUp

<img src="img/logo-fixup.svg" width="96" alt="Logo do FixUp">

Protótipo de um marketplace de serviços sob demanda. O cliente descreve o problema com as próprias
palavras, vê os profissionais independentes que já resolveram casos parecidos, combina os detalhes
pelo chat, paga pelo app e acompanha a chegada no mapa.
Não há mensalidade: a plataforma retém uma comissão pequena de cada serviço concluído.

- Site: https://lucaslcp.github.io/FixUp/ (sempre na versão mais recente)
- Código: https://github.com/lucaslcp/FixUp
- Notas de atualização: [CHANGELOG.md](CHANGELOG.md) (também em Perfil > Novidades, dentro do app)

## Como abrir

Dê dois cliques em `iniciar.bat`. Ele sobe um servidor local e abre `http://localhost:5173/`.
Não é preciso instalar nada (o servidor usa o PowerShell do próprio Windows).

Também funciona abrindo `index.html` direto, mas pelo servidor o navegador lembra a permissão
de localização e o mapa carrega de forma mais confiável.

É preciso estar conectado à internet: o mapa, os ícones e a fonte vêm de CDNs.

## O que dá para testar

**Como cliente**

1. Descrever um problema na busca, por exemplo “a fonte de energia da minha geladeira Electrolux
   quebrou” ou “torneira pingando”. O app mostra o que entendeu e quem já fez trabalhos parecidos.
2. Abrir o perfil do profissional e ver os casos parecidos com o seu e o histórico de trabalhos.
3. Tocar em “Pedir orçamento pelo chat”: o profissional responde com uma proposta personalizada.
   Dá para pedir desconto, incluir outro serviço na mesma visita, aceitar e pagar ou recusar.
4. Ou escolher um serviço de preço fechado e pagar com Pix, cartão ou saldo.
5. Acompanhar o profissional no mapa, confirmar a conclusão (libera o pagamento) e avaliar.
   O serviço entra no banco de trabalhos do profissional, com a sua avaliação.

**Como profissional** (Perfil > “Você presta serviços?”, ou o seletor ao lado do aparelho)

1. Abrir Conversas, responder os clientes e enviar uma proposta. O formulário mostra quanto você
   recebe depois da comissão. Se o valor couber no orçamento do cliente, ele aceita e paga.
2. Ficar online e receber solicitações próximas, com o valor líquido já calculado.
3. Atender (deslocamento pela rota, início e conclusão) e ver os ganhos, o extrato e o saque via Pix.

Ao abrir, o app mostra a abertura animada com o logo (um toque pula). Para ver de novo:
Perfil > Sobre o app > “Ver a abertura de novo”.

O tema fica em Perfil > Aparência (automático, claro ou escuro).
Em Perfil > “Restaurar demonstração” tudo volta ao estado inicial.

## Como a busca por problema funciona

O código fica em `js/match.js`, e o vocabulário em `js/lexicon.js`.

1. **Normaliza o texto:** tira acentos, plurais e conjugações (“ligando”, “ligou” e “ligar” viram a
   mesma palavra) e corrige erros de digitação pela palavra conhecida mais próxima.
2. **Entende o problema:** transforma o texto em conceitos do vocabulário: aparelho, peça, sintoma,
   tipo de serviço e marca. “Fonte de energia” e “placa fonte” viram o mesmo conceito, por exemplo.
3. **Compara com o banco de trabalhos:** cada trabalho já realizado passou pelo mesmo processo.
   Aparelho e peça pesam mais, termos raros valem mais que termos comuns e conceitos análogos
   (geladeira e freezer) contam pela metade. Cada trabalho recebe um nível: mesmo problema,
   parecido ou não relacionado.
4. **Ordena os profissionais:** soma a experiência em casos parecidos (os primeiros pesam mais),
   e usa avaliação, distância e disponibilidade para desempatar. O preço mostrado é a mediana do
   que o profissional cobrou nos casos parecidos.

Para ensinar uma palavra nova ao app, inclua o termo no conceito certo de `js/lexicon.js`.

## Abertura animada e logo

A abertura fica em `img/abertura.svg`: um SVG que se anima sozinho, com o logo dividido em peças
(casa, pássaro e chave inglesa). O fundo azul, o nome do app e a saída ficam em `css/styles.css`
(seção “Abertura animada”), e `js/app.js` decide a hora de sair: quando a animação termina e o app
está pronto, o que vier por último.

| Momento | O que acontece |
| --- | --- |
| 0,15 s | a casa começa a se desenhar, da parede esquerda ao telhado e à chaminé |
| 0,75 s | o pássaro sobe |
| 1,15 s | a chave inglesa gira e encaixa |
| 1,42 s | o nome FixUp aparece, e depois a frase |
| 1,45 s | o pássaro dá duas bicadas na parede, com faíscas |
| 2,45 s | a tela se abre para o app |

A abertura, o logo estático (`img/logo-fixup.svg`, usado no ícone da aba e na marca ao lado do
aparelho) e os ícones PNG (`img/icone-180.png` para a tela inicial do iPhone e `img/icone-512.png`
para a prévia do link no WhatsApp e nas redes) são gerados a partir do PNG do logo pela ferramenta
em `ferramentas/logo`. Para trocar o logo:

1. Substitua `ferramentas/logo/logo-original.png` pelo novo PNG.
2. Na pasta `ferramentas/logo`, rode `npm install` (só na primeira vez) e depois `npm run gerar`.

A ferramenta usa o potrace para transformar cada peça em vetor e o resvg para gerar os PNGs. As linhas-guia da casa e a posição
das faíscas estão no início de `gerar.js`; se o desenho do logo mudar, ajuste essas medidas.

## Banco de trabalhos

O código fica em `js/db.js`. Os registros ficam no IndexedDB do navegador, no banco `fixup`.
Para ver, abra as Ferramentas do desenvolvedor e vá em Application > IndexedDB.
Se o navegador bloquear o IndexedDB, o banco funciona só em memória.

| Campo | Conteúdo |
| --- | --- |
| `proId`, `cat`, `kind` | profissional, categoria e tipo de trabalho |
| `title` | o que foi feito (“Troca da placa fonte”) |
| `device`, `brand`, `model` | aparelho, marca e modelo |
| `problem` | o problema, nas palavras do cliente |
| `price`, `min` | valor e duração |
| `doneAt`, `rating`, `review`, `client` | quando, avaliação, comentário e cliente |
| `source` | `seed` (exemplo) ou `app` (criado por um pedido feito no app) |

O banco começa com 830 trabalhos de exemplo de 30 profissionais, gerados sempre iguais a partir de
modelos realistas. Serviços concluídos no app entram na hora e passam a contar na busca.

## Modelo de negócio

Tudo fica em `js/config.js`:

| Ajuste | Onde | Padrão |
| --- | --- | --- |
| Comissão por serviço | `commissionRate` | 8% |
| Taxa de deslocamento | `travelFee` | R$ 4,00 + R$ 1,50/km |
| Raio de atendimento | `coverageKm` | 6 km |
| Local padrão sem GPS | `defaultLocation` | Av. Paulista, São Paulo |

Em serviços de preço fechado, o cliente paga serviço + deslocamento. Em propostas do chat, o valor
combinado já inclui o deslocamento. Nos dois casos, a comissão é descontada do repasse ao profissional.

## O que é real e o que é simulado

| Parte | Situação |
| --- | --- |
| GPS do aparelho | Real (API de geolocalização do navegador) |
| Mapa, rota pelas ruas e endereço | Reais (OpenStreetMap, OSRM e Nominatim, serviços públicos de demonstração) |
| Busca por problema e banco de trabalhos | Reais, rodando no navegador, com trabalhos de exemplo |
| Profissionais, preços e avaliações | Dados de exemplo em `js/data.js` e `js/db.js`, posicionados ao redor do usuário |
| O outro lado da conversa | Simulado: o profissional (ou o cliente) responde sozinho |
| Deslocamento do profissional | Simulado e acelerado (segue a rota real em cerca de 25 segundos) |
| Pagamentos, Pix, cartão, saques | Simulados: nenhum dinheiro é movimentado |
| Contas, pedidos e conversas | Salvos apenas neste navegador (localStorage) |

A localização do usuário é enviada aos serviços de mapa, rota e endereço para que eles funcionem.
Para desligar rota e endereço, deixe `services.routing` e `services.geocoding` vazios em `js/config.js`.

## Versão publicada

`artifact.html` é a mesma aplicação preparada para ser publicada como página do Claude (Artifact).
Esse ambiente bloqueia o GPS do aparelho e o acesso a outros sites, então nessa versão:

- o mapa é ilustrativo (uma malha de ruas desenhada pelo próprio app) e a rota segue essa malha;
- o endereço é escolhido em uma lista de exemplos, em vez de vir do GPS;
- a navegação entre telas fica em memória, sem alterar o endereço da página.

Tudo isso é ligado por `FIXUP_EMBED = true` (veja `js/config.js`). O resto do código é o mesmo.

## Site público

A versão completa (mapa real, rota pelas ruas e GPS) está no GitHub Pages:
https://lucaslcp.github.io/FixUp/

O site é publicado a partir da branch `main`. Cada envio ao GitHub atualiza o site sozinho, em
um ou dois minutos. Qualquer hospedagem de sites estáticos com HTTPS também serve (o GPS do
navegador exige HTTPS); a página é a `index.html`.

O endereço antigo no Netlify (flourishing-druid-dd582d.netlify.app) ficou na versão 1.0.0.

## Estrutura

```
index.html            estrutura da página e moldura do aparelho (versão local)
artifact.html         a mesma página, preparada para publicação
CHANGELOG.md          notas de atualização de cada versão
css/styles.css        identidade visual (paleta FixUp, temas claro e escuro, abertura)
img/abertura.svg      abertura animada do logo
img/logo-fixup.svg    logo em vetor (ícone da aba e marca)
img/icone-*.png       ícones da tela inicial do iPhone e da prévia do link
ferramentas/logo      gera os SVGs e os ícones a partir do PNG do logo (npm run gerar)
css/leaflet-core.css  regras essenciais do mapa para a versão publicada
js/config.js          versão, comissão, taxas, provedores de mapa e notas de atualização
js/geo.js             GPS, distâncias, rotas e endereço
js/lexicon.js         vocabulário de problemas: aparelhos, peças, sintomas, serviços e marcas
js/data.js            categorias, serviços de preço fechado e profissionais
js/db.js              banco de trabalhos realizados (IndexedDB) e trabalhos de exemplo
js/match.js           busca por problema
js/store.js           pedidos, carteira e conversas salvos no navegador
js/payment.js         pagamento retido, liberação, estorno e divisão do valor
js/orders.js          pedidos e simulação do atendimento
js/ui.js              formatação, tema, ícones, painéis, avisos e mapa
js/client.js          telas do cliente
js/chat.js            conversas e propostas personalizadas
js/pro.js             telas do profissional
js/app.js             rotas, navegação e inicialização
```

## Para virar um produto

- **Backend e contas**: cadastro, login e verificação de identidade dos profissionais.
- **Banco de dados**: a tabela de trabalhos de `js/db.js` no servidor (PostgreSQL, por exemplo), com
  busca textual e um índice por conceito; o mesmo desenho de `js/match.js` roda no servidor.
- **Chat**: mensagens em tempo real por WebSocket ou push entre os dois aplicativos, com moderação.
- **Pagamento**: gateway com split (Mercado Pago, Pagar.me ou Stripe Connect) no lugar de `js/payment.js`.
- **Tempo real**: posição do profissional e status do pedido por WebSocket ou push, no lugar de `js/orders.js`.
- **Mapas**: provedor contratado (Mapbox, Google Maps ou MapTiler); os serviços públicos usados aqui não são para produção.
- **Aplicativo**: empacotar como PWA ou portar as telas para React Native ou Flutter.
