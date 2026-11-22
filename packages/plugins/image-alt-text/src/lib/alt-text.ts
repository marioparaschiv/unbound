export type ContentNode = { type: string; content?: unknown };

const DEBUG_PAYLOAD = /^(?:UNBOUND_DEBUG_COMPRESSED:)?ubd\d+:/;
const MAX_LENGTH = 500;

/**
 * @description Picks the descriptions worth showing: real ones, not the data Unbound's debug cards hide in alt text.
 * @param descriptions The attachments' descriptions.
 * @returns The descriptions to show, trimmed.
 */
export function readableDescriptions(descriptions: (string | null | undefined)[]): string[] {
	return descriptions
		.map((description) => description?.trim() ?? '')
		.filter((description) => description && !DEBUG_PAYLOAD.test(description))
		.map((description) =>
			description.length > MAX_LENGTH ? `${description.slice(0, MAX_LENGTH)}…` : description,
		);
}

/**
 * @description Adds descriptions to a message's content as italic lines after its text.
 * @param content The message's content.
 * @param descriptions The descriptions.
 * @param label The label before each one, such as `Alt text`.
 * @returns The content with the descriptions.
 */
export function withAltText(
	content: ContentNode[],
	descriptions: string[],
	label: string,
): ContentNode[] {
	const lines = descriptions.flatMap((description, index) => [
		...(content.length || index ? [{ type: 'text', content: '\n' }] : []),
		{ type: 'em', content: [{ type: 'text', content: `${label}: ${description}` }] },
	]);

	return [...content, ...lines];
}
