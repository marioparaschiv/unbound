import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readPluginManifests } from './plugin-manifests';
import { PLUGINS_DIR, REPO_ROOT } from './paths';

const TEMPLATES = ['bug-report.yml', 'plugin-idea.yml'];
const TEMPLATE_DIR = join(REPO_ROOT, '.github', 'ISSUE_TEMPLATE');

/**
 * @description Rewrites the options of a form's `plugin` dropdown: its first option, such as "Not a plugin", stays first,
 * then every plugin by name.
 * @param form The issue form's YAML.
 * @param names The plugins' display names.
 * @returns The form with the dropdown's options replaced; the same text when it has no `plugin` dropdown.
 */
export function withPluginOptions(form: string, names: string[]): string {
	const lines = form.split('\n');
	const idLine = lines.findIndex((line) => line.trim() === 'id: plugin');
	const optionsLine =
		idLine < 0
			? -1
			: lines.findIndex((line, index) => index > idLine && line.trim() === 'options:');

	if (optionsLine < 0) return form;

	const first = optionsLine + 1;
	const indent = /^\s*/.exec(lines[first] ?? '')?.[0] ?? '';
	let end = first;

	while (end < lines.length && lines[end]!.startsWith(`${indent}- `)) end++;

	const keep = lines[first]!.slice(indent.length + 2);
	const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en'));
	const options = [keep, ...sorted.filter((name) => name !== keep)].map(
		(option) => `${indent}- ${option}`,
	);

	return [...lines.slice(0, first), ...options, ...lines.slice(end)].join('\n');
}

function syncTemplates(): number {
	const names = readPluginManifests(PLUGINS_DIR).map(({ manifest }) => manifest.name);
	let changed = 0;

	for (const file of TEMPLATES) {
		const path = join(TEMPLATE_DIR, file);
		const form = readFileSync(path, 'utf8');
		const next = withPluginOptions(form, names);

		if (next !== form) {
			writeFileSync(path, next);
			changed++;
		}
	}

	return changed;
}

if (import.meta.main) {
	console.log(`Issue templates: ${syncTemplates()} updated.`);
}
