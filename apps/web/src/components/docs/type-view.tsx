import { Link } from '@tanstack/react-router';

import { TYPE_TONE_CLASSES, getTypeTone } from '~/lib/type-tone';
import type { DocsRoute } from '~/lib/docs/docs-links';
import type { TypePart } from '~/lib/docs/type-parts';
import cn from '~/lib/cn';

type TypeViewProps = {
	parts: TypePart[];
	route: DocsRoute;
	className?: string;
};

type LinkPart = {
	kind: 'link';
};

/** A part shown as coloured text rather than a link. */
type TextPart = Exclude<TypePart, LinkPart>;

const PART_CLASSES: Record<Exclude<TypePart['kind'], 'link' | 'intrinsic' | 'literal'>, string> = {
	keyword: 'text-primary',
	punctuation: 'text-muted-foreground',
	name: 'text-foreground',
	reference: TYPE_TONE_CLASSES.reference,
	parameter: 'text-foreground/80',
	typeParameter: 'italic text-orange-700 dark:text-orange-300',
};

// Intrinsics and literals take the tone of the value they describe, so `boolean` and `true` match.
function partClass(part: TextPart): string {
	return part.kind === 'intrinsic' || part.kind === 'literal'
		? TYPE_TONE_CLASSES[getTypeTone(part.text)]
		: PART_CLASSES[part.kind];
}

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
						to='/docs/sdk/$version/$symbol'
						params={{ version: route.version, symbol: part.location.symbol }}
						hash={part.location.anchor}
						className='text-link underline underline-offset-4 decoration-link/40 hover:decoration-link'
					>
						{part.text}
					</Link>
				) : (
					<span key={index} className={partClass(part)}>
						{part.text}
					</span>
				),
			)}
		</code>
	);
}

export default TypeView;
