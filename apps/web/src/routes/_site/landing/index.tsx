import { createFileRoute, Link } from '@tanstack/react-router';
import { IconArrowRight } from 'nucleo-micro-bold';

type Variant = {
	to: '/landing/terminal' | '/landing/sticker' | '/landing/editorial';
	name: string;
	description: string;
};

const VARIANTS: Variant[] = [
	{
		to: '/landing/terminal',
		name: 'Terminal',
		description:
			'Talks to developers first: a real plugin file, the CLI command and an ls of what Unbound does.',
	},
	{
		to: '/landing/sticker',
		name: 'Sticker',
		description:
			'Loud and Discord-coloured: draggable stickers on the phones and a marquee of real plugin names.',
	},
	{
		to: '/landing/editorial',
		name: 'Editorial',
		description:
			'Reads like a magazine: huge serif-and-sans type, numbered sections and an asymmetric layout.',
	},
];

function LandingVariants() {
	return (
		<div className='flex flex-col gap-8 mx-auto px-4 pt-[6vh] pb-24 w-full max-w-3xl'>
			<div className='flex flex-col gap-2'>
				<h1 className='font-semibold text-3xl tracking-tight'>Landing page drafts</h1>
				<p className='text-muted-foreground'>
					Three directions for the home page. Each keeps the header, the footer and the
					same two buttons.
				</p>
			</div>
			<ul className='flex flex-col gap-3'>
				{VARIANTS.map(({ to, name, description }) => (
					<li key={to}>
						<Link
							to={to}
							className='group flex items-center gap-4 bg-secondary/30 hover:bg-secondary/60 p-5 border rounded-surface transition-colors'
						>
							<div className='flex flex-col flex-1 gap-1'>
								<span className='font-semibold text-lg'>{name}</span>
								<span className='text-muted-foreground text-sm'>{description}</span>
							</div>
							<IconArrowRight className='size-5 text-muted-foreground group-hover:text-foreground transition-all group-hover:translate-x-1' />
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

export const Route = createFileRoute('/_site/landing/')({
	head: () => ({ meta: [{ title: 'Unbound | Landing drafts' }] }),
	component: LandingVariants,
});
