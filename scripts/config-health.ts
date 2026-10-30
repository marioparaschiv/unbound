import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type ConfigKind = 'secret' | 'var';

export type ConfigRequirement = {
	kind: ConfigKind;
	required: boolean;
	purpose: string;
};

export type ConfigRequirements = Record<string, ConfigRequirement>;

export type ConfigReference = {
	name: string;
	kind: ConfigKind;
};

export type ConfigStatus = ConfigReference & ConfigRequirement & { present: boolean };

const root = resolve(import.meta.dir, '..');
const IGNORED = new Set(['GITHUB_TOKEN']);
const REFERENCE = /\b(secrets|vars)\.([A-Z][A-Z0-9_]*)\b/g;

/**
 * @description Finds every repository secret and variable the workflows and actions read.
 * @param directories The directories to scan, relative to the repository root.
 * @param excluded File names to skip, such as the health workflow that reads every name on purpose.
 * @returns The references, one per name, sorted by name.
 */
export function referencedConfig(
	directories: string[] = ['.github/workflows', '.github/actions'],
	excluded: string[] = ['config-health.yml'],
): ConfigReference[] {
	const found = new Map<string, ConfigKind>();

	function scan(directory: string): void {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				scan(path);
			} else if (/\.ya?ml$/.test(entry.name) && !excluded.includes(entry.name)) {
				for (const match of readFileSync(path, 'utf8').matchAll(REFERENCE)) {
					if (!IGNORED.has(match[2])) {
						found.set(match[2], match[1] === 'secrets' ? 'secret' : 'var');
					}
				}
			}
		}
	}

	for (const directory of directories) {
		scan(join(root, directory));
	}

	return [...found]
		.map(([name, kind]) => ({ name, kind }))
		.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * @description Reads the documented configuration from `.github/config-requirements.json`.
 * @returns The requirements keyed by name.
 */
export function loadRequirements(): ConfigRequirements {
	const path = join(root, '.github/config-requirements.json');
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'));

	if (!isRequirements(value)) {
		throw new Error(`${path} must map each name to { kind, required, purpose }.`);
	}

	return value;
}

// UNKNOWN: one entry of the parsed requirements file.
function isRequirement(value: unknown): value is ConfigRequirement {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		(value.kind === 'secret' || value.kind === 'var') &&
		'required' in value &&
		typeof value.required === 'boolean' &&
		'purpose' in value &&
		typeof value.purpose === 'string'
	);
}

// UNKNOWN: the parsed requirements file.
function isRequirements(value: unknown): value is ConfigRequirements {
	return typeof value === 'object' && value !== null && Object.values(value).every(isRequirement);
}

/**
 * @description Combines the documented requirements with what the repository has configured.
 * @param requirements The documented requirements.
 * @param present Whether each name is configured.
 * @returns Every requirement with its status, required ones first.
 */
export function checkConfig(
	requirements: ConfigRequirements,
	present: (name: string) => boolean,
): ConfigStatus[] {
	return Object.entries(requirements)
		.map(([name, requirement]) => ({ name, ...requirement, present: present(name) }))
		.sort(
			(left, right) =>
				Number(right.required) - Number(left.required) ||
				left.name.localeCompare(right.name),
		);
}

/**
 * @description Renders the statuses as a Markdown summary.
 * @param statuses The statuses from {@link checkConfig}.
 * @returns The summary.
 */
export function renderConfigSummary(statuses: ConfigStatus[]): string {
	const missingRequired = statuses.filter((status) => status.required && !status.present);
	const missingOptional = statuses.filter((status) => !status.required && !status.present);
	const lines = [
		'## Repository configuration',
		'',
		missingRequired.length === 0
			? 'Every required secret and variable is set.'
			: `**${missingRequired.length} required ${missingRequired.length === 1 ? 'value is' : 'values are'} missing.**`,
		missingOptional.length === 0
			? ''
			: `${missingOptional.length} optional ${missingOptional.length === 1 ? 'value is' : 'values are'} unset.`,
		'',
		'| Name | Kind | Required | Set | Purpose |',
		'| --- | --- | --- | --- | --- |',
		...statuses.map(
			(status) =>
				`| \`${status.name}\` | ${status.kind} | ${status.required ? 'yes' : 'no'} | ${status.present ? 'yes' : '**no**'} | ${status.purpose} |`,
		),
	];

	return `${lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n')}\n`;
}

/**
 * @description Names the environment variable the health workflow sets to whether a name is configured.
 * @param name The secret or variable name.
 * @returns The environment variable name.
 */
export function presenceVariable(name: string): string {
	return `CONFIG_PRESENT_${name}`;
}

if (import.meta.main) {
	const statuses = checkConfig(
		loadRequirements(),
		(name) => process.env[presenceVariable(name)] === 'true',
	);
	const summary = renderConfigSummary(statuses);

	console.log(summary);

	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
	}

	if (statuses.some((status) => status.required && !status.present)) {
		process.exit(1);
	}
}
