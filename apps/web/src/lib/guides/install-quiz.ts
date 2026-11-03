import type { GuideIconName } from '~/lib/guides/guide-icon-names';

/** An install path the quiz ends on; the installing guide holds one `InstallResult` per id. */
export type InstallResultId =
	| 'ios-source'
	| 'ios-ipa'
	| 'ios-no-tool'
	| 'ios-jailbroken'
	| 'android-patched'
	| 'android-rooted';

export type InstallQuestionId = 'device' | 'jailbreak' | 'sideloader' | 'root';

/** One answer: what it says, and the question or install path it leads to. */
export type InstallAnswer = {
	label: string;
	/** Names the answer in the list of answers so far, where the question isn't shown. */
	summary?: string;
	detail?: string;
	icon: GuideIconName;
	next: InstallQuestionId | InstallResultId;
};

export type InstallQuestion = {
	title: string;
	/** Helps someone unsure which answer fits. */
	help?: string;
	answers: InstallAnswer[];
};

/** The questions, from `device` on; every answer leads to another question or to an install path. */
export const INSTALL_QUESTIONS: Record<InstallQuestionId, InstallQuestion> = {
	device: {
		title: 'What are you installing on?',
		answers: [
			{ label: 'iPhone or iPad', icon: 'apple', next: 'jailbreak' },
			{ label: 'Android', detail: 'Phone or tablet', icon: 'mobile', next: 'root' },
		],
	},
	jailbreak: {
		title: 'Is your device jailbroken?',
		help: "If you're not sure, it isn't. A jailbreak is something you set up on purpose.",
		answers: [
			{
				label: 'No',
				summary: 'Not jailbroken',
				detail: 'Most people',
				icon: 'circle-check',
				next: 'sideloader',
			},
			{
				label: 'Yes',
				summary: 'Jailbroken',
				detail: 'A rootless jailbreak, with Sileo or a similar package manager',
				icon: 'wrench',
				next: 'ios-jailbroken',
			},
		],
	},
	sideloader: {
		title: 'Which app do you use to install apps from outside the App Store?',
		help: 'This is your sideloading tool.',
		answers: [
			{
				label: 'SideStore, Feather or AltStore',
				detail: 'Or another tool that supports sources',
				icon: 'download',
				next: 'ios-source',
			},
			{ label: 'A different tool', summary: 'Another tool', icon: 'box', next: 'ios-ipa' },
			{
				label: "I don't have one yet",
				summary: 'No sideloading tool',
				icon: 'circle-dashed',
				next: 'ios-no-tool',
			},
		],
	},
	root: {
		title: 'Is your device rooted, with Vector or LSPosed installed?',
		help: "If you're not sure, it isn't. Pick No.",
		answers: [
			{
				label: 'No',
				summary: 'Not rooted',
				detail: 'Most people',
				icon: 'circle-check',
				next: 'android-patched',
			},
			{
				label: 'Yes',
				summary: 'Rooted',
				detail: 'Rooted, with an Xposed framework',
				icon: 'wrench',
				next: 'android-rooted',
			},
		],
	},
};

export const FIRST_INSTALL_QUESTION: InstallQuestionId = 'device';

/** One answered question on the way to the current step. */
export type InstallChoice = {
	question: InstallQuestionId;
	answer: InstallAnswer;
};

/**
 * @description Narrows a quiz step to a question id.
 * @param step A question or an install path.
 * @returns Whether the step is a question.
 */
export function isInstallQuestion(step: string): step is InstallQuestionId {
	return Object.hasOwn(INSTALL_QUESTIONS, step);
}

/**
 * @description Finds the answers that lead from the first question to an install path, for a link
 * such as `#android-rooted` that opens the quiz already answered.
 * @param result The install path, such as a page's hash.
 * @param from The question to search from.
 * @returns The answers in order, or `undefined` when no path leads there.
 */
export function findInstallChoices(
	result: string,
	from: InstallQuestionId = FIRST_INSTALL_QUESTION,
): InstallChoice[] | undefined {
	for (const answer of INSTALL_QUESTIONS[from].answers) {
		const choice = { question: from, answer };

		if (answer.next === result) {
			return [choice];
		}

		const rest = isInstallQuestion(answer.next)
			? findInstallChoices(result, answer.next)
			: undefined;

		if (rest) {
			return [choice, ...rest];
		}
	}

	return undefined;
}

export default { INSTALL_QUESTIONS, FIRST_INSTALL_QUESTION, findInstallChoices, isInstallQuestion };
