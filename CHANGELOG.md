# Notas de atualização

Todas as mudanças do FixUp, da mais recente para a mais antiga.
As versões seguem o formato `MAIOR.MENOR.CORREÇÃO`: o primeiro número muda quando o app muda de forma
grande, o segundo quando ganha recursos novos e o terceiro quando só há correções.

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
