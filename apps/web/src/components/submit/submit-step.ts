import type useSubmitFlow from '~/queries/submissions/use-submit-flow';

/** Where the author is in the flow: reading a repository, picking an addon, or confirming details. */
export type SubmitStep = 'repository' | 'addon' | 'details';

/** The action the flow last started, so the control that started it can show it is working. */
export type SubmitActivity = 'repository' | 'ref' | 'preview' | 'submit';

type SubmitStepEntry = {
	id: SubmitStep;
	title: string;
	/** What the step asks for, shown until it is done. */
	hint: string;
};

type SubmitFlowState = Pick<ReturnType<typeof useSubmitFlow>, 'listing' | 'request' | 'preview'>;

export const SUBMIT_STEPS: SubmitStepEntry[] = [
	{ id: 'repository', title: 'Repository', hint: 'A GitHub repository you can push to.' },
	{ id: 'addon', title: 'Addon', hint: 'The addon and the commit to submit.' },
	{ id: 'details', title: 'Details', hint: 'Check the preview, then submit for review.' },
];

/**
 * @description Derives the step the author is on from the submit flow's state.
 * @param flow The flow's listing, preview request and preview.
 * @returns `repository` before a listing loads, `addon` until a preview loads, then `details`.
 */
export function getSubmitStep(flow: SubmitFlowState): SubmitStep {
	if (!flow.listing) {
		return 'repository';
	}

	if (!flow.request || !flow.preview) {
		return 'addon';
	}

	return 'details';
}

export default { SUBMIT_STEPS, getSubmitStep };
