import { useLocation, useRouter } from '@tanstack/react-router';
import { createPortal } from 'react-dom';

import { LAB_VARIANT_IDS } from '~/components/lab/lab-variant';
import useInBrowser from '~/components/lab/use-in-browser';
import LAB_VARIANTS from '~/components/lab/variants';
import cn from '~/lib/cn';

const LIVE_PATHS: Record<string, string> = {
	review: '/review',
	addons: '/admin/addons',
	users: '/admin/users',
};

/**
 * @description Splits a staff path into its lab variant (or `null` for the live page) and the page path.
 * @param pathname A `/lab/<variant>/...` or live staff path.
 * @returns The active variant and the page path shared by every variant, like `addons/verify.hello`.
 */
function parsePath(pathname: string) {
	const lab = /^\/lab\/([abc])\/?(.*)$/.exec(pathname);

	if (lab) {
		return { active: lab[1], page: lab[2] || 'review' };
	}

	const live = /^\/(?:admin\/)?(.*)$/.exec(pathname);

	return { active: null, page: live?.[1] || 'review' };
}

/**
 * @description Maps a lab page path to the same page on the live staff area.
 * @param page The page path, like `addons/verify.hello`.
 * @returns The live staff path.
 */
function toLivePath(page: string): string {
	const [section = 'review', ...rest] = page.split('/');
	const base = LIVE_PATHS[section] ?? '/review';

	return rest.length > 0 ? `${base}/${rest.join('/')}` : base;
}

function LabSwitcher() {
	const location = useLocation();
	const router = useRouter();
	const inBrowser = useInBrowser();
	const { active, page } = parsePath(location.pathname);

	function go(href: string) {
		void router.navigate({ href: `${href}${location.searchStr}` });
	}

	const items = [
		...LAB_VARIANT_IDS.map((id) => ({
			key: id,
			short: id.toUpperCase(),
			label: `${id.toUpperCase()} · ${LAB_VARIANTS[id].label}`,
			title: LAB_VARIANTS[id].pitch,
			href: `/lab/${id}/${page}`,
		})),
		{
			key: 'current',
			short: 'Live',
			label: 'Current',
			title: 'The live staff area',
			href: toLivePath(page),
		},
	];

	if (!inBrowser) return null;

	// Portalled to the body: the page wrapper's `clip-path` would otherwise hide it once the footer scrolls in.
	return createPortal(
		<div className='bottom-4 left-1/2 z-40 fixed flex items-center gap-1 bg-card/90 shadow-float backdrop-blur-md p-1 border rounded-full max-w-[calc(100vw-1rem)] -translate-x-1/2'>
			<span className='hidden sm:inline px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
				Lab
			</span>
			{items.map((item) => (
				<button
					key={item.key}
					type='button'
					title={item.title}
					onClick={() => go(item.href)}
					className={cn(
						'px-3 rounded-full h-8 font-semibold text-sm whitespace-nowrap transition-colors',
						(active ?? 'current') === item.key
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
					)}
				>
					<span className='sm:hidden'>{item.short}</span>
					<span className='hidden sm:inline'>{item.label}</span>
				</button>
			))}
		</div>,
		document.body,
	);
}

export default LabSwitcher;
