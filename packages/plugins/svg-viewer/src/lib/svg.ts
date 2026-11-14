/** An attachment as Discord stores it on a message. */
export type Attachment = { filename?: string; url?: string; size?: number; content_type?: string };

/** The largest SVG the viewer draws. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024;

const SCRIPT = /<script[\s\S]*?<\/script\s*>|<script[^>]*\/>/gi;
const HANDLERS = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const FOREIGN = /<foreignObject[\s\S]*?<\/foreignObject\s*>/gi;

/**
 * @description Tells whether an attachment is an SVG the viewer can draw.
 * @param attachment The attachment.
 * @returns Whether it is an SVG of at most 2 MB.
 */
export function isSvg(attachment: Attachment): boolean {
	const { filename = '', size = 0, content_type: type = '' } = attachment;

	if (!attachment.url || size > MAX_SVG_BYTES) return false;

	return type.startsWith('image/svg') || filename.toLowerCase().endsWith('.svg');
}

/**
 * @description Strips scripts, event handlers and embedded HTML from SVG markup before it is drawn.
 * @param markup The SVG file's text.
 * @returns The markup, or `undefined` when it holds no `<svg>` element.
 */
export function cleanSvg(markup: string): string | undefined {
	if (!/<svg[\s>]/i.test(markup)) return undefined;

	return markup.replace(SCRIPT, '').replace(FOREIGN, '').replace(HANDLERS, '');
}

export default isSvg;
