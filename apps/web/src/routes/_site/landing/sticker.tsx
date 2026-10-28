import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, MotionConfig } from 'motion/react';
import { useMemo, useRef } from 'react';

import Marquee from '~/components/landing/sticker/marquee';
import Sticker from '~/components/landing/sticker/sticker';
import { fetchMarketplacePage } from '~/lib/marketplace';
import HeroShowcase from '~/components/hero-showcase';
import { Button } from '~/components/ui/button';

const DOCS_URL = 'https://docs.unbound.rip';

// First-party plugins from packages/plugins, so the marquee stays full while the marketplace is small.
const FIRST_PARTY = [
	'Moyai',
	'Hide Gift Button',
	'Translate',
	'PronounDB',
	'Shiki Codeblocks',
	'Typing Avatars',
	'Clear URLs',
	'ReviewDB',
	'View Raw',
	'Message Latency',
	'Role Color Everywhere',
	'Fix GIF Downloads',
	'Show Me Your Name',
	'Text Replace',
	'Reaction Avatars',
	'No Reply Mention',
	'Sticker Preview',
	'Custom Commands',
];

function StickerLanding() {
	const { addons } = Route.useLoaderData();
	const bounds = useRef<HTMLDivElement>(null);

	const [top, bottom] = useMemo(() => {
		const names = [...new Set([...addons.map((addon) => addon.name), ...FIRST_PARTY])];
		const half = Math.ceil(names.length / 2);

		return [names.slice(0, half), names.slice(half)];
	}, [addons]);

	return (
		<MotionConfig reducedMotion='user'>
			<div ref={bounds} className='relative flex flex-col flex-1 items-center w-full'>
				<section className='flex flex-col items-center gap-6 px-4 pt-[6vh] w-full max-w-5xl text-center'>
					<motion.span
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className='bg-brand/15 px-4 py-1.5 border border-brand/40 rounded-full font-medium text-[#A5ADFF] text-sm'
					>
						a mod for the Discord app on iOS and Android
					</motion.span>
					<motion.h1
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: 'spring', stiffness: 200, damping: 16 }}
						className='pb-3 font-secondary font-bold text-[clamp(3rem,10vw,7.5rem)] leading-[0.9] tracking-tighter'
					>
						Discord, but you <span className='text-[#FEE75C] italic'>get a say.</span>
					</motion.h1>
					<p className='max-w-2xl text-muted-foreground text-lg md:text-xl'>
						Unbound adds plugins and themes to the Discord app on your phone. Hide the
						gift button. Translate messages. Make every 🗿 go thud. Turn any of it off
						and Discord goes back to normal.
					</p>
					<div className='flex flex-wrap justify-center gap-3'>
						<Button
							asChild
							size='lg'
							className='bg-brand hover:bg-brand/90 [--ledge:var(--ledge-brand)] min-w-40 text-white'
						>
							<Link to='/plugins'>Get Started</Link>
						</Button>
						<Button asChild variant='secondary' size='lg' className='min-w-40'>
							<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
								Documentation
							</a>
						</Button>
					</div>
				</section>
				<section className='relative mt-10 md:mt-4 px-4 w-full max-w-[1400px]'>
					<HeroShowcase
						fade
						className='slide-in-from-bottom-24 animate-in duration-700 fade-in zoom-in-95'
						alt='Discord on three phones, running Unbound plugins and themes'
					/>
					<Sticker
						bounds={bounds}
						rotate={-8}
						className='top-[14%] left-[6%] bg-[#FEE75C] text-black'
					>
						no jailbreak needed
					</Sticker>
					<Sticker
						bounds={bounds}
						rotate={6}
						className='top-[8%] right-[8%] bg-[#EB459E] text-white'
					>
						iOS + Android
					</Sticker>
					<Sticker
						bounds={bounds}
						rotate={-4}
						className='top-[34%] right-[3%] bg-[#57F287] text-black'
					>
						open source, GPLv3
					</Sticker>
					<Sticker
						bounds={bounds}
						rotate={12}
						className='hidden sm:block top-[38%] left-[2%] bg-white text-black text-3xl md:text-4xl'
					>
						🗿
					</Sticker>
				</section>
				<section className='z-20 relative flex flex-col gap-4 -mt-[18vw] md:-mt-[28vw] lg:-mt-80 w-full'>
					<h2 className='mb-2 px-4 font-secondary font-bold text-2xl md:text-4xl text-center -rotate-1'>
						Stuff people already built
					</h2>
					<Marquee items={top} className='rotate-1' />
					<Marquee items={bottom} reverse className='-rotate-1' />
				</section>
				<section className='px-4 py-24 w-full max-w-4xl'>
					<motion.div
						initial={{ opacity: 0, rotate: -3, y: 30 }}
						whileInView={{ opacity: 1, rotate: -1.5, y: 0 }}
						viewport={{ once: true, amount: 0.4 }}
						transition={{ type: 'spring', stiffness: 160, damping: 18 }}
						className='flex flex-col items-center gap-5 bg-brand shadow-[0_10px_0_var(--ledge-brand)] p-10 md:p-14 rounded-[2rem] text-white text-center'
					>
						<h2 className='font-secondary font-bold text-3xl md:text-5xl leading-tight'>
							Pick a plugin. You can always take it back off.
						</h2>
						<p className='max-w-lg text-white/80'>
							Every add-on can be switched off from inside Discord, and recovery mode
							is there if one goes really wrong.
						</p>
						<div className='flex flex-wrap justify-center gap-3'>
							<Button
								asChild
								size='lg'
								className='bg-white hover:bg-white/90 [--ledge:var(--ledge-brand)] min-w-40 text-black'
							>
								<Link to='/plugins'>Get Started</Link>
							</Button>
							<Button
								asChild
								size='lg'
								className='bg-black/25 hover:bg-black/35 [--ledge:var(--ledge-brand)] min-w-40 text-white'
							>
								<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
									Documentation
								</a>
							</Button>
						</div>
					</motion.div>
				</section>
			</div>
		</MotionConfig>
	);
}

export const Route = createFileRoute('/_site/landing/sticker')({
	head: () => ({ meta: [{ title: 'Unbound | Sticker' }] }),
	loader: () => fetchMarketplacePage({ data: { type: 'plugin' } }),
	component: StickerLanding,
});
