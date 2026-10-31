import type { SubmitStep } from '~/components/submit/submit-step';
import { SUBMIT_STEPS } from '~/components/submit/submit-step';
import { SidebarCard } from '~/components/addon/sidebar-card';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type SubmitStepsProps = {
	step: SubmitStep;
	/** What each finished step chose, such as the repository's name. */
	values: Partial<Record<SubmitStep, string>>;
};

type StepState = 'done' | 'current' | 'upcoming';

const DOT_TONES: Record<StepState, string> = {
	done: 'bg-primary',
	current: 'bg-primary ring-4 ring-primary/20',
	upcoming: 'bg-muted-foreground/40',
};

/** The three submit steps on a timeline, each finished one with what the author chose. */
function SubmitSteps({ step, values }: SubmitStepsProps) {
	const current = SUBMIT_STEPS.findIndex((entry) => entry.id === step);

	return (
		<SidebarCard title='Steps'>
			<ol className='relative'>
				<span className='top-2 bottom-2 left-[4.5px] absolute bg-border w-px' aria-hidden />
				{SUBMIT_STEPS.map((entry, index) => {
					const state: StepState =
						index < current ? 'done' : index === current ? 'current' : 'upcoming';
					const value = state === 'done' ? values[entry.id] : undefined;

					return (
						<li
							key={entry.id}
							aria-current={state === 'current' ? 'step' : undefined}
							className='relative flex flex-col gap-0.5 pb-5 last:pb-0 pl-6'
						>
							<span
								className={cn(
									'top-1.5 left-0 absolute border-2 border-card rounded-full size-2.5',
									DOT_TONES[state],
								)}
								aria-hidden
							/>
							<Text
								as='span'
								variant='text-sm'
								color={state === 'upcoming' ? 'muted' : undefined}
								className={cn(
									state === 'current' ? 'font-semibold' : 'font-medium',
								)}
							>
								{entry.title}
							</Text>
							<Text
								as='span'
								variant='text-xs'
								color='muted'
								className={cn(value ? 'font-mono truncate' : null)}
							>
								{value ?? entry.hint}
							</Text>
						</li>
					);
				})}
			</ol>
		</SidebarCard>
	);
}

export default SubmitSteps;
