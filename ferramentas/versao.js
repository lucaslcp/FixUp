/* FixUp — marca os arquivos do site com o número da versão, para o navegador baixar a versão nova.

   Uso (na pasta do projeto, depois de mudar `version` em js/config.js):  node ferramentas/versao.js

   O GitHub Pages deixa o navegador guardar CSS e JavaScript por até 10 minutos. Sem a marca, quem já
   abriu o app continua vendo a versão anterior até recarregar a página. Com ela (js/ui.js?v=3.3.4),
   cada versão tem um endereço novo e é baixada na hora.
   Só o index.html é marcado: o artifact.html é publicado como uma versão nova a cada atualização. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const m = config.match(/version:\s*'([^']+)'/);
if (!m) throw new Error('versão não encontrada em js/config.js');
const v = m[1];

const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8');
let count = 0;
const out = html.replace(/(href|src)="((?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g, (all, attr, url) => { count += 1; return `${attr}="${url}?v=${v}"`; });
fs.writeFileSync(file, out);
console.log(`index.html: ${count} arquivos marcados com a versão ${v}`);
