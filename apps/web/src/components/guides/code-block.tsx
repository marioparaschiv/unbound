import { IconClipboard } from 'nucleo-micro-bold';
import type { ComponentProps } from 'react';
import { useRef } from 'react';

import copyText from '~/components/dashboard/copy-text';
import { Button } from '~/components/ui/button';
import cn from '~/lib/cn';

type CodeBlockProps = ComponentProps<'pre'> & {
	'data-title'?: string;
	'data-language'?: string;
};

/**
 * @description A code block Shiki highlighted at build time: an optional file name bar, a copy button,
 * and code that scrolls sideways inside the block instead of widening the page.
 * @param props The `pre` Shiki produced, with the fence's title and language.
 * @returns The code block.
 */
function CodeBlock({
	'data-title': title,
	'data-language': language,
	className,
	children,
	...props
}: CodeBlockProps) {
	const ref = useRef<HTMLPreElement>(null);

	return (
		<figure className='group/code relative bg-muted/60 border rounded-control min-w-0 overflow-hidden'>
			{title ? (
				<figcaption className='flex items-center pr-12 pl-4 border-b h-10 font-mono text-muted-foreground text-xs single-line'>
					{title}
				</figcaption>
			) : null}
			<Button
				variant='ghost'
				size='icon-sm'
				aria-label='Copy code'
				className={cn(
					'top-1 right-1 absolute text-muted-foreground',
					!title &&
						'[@media(hover:hover)]:opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100',
				)}
				onClick={() =>
					void copyText(ref.current?.textContent ?? '', `${language ?? 'code'} snippet`)
				}
			>
				<IconClipboard />
			</Button>
			<pre
				ref={ref}
				className={cn(
					className,
					'p-4 overflow-x-auto font-mono text-[0.8125rem] leading-relaxed',
				)}
				{...props}
			>
				{children}
			</pre>
		</figure>
	);
}

export default CodeBlock;
