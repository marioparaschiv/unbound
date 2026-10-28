import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, MotionConfig } from 'motion/react';

import Section from '~/components/landing/editorial/section';
import { fetchMarketplacePage } from '~/lib/marketplace';
import type { CssVariables } from '~/lib/css-variables';
import HeroShowcase from '~/components/hero-showcase';
import { Button } from '~/components/ui/button';

type Entry = {
	name: string;
	description: string;
};

const DOCS_URL = 'https://docs.unbound.rip';
const SERIF: CssVariables = { '--font-serif': "'Instrument Serif', Georgia, serif" };

const KINDS: Entry[] = [
	{ name: 'Plugins', description: 'Change how Discord behaves by patching its code and its UI.' },
	{ name: 'Themes', description: 'Recolor everything, and set a background of your own.' },
	{ name: 'Fonts', description: 'Register new font families with the system.' },
	{ name: 'Icon packs', description: "Replace Discord's built-in icons and images." },
];

// First-party plugins from packages/plugins, listed after whatever the marketplace returns.
const FIRST_PARTY: Entry[] = [
	{ name: 'Translate', description: 'Translate messages.' },
	{
		name: 'Moyai',
		description: 'Plays a thud when Moyai appears in the current channel or as a reaction.',
	},
	{ name: 'Clear URLs', description: 'Removes tracking garbage from URLs before you send them.' },
	{
		name: 'Shiki Codeblocks',
		description: 'Highlights code blocks with VS Code-style syntax colors.',
	},
	{ name: 'PronounDB', description: 'Adds pronouns to user messages using PronounDB.' },
	{
		name: 'View Raw',
		description: 'View and copy raw data for messages, channels, guilds, and user profiles.',
	},
];

const INDEX_SIZE = 6;

function EditorialLanding() {
	const { addons } = Route.useLoaderData();
	const listed = addons.map(({ name, description }) => ({ name, description }));
	const entries = [...listed, ...FIRST_PARTY].slice(0, INDEX_SIZE);

	return (
		<MotionConfig reducedMotion='user'>
			<div className='flex flex-col flex-1 items-center px-4 w-full' style={SERIF}>
				<div className='flex flex-col gap-24 md:gap-32 pt-[4vh] pb-24 w-full max-w-6xl'>
					<header className='flex flex-col gap-8'>
						<div className='flex justify-between pb-3 border-white/15 border-b text-muted-foreground text-xs uppercase tracking-[0.2em]'>
							<span>Unbound</span>
							<span className='hidden sm:inline'>
								Mods for Discord on iOS and Android
							</span>
							<span>No. 01</span>
						</div>
						<motion.h1
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
							className='font-secondary font-semibold text-[clamp(2.75rem,8.5vw,8rem)] leading-[0.92] tracking-tight'
						>
							Discord,{' '}
							<em className='font-serif font-normal text-[1.08em]'>rewritten</em>
							<br />
							by the people
							<span className='block md:pl-[18%] text-muted-foreground'>
								who use it.
							</span>
						</motion.h1>
						<div className='flex md:flex-row flex-col md:justify-end md:items-end gap-6'>
							<p className='max-w-sm text-muted-foreground'>
								Unbound is a client mod for the official Discord app. It runs inside
								Discord and lets add-ons change its modules, its state and its UI.
							</p>
							<div className='flex gap-3'>
								<Button asChild size='lg'>
									<Link to='/plugins'>Get Started</Link>
								</Button>
								<Button asChild variant='secondary' size='lg'>
									<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
										Documentation
									</a>
								</Button>
							</div>
						</div>
					</header>
					<Section number='01' title='The app'>
						<div className='items-end gap-8 grid lg:grid-cols-[1fr_16rem]'>
							<HeroShowcase
								className='lg:-ml-16 slide-in-from-bottom-16 animate-in duration-1000 fade-in'
								alt='Discord on three phones, running Unbound plugins and themes'
							/>
							<p className='font-serif text-2xl md:text-3xl italic leading-snug'>
								Same Discord, same account. The add-ons you pick sit on top, and you
								can take any of them back off.
							</p>
						</div>
					</Section>
					<Section number='02' title='What you can change'>
						<ol className='gap-x-12 gap-y-10 grid sm:grid-cols-2'>
							{KINDS.map(({ name, description }, index) => (
								<li key={name} className='flex gap-4'>
									<span className='font-serif text-muted-foreground text-xl italic'>
										{String.fromCharCode(97 + index)}.
									</span>
									<div className='flex flex-col gap-1'>
										<h3 className='font-semibold text-2xl md:text-3xl tracking-tight'>
											{name}
										</h3>
										<p className='text-muted-foreground'>{description}</p>
									</div>
								</li>
							))}
						</ol>
					</Section>
					<Section number='03' title='From the catalogue'>
						<ul className='flex flex-col'>
							{entries.map(({ name, description }, index) => (
								<li
									key={name}
									className='group flex sm:flex-row flex-col sm:items-baseline gap-1 sm:gap-6 py-4 border-white/10 border-b'
								>
									<span className='w-10 font-serif text-muted-foreground italic shrink-0'>
										{String(index + 1).padStart(2, '0')}
									</span>
									<span className='sm:w-64 font-semibold text-xl group-hover:translate-x-1 transition-transform shrink-0'>
										{name}
									</span>
									<span className='text-muted-foreground'>{description}</span>
								</li>
							))}
						</ul>
						<Link
							to='/plugins'
							className='inline-block mt-6 text-sm underline underline-offset-4 decoration-white/30 hover:decoration-white'
						>
							See every plugin
						</Link>
					</Section>
					<figure className='md:mx-[12%] text-center'>
						<blockquote className='font-serif text-[clamp(2rem,5vw,4rem)] italic leading-[1.05]'>
							"Disabling an add-on returns Discord to its stock state."
						</blockquote>
						<figcaption className='mt-4 text-muted-foreground text-xs uppercase tracking-[0.2em]'>
							The Unbound README
						</figcaption>
					</figure>
				</div>
			</div>
		</MotionConfig>
	);
}

export const Route = createFileRoute('/_site/landing/editorial')({
	head: () => ({
		meta: [{ title: 'Unbound | Editorial' }],
		links: [
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap',
			},
		],
	}),
	loader: () => fetchMarketplacePage({ data: { type: 'plugin' } }),
	component: EditorialLanding,
});
