import { expect, test } from 'bun:test';

import { catalogPlugins, renderDeviceMatrix, validateDeviceMatrix } from './device-matrix';
import { PLUGINS_DIR } from './paths';

const catalog = [
	{ id: 'unbound.alpha', name: 'Alpha' },
	{ id: 'unbound.beta', name: 'Beta' },
];

const checks = [
	{
		id: 'unbound.alpha',
		behavior: 'pass' as const,
		lifecycle: 'pass' as const,
		evidence: ['screen.png'],
	},
	{
		id: 'unbound.beta',
		behavior: 'pass' as const,
		lifecycle: 'pass' as const,
		evidence: ['video.mp4'],
	},
];

test('the device matrix discovers the complete plugin catalog', () => {
	expect(catalogPlugins(PLUGINS_DIR)).toHaveLength(32);
});

test('the device matrix accepts one evidenced result per plugin', () => {
	expect(validateDeviceMatrix(catalog, checks)).toEqual([]);
});

test('the device matrix rejects omitted and duplicate results', () => {
	expect(validateDeviceMatrix(catalog, [checks[0], checks[0]])).toContain(
		'Missing result: unbound.beta',
	);
	expect(validateDeviceMatrix(catalog, [checks[0], checks[0]])).toContain(
		'Duplicate result: unbound.alpha',
	);
});

test('the device matrix rejects unknown plugins and unsupported statuses', () => {
	const invalid = {
		id: 'unbound.other',
		behavior: 'pending',
		lifecycle: 'pass',
		evidence: ['screen.png'],
	};
	expect(validateDeviceMatrix(catalog, [...checks, invalid] as typeof checks)).toContain(
		'Unknown plugin: unbound.other',
	);
	expect(validateDeviceMatrix(catalog, [...checks, invalid] as typeof checks)).toContain(
		'Invalid behavior result: unbound.other',
	);
});

test('the device matrix requires evidence and a reason for failures', () => {
	const invalid = {
		id: 'unbound.alpha',
		behavior: 'fail' as const,
		lifecycle: 'pass' as const,
		evidence: [],
	};
	expect(validateDeviceMatrix(catalog, [invalid, checks[1]])).toContain(
		'Missing evidence: unbound.alpha',
	);
	expect(validateDeviceMatrix(catalog, [invalid, checks[1]])).toContain(
		'Failed result needs a note: unbound.alpha',
	);
});

test('the device matrix rejects malformed result and evidence values', () => {
	expect(validateDeviceMatrix(catalog, [null, checks[1]])).toContain('Invalid result at index 0');
	expect(validateDeviceMatrix(catalog, [{ ...checks[0], evidence: [42] }, checks[1]])).toContain(
		'Missing evidence: unbound.alpha',
	);
	expect(validateDeviceMatrix(catalog, [{ ...checks[0], id: '' }, checks[1]])).toContain(
		'Invalid plugin ID at index 0',
	);
});

test('the device matrix renders a summary and preserves table cells', () => {
	const result = renderDeviceMatrix(catalog, [{ ...checks[0], note: 'A | B' }, checks[1]]);
	expect(result).toContain('2/2 plugins passed');
	expect(result).toContain('A \\| B');
});
