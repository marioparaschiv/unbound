import { ComponentType, type APIComponentInContainer, type APIButtonComponent } from 'discord.js';

import type { ContainerMessage } from '~/lib/container-message';

function texts(component: APIComponentInContainer): string[] {
	if (component.type === ComponentType.TextDisplay) {
		return [component.content];
	}

	return component.type === ComponentType.Section
		? component.components.map((part) => part.content)
		: [];
}

/**
 * @description Joins every text display in a container message, sections included.
 * @param message The rendered message.
 * @returns The Markdown, one display per line.
 */
export function messageText(message: ContainerMessage): string {
	return message.components[0].components.flatMap(texts).join('\n');
}

/**
 * @description Lists the buttons a container message shows, in rows and as section accessories.
 * @param message The rendered message.
 * @returns The buttons, top to bottom.
 */
export function messageButtons(message: ContainerMessage): APIButtonComponent[] {
	return message.components[0].components.flatMap((component) => {
		if (component.type === ComponentType.ActionRow) {
			return component.components.filter((child) => child.type === ComponentType.Button);
		}

		return component.type === ComponentType.Section &&
			component.accessory.type === ComponentType.Button
			? [component.accessory]
			: [];
	});
}

export default { messageText, messageButtons };
