import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { Discord } from '@unbound-app/api/metro/components';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openCollectionsSheet } from '~/components/collections-sheet';
import type { Gif } from '~/lib/collections';

type ItemSheetProps = { item?: Partial<Gif> };

function asGif(item: Partial<Gif> | undefined): Gif | undefined {
	if (!item?.url || !item.src) return undefined;

	return {
		url: item.url,
		src: item.src,
		width: item.width ?? 0,
		height: item.height ?? 0,
		format: item.format ?? 1,
	};
}

function isButtonRow(element: ElementNode): boolean {
	const children = element.props?.children;

	return (
		Array.isArray(children) &&
		children.some(
			(child) =>
				isElementNode(child) &&
				!Array.isArray(child) &&
				(child.props as { grow?: unknown } | undefined)?.grow === true,
		)
	);
}

/**
 * @description Adds an "Add to Collection" button to the sheet that opens on a long-pressed GIF in the GIF picker, next to Discord's favourite button.
 * Patches the render of `GIFPickerItemActionSheet` and appends the button to the row holding Discord's buttons.
 */
export function patchItemSheet(): void {
	const ItemSheet = metro.findByFilePath(
		'modules/gif_picker/native/GIFPickerItemActionSheet.tsx',
	);

	if (!ItemSheet?.default) {
		logger.warn('Adding GIFs to collections skipped: Discord moved GIFPickerItemActionSheet.');

		return;
	}

	patcher.react.after(ItemSheet, 'default', ({ props, result }) => {
		const gif = asGif((props as ItemSheetProps).item);
		const row = gif ? findElement(result, isButtonRow) : undefined;
		const children = row?.props?.children;

		if (!gif || !Array.isArray(children)) return result;

		row!.props!.children = [
			...children,
			<Discord.Button
				key='unbound-gif-collections'
				variant='secondary'
				grow
				text={messages.ADD_TO_COLLECTION}
				onPress={() => openCollectionsSheet(gif)}
			/>,
		];

		return result;
	});
}
