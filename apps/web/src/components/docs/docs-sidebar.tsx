import {
	MAIN_DOCS_VERSION,
	docsPackageSchema,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import KindBadge from '~/components/docs/kind-badge';
import type { DocsNav } from '~/lib/docs/docs-page';
import { docsNavQuery } from '~/queries/docs/docs';
import { DOCS_GROUPS } from '~/lib/docs/kinds';
import cn from '~/lib/cn';

type DocsSidebarProps = {
	nav: DocsNav;
	/** The open symbol page, or `undefined` on the overview. */
	symbol: string | undefined;
};

const PACKAGE_LABELS: Record<string, string> = Object.fromEntries(
	docsPackageSchema.options.map((pkg) => [pkg, `@unbound-app/${pkg}`]),
);

const GROUP_LABELS = new Map(DOCS_GROUPS.map((group) => [group.key, group.label]));

function versionLabel(version: DocsVersion): string {
	return version === MAIN_DOCS_VERSION ? 'main (development)' : version;
}

// Scrolls only the sidebar, never the window; `scrollIntoView` would scroll both.
// A group still expanding is too short to scroll to, so this waits for the sidebar's animations to end.
async function revealActiveItem(nav: HTMLElement | null) {
	const container = nav?.parentElement;

	if (!container) return;

	await Promise.allSettled(
		container.getAnimations({ subtree: true }).map((animation) => animation.finished),
	);

	const item = nav?.querySelector<HTMLElement>('[data-active="true"]');

	if (!item || container.scrollHeight <= container.clientHeight) return;

	const offset = item.getBoundingClientRect().top - container.getBoundingClientRect().top;

	if (offset < 0 || offset > container.clientHeight - item.offsetHeight) {
		container.scrollTop += offset - container.clientHeight / 2;
	}
}

/**
 * @description The API reference sidebar: package and version selects, and every symbol in collapsible kind groups.
 * @param props The version's navigation and the open symbol.
 * @returns The sidebar.
 */
function DocsSidebar({ nav, symbol }: DocsSidebarProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const router = useRouter();
	const navRef = useRef<HTMLElement>(null);
	const route = { package: nav.package, version: nav.version };
	const activeGroup = nav.groups.find((group) =>
		group.symbols.some((entry) => entry.qualifiedName === symbol),
	)?.key;
	const [openGroups, setOpenGroups] = useState<string[]>(() => [
		'namespaces',
		...(activeGroup ? [activeGroup] : []),
	]);
	const [shownGroup, setShownGroup] = useState(activeGroup);

	if (activeGroup !== shownGroup) {
		setShownGroup(activeGroup);

		if (activeGroup && !openGroups.includes(activeGroup)) {
			setOpenGroups([...openGroups, activeGroup]);
		}
	}

	const versionLabels = Object.fromEntries(nav.versions.map((v) => [v, versionLabel(v)]));

	// After a navigation renders, the router puts every scrolled element back where it was, so the
	// sidebar reveals its active entry only once the router has.
	useEffect(() => {
		void revealActiveItem(navRef.current);

		return router.subscribe('onRendered', () => void revealActiveItem(navRef.current));
	}, [router]);

	async function switchVersion(next: string | null) {
		const version = nav.versions.find((entry) => entry === next);

		if (!version || version === nav.version) return;

		const target = await queryClient.fetchQuery(docsNavQuery(nav.package, version));
		const kept = target?.groups.some((group) =>
			group.symbols.some((entry) => entry.qualifiedName === symbol),
		);

		if (symbol && kept) {
			await navigate({
				to: '/docs/$package/$version/$symbol',
				params: { package: nav.package, version, symbol },
			});

			return;
		}

		await navigate({
			to: '/docs/$package/$version',
			params: { package: nav.package, version },
		});
	}

	return (
		<nav ref={navRef} aria-label='API reference' className='flex flex-col gap-3'>
			<div className='flex flex-col gap-2'>
				<Select items={PACKAGE_LABELS} value={nav.package}>
					<SelectTrigger size='sm' className='w-full' aria-label='Package'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{docsPackageSchema.options.map((pkg) => (
							<SelectItem key={pkg} value={pkg}>
								{PACKAGE_LABELS[pkg]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					items={versionLabels}
					value={nav.version}
					onValueChange={(next) => void switchVersion(next)}
				>
					<SelectTrigger size='sm' className='w-full' aria-label='Version'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{nav.versions.map((version) => (
							<SelectItem key={version} value={version}>
								{versionLabel(version)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Accordion type='multiple' value={openGroups} onValueChange={setOpenGroups}>
				{nav.groups.map((group) => (
					<AccordionItem key={group.key} value={group.key} className='border-b-0'>
						<AccordionTrigger className='py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide hover:no-underline'>
							<span className='flex items-center gap-2'>
								{GROUP_LABELS.get(group.key)}
								<span className='font-normal normal-case tabular-nums'>
									{group.symbols.length}
								</span>
							</span>
						</AccordionTrigger>
						<AccordionContent className='flex flex-col pb-2'>
							{group.symbols.map((entry) => (
								<Link
									key={entry.qualifiedName}
									to='/docs/$package/$version/$symbol'
									params={{ ...route, symbol: entry.qualifiedName }}
									title={entry.qualifiedName}
									data-active={entry.qualifiedName === symbol}
									className={cn(
										'flex items-center gap-2 px-2 rounded-item h-8 font-mono text-[0.8125rem] press-flat hover:bg-accent',
										entry.qualifiedName === symbol
											? 'bg-accent text-foreground font-semibold'
											: 'text-muted-foreground',
									)}
								>
									<KindBadge group={group.key} />
									<span className='single-line'>{entry.qualifiedName}</span>
								</Link>
							))}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</nav>
	);
}

export default DocsSidebar;
