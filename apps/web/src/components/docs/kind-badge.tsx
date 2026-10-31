import { DOCS_GROUPS, type DocsGroupKey } from '~/lib/docs/kinds';
import cn from '~/lib/cn';

type KindBadgeProps = {
	group: DocsGroupKey;
	className?: string;
};

const BADGE_TINTS: Record<DocsGroupKey, string> = {
	namespaces: 'bg-secondary text-muted-foreground',
	functions: 'bg-primary/12 text-primary',
	classes: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
	interfaces: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
	types: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
	enums: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
	variables: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
};

const GROUPS = new Map(DOCS_GROUPS.map((group) => [group.key, group]));

/**
 * @description A symbol's kind as a one-letter tile, tinted per kind.
 * @param props The kind group.
 * @returns The badge.
 */
function KindBadge({ group, className }: KindBadgeProps) {
	const { badge, label } = GROUPS.get(group) ?? DOCS_GROUPS[0];

	return (
		<span
			title={label}
			className={cn(
				'inline-flex justify-center items-center rounded-[6px] size-5 font-mono font-semibold text-[11px] shrink-0',
				BADGE_TINTS[group],
				className,
			)}
		>
			{badge}
		</span>
	);
}

export default KindBadge;
