import { findElement } from '@unbound-plugins/shared/react/find-element';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement, type ComponentType, type ReactElement } from 'react';
import { View } from 'react-native';

import { findCollection, type Gif } from '~/lib/collections';
import { openCollection, setOpenCollection } from '~/lib/open-collection';
import { getCollections } from '~/lib/store';

const FAVORITES = 'Favorites';
const LIST_SECTION = 0;
const ROWS_BEFORE = 1;

type Category = { type: string; name: string; src?: string; format?: number };

type SelectCategory = (type: string, name: string) => void;

type CategoriesPageProps = { favoritesCategory?: Category; onSelectCategory?: SelectCategory };

type TileProps = { item: Category; onSelectCategory?: SelectCategory };

type RowElement = ReactElement<{ children?: ReactElement<TileProps> | ReactElement<TileProps>[] }>;

type CategoryList = ReactElement<{
	sections?: number[];
	renderItem?: (section: number, row: number) => RowElement;
}>;

type FavoritesResult = { favorites?: Gif[]; favoritesCategory?: Category };

function collectionTiles(type: string): Category[] {
	return getCollections()
		.filter((collection) => collection.gifs.length)
		.map(({ name, gifs }) => ({ type, name, src: gifs[0]!.src, format: gifs[0]!.format }));
}

function chunk<T>(items: T[], size: number): T[][] {
	const rows: T[][] = [];

	for (let index = 0; index < items.length; index += size)
		rows.push(items.slice(index, index + size));

	return rows;
}

function tileRow(
	template: RowElement,
	Tile: ComponentType<TileProps>,
	tiles: Category[],
	columns: number,
	select: SelectCategory,
) {
	const cells = tiles.map((item) => (
		<Tile key={`unbound-${item.name}`} item={item} onSelectCategory={select} />
	));

	while (cells.length < columns)
		cells.push(<View key={`unbound-gap-${cells.length}`} style={{ flex: 1 }} />);

	return cloneElement(template, { key: `unbound-collections-${tiles[0]!.name}` }, cells);
}

function openSelected(page: CategoriesPageProps): SelectCategory {
	return (type, name) => {
		const collection = findCollection(getCollections(), name);

		setOpenCollection(collection ? collection.name : undefined);
		page.onSelectCategory?.(type, name);
	};
}

function addCollectionRows(list: CategoryList, page: CategoriesPageProps): void {
	const { sections, renderItem } = list.props;
	const tiles = collectionTiles(page.favoritesCategory?.type ?? FAVORITES);

	if (!tiles.length || !Array.isArray(sections) || typeof renderItem !== 'function') return;

	const template = renderItem(LIST_SECTION, 0);
	const children = template?.props?.children;
	const first = Array.isArray(children) ? children[0] : children;
	const Tile = first?.type as ComponentType<TileProps> | undefined;

	if (!Tile) return;

	const columns = Array.isArray(children) ? children.length : 1;
	const rows = chunk(tiles, columns);
	const select = openSelected(page);

	list.props.sections = sections.map((count, section) =>
		section === LIST_SECTION ? count + rows.length : count,
	);
	list.props.renderItem = (section, row) => {
		if (section !== LIST_SECTION || row < ROWS_BEFORE) return renderItem(section, row);
		if (row < ROWS_BEFORE + rows.length) {
			return tileRow(template, Tile, rows[row - ROWS_BEFORE]!, columns, select);
		}

		return renderItem(section, row - rows.length);
	};
}

function patchHeader(): void {
	const Header = metro.findByFilePath('modules/gif_picker/native/GIFPickerHeader.tsx');

	if (!Header?.default) return;

	patcher.react.after(Header, 'default', ({ result }) => {
		const name = openCollection();
		const title = name
			? findElement(result, (element) => typeof element.props?.children === 'string')
			: undefined;

		if (title?.props) title.props.children = name;

		return result;
	});
}

/**
 * @description Shows each collection as a tile under the GIF picker's favourites. A tile opens Discord's favourites grid, which shows the collection's GIFs instead while it is open.
 * Patches the render of `GIFPickerCategoriesPage`, adding rows of Discord's own category tiles to its list, the result of `useFavoriteGIFsMobile`, and the title of `GIFPickerHeader`, which names the open collection.
 */
export function patchGifPicker(): void {
	const CategoriesPage = metro.findByFilePath(
		'modules/gif_picker/native/GIFPickerCategoriesPage.tsx',
	);
	const FavoriteHooks = metro.findByProps('useFavoriteGIFsMobile');

	if (!CategoriesPage?.default || !FavoriteHooks) {
		logger.warn(
			'Collections in the GIF picker skipped: Discord moved GIFPickerCategoriesPage or useFavoriteGIFsMobile.',
		);

		return;
	}

	patcher.react.after(CategoriesPage, 'default', ({ props, result }) => {
		setOpenCollection(undefined);
		addCollectionRows(result as CategoryList, props as CategoriesPageProps);

		return result;
	});

	patchHeader();

	patcher.after(FavoriteHooks, 'useFavoriteGIFsMobile', ({ result }) => {
		const name = openCollection();
		const collection = name ? findCollection(getCollections(), name) : undefined;

		if (!collection) return result;

		return { ...(result as FavoritesResult), favorites: collection.gifs };
	});
}
