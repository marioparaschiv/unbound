import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLUGINS_DIR } from './paths';

export type DeviceCheck = {
	id: string;
	behavior: 'pass' | 'fail';
	lifecycle: 'pass' | 'fail';
	evidence: string[];
	note?: string;
};

export type CatalogPlugin = {
	id: string;
	name: string;
};

export function catalogPlugins(directory: string): CatalogPlugin[] {
	return readdirSync(directory, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() && existsSync(join(directory, entry.name, 'manifest.json')),
		)
		.map((entry) => {
			const manifest = JSON.parse(
				readFileSync(join(directory, entry.name, 'manifest.json'), 'utf8'),
			);
			return { id: manifest.id, name: manifest.name } as CatalogPlugin;
		})
		.sort((left, right) => left.name.localeCompare(right.name));
}

export function validateDeviceMatrix(catalog: CatalogPlugin[], checks: unknown[]): string[] {
	const errors: string[] = [];
	const expected = new Set(catalog.map((plugin) => plugin.id));
	const seen = new Set<string>();

	for (const [index, value] of checks.entries()) {
		if (!value || typeof value !== 'object') {
			errors.push(`Invalid result at index ${index}`);
			continue;
		}
		const check = value as DeviceCheck;
		if (typeof check.id !== 'string' || !check.id) {
			errors.push(`Invalid plugin ID at index ${index}`);
			continue;
		}
		if (!expected.has(check.id)) errors.push(`Unknown plugin: ${check.id}`);
		if (seen.has(check.id)) errors.push(`Duplicate result: ${check.id}`);
		seen.add(check.id);
		if (check.behavior !== 'pass' && check.behavior !== 'fail') {
			errors.push(`Invalid behavior result: ${check.id}`);
		}
		if (check.lifecycle !== 'pass' && check.lifecycle !== 'fail') {
			errors.push(`Invalid lifecycle result: ${check.id}`);
		}
		if (
			!Array.isArray(check.evidence) ||
			check.evidence.length === 0 ||
			check.evidence.some((item) => typeof item !== 'string' || !item.trim())
		) {
			errors.push(`Missing evidence: ${check.id}`);
		}
		if (
			(check.behavior === 'fail' || check.lifecycle === 'fail') &&
			(typeof check.note !== 'string' || !check.note.trim())
		) {
			errors.push(`Failed result needs a note: ${check.id}`);
		}
	}

	for (const plugin of catalog) {
		if (!seen.has(plugin.id)) errors.push(`Missing result: ${plugin.id}`);
	}

	return errors;
}

function cell(value: string): string {
	return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderDeviceMatrix(
	catalog: CatalogPlugin[],
	checks: DeviceCheck[],
	device = 'SE',
): string {
	const byId = new Map(checks.map((check) => [check.id, check]));
	const passed = checks.filter(
		(check) => check.behavior === 'pass' && check.lifecycle === 'pass',
	).length;
	const rows = catalog.map((plugin) => {
		const check = byId.get(plugin.id)!;
		return `| ${cell(plugin.name)} | ${cell(plugin.id)} | ${check.behavior} | ${check.lifecycle} | ${check.evidence.map(cell).join(', ')} | ${cell(check.note ?? '')} |`;
	});
	return [
		`# ${device} plugin device matrix`,
		'',
		`${passed}/${catalog.length} plugins passed behavior and lifecycle checks.`,
		'',
		'| Plugin | ID | Behavior | Lifecycle | Evidence | Note |',
		'| --- | --- | --- | --- | --- | --- |',
		...rows,
	].join('\n');
}

function main(): void {
	const path = process.argv[2];
	if (!path)
		throw new Error('Usage: bun packages/plugin-scripts/src/device-matrix.ts <results.json>');
	const catalog = catalogPlugins(PLUGINS_DIR);
	const checks = JSON.parse(readFileSync(path, 'utf8')) as unknown;
	if (!Array.isArray(checks)) throw new Error('Results must be an array');
	const errors = validateDeviceMatrix(catalog, checks);
	if (errors.length) throw new Error(errors.join('\n'));
	const results = checks as DeviceCheck[];
	console.log(renderDeviceMatrix(catalog, results));
	if (results.some((check) => check.behavior === 'fail' || check.lifecycle === 'fail'))
		process.exitCode = 1;
}

if (import.meta.main) main();
