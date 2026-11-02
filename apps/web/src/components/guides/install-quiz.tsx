import { IconArrowRotateClockwise, IconChevronLeft, IconChevronRight } from 'nucleo-micro-bold';
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
			className='group/answer flex items-center gap-3 bg-background hover:bg-accent/50 p-3 border rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo min-h-14 text-left transition-colors press-flat'
		>
			<span className='flex justify-center items-center bg-accent shadow-key rounded-full size-8 text-foreground shrink-0'>
				<Glyph size={14} aria-hidden />
			</span>
			<span className='flex flex-col gap-0.5 min-w-0 grow'>
				<span className='font-medium text-foreground text-sm'>{answer.label}</span>
				{answer.detail ? (
					<span className='text-muted-foreground text-xs leading-5'>{answer.detail}</span>
				) : null}
			</span>
			<IconChevronRight
				aria-hidden
				className='size-3.5 text-muted-foreground group-hover/answer:translate-x-0.5 transition-transform shrink-0'
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
	const [shownHash, setShownHash] = useState(hash);
	const results = readResults(children);

	if (hash !== shownHash) {
		setShownHash(hash);
		setChoices((current) => findInstallChoices(hash) ?? current);
	}

	const step = choices.at(-1)?.answer.next ?? FIRST_INSTALL_QUESTION;
	const question = isInstallQuestion(step) ? INSTALL_QUESTIONS[step] : undefined;
	const result = results.find((entry) => entry.props.id === step);

	function pick(answer: InstallAnswer) {
		if (isInstallQuestion(step)) {
			setChoices([...choices, { question: step, answer }]);
		}
	}

	return (
		<div className='flex flex-col gap-6 min-w-0'>
			<section
				aria-label='Find your install steps'
				className='flex flex-col gap-4 bg-card p-4 sm:p-5 border rounded-surface shadow-surface'
			>
				<div className='flex justify-between items-center gap-3 h-5'>
					<p className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>
						{question ? `Question ${choices.length + 1}` : 'Your steps'}
					</p>
					{choices.length > 0 ? (
						// Ghost buttons bleed into the padding, so their text lines up with the card's edges.
						<div className='flex gap-1 -mr-2.5'>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setChoices(choices.slice(0, -1))}
							>
								<IconChevronLeft aria-hidden />
								Back
							</Button>
							<Button variant='ghost' size='sm' onClick={() => setChoices([])}>
								<IconArrowRotateClockwise aria-hidden />
								Start over
							</Button>
						</div>
					) : null}
				</div>
				{choices.length > 0 ? (
					<ul aria-label='Your answers' className='flex flex-wrap gap-1.5'>
						{choices.map((choice) => (
							<li
								key={choice.question}
								className='bg-accent px-2.5 py-1 rounded-full text-foreground text-xs'
							>
								{choice.answer.summary ?? choice.answer.label}
							</li>
						))}
					</ul>
				) : null}
				{question ? (
					<>
						<div className='flex flex-col gap-1'>
							<p className='font-semibold text-foreground text-lg leading-snug'>
								{question.title}
							</p>
							{question.help ? (
								<p className='text-muted-foreground text-sm'>{question.help}</p>
							) : null}
						</div>
						<div className='gap-2 grid sm:grid-cols-2'>
							{question.answers.map((answer) => (
								<AnswerButton key={answer.label} answer={answer} onPick={pick} />
							))}
						</div>
					</>
				) : (
					<p className='font-semibold text-foreground text-lg leading-snug'>
						{result?.props.title}
					</p>
				)}
			</section>
			{/* Every path renders so the server HTML and find-in-page cover all of them. */}
			{results.map((entry) => (
				<div
					key={entry.props.id}
					id={entry.props.id}
					hidden={entry.props.id !== step}
					className='flex flex-col gap-4 min-w-0 scroll-mt-6'
				>
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
