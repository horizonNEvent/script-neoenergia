// Run: npx tsx src/lib/matcher.check.ts
import assert from 'node:assert';
import { matchAllPendencias } from './matcher';
import { extractDataFromText } from './pdf-parser';

const TRANS = '27853556000187';
const COR3 = '24342513000149';
const COR2 = '11222333000181';
const pdf = (nome: string, txt: string) => ({ ...extractDataFromText(txt, nome), file: null as any });
const pend = (id: number, cnpjEmp: string) =>
  ({ id, empresa: 'COREMAS', valor: 46.03, transmissora: 'X', transmissora_cnpj: TRANS, empresa_cnpj: cnpjEmp });

const boletos = [
  pdf('cor2.pdf', `Beneficiário 27.853.556/0001-87 Pagador 11.222.333/0001-81 Valor 46,03`),
  pdf('cor3.pdf', `Beneficiário 27.853.556/0001-87 Pagador 24.342.513/0001-49 Valor 46,03`),
];

// Mesmo valor, empresas diferentes -> cada um pega o seu (ordem invertida de propósito)
const r = matchAllPendencias([pend(1, COR3), pend(2, COR2)], boletos);
assert.equal(r[0].boleto?.arquivo, 'cor3.pdf');
assert.equal(r[1].boleto?.arquivo, 'cor2.pdf');

// Empresa sem PDF próprio -> não sobe nada
const r2 = matchAllPendencias([pend(3, '99888777000166')], boletos);
assert.equal(r2[0].boleto, undefined);
assert.match(r2[0].mensagem!, /empresa não confere/);

// PDF duplicado -> ambíguo, não sobe
const r3 = matchAllPendencias([pend(4, COR3)], [boletos[1], { ...boletos[1], arquivo: 'cor3-copia.pdf' }]);
assert.match(r3[0].mensagem!, /Ambíguo/);

// Sem CNPJ da empresa -> não sobe
assert.match(matchAllPendencias([pend(5, '')], boletos)[0].mensagem!, /empresa não disponível/);
// Mesmo boleto baixado 2x (mesmo código de barras) -> sobe 1, não é ambíguo
const barras = 'Código de Barra 00191161000000044750000003237641000010839817';
const dup = [
  pdf('a.pdf', `Beneficiário 27.853.556/0001-87 Pagador 24.342.513/0001-49 Valor 46,03 ${barras}`),
  pdf('a-copia.pdf', `Beneficiário 27.853.556/0001-87 Pagador 24.342.513/0001-49 Valor 46,03 ${barras}`),
];
const r4 = matchAllPendencias([pend(6, COR3)], dup);
assert.equal(r4[0].boleto?.arquivo, 'a.pdf');
assert.match(r4[0].estrategia!, /cópia/);

console.log('ok');
