# Notas de atualização

Todas as mudanças do FixUp, da mais recente para a mais antiga.
As versões seguem o formato `MAIOR.MENOR.CORREÇÃO`: o primeiro número muda quando o app muda de forma
grande, o segundo quando ganha recursos novos e o terceiro quando só há correções.

## 3.2.0 — 17 de novembro de 2026

### Novo

- **Pica-pau nos blocos de destaque.** Os ícones de linha dos blocos azuis deram lugar à cabeça do
  pica-pau da marca, em contorno, com um símbolo branco no canto:
  - "Quem já resolveu um caso como o seu" (tela inicial): lupa;
  - "Chamar o mais próximo" (busca): alfinete de mapa;
  - "Você presta serviços?" (perfil): maleta, inteira dentro do quadrado; no modo profissional,
    "Voltar para o modo cliente" mostra uma pessoa.
- Os símbolos são desenhados em vetor a partir do mesmo desenho do logo (`ui.ppTile` em `js/ui.js`),
  então ficam nítidos em qualquer tela e não acrescentam arquivos.

## 3.1.0 — 17 de novembro de 2026

### Novo

- **Pica-pau nas categorias.** Os ícones de linha das categorias deram lugar a ilustrações do pica-pau
  fazendo cada serviço, na tela inicial e em "Todas as categorias". As imagens ficam em `img/categorias/`
  (WebP com fundo transparente, então funcionam no tema claro e no escuro).
- **Categoria Piscina**, com ilustração própria no mesmo estilo: limpeza e aspiração, tratamento de água
  verde, correção de pH e cloro, troca da areia do filtro e visita técnica. Dois profissionais de exemplo,
  com histórico de trabalhos, cursos e especialidades.
- A busca reconhece o vocabulário de piscina ("água verde", "turva", "cloro", "filtro da piscina",
  "bomba da piscina", "piscineiro") e as marcas Dancor, Sodramar e Nautilus.

### Mudou

- Os blocos das categorias ficaram maiores para a ilustração aparecer bem no celular.
- O banco de trabalhos de exemplo é recriado uma vez para incluir os trabalhos de piscina. Os trabalhos
  feitos no app são mantidos.

## 3.0.0 — 17 de novembro de 2026

Versão grande: as oito ideias priorizadas pela equipe para o FixUp. Os dados salvos da versão anterior
não são reaproveitados: o app começa com a demonstração nova.

### Novo

- **Tablet e computador de verdade.** A moldura de celular e o painel de apresentação saíram: o app ocupa
  a tela toda. A partir de 768 px a navegação vira uma barra lateral (com os nomes ao lado a partir de
  1280 px), as listas ficam em 2 colunas (e em 3 a partir de 1024 px), conversas e pedidos aparecem com a
  lista de um lado e o detalhe do outro, e os painéis viram janelas centralizadas.
- **Mascote Pica-Pau na interface.** Selo "Profissional Verificado FixUp", ilustração nos estados vazios,
  carregamento com o pica-pau bicando, marca nos títulos de seção e marca-d'água nos comprovantes.
- **Conta e segurança** (Perfil > Conta e segurança):
  - CPF com máscara `000.000.000-00`, conferência pelos dígitos verificadores e proibição de CPF repetido;
  - foto real do rosto obrigatória para contratar ou atender, com câmera ou galeria e o aviso
    "Foto de rosto real obrigatória para identificação e segurança presencial no momento do serviço";
  - a foto de cada parte aparece no cartão do atendimento, para as duas se reconhecerem na chegada;
  - reputação dos dois lados: o cliente avalia o profissional e o profissional avalia o cliente,
    informando se o pagamento e o combinado foram honrados;
  - cada CPF guarda `cpfStatus`, `unpaidDisputesCount` e `reputationScore`. Com 2 ocorrências de
    inadimplência, ou nota abaixo de 3,0 depois de 3 avaliações, contratar e atender ficam bloqueados,
    com uma janela que explica o motivo.
- **Perfil profissional completo.** O profissional edita resumo, anos de experiência, cursos técnicos
  (curso, instituição, ano e carga horária), especialidades, categorias atendidas e a galeria de
  portfólio. O cliente vê tudo em abas: Sobre, Cursos técnicos, Portfólio e Avaliações.
- **Fotos dos serviços nas avaliações.** Cliente e profissional podem anexar fotos de antes e depois ao
  avaliar. Cada avaliação mostra as miniaturas, e o perfil tem a seção "Fotos de Serviços Avaliados
  (Veracidade Comprovada)", com visualização em tela cheia que traz nota, cliente, data, comentário e o
  selo de serviço concluído pela FixUp.
- **Deslocamento com franquia de 15 km.** A distância é a da rota mais curta entre o profissional e o
  cliente. Até 15 km, a taxa de deslocamento é zero e o campo fica travado na proposta, com a explicação.
  Acima disso, o profissional pode cobrar uma taxa opcional de até R$ 2,50 por km excedente.
- **Comprovantes de pagamento e de recebimento**, com código de autenticação, data e hora, nomes e CPFs
  mascarados, descrição do serviço e o selo do pica-pau. Aparecem no chat ("Pagamento liquidado" e
  "Repasse liquidado"), no pedido, na carteira e no histórico de ganhos. Dá para baixar e imprimir
  (ou salvar em PDF) no site.

### Mudou

- **Preço cego.** Cada transação guarda o total pago pelo cliente, o líquido do profissional e a parte da
  plataforma, mas a tela do cliente mostra só o total e a do profissional, só o líquido. As linhas de
  comissão e de repasse saíram de todas as telas, e o profissional passa a informar nas propostas quanto
  quer receber.
