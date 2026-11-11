import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAddress, maskPostalCode, normalizePostalCode, parseReverse, parseSearch, parseViaCep } from '../src/lib/address.ts';

test('normalizePostalCode aceita só CEPs com 8 dígitos, com ou sem traço', () => {
  assert.equal(normalizePostalCode('01001-000'), '01001000');
  assert.equal(normalizePostalCode(' 01001000 '), '01001000');
  assert.equal(normalizePostalCode('0100100'), null);
  assert.equal(normalizePostalCode('010010001'), null);
  assert.equal(normalizePostalCode('abc'), null);
});

test('maskPostalCode aplica 00000-000 e descarta letras', () => {
  assert.equal(maskPostalCode('0100'), '0100');
  assert.equal(maskPostalCode('01001a000'), '01001-000');
  assert.equal(maskPostalCode('0100100099'), '01001-000');
});

test('formatAddress monta uma linha pulando partes vazias', () => {
  assert.equal(
    formatAddress({ street: 'Praça da Sé', number: '100', district: 'Sé', city: 'São Paulo', state: 'SP' }),
    'Praça da Sé, 100 - Sé, São Paulo/SP',
  );
  assert.equal(formatAddress({ city: 'São Paulo', state: 'SP' }), 'São Paulo/SP');
  assert.equal(formatAddress({}), '');
});

test('parseViaCep lê a resposta e reconhece CEP inexistente', () => {
  const a = parseViaCep({ cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' });
  assert.deepEqual(a, { postalCode: '01001000', street: 'Praça da Sé', number: '', district: 'Sé', city: 'São Paulo', state: 'SP' });
  assert.equal(parseViaCep({ erro: 'true' }), null);
  assert.equal(parseViaCep(null), null);
});

test('parseViaCep descarta texto malicioso vindo do serviço', () => {
  const a = parseViaCep({ cep: '01001-000', logradouro: '<script>x</script>', localidade: 'São Paulo', uf: 'SP' });
  assert.equal(a?.street, '');
});

test('parseSearch devolve coordenadas válidas ou null', () => {
  assert.deepEqual(parseSearch([{ lat: '-23.5498', lon: '-46.6341' }]), { latitude: -23.5498, longitude: -46.6341 });
  assert.equal(parseSearch([]), null);
  assert.equal(parseSearch([{ lat: '999', lon: '0' }]), null);
  assert.equal(parseSearch({}), null);
});

test('parseReverse extrai rua, número, bairro, cidade, UF e CEP', () => {
  const a = parseReverse({
    address: {
      road: 'Rua Santa Teresa', house_number: '20', suburb: 'Glicério', city: 'São Paulo',
      'ISO3166-2-lvl4': 'BR-SP', postcode: '01016-020',
    },
  });
  assert.deepEqual(a, {
    postalCode: '01016020', street: 'Rua Santa Teresa', number: '20', district: 'Glicério', city: 'São Paulo', state: 'SP',
  });
  assert.equal(parseReverse({}), null);
});
