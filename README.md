# FixUp

<img src="img/logo-fixup.svg" width="96" alt="Logo do FixUp">

Protótipo de um marketplace de serviços sob demanda. O cliente descreve o problema com as próprias
palavras, vê os profissionais independentes que já resolveram casos parecidos, combina os detalhes
pelo chat, paga pelo app e acompanha a chegada no mapa.
Não há mensalidade: a plataforma fica com uma parte pequena de cada serviço concluído, sem mostrá-la
na tela (o cliente vê o total que paga e o profissional, o líquido que recebe).

Funciona no celular, no tablet e no computador: em telas a partir de 768 px a navegação vira uma
barra lateral e as listas aparecem em colunas.

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
2. Abrir o perfil do profissional: casos parecidos com o seu e as abas Sobre, Cursos técnicos,
   Portfólio e Avaliações (com as fotos dos serviços avaliados, em tela cheia).
3. Tocar em “Pedir orçamento pelo chat”: o profissional responde com uma proposta personalizada.
   Dá para pedir desconto, incluir outro serviço na mesma visita, aceitar e pagar ou recusar.
4. Ou escolher um serviço de preço fechado e pagar com Pix, cartão ou saldo. Antes da primeira
   contratação, o app pede a verificação da conta: CPF e foto do rosto (Perfil > Conta e segurança).
   A cliente de exemplo já tem um CPF de teste; falta só a foto.
5. Acompanhar o profissional no mapa (o cartão mostra a foto dele para você reconhecer na chegada),
   confirmar a conclusão (libera o pagamento) e avaliar, com fotos do serviço se quiser.
6. Ver o comprovante de pagamento no chat, no pedido ou na carteira, e baixar ou imprimir.

**Como profissional** (Perfil > “Você presta serviços?”, ou “Modo profissional” na barra lateral)

1. Abrir Conversas, responder os clientes e enviar uma proposta informando quanto você quer receber.
   Para Débora (3,6 km) a taxa de deslocamento fica travada; para Fernanda, em Santo André (mais de
   15 km pela rota), ela é liberada com teto. Wagner tem o CPF bloqueado por inadimplência.
2. Ficar online e receber solicitações próximas, com o valor líquido já calculado.
3. Atender (o cartão mostra a foto do cliente), concluir, avaliar o cliente informando se o combinado
   foi honrado e ver o comprovante de recebimento, os ganhos e o saque via Pix.
4. Editar o perfil profissional (Perfil > Perfil profissional): resumo, cursos técnicos,
   especialidades, categorias e portfólio, e ver como os clientes enxergam o perfil.

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

## Segurança da conta

O código fica em `js/seguranca.js` (regras) e `js/conta.js` (tela). Os limites ficam em
`security`, em `js/config.js`.

- **CPF:** máscara `000.000.000-00`, conferência dos dois dígitos verificadores e proibição de CPF
  já usado por outra conta. Na tela há um botão de CPF de teste, para ninguém precisar digitar o CPF real.
- **Foto do rosto:** obrigatória para contratar (cliente) e para atender (profissional). A foto é
  recortada e reduzida no próprio aparelho. Onde o navegador sabe detectar rostos, ele confere se há um;
  nos outros, a conferência seria manual, pela equipe.
- **Reputação dos dois lados:** depois de cada serviço o cliente avalia o profissional e o profissional
  avalia o cliente, informando se o pagamento e o combinado foram honrados.
- **Campos por CPF:** `cpfStatus` (`regular` ou `blocked_debtor`), `unpaidDisputesCount` e
  `reputationScore`. Com 2 ocorrências de inadimplência, ou nota abaixo de 3,0 depois de 3 avaliações,
  os botões de contratar e de atender abrem uma janela de restrição com o motivo.

## Preço cego, deslocamento e comprovantes

Os valores de cada transação ficam em `S.pricing` (`js/config.js`):

| Campo | O que é | Quem vê |
| --- | --- | --- |
| `clientTotalAmount` | total pago pelo cliente | só o cliente |
| `providerNetAmount` | líquido do profissional | só o profissional |
| `platformFeeAmount` | parte da plataforma | ninguém: fica só no registro |
| `displacementFee` | taxa de deslocamento, repassada inteira ao profissional | os dois, cada um dentro do seu valor |
| `routeKm` | distância da rota mais curta (`shortestRouteDistanceKm`) | os dois |

- Serviços de preço fechado: o preço mostrado ao cliente é o total, e o profissional recebe esse
  valor menos a parte da plataforma. Propostas do chat: o profissional informa quanto quer receber,
  e o cliente vê o valor com a parte da plataforma embutida.
- **Deslocamento:** a distância é a da rota mais curta (o serviço de rotas devolve alternativas e fica
  a menor). Até 15 km a taxa é zero. Acima disso, o profissional pode cobrar até R$ 2,50 por km
  excedente; os serviços de preço fechado usam R$ 1,50 por km excedente.
