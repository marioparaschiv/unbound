import type { ReactNode } from 'react';

type StepsProps = {
	children: ReactNode;
};

type StepProps = {
	title: string;
	children?: ReactNode;
};

/**
 * @description A numbered sequence of steps joined by a rail.
 * @param props The steps.
 * @returns The list.
 */
export function Steps({ children }: StepsProps) {
	return <ol className='flex flex-col [counter-reset:step]'>{children}</ol>;
}

/**
 * @description One step: its number on the rail, a title, then its content.
 * @param props The title and content.
 * @returns The step.
 */
export function Step({ title, children }: StepProps) {
	return (
		<li className='group/step relative flex gap-4 pb-6 last:pb-0 [counter-increment:step]'>
			<div
				aria-hidden
				className='top-8 bottom-0 left-3.5 absolute bg-border w-px group-last/step:hidden -translate-x-1/2'
			/>
			<span
				aria-hidden
				className='flex justify-center items-center bg-accent shadow-key rounded-full size-7 font-semibold text-foreground text-sm tabular-nums before:content-[counter(step)] shrink-0'
			/>
			<div className='flex flex-col gap-3 pt-0.5 min-w-0 grow'>
				<p className='font-semibold text-foreground'>{title}</p>
				{children}
			</div>
		</li>
	);
}

export default { Steps, Step };
