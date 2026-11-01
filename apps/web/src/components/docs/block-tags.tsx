import { IconAlertWarning } from 'nucleo-micro-bold';

import type { DocsRenderContext } from '~/lib/docs/docs-links';
import type { DocsComment } from '~/lib/docs/typedoc';
import DocText from '~/components/docs/doc-text';
import Text from '~/components/ui/text';

type BlockTagsProps = {
	comment: DocsComment | undefined;
	ctx: DocsRenderContext;
};

/** Tags another section renders: the prose, parameters, return value and the deprecation callout. */
const HANDLED_TAGS = new Set([
	'@description',
	'@param',
	'@returns',
	'@template',
	'@typeParam',
	'@deprecated',
]);

const TAG_TITLES: Record<string, string> = {
	'@example': 'Example',
	'@see': 'See also',
	'@throws': 'Throws',
	'@default': 'Default',
	'@defaultValue': 'Default',
	'@remarks': 'Remarks',
	'@since': 'Since',
};

function tagTitle(tag: string): string {
	return TAG_TITLES[tag] ?? tag.slice(1).replace(/^./, (first) => first.toUpperCase());
}

/**
 * @description The `@deprecated` callout, with the tag's replacement note.
 * @param props The comment and the page's render context.
 * @returns The callout, or nothing when the comment is not deprecated.
 */
export function DeprecatedNote({ comment, ctx }: BlockTagsProps) {
	const tag = comment?.blockTags?.find((entry) => entry.tag === '@deprecated');

	if (!tag) return null;

	return (
		<div className='flex gap-3 bg-amber-500/10 p-4 border border-amber-500/30 rounded-control'>
			<IconAlertWarning className='mt-0.5 size-4 text-amber-600 dark:text-amber-400 shrink-0' />
			<div className='flex flex-col gap-1 min-w-0'>
				<Text
					variant='text-sm'
					className='font-semibold text-amber-700 dark:text-amber-300'
				>
					Deprecated
				</Text>
				<DocText parts={tag.content} ctx={ctx} />
			</div>
		</div>
	);
}

/**
 * @description Every block tag no other section shows, such as `@example`, `@see` and `@throws`, each under its own heading.
 * @param props The comment and the page's render context.
 * @returns The sections, or nothing when there are none.
 */
function BlockTags({ comment, ctx }: BlockTagsProps) {
	const tags = (comment?.blockTags ?? []).filter((tag) => !HANDLED_TAGS.has(tag.tag));

	if (!tags.length) return null;

	return (
		<div className='flex flex-col gap-5'>
			{tags.map((tag, index) => (
				<section key={index} className='flex flex-col gap-2'>
					<Text as='h3' variant='text-sm' className='font-semibold'>
						{tagTitle(tag.tag)}
					</Text>
					<DocText parts={tag.content} ctx={ctx} />
				</section>
			))}
		</div>
	);
}

export default BlockTags;
