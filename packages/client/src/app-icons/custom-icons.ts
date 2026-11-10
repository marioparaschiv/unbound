import { createLogger } from '@unbound-app/logger';

import { documentsPath, exists, readFile, removeFile, writeFile } from '~/native/fs';
import { installHomeScreenIcon, syncAppIcons } from '~/native/unbound-native';
import { getNativeModule } from '~/native/native';
import { findByProps } from '~/metro/lookups';

import AppIconStore from './state';

const Logger = createLogger('AppIcons', 'Custom');

const DIRECTORY = 'Unbound/AppIcons';
const MANIFEST = `${DIRECTORY}/custom.json`;
const ID_PREFIX = 'UnboundCustom';
const HOME_SCREEN_ID_PREFIX = 'UnboundHomeScreen';
const MAX_SIDE = 1024;
const INSTALL_TIMEOUT_MS = 15_000;
const INSTALL_POLL_MS = 500;

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

const ImagePicker: ImagePickerModule = findByProps('launchImageLibraryAsync');

type CurrentAppIcon = { id?: string };

type NativeAppIconModule = {
	getCurrentIcon(): Promise<CurrentAppIcon | null>;
	setIcon(id: string): Promise<void>;
};

type AppIconUtils = {
	setAppIcon?(id: string): Promise<boolean>;
};

const DEFAULT_ICON_ID = 'AppIcon';
const AppIconUtils = findByProps('setAppIcon') as AppIconUtils;

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
 * @description Reads the custom app icons saved by the user.
 * @returns Saved icons, or an empty list when the manifest is missing or invalid.
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
 * @description Opens Discord's photo picker for a custom app icon.
 * @returns The selected image's local path, or `undefined` when the picker is cancelled.
 * @throws When Discord's photo picker is unavailable or fails.
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
 * @description Saves a custom app icon and asks the loader to install it.
 * @param name The name displayed in Discord's icon picker.
 * @param image The selected image's local path.
 * @returns Whether the loader installed the icon before the timeout.
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
 * @description Copies a picked image into Unbound's AppIcons folder and has the loader offer it as a Home Screen
 * shortcut. The loader reads the image before returning, so the copy is removed afterwards.
 * @param name The shortcut's label.
 * @param image The picked image's local path.
 * @returns Whether the loader offered the shortcut.
 */
export async function addHomeScreenIcon(name: string, image: string): Promise<boolean> {
	const file = `${DIRECTORY}/${HOME_SCREEN_ID_PREFIX}${Date.now().toString(36)}.png`;
	const imagePath = `${documentsPath}/${file}`;

	await writeFile(file, await readFile(image, 'base64', false), 'base64');

	try {
		return installHomeScreenIcon(name, imagePath);
	} finally {
		try {
			await removeFile(file);
		} catch (error) {
			Logger.error(`Failed to remove temporary Home Screen icon ${file}:`, error);
		}
	}
}

/**
 * @description Deletes a custom app icon and asks the loader to remove it.
 * @param id The icon's id.
 * @returns Whether the loader removed the icon before the timeout.
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
