import type { UnboundAppIcon } from '@unbound-app/types';

export type DiscordAppIcon = {
	id: string;
	nativeId: string;
	replacesId?: string;
	name: string;
	iconSource: { uri: string };
	isPremium: boolean;
};

export type DiscordIconRow = { id: string; name?: string };

export type DiscordAppIconSelection = string | DiscordIconRow;

function toDiscordAppIcon(icon: UnboundAppIcon): DiscordAppIcon {
	return {
		id: icon.pickerId ?? icon.id,
		nativeId: icon.id,
		replacesId: icon.pickerId ? icon.id : undefined,
		name: icon.name,
		iconSource: { uri: icon.image },
		isPremium: false,
	};
}

function findDiscordAppIcon(
	id: string | undefined,
	provided: DiscordAppIcon[],
): DiscordAppIcon | undefined {
	if (id === undefined) {
		return undefined;
	}

	const icon = provided.find((entry) => entry.id === id || entry.nativeId === id);

	return icon ? { ...icon, id } : undefined;
}

function isDiscordIconRow(value: unknown): value is DiscordIconRow {
	return (
		typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
	);
}

function isDiscordAppIconSelection(value: unknown): value is DiscordAppIconSelection {
	return typeof value === 'string' || isDiscordIconRow(value);
}

function mergeDiscordAppIcons(
	existing: DiscordIconRow[],
	provided: DiscordAppIcon[],
): DiscordIconRow[] {
	const replacedIds = new Set(
		provided.map(({ replacesId }) => replacesId).filter((id): id is string => id !== undefined),
	);
	const retained = existing.filter((icon) => !replacedIds.has(icon.id));
	const byId = new Map(provided.map((icon) => [icon.id, icon]));
	const merged = retained.map((icon) => byId.get(icon.id) ?? icon);
	const missing = provided.filter((icon) => !merged.some((entry) => entry.id === icon.id));

	return [...merged, ...missing];
}

function mergeDiscordAppIconRows(
	shown: DiscordIconRow[],
	provided: DiscordAppIcon[],
	leading: DiscordAppIcon[],
	addTileId: string,
): DiscordIconRow[] {
	const replacedIds = new Set(
		provided.map(({ replacesId }) => replacesId).filter((id): id is string => id !== undefined),
	);
	const rest = shown.filter((icon) => icon.id !== addTileId && !replacedIds.has(icon.id));
	const byId = new Map(provided.map((icon) => [icon.id, icon]));
	const replaced = rest.map((icon) => byId.get(icon.id) ?? icon);
	const missing = provided.filter((icon) => !replaced.some((entry) => entry.id === icon.id));

	return [...leading, ...replaced.slice(0, 1), ...missing, ...replaced.slice(1)];
}

function resolveDiscordAppIconSelection(
	selection: DiscordAppIconSelection,
	provided: DiscordAppIcon[],
): DiscordAppIconSelection {
	const id = typeof selection === 'string' ? selection : selection.id;
	const icon = provided.find((entry) => entry.id === id);

	if (!icon || icon.nativeId === icon.id) {
		return selection;
	}

	if (typeof selection === 'string') {
		return icon.nativeId;
	}

	return { ...selection, id: icon.nativeId };
}

export {
	findDiscordAppIcon,
	isDiscordAppIconSelection,
	isDiscordIconRow,
	mergeDiscordAppIconRows,
	mergeDiscordAppIcons,
	resolveDiscordAppIconSelection,
	toDiscordAppIcon,
};
