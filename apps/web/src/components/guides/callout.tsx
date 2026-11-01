import { IconCircleInfo, IconLightbulb, IconTriangleWarning } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import cn from '~/lib/cn';

type CalloutTone = 'note' | 'warning' | 'tip';

type CalloutProps = {
	children: ReactNode;
};

type ToneStyle = {
	icon: typeof IconCircleInfo;
	label: string;
	text: string;
	surface: string;
};

// The same surface-and-icon shape as the submit flow's callouts.
const TONES: Record<CalloutTone, ToneStyle> = {
	note: { icon: IconCircleInfo, label: 'Note', text: 'text-sky-500', surface: 'bg-sky-500/8' },
	warning: {
		icon: IconTriangleWarning,
		label: 'Warning',
		text: 'text-amber-500',
		surface: 'bg-amber-500/10',
	},
	tip: {
		icon: IconLightbulb,
		label: 'Tip',
		text: 'text-emerald-500',
		surface: 'bg-emerald-500/8',
	},
};

function Callout({ tone, children }: CalloutProps & { tone: CalloutTone }) {
	const style = TONES[tone];
	const Icon = style.icon;

	return (
		<aside
			aria-label={style.label}
			className={cn('flex gap-3 p-4 rounded-control text-sm', style.surface)}
		>
			<Icon size={16} className={cn('mt-0.5 shrink-0', style.text)} />
			<div className='flex flex-col gap-3 min-w-0 text-foreground/90 [&_p]:text-sm [&_p]:leading-6'>
				{children}
			</div>
		</aside>
	);
}

/**
 * @description A neutral aside with extra context.
 * @param props The content.
 * @returns The callout.
 */
export function Note({ children }: CalloutProps) {
	return <Callout tone='note'>{children}</Callout>;
}

/**
 * @description An aside about something that can break or lose data.
 * @param props The content.
 * @returns The callout.
 */
export function Warning({ children }: CalloutProps) {
	return <Callout tone='warning'>{children}</Callout>;
}

/**
 * @description An aside with a shortcut or a better way.
 * @param props The content.
 * @returns The callout.
 */
export function Tip({ children }: CalloutProps) {
	return <Callout tone='tip'>{children}</Callout>;
}

export default { Note, Warning, Tip };