- **Comprovantes** (`js/comprovantes.js`): o do cliente mostra o total pago; o do profissional, o
  líquido recebido. Os dois têm código de autenticação calculado a partir dos dados do comprovante,
  nomes e CPFs mascarados das partes e o selo do pica-pau. Dá para baixar (arquivo HTML) e imprimir
  (ou salvar em PDF) no site; na página publicada no Claude essas duas opções ficam desativadas.

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
| `shots` | quantas imagens ilustrativas o trabalho de exemplo mostra |

A tabela `media` guarda as fotos enviadas: fotos de serviços (`kind: "job"`, ligadas a um trabalho)
e do portfólio (`kind: "portfolio"`). Os trabalhos de exemplo não têm fotos reais: mostram imagens
ilustrativas, sempre marcadas como tal.

O banco começa com 830 trabalhos de exemplo de 30 profissionais, gerados sempre iguais a partir de
modelos realistas. Serviços concluídos no app entram na hora e passam a contar na busca.

## Modelo de negócio

Tudo fica em `js/config.js`:

| Ajuste | Onde | Padrão |
| --- | --- | --- |
| Parte da plataforma (não aparece na tela) | `commissionRate` | 8% |
| Deslocamento grátis até | `travel.freeKm` | 15 km pela rota mais curta |
| Teto da taxa acima da franquia | `travel.maxPerExcessKm` | R$ 2,50 por km excedente |
| Bloqueio por inadimplência | `security.maxUnpaidDisputes` | 2 ocorrências |
| Nota mínima de reputação | `security.minReputation` | 3,0 (depois de 3 avaliações) |
| Raio de atendimento | `coverageKm` | 6 km |
| Local padrão sem GPS | `defaultLocation` | Av. Paulista, São Paulo |

O cliente paga serviço + deslocamento (grátis até 15 km). A parte da plataforma sai do valor do
serviço; a taxa de deslocamento vai inteira para o profissional.

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
| Contas, CPFs, fotos, pedidos e conversas | Salvos apenas neste navegador (localStorage e IndexedDB) |
| CPFs e fotos dos perfis de exemplo | CPFs de teste gerados pelo app; retratos ilustrativos no lugar das fotos |
| Código de autenticação dos comprovantes | Calculado no aparelho; em produção, assinado pelo servidor |

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
index.html            estrutura da página (versão local)
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
js/store.js           contas, pedidos, carteira e conversas salvos no navegador
js/seguranca.js       CPF, reputação por CPF e verificação antes de contratar ou atender
js/midia.js           envio de fotos, fotos dos serviços e visualização em tela cheia
js/comprovantes.js    comprovantes de pagamento e de recebimento
js/conta.js           telas de conta e segurança e do perfil profissional
js/mascote.js         desenho do pica-pau (gerado pela ferramenta do logo)
js/payment.js         pagamento retido, liberação e estorno
js/orders.js          pedidos e simulação do atendimento
js/ui.js              formatação, tema, ícones, painéis, avisos e mapa
js/client.js          telas do cliente
js/chat.js            conversas e propostas personalizadas
js/pro.js             telas do profissional
js/app.js             rotas, navegação e inicialização
```

## Para virar um produto

- **Backend e contas**: cadastro, login e verificação de identidade (consulta do CPF a um serviço de
  validação e comparação da foto com um documento), com o CPF único garantido pelo banco.
- **Banco de dados**: a tabela de trabalhos de `js/db.js` no servidor (PostgreSQL, por exemplo), com
  busca textual e um índice por conceito; o mesmo desenho de `js/match.js` roda no servidor.
- **Chat**: mensagens em tempo real por WebSocket ou push entre os dois aplicativos, com moderação.
- **Pagamento**: gateway com split (Mercado Pago, Pagar.me ou Stripe Connect) no lugar de `js/payment.js`.
- **Tempo real**: posição do profissional e status do pedido por WebSocket ou push, no lugar de `js/orders.js`.
- **Mapas**: provedor contratado (Mapbox, Google Maps ou MapTiler); os serviços públicos usados aqui não são para produção.
- **Aplicativo**: empacotar como PWA ou portar as telas para React Native ou Flutter.

## Aplicativo Android (APK)

O arquivo instalável pronto fica na raiz do repositório em `FixUp.apk`, empacotado pelo projeto Android em `android/`.

- **Instalação direta:** transfira `FixUp.apk` para o celular Android e abra o arquivo (autorizando instalação de fontes desconhecidas).
- **Recompilar o APK:** na pasta `android/`, execute `.\gradlew.bat assembleRelease` (ou `./gradlew assembleRelease` no Linux/macOS). O build copia automaticamente `index.html`, `css/`, `js/` e `img/` para dentro do app e gera o APK assinado.
- **Recursos embarcados:** o app usa `WebViewAssetLoader` em `https://appassets.androidplatform.net/assets/index.html` (para manter GPS real, `localStorage` e `IndexedDB` funcionando) e inclui Leaflet e Lucide localmente para carregamento rápido.

