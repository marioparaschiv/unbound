import type { NativeJavaBridge } from '@unbound-app/api/native';

export const MOSAIC_LAYOUT =
	'com.discord.chat.presentation.message.view.mosaic_recycler.MosaicLayoutManager';
export const ASPECT_GETTER = 'getSingleAspectRatio';
const RECYCLER_VIEW = 'androidx.recyclerview.widget.RecyclerView';
const MAX_TILE_CLASSES = 20;

/** The obfuscated names of the mosaic's layout pass and fields, its list's layout manager, and the tiles' sizing method. */
export type MosaicShape = {
	layout: string;
	parameters: string[];
	spacing: string;
	maxHeight: string;
	width: string;
	list: string;
	manager: string;
	tiles: string[];
	resize: string;
};

type Description = ReturnType<NativeJavaBridge['describe']>;

function describe(java: NativeJavaBridge, name: string): Description | undefined {
	try {
		return java.describe(name);
	} catch {
		// A build without the class lays its media out some other way.
		return undefined;
	}
}

function resizeOf(description: Description): string | undefined {
	return description.methods.find(
		(method) =>
			!method.static &&
			method.returnType === 'void' &&
			method.parameters.length === 2 &&
			method.parameters.every((type) => type === 'int'),
	)?.name;
}

async function tileShape(java: NativeJavaBridge) {
	const found = await java.findClasses({
		methods: [{ name: ASPECT_GETTER, returns: 'float' }],
		limit: MAX_TILE_CLASSES,
	});
	const described = found.flatMap((name) => {
		const description = describe(java, name);

		return description ? [{ name, description }] : [];
	});
	const tile = described.find(({ name }) =>
		described.some(({ description }) => description.interfaces.includes(name)),
	);
	const resize = tile && resizeOf(tile.description);

	if (!tile || !resize) return;

	return {
		tiles: described
			.filter(({ description }) => description.interfaces.includes(tile.name))
			.map(({ name }) => name),
		resize,
	};
}

/**
 * @description Finds the mosaic layout manager's layout pass and fields, and the tiles' sizing method, by their shape,
 * since Discord obfuscates their names.
 * @param java The plugin's Java bridge.
 * @returns The names, or `undefined` when this build lays media out differently.
 */
export async function mosaicShape(java: NativeJavaBridge): Promise<MosaicShape | undefined> {
	const own = describe(java, MOSAIC_LAYOUT);

	if (!own?.superclass) return;

	const layout = own.methods.find(
		(method) =>
			!method.static && method.returnType === 'void' && method.parameters.length === 2,
	);
	// Discord reads its spacing and tallest image into the first int fields when built, and sets its width, the last, on each bind.
	const ints = own.fields.filter((field) => !field.static && field.type === 'int');
	const list = describe(java, own.superclass)?.fields.find(
		(field) => !field.static && field.type === RECYCLER_VIEW,
	);
	const manager = describe(java, RECYCLER_VIEW)?.fields.find(
		(field) => !field.static && field.type === own.superclass,
	);
	const tiles = await tileShape(java);

	if (!layout || ints.length < 3 || !list || !manager || !tiles?.tiles.length) return;

	return {
		layout: layout.name,
		parameters: layout.parameters,
		spacing: ints[0]!.name,
		maxHeight: ints[1]!.name,
		width: ints.at(-1)!.name,
		list: list.name,
		manager: manager.name,
		...tiles,
	};
}
