import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/lib/reconcile.ts';

const spot = {
  latitude: 1, longitude: 2, savedAt: 3, altitude: null, floor: '', note: '', address: '', postalCode: '', expiresAt: null,
};

test('sem mudança local, copia o servidor só quando a versão difere', () => {
  assert.equal(reconcile({ spot: null, version: 2, dirty: false }, { spot, version: 2 }), 'none');
  assert.equal(reconcile({ spot: null, version: 1, dirty: false }, { spot, version: 2 }), 'pull');
  assert.equal(reconcile({ spot, version: 1, dirty: false }, { spot: null, version: 2 }), 'pull');
});

test('mudança local pendente é enviada ao servidor', () => {
  assert.equal(reconcile({ spot, version: 1, dirty: true }, { spot: null, version: 1 }), 'push');
});

test('vaga liberada offline vira DELETE se o servidor ainda tem vaga', () => {
  assert.equal(reconcile({ spot: null, version: 1, dirty: true }, { spot, version: 1 }), 'delete');
  assert.equal(reconcile({ spot: null, version: 1, dirty: true }, { spot: null, version: 3 }), 'pull');
});
