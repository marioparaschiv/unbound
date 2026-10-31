import { IconPhoto } from 'nucleo-micro-bold';
import type { Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Lexer } from 'marked';

import { resolveMarkdownUrl, type MarkdownPin } from '~/lib/markdown-url';
import Text from '~/components/ui/text';

type MarkdownProps = {
	source: string;
	pin: MarkdownPin;
};

type LinkProps = {
	href: string | undefined;
	children: ReactNode;
};

type HeadingStyle = {
	as: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
	variant: 'heading-md' | 'heading-sm' | 'text-md' | 'text-sm';
	className?: string;
};

const LINK_REL = 'nofollow ugc noopener noreferrer';
const LINK_CLASS = 'font-medium text-link underline-offset-4 hover:underline';

// Headings shift down one level: the page's own title is the only h1.
const HEADINGS: Record<number, HeadingStyle> = {
	1: { as: 'h2', variant: 'heading-md' },
	2: { as: 'h3', variant: 'heading-md' },
	3: { as: 'h4', variant: 'heading-sm' },
	4: { as: 'h5', variant: 'text-md', className: 'font-semibold' },
	5: { as: 'h6', variant: 'text-md', className: 'font-semibold' },
	6: { as: 'h6', variant: 'text-sm', className: 'font-semibold' },
};

const ALIGN_CLASSES = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

// marked decodes numeric character references but leaves named ones for an HTML renderer.
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00A0',
	copy: '©',
	reg: '®',
	trade: '™',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	middot: '·',
	larr: '←',
	rarr: '→',
	harr: '↔',
};

const NAMED_ENTITY = /&([a-z]+);/gi;

function decodeEntities(text: string): string {
	return text.includes('&')
		? text.replace(NAMED_ENTITY, (entity, name: string) => NAMED_ENTITIES[name] ?? entity)
		: text;
}

function Link({ href, children }: LinkProps) {
	if (!href) {
		return <span>{children}</span>;
	}

	if (href.startsWith('#')) {
		return (
			<a href={href} className={LINK_CLASS}>
				{children}
			</a>
		);
	}

	return (
		<a href={href} target='_blank' rel={LINK_REL} className={LINK_CLASS}>
			{children}
		</a>
	);
}

function renderInline(tokens: Token[] | undefined, pin: MarkdownPin): ReactNode[] {
	return (tokens ?? []).map((token, index) => renderInlineToken(token, pin, index));
}

// Raw HTML never renders: its tags drop out and the text between them stays.
function renderInlineToken(token: Token, pin: MarkdownPin, key: number): ReactNode {
	switch (token.type) {
		case 'text': {
			const text = token as Tokens.Text;

			return text.tokens ? renderInline(text.tokens, pin) : decodeEntities(text.text);
		}
		case 'escape': {
			return (token as Tokens.Escape).text;
		}
		case 'strong': {
			return (
				<strong key={key} className='font-semibold text-foreground'>
					{renderInline((token as Tokens.Strong).tokens, pin)}
				</strong>
			);
		}
		case 'em': {
			return <em key={key}>{renderInline((token as Tokens.Em).tokens, pin)}</em>;
		}
		case 'del': {
			return (
				<del key={key} className='text-muted-foreground/70'>
					{renderInline((token as Tokens.Del).tokens, pin)}
				</del>
			);
		}
		case 'codespan': {
			return (
				<code
					key={key}
					className='bg-muted px-1.5 py-0.5 rounded-md font-mono text-[0.875em] text-foreground'
				>
					{(token as Tokens.Codespan).text}
				</code>
			);
		}
		case 'br': {
			return <br key={key} />;
		}
		case 'link': {
			const link = token as Tokens.Link;

			return (
				<Link key={key} href={resolveMarkdownUrl(link.href, pin, 'link')?.href}>
					{renderInline(link.tokens, pin)}
				</Link>
			);
		}
		case 'image': {
			// An image becomes a link to the file, so no remote content loads on the page.
			const image = token as Tokens.Image;

			return (
				<Link key={key} href={resolveMarkdownUrl(image.href, pin, 'image')?.href}>
					<IconPhoto className='inline mr-1 size-4 align-[-0.125em]' aria-hidden />
					{decodeEntities(image.text.trim()) || 'Image'}
				</Link>
			);
		}
		default: {
			return null;
		}
	}
}

function renderBlocks(tokens: Token[], pin: MarkdownPin): ReactNode[] {
	return tokens.map((token, index) => renderBlock(token, pin, index));
}

