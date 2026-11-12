import type {
	APIComponentInContainer,
	APIContainerComponent,
	APISeparatorComponent,
	APITextDisplayComponent,
} from 'discord.js';
import { ComponentType, MessageFlags } from 'discord.js';

import { truncate } from '~/lib/message-text';

/** A components v2 message holding one container; it cannot carry `content`, so edits replace the whole container. */
export type ContainerMessage = {
	flags: MessageFlags.IsComponentsV2;
	components: [APIContainerComponent];
};

// Components v2 caps all text in a message at 4000 characters; one block stays well under it.
const TEXT_LIMIT = 3000;

/**
 * @description Builds a text display, truncated to fit a components v2 message.
 * @param content The Markdown text.
 * @returns The text display component.
 */
export function textDisplay(content: string): APITextDisplayComponent {
	return { type: ComponentType.TextDisplay, content: truncate(content, TEXT_LIMIT) };
}

/**
 * @description Builds a divider line between a container's parts.
 * @returns The separator component.
 */
export function separator(): APISeparatorComponent {
	return { type: ComponentType.Separator, divider: true };
}

/**
 * @description Wraps components in one accented container, as a components v2 message.
 * @param accent The container's accent colour, from `COLOURS`.
 * @param components The container's contents, top to bottom.
 * @returns The message options for a send, reply, edit or interaction update.
 */
export function containerMessage(
	accent: number,
	components: APIComponentInContainer[],
): ContainerMessage {
	return {
		flags: MessageFlags.IsComponentsV2,
		components: [{ type: ComponentType.Container, accent_color: accent, components }],
	};
}

export default { textDisplay, separator, containerMessage };
