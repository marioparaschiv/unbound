import { Fragment } from 'react';

import type { RevealPreset } from '~/components/motion/reveal-style';
import { revealStyle } from '~/components/motion/reveal-style';

type BlurRevealSplit = 'letter' | 'word';

type BlurRevealProps = {
	text: string;
	split?: BlurRevealSplit;
	preset?: RevealPreset;
	delay?: number;
};

const SPLIT_STAGGER_MS: Record<BlurRevealSplit, number> = {
	letter: 40,
	word: 60,
};

function BlurReveal({ text, split = 'word', preset = 'heading', delay = 0 }: BlurRevealProps) {
	// Graphemes, so an emoji or accented letter stays one piece.
	const parts =
		split === 'letter'
			? Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment)
			: text.split(' ');
	const stagger = SPLIT_STAGGER_MS[split];

	return (
		<>
			<span className='sr-only'>{text}</span>
			<span aria-hidden>
				{parts.map((part, index) => (
					<Fragment key={index}>
						{split === 'word' && index > 0 ? ' ' : null}
						<span
							className='inline-block animate-reveal'
							style={revealStyle(preset, delay + index * stagger)}
						>
							{part}
						</span>
					</Fragment>
				))}
			</span>
		</>
	);
}

export default BlurReveal;
