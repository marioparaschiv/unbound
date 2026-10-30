import type { TagColors } from '~/tag-properties';

const MAX_PROBLEMS = 64;
const problems = new Map<string, string>();

/**
 * @description Says what is visibly wrong with a tag the plugin adds.
 * @param text The tag's text.
 * @param colors The tag's colors, when it is colored.
 * @returns The problem, or `undefined` for a tag that shows readable text.
 */
export function tagProblem(text: string, colors: TagColors | undefined): string | undefined {
	if (!text.trim()) return 'has no text';
	if (colors && colors.background === colors.text)
		return 'has text the same color as its background';
}

/**
 * @description Records how a tag looks, keeping the latest problem for each message.
 * @param messageId The message the tag belongs to.
 * @param problem What is wrong with it, or `undefined` once it looks right.
 */
export function noteTag(messageId: string, problem: string | undefined) {
	if (problem) problems.set(messageId, problem);
	else problems.delete(messageId);

	if (problems.size > MAX_PROBLEMS) problems.delete(problems.keys().next().value!);
}

/**
 * @description Lists the tags that look wrong.
 * @returns Each tag's message id and its problem.
 */
export function tagProblems(): string[] {
	return [...problems].map(([messageId, problem]) => `${messageId} ${problem}`);
}

/** @description Forgets every recorded tag. */
export function clearTagProblems() {
	problems.clear();
}
