import type { ReactNode } from 'react';

import cn from '~/lib/cn';

type FlowProps = {
	/** Names what the diagram shows, above the rail. */
	caption?: string;
	children: ReactNode;
};

type FlowStepProps = {
	title: string;
	/** A short line after the title. */
	detail?: string;
	/** Marks the step this diagram adds to the one before it. */
	added?: boolean;
	/** A short pill after the detail, such as `You write this`. */
	badge?: string;
};

/**
 * @description A sequence drawn as numbered stops on a vertical rail, in a recessed well, the same rail
 * as {@link Steps}. A page draws one per idea and marks the step each adds.
 * @param props The steps and an optional caption.
 * @returns The diagram.
 */
export function Flow({ caption, children }: FlowProps) {
	return (
		<figure className='flex flex-col gap-3 min-w-0'>
			{caption ? (
				<figcaption className='font-medium text-muted-foreground text-xs'>
					{caption}
				</figcaption>
			) : null}
			<ol className='flex flex-col bg-[var(--field)] shadow-field px-4.5 py-4 rounded-surface [counter-reset:flow]'>
				{children}
			</ol>
		</figure>
	);
}

/**
 * @description One step of a {@link Flow}: its number on the rail, its title, detail and badge.
 * @param props The title, its detail line, its badge, and whether this diagram adds it.
 * @returns The step.
 */
export function FlowStep({ title, detail, added = false, badge }: FlowStepProps) {
	return (
		<li className='group/flow relative flex gap-3.5 pb-3.5 last:pb-0 [counter-increment:flow]'>
			<span
				aria-hidden
				className='top-[1.875rem] bottom-0.5 left-3.5 absolute bg-border w-px group-last/flow:hidden -translate-x-1/2'
			/>
			<span
				aria-hidden
				className={cn(
					'flex justify-center items-center rounded-full size-7 font-semibold text-sm tabular-nums before:content-[counter(flow)] shrink-0',
					added
						? 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.18),0_0_0_4px_oklch(from_var(--primary)_l_c_h/0.18)]'
						: 'bg-accent text-foreground shadow-key',
				)}
			/>
			<div className='flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 pt-1 min-w-0'>
				<span className='font-semibold text-foreground text-sm break-words'>{title}</span>
				{detail ? (
					<span className='text-muted-foreground text-xs break-words'>{detail}</span>
				) : null}
				{badge ? (
					<span className='bg-primary/18 px-2 py-0.5 rounded-full font-semibold text-link text-[0.6875rem]'>
						{badge}
					</span>
				) : null}
			</div>
		</li>
	);
}

export default { Flow, FlowStep };
