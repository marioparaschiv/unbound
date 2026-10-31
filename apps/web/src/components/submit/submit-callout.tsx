import { IconCircleWarning, IconTriangleWarning } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';

import type { SubmitErrorTone } from '~/components/submit/submit-errors';
import { describeSubmitError } from '~/components/submit/submit-errors';
import type { ApiErrorDetails } from '~/lib/api/error-details';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type SubmitCalloutProps = {
	error: ApiErrorDetails | null;
};

type SubmitIssueProps = {
	issue: ApiErrorDetails;
};

type ToneStyle = {
	icon: typeof IconCircleWarning;
	text: string;
	surface: string;
};

const TONES: Record<SubmitErrorTone, ToneStyle> = {
	error: { icon: IconCircleWarning, text: 'text-destructive', surface: 'bg-destructive/8' },
	warning: { icon: IconTriangleWarning, text: 'text-amber-400', surface: 'bg-amber-500/10' },
};

/**
 * @description Explains a failed step of the submit flow in plain words: a title, what to do, and the
 * server's own message behind Details.
 * @param props The failure, or `null` to render nothing.
 * @returns The callout.
 */
export function SubmitCallout({ error }: SubmitCalloutProps) {
	if (!error) return null;

	const view = describeSubmitError(error);
	const tone = TONES[view.tone];
	const Icon = tone.icon;

	return (
		<div role='alert' className={cn('flex gap-3 p-3 rounded-control', tone.surface)}>
			<Icon size={16} className={cn('mt-0.5 shrink-0', tone.text)} />
			<div className='flex flex-col flex-1 gap-1 min-w-0'>
				<Text variant='text-sm' className='font-medium'>
					{view.title}
				</Text>
				<Text variant='text-sm' color='muted' className='break-words whitespace-pre-wrap'>
					{view.hint}
				</Text>
				{view.link ? (
					<Link
						to={view.link.to}
						className='self-start font-medium text-link text-sm underline-offset-4 hover:underline'
					>
						{view.link.label}
					</Link>
				) : null}
				{view.details ? (
					<details className='group mt-0.5'>
						<summary className='text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer select-none'>
							Details
						</summary>
						<Text
							variant='text-xs'
							color='muted'
							className='mt-1 font-mono break-words whitespace-pre-wrap'
						>
							{view.details}
						</Text>
					</details>
				) : null}
			</div>
		</div>
	);
}

/**
 * @description An addon's issue on its row: an icon and the title, the hint below, and the server's
 * message as the tooltip. Phrasing content only, since it sits inside the row's button.
 * @param props The issue.
 * @returns The issue.
 */
export function SubmitIssue({ issue }: SubmitIssueProps) {
	const view = describeSubmitError(issue);
	const tone = TONES[view.tone];
	const Icon = tone.icon;

	return (
		<span className='flex flex-col min-w-0' title={view.details ?? undefined}>
			<span className='flex items-center gap-1.5 min-w-0'>
				<Icon size={12} className={cn('shrink-0', tone.text)} />
				<Text as='span' variant='text-xs' className='font-medium truncate'>
					{view.title}
				</Text>
			</span>
			<Text as='span' variant='text-xs' color='muted' className='line-clamp-2'>
				{view.hint}
			</Text>
		</span>
	);
}

export default { SubmitCallout, SubmitIssue };
