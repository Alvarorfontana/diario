import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seleccionarTapa } from './portada.ts';

const riesgoPais = { slug: 'riesgo-pais-700-puntos-deuda-2027', breaking: false };

test('prioriza la nota marcada como tapa', () => {
	const marcada = { slug: 'otra-nota', breaking: false, tapa: true };
	assert.equal(seleccionarTapa([riesgoPais, marcada]), marcada);
});

test('mantiene Riesgo País como respaldo si no hay nota marcada', () => {
	assert.equal(seleccionarTapa([{ slug: 'otra-nota', breaking: true }, riesgoPais]), riesgoPais);
});

test('usa último momento y luego la primera nota como respaldos finales', () => {
	const breaking = { slug: 'ultima-nota', breaking: true };
	assert.equal(seleccionarTapa([breaking, { slug: 'otra-nota', breaking: false }]), breaking);
	assert.equal(seleccionarTapa([{ slug: 'otra-nota', breaking: false }])?.slug, 'otra-nota');
	assert.equal(seleccionarTapa([]), null);
});
