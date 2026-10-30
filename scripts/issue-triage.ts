import { appendFileSync } from 'node:fs';

export type FormAnswers = Record<string, string>;

export type Triage = {
	labels: string[];
	needsDetails: boolean;
};

const NO_RESPONSE = '_No response_';
const VERSION = /\d+\.\d+/;

const AREA_LABELS: [RegExp, string][] = [
	[/^Loader\b/, 'Loader'],
	[/first-party plugin/i, 'Plugin'],
	[/^Website or marketplace/, 'Web'],
	[/^Developer tools/, 'Developer Tools'],
	[/^Documentation/, 'Documentation'],
];

const PLATFORM_LABELS: Record<string, string> = { iOS: 'iOS', Android: 'Android' };

/**
 * @description Reads the answers GitHub renders into an issue form's body, one `### Label` section per field.
 * @param body The issue body.
 * @returns Each field's label and its answer, empty when the reporter left it blank.
 */
export function parseFormAnswers(body: string): FormAnswers {
	const answers: FormAnswers = {};

	for (const section of body.split(/^### /m).slice(1)) {
		const newline = section.indexOf('\n');
		const label = (newline < 0 ? section : section.slice(0, newline)).trim();
		const value = newline < 0 ? '' : section.slice(newline + 1).trim();

		answers[label] = value === NO_RESPONSE ? '' : value;
	}

	return answers;
}

function platformLabels(answers: FormAnswers): string[] {
	const value = [answers.Platform, answers.Platforms].filter(Boolean).join(', ');

	return value
		.split(',')
		.map((entry) => PLATFORM_LABELS[entry.trim()])
		.filter((label): label is string => Boolean(label));
}

function areaLabels(answers: FormAnswers): string[] {
	const area = answers.Area ?? answers['Where is the problem?'] ?? '';
	const labels = AREA_LABELS.filter(([pattern]) => pattern.test(area)).map(([, label]) => label);
	const plugin = answers.Plugin ?? '';

	if (plugin && plugin !== 'Not a plugin') {
		labels.push('Plugin');
	}

	return labels;
}

/**
 * @description Works out the labels an issue form's answers call for, and whether a bug report still lacks the versions needed to look into it.
 * @param body The issue body.
 * @param labels The labels the issue already has.
 * @returns The labels to add and whether to ask for details.
 */
export function triageIssue(body: string, labels: string[]): Triage {
	const answers = parseFormAnswers(body);
	const wanted = [...new Set([...platformLabels(answers), ...areaLabels(answers)])];
	const isBug = labels.includes('Bug');

	return {
		labels: wanted.filter((label) => !labels.includes(label)),
		needsDetails: isBug && !VERSION.test(answers.Environment ?? ''),
	};
}

if (import.meta.main) {
	const labels: unknown = JSON.parse(process.env.ISSUE_LABELS ?? '[]');
	const names = Array.isArray(labels)
		? labels.filter((label): label is string => typeof label === 'string')
		: [];
	const triage = triageIssue(process.env.ISSUE_BODY ?? '', names);

	appendFileSync(
		process.env.GITHUB_OUTPUT ?? '/dev/stdout',
		`labels=${triage.labels.join(',')}\nneeds-details=${triage.needsDetails}\n`,
	);
}
