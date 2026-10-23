import type { SubmissionStatus } from '@unbound-app/contracts/publish';

import type { Visibility } from '~/lib/dashboard';

export type DisplayStatus = SubmissionStatus | Visibility;

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

type StatusStyle = {
	label: string;
	tone: Tone;
};

type ToneClasses = {
	pill: string;
	dot: string;
	callout: string;
};

export const STATUSES: Record<DisplayStatus, StatusStyle> = {
	listed: { label: 'Listed', tone: 'success' },
	delisted: { label: 'Delisted', tone: 'neutral' },
	awaiting_upload: { label: 'Upload incomplete', tone: 'neutral' },
	pending_review: { label: 'In review', tone: 'info' },
	changes_requested: { label: 'Changes requested', tone: 'warning' },
	approved: { label: 'Approved', tone: 'success' },
	rejected: { label: 'Rejected', tone: 'danger' },
	superseded: { label: 'Superseded', tone: 'neutral' },
	expired: { label: 'Upload expired', tone: 'neutral' },
	cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const TONES: Record<Tone, ToneClasses> = {
	success: {
		pill: 'bg-emerald-500/15 text-emerald-400',
		dot: 'bg-emerald-400',
		callout: 'border-emerald-500/30 bg-emerald-500/10',
	},
	info: {
		pill: 'bg-sky-500/15 text-sky-400',
		dot: 'bg-sky-400',
		callout: 'border-sky-500/30 bg-sky-500/10',
	},
	warning: {
		pill: 'bg-amber-500/15 text-amber-400',
		dot: 'bg-amber-400',
		callout: 'border-amber-500/30 bg-amber-500/10',
	},
	danger: {
		pill: 'bg-red-500/15 text-red-400',
		dot: 'bg-red-400',
		callout: 'border-red-500/30 bg-red-500/10',
	},
	neutral: {
		pill: 'bg-muted text-muted-foreground',
		dot: 'bg-muted-foreground',
		callout: 'bg-muted/50',
	},
};

/**
 * @description Resolves a status to its label and tone classes.
 * @param status The status to show.
 * @returns The label, tone and classes.
 */
export function getStatusStyle(status: DisplayStatus): StatusStyle & ToneClasses {
	const style = STATUSES[status];

	return { ...style, ...TONES[style.tone] };
}

export default { STATUSES, TONES, getStatusStyle };
