/**
 * Every icon an ADDON.md may name as `:name:`: `nucleo-micro-bold` names without `Icon`, in kebab case.
 * Adding one: map it in `apps/web/src/lib/page-icons.ts`, deploy, then run `scripts/rebuild-store-pages.ts` there.
 */
export const ADDON_PAGE_ICON_NAMES = [
	'accessibility',
	'android',
	'apple',
	'arrow-down',
	'arrow-right',
	'arrow-rotate-anticlockwise',
	'arrow-rotate-clockwise',
	'arrow-up',
	'arrows-rotate-center',
	'at-sign',
	'atom',
	'award',
	'ban',
	'bell',
	'bell-slash',
	'bolt',
	'book',
	'bookmark',
	'box',
	'brackets-curly',
	'broom',
	'brush',
	'bug',
	'bullet-list',
	'calendar',
	'chat-bot',
	'circle-check',
	'circle-dashed',
	'circle-info',
	'circle-play',
	'circle-user',
	'circle-xmark',
	'clipboard',
	'clock',
	'clock-rotate-clockwise',
	'clone',
	'cloud',
	'code',
	'code-branch',
	'code-fork',
	'color-palette',
	'command',
	'compass',
	'cursor-default',
	'database',
	'dots',
	'download',
	'droplet',
	'eye',
	'eye-slash',
	'face-smile',
	'file',
	'file-content',
	'files',
	'filter',
	'flag-2',
	'floppy-disk',
	'folder',
	'folder-tree',
	'gear',
	'gift',
	'globe',
	'gradient',
	'grid',
	'hammer',
	'hand-2',
	'headphones',
	'heart',
	'hourglass',
	'import',
	'keyboard',
	'language',
	'layers',
	'life-ring',
	'lightbulb',
	'link',
	'link-slash',
	'loader',
	'lock',
	'magnifier',
	'magnifier-plus',
	'map',
	'media-fast-forward',
	'microchip',
	'microphone',
	'mobile',
	'msg',
	'msg-arrow-right',
	'msg-check',
	'msg-smile',
	'msg-user',
	'msgs',
	'music',
	'paintbrush',
	'palette',
	'paper-plane-2',
	'paperclip',
	'pen',
	'percentage',
	'photo',
	'pin',
	'plug',
	'plus',
	'pointer',
	'puzzle-piece',
	'refresh',
	'repeat',
	'rocket',
	'ruler',
	'scroll-x',
	'scroll-y',
	'server',
	'shapes',
	'share-left',
	'share-up-right',
	'shield',
	'shield-user',
	'shop',
	'signal',
	'sitemap',
	'slider',
	'sliders-3',
	'sort-down',
	'sparkle',
	'sparkle-3',
	'square-code',
	'square-user',
	'star',
	'sticker',
	'stopwatch',
	'swap',
	'tag',
	'terminal',
	'text',
	'text-a',
	'text-color',
	'text-size-change',
	'ticket',
	'timer',
	'toggle',
	'trash',
	'triangle-warning',
	'undo',
	'upload',
	'user',
	'user-arrow-right',
	'user-change',
	'user-check',
	'user-heart',
	'user-key',
	'user-minus',
	'user-plus',
	'user-xmark',
	'users',
	'users-2',
	'video',
	'volume-up',
	'wand-sparkle',
	'wifi',
	'wrench',
] as const;

export type AddonPageIconName = (typeof ADDON_PAGE_ICON_NAMES)[number];

/** A shortcode found in an ADDON.md that names no page icon. */
export type UnknownPageIcon = {
	name: string;
	/** 1-based line in the text searched. */
	line: number;
};

const NAMES = new Set<string>(ADDON_PAGE_ICON_NAMES);
const FENCE = /^\s*(?:```|~~~)/;
const CODE_SPAN = /`[^`\n]*`/g;
// Starts with a letter so times and ratios such as `10:30:45` are not read as shortcodes.
const SHORTCODE = /:(?=([a-z][a-z0-9]*(?:-[a-z0-9]+)*):)/g;

/**
 * @description Finds `:name:` shortcodes outside code that name no page icon, which the store would show as text.
 * @param markdown ADDON.md, frontmatter included or not.
 * @returns Each unknown shortcode with its line, in order.
 */
export function findUnknownPageIcons(markdown: string): UnknownPageIcon[] {
	const unknown: UnknownPageIcon[] = [];
	let fenced = false;

	for (const [index, line] of markdown.split('\n').entries()) {
		if (FENCE.test(line)) {
			fenced = !fenced;
			continue;
		}

		if (fenced) {
			continue;
		}

		for (const [, name = ''] of line.replace(CODE_SPAN, '').matchAll(SHORTCODE)) {
			if (!NAMES.has(name)) {
				unknown.push({ name, line: index + 1 });
			}
		}
	}

	return unknown;
}

export default { ADDON_PAGE_ICON_NAMES, findUnknownPageIcons };
