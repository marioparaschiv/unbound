import { appendFileSync } from 'node:fs';

const HEADER_LIMIT = 72;
const NOISE = [
	/ from \S+(?= to )/,
	/ in \/\S*/g,
	/ in the \S+ group/g,
	/ across \d+ director(?:y|ies)/g,
];

/**
 * @description Shortens a Dependabot pull request title so the squash commit it becomes fits the conventional header limit.
 * @param title The title Dependabot gave the pull request.
 * @param number The pull request number the squash merge appends as ` (#number)`.
 * @returns The original title when it already fits, otherwise the shortest form that keeps the update's meaning.
 */
export function shortenDependabotTitle(title: string, number: number): string {
	const fits = (candidate: string) => `${candidate} (#${number})`.length <= HEADER_LIMIT;

	if (fits(title)) {
		return title;
	}

	const trimmed = NOISE.reduce((current, pattern) => current.replace(pattern, ''), title).trim();

	if (fits(trimmed)) {
		return trimmed;
	}

	const prefix = title.slice(0, title.indexOf(':') + 1) || 'build(deps):';
	const group = /bump the (\S+) group/.exec(title);

	return group && fits(`${prefix} bump the ${group[1]} group`)
		? `${prefix} bump the ${group[1]} group`
		: `${prefix} bump dependencies`;
}

if (import.meta.main) {
	const title = process.env.PR_TITLE ?? '';
	const shortened = shortenDependabotTitle(title, Number(process.env.PR_NUMBER));

	appendFileSync(
		process.env.GITHUB_OUTPUT ?? '/dev/stdout',
		`title=${shortened}\nchanged=${shortened !== title}\n`,
	);
}
