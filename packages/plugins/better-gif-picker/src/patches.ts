import { metro, patcher } from '@unbound-app/api';
import { useEffect, useState } from 'react';

const GIF_PICKER = 'modules/gif_picker/native/GIFPicker.tsx';
const CATEGORIES_PAGE = 'modules/gif_picker/native/GIFPickerCategoriesPage.tsx';

type Category = { type: string; name: string };

type CategoriesPageProps = {
	favoritesCategory?: Category;
	onSelectCategory?: (type: string, name: string) => void;
};

let favouritesPending = false;

/**
 * @description Opens the GIF picker on your favourites instead of the category grid.
 * Marks each new `GIFPicker` and selects the favourites tile once from its `GIFPickerCategoriesPage`, so going back still shows the grid.
 */
export function patchGifPicker(): void {
	const GifPicker = metro.findByFilePath(GIF_PICKER);
	const CategoriesPage = metro.findByFilePath(CATEGORIES_PAGE);

	if (!GifPicker?.default || !CategoriesPage?.default) {
		logger.warn(
			'Favourite GIFs first skipped: Discord moved GIFPicker or GIFPickerCategoriesPage.',
		);

		return;
	}

	patcher.react.before(GifPicker, 'default', () => {
		useState(() => {
			favouritesPending = true;

			return true;
		});
	});

	patcher.react.before(CategoriesPage, 'default', ({ props }) => {
		const { favoritesCategory, onSelectCategory } = (props ?? {}) as CategoriesPageProps;

		useEffect(() => {
			if (!favouritesPending || !favoritesCategory || !onSelectCategory) return;

			favouritesPending = false;
			onSelectCategory(favoritesCategory.type, favoritesCategory.name);
		}, []);
	});
}