function renderListItem(item: Tokens.ListItem, pin: MarkdownPin, key: number): ReactNode {
	// A tight item holds bare text; a loose one holds paragraphs.
	const body = item.tokens.map((token, index) =>
		token.type === 'text'
			? renderInlineToken(token, pin, index)
			: renderBlock(token, pin, index),
	);

	if (item.task) {
		return (
			<li key={key} className='flex items-baseline gap-2 [&>input]:accent-primary'>
				{body}
			</li>
		);
	}

	return (
		<li key={key} className='pl-1 marker:text-muted-foreground/60'>
			{body}
		</li>
	);
}

function renderTable(table: Tokens.Table, pin: MarkdownPin, key: number): ReactNode {
	return (
		<div key={key} className='border rounded-control overflow-x-auto'>
			<table className='w-full text-sm border-collapse'>
				<thead className='bg-muted/50'>
					<tr className='border-b last:border-b-0'>
						{table.header.map((cell, index) => (
							<th
								key={index}
								className={`px-3 py-2 font-medium text-foreground ${ALIGN_CLASSES[cell.align ?? 'left']}`}
							>
								{renderInline(cell.tokens, pin)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{table.rows.map((row, rowIndex) => (
						<tr key={rowIndex} className='border-b last:border-b-0'>
							{row.map((cell, index) => (
								<td
									key={index}
									className={`px-3 py-2 text-muted-foreground align-top ${ALIGN_CLASSES[cell.align ?? 'left']}`}
								>
									{renderInline(cell.tokens, pin)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// Raw HTML blocks and link definitions render nothing; definitions already resolved their links.
function renderBlock(token: Token, pin: MarkdownPin, key: number): ReactNode {
	switch (token.type) {
		case 'heading': {
			const heading = token as Tokens.Heading;
			const style = HEADINGS[heading.depth] ?? HEADINGS[6];

			return (
				<Text
					key={key}
					as={style?.as}
					variant={style?.variant}
					className={style?.className}
				>
					{renderInline(heading.tokens, pin)}
				</Text>
			);
		}
		case 'paragraph': {
			return (
				<Text key={key} variant='text-md' color='muted'>
					{renderInline((token as Tokens.Paragraph).tokens, pin)}
				</Text>
			);
		}
		case 'text': {
			return (
				<Text key={key} variant='text-md' color='muted'>
					{renderInlineToken(token, pin, key)}
				</Text>
			);
		}
		case 'list': {
			const list = token as Tokens.List;
			const tasks = list.items.some((item) => item.task);
			const items = list.items.map((item, index) => renderListItem(item, pin, index));

			return list.ordered ? (
				<Text
					key={key}
					as='ol'
					variant='text-md'
					color='muted'
					start={typeof list.start === 'number' ? list.start : undefined}
					className='flex flex-col gap-1 pl-6 list-decimal'
				>
					{items}
				</Text>
			) : (
				<Text
					key={key}
					as='ul'
					variant='text-md'
					color='muted'
					className={tasks ? 'flex flex-col gap-1' : 'flex flex-col gap-1 pl-6 list-disc'}
				>
					{items}
				</Text>
			);
		}
		case 'checkbox': {
			return (
				<input
					key={key}
					type='checkbox'
					checked={(token as Tokens.Checkbox).checked}
					disabled
					readOnly
				/>
			);
		}
		case 'blockquote': {
			return (
				<blockquote key={key} className='flex flex-col gap-3 pl-4 border-border border-l-2'>
					{renderBlocks((token as Tokens.Blockquote).tokens, pin)}
				</blockquote>
			);
		}
		case 'code': {
			return (
				<pre
					key={key}
					className='bg-muted p-4 border rounded-control overflow-x-auto font-mono text-sm leading-relaxed'
				>
					<code>{`${(token as Tokens.Code).text}\n`}</code>
				</pre>
			);
		}
		case 'table': {
			return renderTable(token as Tokens.Table, pin, key);
		}
		case 'hr': {
			return <hr key={key} className='border-border' />;
		}
		default: {
			return null;
		}
	}
}

/**
 * @description Renders an addon's ADDON.md: GitHub-flavoured markdown without raw HTML, with every
 * URL passed through {@link resolveMarkdownUrl} and images shown as links.
 * @param props The markdown text and the source pin its relative URLs resolve against.
 * @returns The rendered document.
 */
function Markdown({ source, pin }: MarkdownProps) {
	// marked only tokenizes here; React builds the elements, so nothing renders as raw HTML.
	const content = useMemo(
		() => renderBlocks(Lexer.lex(source, { gfm: true }), pin),
		[source, pin],
	);

	return <div className='flex flex-col gap-4 min-w-0 break-words'>{content}</div>;
}

export type { MarkdownProps };

export default Markdown;
