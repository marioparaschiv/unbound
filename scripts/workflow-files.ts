import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { YAML } from 'bun';

type Label = { name: string; color: string; description: string };

type VendoredComponent = { path: string; name: string; license: string; url: string };

const COLOR = /^[0-9a-f]{6}$/i;
const TRIAGE_LABELS = ['needs-info', 'needs-triage', 'iOS', 'Android', 'Plugin', 'Loader', 'Web'];

function isLabel(value: unknown): value is Label {
	return (
		typeof value === 'object' &&
		value !== null &&
		'name' in value &&
		typeof value.name === 'string' &&
		'color' in value &&
		typeof value.color === 'string' &&
		COLOR.test(value.color) &&
		'description' in value &&
		typeof value.description === 'string'
	);
}

function isVendoredComponent(value: unknown): value is VendoredComponent {
	return (
		typeof value === 'object' &&
		value !== null &&
		'path' in value &&
		typeof value.path === 'string' &&
		value.path !== '' &&
		'name' in value &&
		typeof value.name === 'string' &&
		'license' in value &&
		typeof value.license === 'string' &&
		'url' in value &&
		typeof value.url === 'string'
	);
}

function isIgnoreRule(value: unknown): value is { ignore: unknown[] } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ignore' in value &&
		Array.isArray(value.ignore)
	);
}

function zizmorProblems(root: string): string[] {
	const path = join(root, '.github', 'zizmor.yml');

	if (!existsSync(path)) {
		return ['.github/zizmor.yml is missing'];
	}

	const config: unknown = YAML.parse(readFileSync(path, 'utf8'));

	if (typeof config !== 'object' || config === null || !('rules' in config)) {
		return [];
	}

	const { rules } = config;

	if (typeof rules !== 'object' || rules === null) {
		return [];
	}

	return Object.entries(rules).flatMap(([rule, settings]) =>
		(isIgnoreRule(settings) ? settings.ignore.map(String) : [])
			.filter((file) => !existsSync(join(root, '.github', 'workflows', file)))
			.map(
				(file) => `.github/zizmor.yml ignores ${file} for ${rule}, which is not a workflow`,
			),
	);
}

function formLabels(root: string): string[] {
	const directory = join(root, '.github', 'ISSUE_TEMPLATE');

	if (!existsSync(directory)) {
		return [];
	}

	return readdirSync(directory)
		.filter((file) => file.endsWith('.yml') && file !== 'config.yml')
		.flatMap((file) => {
			const form: unknown = YAML.parse(readFileSync(join(directory, file), 'utf8'));

			if (
				typeof form !== 'object' ||
				form === null ||
				!('labels' in form) ||
				!Array.isArray(form.labels)
			) {
				return [];
			}

			return form.labels.filter((label): label is string => typeof label === 'string');
		});
}

function labelProblems(root: string): string[] {
	const path = join(root, '.github', 'labels.json');

	if (!existsSync(path)) {
		return ['.github/labels.json is missing'];
	}

	const labels: unknown = JSON.parse(readFileSync(path, 'utf8'));

	if (!Array.isArray(labels) || !labels.every(isLabel)) {
		return [
			'.github/labels.json must list labels with a name, a six-digit hex color and a description',
		];
	}

	const names = labels.map((label) => label.name.toLowerCase());
	const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
	const missing = [...new Set([...formLabels(root), ...TRIAGE_LABELS])].filter(
		(label) => !names.includes(label.toLowerCase()),
	);

	return [
		...duplicates.map((name) => `.github/labels.json lists ${name} twice`),
		...missing.map(
			(name) =>
				`.github/labels.json is missing ${name}, which the issue forms or triage apply`,
		),
	];
}

function vendorProblems(root: string): string[] {
	const loader = join(root, 'packages', 'loader');
	const path = join(loader, 'vendor', 'versions.json');

	if (!existsSync(path)) {
		return ['packages/loader/vendor/versions.json is missing'];
	}

	const components: unknown = JSON.parse(readFileSync(path, 'utf8'));

	if (!Array.isArray(components) || !components.every(isVendoredComponent)) {
		return [
			'packages/loader/vendor/versions.json must list components with a path, name, license and url',
		];
	}

	return components
		.filter((component) => !existsSync(join(loader, component.path)))
		.map(
			(component) =>
				`packages/loader/vendor/versions.json lists ${component.path}, which does not exist`,
		);
}

/**
 * @description Checks the files the workflows read besides secrets and variables: the zizmor config, the label list and the loader's vendored versions.
 * @param root The repository root.
 * @returns Each problem found, empty when all three files are sound.
 */
export function workflowFileProblems(root: string): string[] {
	return [...zizmorProblems(root), ...labelProblems(root), ...vendorProblems(root)];
}
