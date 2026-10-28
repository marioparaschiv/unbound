import type { Components, UrlTransform } from 'react-markdown';
import type { ComponentProps, ReactNode } from 'react';
import { IconPhoto } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { resolveMarkdownUrl, type MarkdownPin } from '~/lib/markdown-url';
import Text from '~/components/ui/text';

type MarkdownProps = {
	source: string;
	pin: MarkdownPin;
};

type ImageLinkProps = Pick<ComponentProps<'img'>, 'src' | 'alt'>;

type LinkProps = {
	href: string | undefined;
	children: ReactNode;
};

const REMARK_PLUGINS = [remarkGfm];
const LINK_REL = 'nofollow ugc noopener noreferrer';
const LINK_CLASS =
	'font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors';

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

// An image becomes a link to the file, so no remote content loads on the page.
function ImageLink({ src, alt }: ImageLinkProps) {
	const label = alt?.trim() || 'Image';
	const href = typeof src === 'string' ? src : undefined;

	return (
		<Link href={href}>
			<IconPhoto className='inline mr-1 size-4 align-[-0.125em]' aria-hidden />
			{label}
		</Link>
	);
}

const COMPONENTS: Components = {
	h1: ({ children }) => (
		<Text as='h2' variant='heading-md'>
			{children}
		</Text>
	),
	h2: ({ children }) => (
		<Text as='h3' variant='heading-md'>
			{children}
		</Text>
	),
	h3: ({ children }) => (
		<Text as='h4' variant='heading-sm'>
			{children}
		</Text>
	),
	h4: ({ children }) => (
		<Text as='h5' variant='text-md' className='font-semibold'>
			{children}
		</Text>
	),
	h5: ({ children }) => (
		<Text as='h6' variant='text-md' className='font-semibold'>
			{children}
		</Text>
	),
	h6: ({ children }) => (
		<Text as='h6' variant='text-sm' className='font-semibold'>
			{children}
		</Text>
	),
	p: ({ children }) => (
		<Text variant='text-md' color='muted'>
			{children}
		</Text>
	),
	a: ({ href, children }) => <Link href={href}>{children}</Link>,
	img: ({ src, alt }) => <ImageLink src={src} alt={alt} />,
	ul: ({ className, children }) => (
		<Text
			as='ul'
			variant='text-md'
			color='muted'
			className={
				className === 'contains-task-list'
					? 'flex flex-col gap-1'
					: 'flex flex-col gap-1 pl-6 list-disc'
			}
		>
			{children}
		</Text>
	),
	ol: ({ start, children }) => (
		<Text
			as='ol'
			variant='text-md'
			color='muted'
			start={start}
			className='flex flex-col gap-1 pl-6 list-decimal'
		>
			{children}
		</Text>
	),
	li: ({ className, children }) => (
		<li
			className={
				className === 'task-list-item'
					? 'flex items-baseline gap-2 [&>input]:accent-primary'
					: 'pl-1 marker:text-muted-foreground/60'
			}
		>
			{children}
		</li>
	),
	blockquote: ({ children }) => (
		<blockquote className='flex flex-col gap-3 pl-4 border-border border-l-2'>
			{children}
		</blockquote>
	),
	hr: () => <hr className='border-border' />,
	pre: ({ children }) => (
		<pre className='bg-muted p-4 border rounded-control overflow-x-auto font-mono text-sm leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:rounded-none [&>code]:text-[length:inherit]'>
			{children}
		</pre>
	),
	code: ({ children }) => (
		<code className='bg-muted px-1.5 py-0.5 rounded-md font-mono text-[0.875em] text-foreground'>
			{children}
		</code>
	),
	table: ({ children }) => (
		<div className='border rounded-control overflow-x-auto'>
			<table className='w-full text-sm border-collapse'>{children}</table>
		</div>
	),
	thead: ({ children }) => <thead className='bg-muted/50'>{children}</thead>,
	tr: ({ children }) => <tr className='border-b last:border-b-0'>{children}</tr>,
	th: ({ style, children }) => (
		<th style={style} className='px-3 py-2 font-medium text-foreground text-left'>
			{children}
		</th>
	),
	td: ({ style, children }) => (
		<td style={style} className='px-3 py-2 text-muted-foreground align-top'>
			{children}
		</td>
	),
	del: ({ children }) => <del className='text-muted-foreground/70'>{children}</del>,
	strong: ({ children }) => <strong className='font-semibold text-foreground'>{children}</strong>,
};

/**
 * @description Renders an addon's ADDON.md: GitHub-flavoured markdown without raw HTML, with every
 * URL passed through {@link resolveMarkdownUrl} and images shown as links.
 * @param props The markdown text and the source pin its relative URLs resolve against.
 * @returns The rendered document.
 */
function Markdown({ source, pin }: MarkdownProps) {
	const urlTransform: UrlTransform = (url, key) =>
		resolveMarkdownUrl(url, pin, key === 'src' ? 'image' : 'link')?.href;

	return (
		<div className='flex flex-col gap-4 min-w-0 break-words'>
			<ReactMarkdown
				remarkPlugins={REMARK_PLUGINS}
				components={COMPONENTS}
				urlTransform={urlTransform}
				skipHtml
			>
				{source}
			</ReactMarkdown>
		</div>
	);
}

export type { MarkdownProps };

export default Markdown;
