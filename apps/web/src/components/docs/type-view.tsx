import { Link } from '@tanstack/react-router';

import type { DocsRoute } from '~/lib/docs/docs-links';
import type { TypePart } from '~/lib/docs/type-parts';
import cn from '~/lib/cn';

type TypeViewProps = {
	parts: TypePart[];
	route: DocsRoute;
	className?: string;
};

const PART_CLASSES: Record<Exclude<TypePart['kind'], 'link'>, string> = {
	keyword: 'text-primary',
	intrinsic: 'text-emerald-700 dark:text-emerald-400',
	punctuation: 'text-muted-foreground',
	name: 'text-foreground',
	literal: 'text-amber-700 dark:text-amber-400',
	parameter: 'text-sky-700 dark:text-sky-400',
};

/**
 * @description Renders a type's parts as code, each reference into the docs a link to its page.
 * @param props The parts and the version their links point into.
 * @returns The inline code.
 */
function TypeView({ parts, route, className }: TypeViewProps) {
	return (
		<code className={cn('font-mono text-[0.8125rem] leading-relaxed break-words', className)}>
			{parts.map((part, index) =>
				part.kind === 'link' ? (
					<Link
						key={index}
						to='/docs/$package/$version/$symbol'
						params={{ ...route, symbol: part.location.symbol }}
						hash={part.location.anchor}
						className='text-link underline underline-offset-4 decoration-link/40 hover:decoration-link'
					>
						{part.text}
					</Link>
				) : (
					<span key={index} className={PART_CLASSES[part.kind]}>
						{part.text}
					</span>
				),
			)}
		</code>
	);
}

export default TypeView;
