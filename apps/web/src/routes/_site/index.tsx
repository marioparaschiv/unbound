import {
	IconBrandOpenSource,
	IconCode,
	IconDeviceMobile,
	IconPalette,
	IconPlug,
	IconUsers,
} from '@tabler/icons-react';
import type { ComponentType, CSSProperties, MouseEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { Card, CardDescription, CardTitle } from '~/components/ui/card';
import { revealStyle } from '~/components/motion/reveal-style';
import BlurReveal from '~/components/motion/blur-reveal';
import type { CssVariables } from '~/lib/css-variables';
import Reveal from '~/components/motion/reveal';
import { Button } from '~/components/ui/button';
import cn from '~/lib/cn';

type IconProps = {
	className?: string;
};

type Feature = {
	icon: ComponentType<IconProps>;
	title: string;
	description: string;
	wide?: boolean;
};

const DOCS_URL = 'https://docs.unbound.rip';

const GRID_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' opacity='0.1'%3E%3Cpath d='M48 23.5L0 23.5' stroke='%23888'/%3E%3Cpath d='M48 47.5001L0 47.5001' stroke='%23888'/%3E%3Cpath d='M23.5 0V48' stroke='%23888'/%3E%3Cpath d='M47.5 0V48' stroke='%23888'/%3E%3C/g%3E%3Cg opacity='0.25'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M48 47L48 48L47 48L47 47L48 47ZM48 43L48 44L47 44L47 43L48 43ZM48 39L48 40L47 40L47 39L48 39ZM48 35L48 36L47 36L47 35L48 35ZM48 31L48 32L47 32L47 31L48 31ZM48 27L48 28L47 28L47 27L48 27ZM48 23L48 24L47 24L47 23L48 23ZM48 19L48 20L47 20L47 19L48 19ZM48 15L48 16L47 16L47 15L48 15ZM48 11L48 12L47 12L47 11L48 11ZM48 7L48 8L47 8L47 7L48 7ZM48 3L48 4L47 4L47 3L48 3Z' fill='%23888'/%3E%3C/g%3E%3Cg opacity='0.035'%3E%3Crect width='24' height='24' fill='%23888'/%3E%3Crect x='24' y='24' width='24' height='24' fill='%23888'/%3E%3C/g%3E%3C/svg%3E")`;

const FEATURES: Feature[] = [
	{
		icon: IconPlug,
		title: 'Plugins',
		description:
			'Extend Discord with community-built plugins that add new features and functionality.',
		wide: true,
	},
	{
		icon: IconPalette,
		title: 'Themes',
		description: 'Personalize your Discord with custom themes and color schemes.',
	},
	{
		icon: IconBrandOpenSource,
		title: 'Open Source',
		description: 'Fully open-source and auditable under GPLv3. Transparency you can trust.',
	},
	{
		icon: IconDeviceMobile,
		title: 'Cross-Platform',
		description:
			'Built for both Android and iOS, bringing the same powerful customization to every mobile device.',
		wide: true,
	},
	{
		icon: IconCode,
		title: 'Developer Friendly',
		description:
			'Comprehensive API and documentation for building your own plugins and themes.',
		wide: true,
	},
	{
		icon: IconUsers,
		title: 'Community Driven',
		description:
			'Join a growing community of developers and users shaping the future of mobile Discord.',
	},
];

// The hero enters in sequence: title letters, then the tagline's words, then the actions and art.
const TAGLINE_DELAY_MS = 250;
const ACTIONS_STYLE = revealStyle('hero', 450);
const ART_STYLE = revealStyle('card', 600);

const GLOW_ORIGIN: CssVariables = { '--glow-x': '0px', '--glow-y': '0px' };
const GLOW_POSITION: CSSProperties = { left: 'var(--glow-x)', top: 'var(--glow-y)' };
const GLOW_RING_MASK = 'radial-gradient(250px at var(--glow-x) var(--glow-y), white, transparent)';
const GLOW_RING: CSSProperties = { maskImage: GLOW_RING_MASK, WebkitMaskImage: GLOW_RING_MASK };

const GRID_BACKGROUND: CSSProperties = { backgroundImage: GRID_PATTERN };
const GRID_VIGNETTE: CSSProperties = {
	background: 'radial-gradient(ellipse at center, transparent 0%, var(--color-background) 70%)',
};

// Every card's glow follows the pointer across the whole grid, so the offsets are written
// straight to each card's CSS variables instead of re-rendering on every mouse move.
function trackGlow(event: MouseEvent<HTMLDivElement>) {
	for (const card of event.currentTarget.querySelectorAll<HTMLElement>('[data-feature]')) {
		const rect = card.getBoundingClientRect();

		card.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
		card.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
	}
}

function FeatureGrid() {
	return (
		<div className='z-20 relative mx-auto -mt-24 sm:-mt-40 md:-mt-80 mb-12 px-4 w-full max-w-6xl'>
			<div
				className='group/features relative gap-4 grid grid-cols-1 md:grid-cols-3'
				onMouseMove={trackGlow}
			>
				{FEATURES.map(({ icon: Icon, title, description, wide }, index) => (
					<Reveal
						key={title}
						data-feature
						style={GLOW_ORIGIN}
						delay={0.05 * index}
						className={cn(wide && 'md:col-span-2')}
					>
						<Card className='relative gap-3 bg-secondary/30 backdrop-blur-md p-6 border-transparent h-full overflow-hidden'>
							<div
								className='absolute bg-primary/8 blur-3xl rounded-full size-80 opacity-0 group-hover/features:opacity-100 transition-opacity -translate-x-1/2 -translate-y-1/2 duration-200 pointer-events-none'
								style={GLOW_POSITION}
							/>
							<div
								className='absolute inset-0 rounded-xl ring-1 ring-primary/15 ring-inset opacity-0 group-hover/features:opacity-100 transition-opacity duration-200 pointer-events-none'
								style={GLOW_RING}
							/>
							<div className='absolute inset-0 ring-border/50 rounded-xl ring-1 ring-inset pointer-events-none' />
							<div className='relative flex justify-center items-center bg-accent/50 backdrop-blur-md rounded-lg size-10'>
								<Icon className='size-5' />
							</div>
							<CardTitle className='relative'>{title}</CardTitle>
							<CardDescription className='relative'>{description}</CardDescription>
						</Card>
					</Reveal>
				))}
			</div>
		</div>
	);
}

function HomePage() {
	return (
		<div className='flex flex-col flex-1 items-center'>
			<div className='flex flex-col justify-center items-center gap-6 px-4 pt-[8vh] overflow-hidden'>
				<h1 className='font-secondary font-bold text-5xl md:text-6xl lg:text-7xl text-fade'>
					<BlurReveal text='Unbound' split='letter' preset='hero' />
				</h1>
				<h2 className='font-secondary font-semibold text-2xl md:text-3xl lg:text-4xl text-fade'>
					<BlurReveal
						text='Transform your discord experience.'
						preset='hero'
						delay={TAGLINE_DELAY_MS}
					/>
				</h2>
				<div className='flex gap-4 mt-4 animate-reveal' style={ACTIONS_STYLE}>
					<Button asChild variant='default' size='lg' className='min-w-40'>
						<Link to='/plugins'>Get Started</Link>
					</Button>
					<Button asChild variant='secondary' size='lg' className='min-w-40'>
						<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
							Documentation
						</a>
					</Button>
				</div>
				<div
					className='after:z-10 after:absolute relative after:inset-0 after:bg-[linear-gradient(to_bottom,transparent_0%,var(--color-background)_55%)] mt-16 md:mt-8 w-full max-w-[1600px] after:pointer-events-none animate-reveal'
					style={ART_STYLE}
				>
					<img src='/img/hero.png' alt='Unbound hero' className='w-full' />
				</div>
			</div>
			<FeatureGrid />
			<div className='relative w-full overflow-hidden'>
				<div className='absolute inset-0' style={GRID_BACKGROUND} />
				<div className='absolute inset-0' style={GRID_VIGNETTE} />
				<Reveal className='z-10 relative flex flex-col items-center gap-4 mx-auto my-24 px-4 w-full max-w-6xl text-center'>
					<h3 className='bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground font-secondary font-semibold text-transparent text-2xl md:text-3xl'>
						Are you a developer?
					</h3>
					<p className='max-w-lg text-muted-foreground'>
						Build plugins and themes for Unbound with our comprehensive documentation
						and developer tools.
					</p>
					<Button asChild variant='secondary' size='lg'>
						<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
							Start Building
						</a>
					</Button>
				</Reveal>
			</div>
		</div>
	);
}

export const Route = createFileRoute('/_site/')({
	component: HomePage,
});