- A taxa de deslocamento antiga (valor fixo mais valor por km, cobrada em qualquer distância) saiu.
- Perfis de exemplo com cursos técnicos, especialidades e fotos ilustrativas, sempre marcadas como tal.

## 2.2.0 — 14 de novembro de 2026

### Mudou

- O ícone da aba do navegador e a marca ao lado do aparelho agora usam o novo logo.

### Novo

- **Ícone para a tela inicial do iPhone** (`img/icone-180.png`), usado quando o site é adicionado à
  tela de início.
- **Prévia do link com o logo** ao compartilhar o site no WhatsApp e nas redes sociais
  (`img/icone-512.png`, com título e descrição).
- A ferramenta do logo (`ferramentas/logo`) também gera os ícones PNG.

## 2.1.0 — 14 de novembro de 2026

### Novo

- **Abertura animada com o novo logo.** Ao abrir o app, o logo se monta na tela azul: a casa se
  desenha, o pássaro sobe e dá duas bicadas na parede (com faíscas), a chave inglesa gira e encaixa
  e o nome FixUp aparece. Depois a tela se abre para o app com um zoom suave.
  - A abertura aparece enquanto o app carrega e sai quando a animação termina, em cerca de 2,5 segundos.
  - Um toque na tela pula a animação.
  - Com a opção de reduzir movimento do aparelho ligada, o logo aparece parado por um instante.
  - Para ver de novo: Perfil > Sobre o app > Ver a abertura de novo.
- **Logo em vetor** (`img/logo-fixup.svg`), nítido em qualquer tamanho.
- **Ferramenta do logo** (`ferramentas/logo`): gera o logo vetorial e a abertura a partir do PNG.
  Se o logo final mudar, basta trocar o PNG e rodar `npm run gerar`.

## 2.0.0 — 13 de novembro de 2026

O app passa a se chamar **FixUp**. Esta versão muda a forma de encontrar um profissional: em vez de
escolher só pela categoria, o cliente descreve o problema e o app mostra quem já resolveu casos parecidos.

### Novo

- **Busca por problema.** O cliente escreve com as próprias palavras, por exemplo “a fonte de energia
  da minha geladeira Electrolux quebrou”, e o app:
  - corrige erros de digitação (“gelareira” vira “geladeira”, “concertar” vira “consertar”);
  - entende do que se trata: aparelho, marca, peça, sintoma e tipo de serviço, e mostra isso na tela;
  - compara com o histórico de trabalhos de cada profissional, dando mais peso ao aparelho e à peça,
    e considera casos análogos (geladeira e freezer, “não liga” e “queimou”);
  - ordena quem tem mais experiência no problema, desempatando por avaliação, distância e disponibilidade;
  - mostra no cartão do profissional o trabalho mais parecido que ele já fez, quando foi e quanto custou.
- **Banco de trabalhos realizados.** Cada serviço concluído vira um registro com o problema, o aparelho,
  a marca, o modelo, o valor e a avaliação do cliente. O banco começa com 830 trabalhos de exemplo de 30
  profissionais e fica no IndexedDB do navegador. Serviços concluídos pelo app entram nele na hora.
- **Histórico no perfil do profissional.** Tipos de trabalho mais frequentes, trabalhos recentes, lista
  completa e, quando a pessoa chega pela busca, os casos parecidos com o dela em destaque.
- **Chat com proposta personalizada.** Cliente e profissional combinam escopo, prazo e valor. O
  profissional envia uma proposta; o cliente pode aceitar e pagar pelo app, recusar ou pedir desconto.
  O valor aceito fica retido até a conclusão, como em qualquer pedido.
  - No modo cliente, o profissional simulado lê a mensagem, consulta os trabalhos que já fez e monta a
    proposta, juntando mais de um serviço na mesma visita com desconto.
  - No modo profissional, há uma tela de conversas e um formulário de proposta que mostra quanto você
    recebe depois da comissão. Proposta aceita vira atendimento na tela inicial.
- **Modo noturno**, com três opções: automático (segue o aparelho), claro e escuro. O mapa também muda de tema.
- **Novas categorias:** Eletrodomésticos (geladeira, máquina de lavar, micro-ondas, fogão) e Eletrônicos
  (TV, celular, videogame, caixa de som), com cinco profissionais novos.
- **Novidades e banco no app:** em Perfil > Sobre o app há as notas de atualização e um resumo do banco de trabalhos.

### Mudou

- Nova identidade visual com a paleta azul do FixUp: `#0303B5`, `#0404E2`, `#4040FB`, `#6565FF` e `#8787FB`.
- A tela inicial pergunta “Qual problema você quer resolver hoje?” e traz exemplos de busca.
- A barra inferior do cliente ganhou a aba **Conversas**. A Carteira passou para o Perfil.
- O número de serviços e a nota de cada profissional agora são calculados a partir do banco de trabalhos.
- Os dados salvos da versão anterior não são reaproveitados: o app começa com a demonstração nova.

## 1.0.0 — 12 de novembro de 2026

Primeira versão, ainda com o nome **Servi**.

- Busca de profissionais por categoria e por palavra, em lista ou no mapa, com “Chamar o mais próximo”.
- GPS do aparelho, mapa do OpenStreetMap e rota pelas ruas até o endereço.
- Pagamento pelo app (Pix, cartão ou saldo) com o valor retido até a conclusão do serviço.
- Acompanhamento do profissional em tempo real, confirmação da conclusão e avaliação.
- Comprovante com a divisão do valor entre profissional e plataforma (8% de comissão, sem mensalidade).
- Modo profissional: ficar online, receber e aceitar solicitações, atender, ver ganhos e sacar via Pix.
- Versão publicada como página do Claude, com mapa ilustrativo e endereços de exemplo.
