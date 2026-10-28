import { createFileRoute, Link } from '@tanstack/react-router';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { motion, MotionConfig } from 'motion/react';
import { useState } from 'react';

import CodeWindow from '~/components/landing/terminal/code-window';
import copyText from '~/components/dashboard/copy-text';
import type { CssVariables } from '~/lib/css-variables';
import HeroShowcase from '~/components/hero-showcase';
import { Button } from '~/components/ui/button';

type Capability = {
	name: string;
	detail: string;
};

const DOCS_URL = 'https://docs.unbound.rip';
const INSTALL_COMMAND = 'bunx @unbound-app/cli create';
const MONO: CssVariables = { '--font-mono': "'Geist Mono', ui-monospace, monospace" };

const CAPABILITIES: Capability[] = [
	{ name: 'hot-reload/', detail: 'Add-ons update while Discord is running. No restart.' },
	{
		name: 'error-isolation/',
		detail: 'A plugin that throws gets caught and logged, not the app.',
	},
	{ name: 'recovery-mode/', detail: 'If a bundle breaks Discord, boot back into a working one.' },
	{ name: 'api/', detail: '@unbound-app/api types every module the client exposes.' },
	{ name: 'themes/', detail: 'Colors and a custom background, no plugin code needed.' },
	{ name: 'fonts/ icons/', detail: 'Register font families and swap built-in assets.' },
];

const RISE = { opacity: 0, y: 16 };
const RISEN = { opacity: 1, y: 0 };

function InstallLine() {
	const [copied, setCopied] = useState(false);

	async function copy() {
		await copyText(INSTALL_COMMAND, 'command');
		setCopied(true);
	}

	return (
		<button
			type='button'
			onClick={copy}
			className='group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] px-4 border border-white/10 rounded-control w-full sm:w-auto h-12 font-mono text-sm text-left transition-colors'
		>
			<span className='text-emerald-400 select-none'>$</span>
			<span className='flex-1 truncate'>{INSTALL_COMMAND}</span>
			{copied ? (
				<IconCheck className='size-4 text-emerald-400' />
			) : (
				<IconCopy className='size-4 text-muted-foreground group-hover:text-foreground transition-colors' />
			)}
		</button>
	);
}

function TerminalLanding() {
	return (
		<MotionConfig reducedMotion='user'>
			<div className='flex flex-col flex-1 items-center w-full' style={MONO}>
				<section className='items-center gap-12 grid lg:grid-cols-[1fr_1.05fr] px-4 pt-[6vh] w-full max-w-6xl'>
					<motion.div
						initial={RISE}
						animate={RISEN}
						transition={{ duration: 0.4, ease: 'easeOut' }}
						className='flex flex-col gap-6 min-w-0'
					>
						<p className='font-mono text-muted-foreground text-xs tracking-wide'>
							<span className='text-emerald-400'>●</span> unbound · ios · android
						</p>
						<h1 className='font-secondary font-bold text-4xl md:text-5xl lg:text-6xl text-balance leading-[1.05] tracking-tight'>
							Your Discord app, now with a{' '}
							<code className='font-mono text-emerald-300'>start()</code> and a{' '}
							<code className='font-mono text-rose-300'>stop()</code>.
						</h1>
						<p className='max-w-xl text-muted-foreground text-lg'>
							Unbound loads into the official Discord app on your phone. Plugins patch
							its modules and React components at runtime. Turn one off and Discord is
							exactly how it was before.
						</p>
						<InstallLine />
						<div className='flex flex-wrap gap-3'>
							<Button asChild size='lg' className='min-w-36'>
								<Link to='/plugins'>Get Started</Link>
							</Button>
							<Button asChild variant='secondary' size='lg' className='min-w-36'>
								<a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
									Documentation
								</a>
							</Button>
						</div>
					</motion.div>
					<motion.div
						initial={RISE}
						animate={RISEN}
						transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
						className='min-w-0'
					>
						<CodeWindow />
					</motion.div>
				</section>
				<section className='relative mt-20 px-4 w-full max-w-5xl'>
					<p className='mb-6 font-mono text-muted-foreground text-xs text-center'>
						{'// what that looks like on a phone'}
					</p>
					<HeroShowcase
						fade
						className='slide-in-from-bottom-12 animate-in duration-700 fade-in'
						alt='Discord on three phones, running Unbound plugins and themes'
					/>
				</section>
				<section className='z-20 relative -mt-16 sm:-mt-32 md:-mt-56 mb-24 px-4 w-full max-w-4xl'>
					<div className='bg-[#0d0d10]/80 backdrop-blur-md p-6 md:p-8 border border-white/10 rounded-surface font-mono text-sm'>
						<p className='mb-4 text-muted-foreground'>
							<span className='text-emerald-400'>$</span> ls unbound/
						</p>
						<ul className='gap-x-8 gap-y-3 grid md:grid-cols-2'>
							{CAPABILITIES.map(({ name, detail }, index) => (
								<motion.li
									key={name}
									initial={RISE}
									whileInView={RISEN}
									viewport={{ once: true, amount: 0.6 }}
									transition={{ duration: 0.25, delay: 0.04 * index }}
									className='flex flex-col gap-0.5'
								>
									<span className='text-sky-300'>{name}</span>
									<span className='font-primary text-muted-foreground'>
										{detail}
									</span>
								</motion.li>
							))}
						</ul>
					</div>
				</section>
			</div>
		</MotionConfig>
	);
}

export const Route = createFileRoute('/_site/landing/terminal')({
	head: () => ({
		meta: [{ title: 'Unbound | Terminal' }],
		links: [
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap',
			},
		],
	}),
	component: TerminalLanding,
});
