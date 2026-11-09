import type { MarkdownIconRenderer } from '~/components/markdown';

/**
 * @description Draws ADDON.md `:name:` shortcodes from server-rendered markup, so a page ships only the
 * icons it uses instead of the whole set.
 * @param icons Each used icon's `<svg>` markup by name, from `renderPageIcons`.
 * @returns A renderer that leaves a name without markup as text.
 */
export function createPageIconRenderer(icons: Record<string, string>): MarkdownIconRenderer {
	return (name, key) => {
		if (!Object.hasOwn(icons, name)) {
			return undefined;
		}

		// The markup comes from our own icon components on the server, never from user input.
		return (
			<span
				key={key}
				aria-hidden
				className='inline-block size-[1em] text-primary align-[-0.125em] [&>svg]:size-full'
				dangerouslySetInnerHTML={{ __html: icons[name] ?? '' }}
			/>
		);
	};
}

export default { createPageIconRenderer };
