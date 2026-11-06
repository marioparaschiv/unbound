import { createLogger } from '@unbound-app/logger';

import { exists, readFile, removeFile, writeFile } from '~/native/fs';
import { syncAppIcons } from '~/native/unbound-native';
import { findByPropsLazy } from '~/metro/wrappers';
import { getNativeModule } from '~/native/native';

import AppIconStore from './state';

const Logger = createLogger('AppIcons', 'Custom');

/** Read by the native bundle patcher, which installs each entry as an alternate app icon. */
const DIRECTORY = 'Unbound/AppIcons';
const MANIFEST = `${DIRECTORY}/custom.json`;
const ID_PREFIX = 'UnboundCustom';
const MAX_SIDE = 1024;
const INSTALL_TIMEOUT_MS = 15_000;
const INSTALL_POLL_MS = 500;

/** A custom app icon the user added: its id, the name the picker shows, and its image in {@link DIRECTORY}. */
export type CustomAppIcon = { id: string; name: string; file: string };

type PickerResult = { assets?: { uri?: string }[]; errorCode?: string; errorMessage?: string };

type PickerOptions = {
	includeBase64: boolean;
	mediaType: 'photo';
	selectionLimit: number;
	maxWidth: number;
	maxHeight: number;
};

type ImagePickerModule = {
	launchImageLibraryAsync?: (options: PickerOptions) => Promise<PickerResult>;
};

const ImagePicker: ImagePickerModule = findByPropsLazy('launchImageLibraryAsync');

type CurrentAppIcon = { id?: string };

type NativeAppIconModule = {
	getCurrentIcon(): Promise<CurrentAppIcon | null>;
	setIcon(id: string): Promise<void>;
};

type AppIconUtils = {
	setAppIcon?(id: string): Promise<boolean>;
};

const DEFAULT_ICON_ID = 'AppIcon';
const AppIconUtils = findByPropsLazy('setAppIcon') as AppIconUtils;

function isCustomIcon(value: unknown): value is CustomAppIcon {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		'name' in value &&
		'file' in value &&
		typeof value.id === 'string' &&
		value.id.startsWith(ID_PREFIX) &&
		typeof value.name === 'string' &&
		typeof value.file === 'string'
	);
}

function localPath(uri: string) {
	return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

/**
 * @description Reads the custom app icons the user added.
 * @returns The icons, or none when the list is missing or unreadable.
 */
export async function readCustomIcons(): Promise<CustomAppIcon[]> {
	if (!(await exists(MANIFEST))) {
		return [];
	}

	try {
		const value: unknown = JSON.parse(await readFile(MANIFEST));

		return Array.isArray(value) ? value.filter(isCustomIcon) : [];
	} catch (error) {
		Logger.error(`Failed to read custom app icons ${MANIFEST}:`, error);

		return [];
	}
}

async function writeCustomIcons(icons: CustomAppIcon[]) {
	await writeFile(MANIFEST, JSON.stringify(icons));
}

/**
 * @description Opens Discord's photo picker so the user picks an image for a new app icon.
 * @returns The picked image's local path, or `undefined` when the picker was cancelled.
 * @throws When the picker is unavailable or fails.
 */
export async function pickCustomIconImage(): Promise<string | undefined> {
	if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
		throw new Error("Discord's photo picker is unavailable.");
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		includeBase64: false,
		mediaType: 'photo',
		selectionLimit: 1,
		maxWidth: MAX_SIDE,
		maxHeight: MAX_SIDE,
	});

	if (result.errorCode) {
		throw new Error(result.errorMessage || result.errorCode);
	}

	const uri = result.assets?.[0]?.uri;

	return uri ? localPath(uri) : undefined;
}

async function leaveIcon(id: string) {
	const module = getNativeModule<NativeAppIconModule | undefined>('NativeAppIconModule');
	const current = await module?.getCurrentIcon();

	if (current?.id === id) {
		if (typeof AppIconUtils.setAppIcon === 'function') {
			await AppIconUtils.setAppIcon(DEFAULT_ICON_ID);
		} else {
			await module?.setIcon(DEFAULT_ICON_ID);
		}
	}
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIcons(isDone: (ids: string[]) => boolean): Promise<boolean> {
	for (let waited = 0; waited <= INSTALL_TIMEOUT_MS; waited += INSTALL_POLL_MS) {
		const ids = AppIconStore.getState()
			.refresh()
			.map((icon) => icon.id);

		if (isDone(ids)) {
			return true;
		}

		await wait(INSTALL_POLL_MS);
	}

	return false;
}

/**
 * @description Saves a picked image as a custom app icon and has the loader install it. The loader crops it to a
 * square.
 * @param name The name the picker shows.
 * @param image The picked image's local path.
 * @returns Whether the icon was installed before the timeout.
 */
export async function addCustomIcon(name: string, image: string): Promise<boolean> {
	const id = `${ID_PREFIX}${Date.now().toString(36)}`;
	const extension = image.split('.').pop()?.toLowerCase() || 'jpg';
	const file = `${id}.${extension}`;

	await writeFile(`${DIRECTORY}/${file}`, await readFile(image, 'base64', false), 'base64');
	await writeCustomIcons([...(await readCustomIcons()), { id, name, file }]);
	syncAppIcons();

	return waitForIcons((ids) => ids.includes(id));
}

/**
 * @description Deletes a custom app icon and has the loader remove it from the app.
 * @param id The icon's id.
 * @returns Whether the loader removed it before the timeout.
 */
export async function removeCustomIcon(id: string): Promise<boolean> {
	const icons = await readCustomIcons();
	const removed = icons.find((icon) => icon.id === id);

	if (!removed) {
		return true;
	}

	await leaveIcon(id);
	await writeCustomIcons(icons.filter((icon) => icon.id !== id));
	await removeFile(`${DIRECTORY}/${removed.file}`);
	syncAppIcons();

	return waitForIcons((ids) => !ids.includes(id));
}
