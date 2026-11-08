import {
	IconArrowRotateClockwise,
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
} from 'nucleo-micro-bold';
import { Children, isValidElement, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';

import {
	FIRST_INSTALL_QUESTION,
	INSTALL_QUESTIONS,
	findInstallChoices,
	isInstallQuestion,
	type InstallAnswer,
	type InstallChoice,
	type InstallResultId,
} from '~/lib/guides/install-quiz';
import MorphStep, { type StepDirection } from '~/components/guides/morph-step';
import { GUIDE_ICONS } from '~/components/guides/guide-icons';
import { Button } from '~/components/ui/button';

type InstallQuizProps = {
	/** One `InstallResult` per install path. */
	children: ReactNode;
};

type InstallResultProps = {
	id: InstallResultId;
	/** Names the path once the quiz reaches it. */
	title: string;
	children?: ReactNode;
};

type AnswerButtonProps = {
	answer: InstallAnswer;
	onPick: (answer: InstallAnswer) => void;
};

function AnswerButton({ answer, onPick }: AnswerButtonProps) {
	const Glyph = GUIDE_ICONS[answer.icon];

	return (
		<button
			type='button'
			onClick={() => onPick(answer)}
			className='group/answer flex items-center gap-3.5 bg-card hover:bg-accent/40 p-3.5 border rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-halo shadow-surface min-h-16 text-left transition-colors press-flat'
		>
			<span className='flex justify-center items-center bg-accent shadow-key rounded-full size-10 text-foreground shrink-0'>
				<Glyph size={16} aria-hidden />
			</span>
			<span className='flex flex-col gap-0.5 min-w-0 grow'>
				<span className='font-semibold text-foreground text-sm'>{answer.label}</span>
				{answer.detail ? (
					<span className='text-muted-foreground text-xs leading-5'>{answer.detail}</span>
				) : null}
			</span>
			<IconChevronRight
				aria-hidden
				className='size-4 text-muted-foreground group-hover/answer:text-foreground group-hover/answer:translate-x-0.5 transition-[color,translate] shrink-0'
			/>
		</button>
	);
}

function readResults(children: ReactNode): ReactElement<InstallResultProps>[] {
	return Children.toArray(children).filter((child): child is ReactElement<InstallResultProps> =>
		isValidElement<InstallResultProps>(child),
	);
}

/**
 * @description Asks a few questions about the reader's device, then shows only the install steps for
 * their answers. A link to `#<result id>` opens it already answered.
 * @param props The `InstallResult` for each install path.
 * @returns The quiz.
 */
export function InstallQuiz({ children }: InstallQuizProps) {
	const hash = useLocation({ select: (location) => location.hash });
	const [choices, setChoices] = useState<InstallChoice[]>(() => findInstallChoices(hash) ?? []);
	const [direction, setDirection] = useState<StepDirection>(1);
	const [shownHash, setShownHash] = useState(hash);
	const results = readResults(children);

	if (hash !== shownHash) {
		setShownHash(hash);
		setDirection(1);
		setChoices((current) => findInstallChoices(hash) ?? current);
	}

	const step = choices.at(-1)?.answer.next ?? FIRST_INSTALL_QUESTION;
	const question = isInstallQuestion(step) ? INSTALL_QUESTIONS[step] : undefined;
	const result = results.find((entry) => entry.props.id === step);

	function move(next: InstallChoice[]) {
		setDirection(next.length > choices.length ? 1 : -1);
		setChoices(next);
	}

	function pick(answer: InstallAnswer) {
		if (isInstallQuestion(step)) {
			move([...choices, { question: step, answer }]);
		}
	}

	return (
		<div className='flex flex-col min-w-0'>
			<section aria-label='Find your install steps' className='flex flex-col gap-5'>
				<div className='flex flex-wrap justify-between items-center gap-3 min-h-9'>
					<ol aria-label='Your answers' className='flex flex-wrap items-center gap-1.5'>
						{choices.map((choice) => (
							<li key={choice.question} className='flex items-center gap-1.5'>
								<span className='flex items-center bg-secondary shadow-key px-3 rounded-full h-7 font-medium text-foreground text-xs'>
									{choice.answer.summary ?? choice.answer.label}
								</span>
								<IconChevronRight
									aria-hidden
									className='size-3 text-muted-foreground'
								/>
							</li>
						))}
						<li className='px-1 font-medium text-muted-foreground text-sm'>
							{question ? `Question ${choices.length + 1}` : 'Your steps'}
						</li>
					</ol>
					{choices.length > 0 ? (
						<div className='flex gap-1'>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => move(choices.slice(0, -1))}
							>
								<IconChevronLeft aria-hidden />
								Back
							</Button>
							<Button variant='ghost' size='sm' onClick={() => move([])}>
								<IconArrowRotateClockwise aria-hidden />
								Start over
							</Button>
						</div>
					) : null}
				</div>
				<MorphStep step={step} direction={direction}>
					<div className='flex flex-col gap-5'>
						<div className='flex flex-col gap-1.5'>
							{question ? (
								<p className='font-semibold text-foreground text-2xl leading-tight tracking-tight'>
									{question.title}
								</p>
							) : (
								<p className='flex items-center gap-3 font-semibold text-foreground text-2xl leading-tight tracking-tight'>
									<span className='flex justify-center items-center bg-primary/15 rounded-full size-9 text-primary shrink-0'>
										<IconCheck aria-hidden className='size-4' />
									</span>
									{result?.props.title}
								</p>
							)}
							{question?.help ? (
								<p className='text-muted-foreground text-sm'>{question.help}</p>
							) : null}
						</div>
						{question ? (
							<div className='gap-3 grid sm:grid-cols-2'>
								{question.answers.map((answer) => (
									<AnswerButton
										key={answer.label}
										answer={answer}
										onPick={pick}
									/>
								))}
							</div>
						) : (
							<div id={step} className='flex flex-col gap-4 min-w-0 scroll-mt-6'>
								{result?.props.children}
							</div>
						)}
					</div>
				</MorphStep>
			</section>
			{/* Every other path renders hidden, so the server HTML covers all of them. */}
			{results
				.filter((entry) => entry.props.id !== step)
				.map((entry) => (
					<div key={entry.props.id} hidden>
						{entry.props.children}
					</div>
				))}
		</div>
	);
}

/**
 * @description One install path of {@link InstallQuiz}; the quiz reads its id and title and shows its content.
 * @param props The path's id, title and steps.
 * @returns The content.
 */
export function InstallResult({ children }: InstallResultProps) {
	return <>{children}</>;
}

export default { InstallQuiz, InstallResult };
