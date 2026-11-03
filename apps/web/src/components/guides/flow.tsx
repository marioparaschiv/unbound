import type { ReactNode } from 'react';

import cn from '~/lib/cn';

type FlowProps = {
	/** Names what the diagram shows, in the card's header bar. */
	caption?: string;
	children: ReactNode;
};

type FlowStepProps = {
	title: string;
	/** A short line under the title. */
	detail?: string;
	/** Marks the step this diagram adds to the one before it. */
	added?: boolean;
};

/**
 * @description A sequence drawn as numbered stops on a rail, in a card that blends into the page:
 * centred left to right, top to bottom on phones. A page draws one per idea and marks the step each
 * adds, so the reader watches the system assemble.
 * @param props The steps and an optional caption.
 * @returns The diagram.
 */
export function Flow({ caption, children }: FlowProps) {
	return (
		<figure className='flex flex-col bg-card/50 border border-border/60 rounded-surface min-w-0 overflow-hidden'>
			{caption ? (
				<figcaption className='px-4 py-2.5 border-border/60 border-b font-medium text-muted-foreground text-xs'>
					{caption}
				</figcaption>
			) : null}
			<ol className='flex sm:flex-row flex-col px-4 sm:px-2 py-5 [counter-reset:flow]'>
				{children}
			</ol>
		</figure>
	);
}

/**
 * @description One step of a {@link Flow}: its number on the rail, its title and detail.
 * @param props The title, its detail line, and whether this diagram adds it.
 * @returns The step.
 */
export function FlowStep({ title, detail, added = false }: FlowStepProps) {
	return (
		<li className='group/flow relative flex flex-col sm:items-center flex-1 gap-1 pb-8 sm:pb-0 last:pb-0 pl-12 min-h-20 sm:min-h-0 last:min-h-0 sm:pl-0 sm:pt-12 sm:px-2 min-w-0 sm:text-center [counter-increment:flow]'>
			{/* The rail to the next stop, with a gap at each end: down on phones, across from sm up. */}
			<span
				aria-hidden
				className='group-last/flow:hidden top-[2.375rem] sm:top-4 bottom-1.5 sm:bottom-auto left-4 sm:left-[calc(50%+1.75rem)] absolute bg-border w-px sm:w-[calc(100%-3.5rem)] sm:h-px'
			/>
			<span
				aria-hidden
				className={cn(
					'top-0 left-0 sm:left-1/2 absolute flex justify-center items-center backdrop-blur-md rounded-full size-8 font-semibold text-sm tabular-nums before:content-[counter(flow)] sm:-translate-x-1/2',
					added ? 'bg-primary/20 text-primary' : 'bg-accent/60 text-foreground',
				)}
			/>
			<span
				className={cn(
					'pt-1.5 sm:pt-0 font-medium text-sm break-words',
					added ? 'text-primary' : 'text-foreground',
				)}
			>
				{title}
			</span>
			{detail ? (
				<span className='text-muted-foreground text-xs break-words'>{detail}</span>
			) : null}
		</li>
	);
}

export default { Flow, FlowStep };
