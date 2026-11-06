import {
	addHomeScreenIcon,
	addCustomIcon,
	pickCustomIconImage,
	readCustomIcons,
	removeCustomIcon,
} from '~/app-icons/custom-icons';
import { canInstallHomeScreenIcon, canSyncAppIcons } from '~/native/unbound-native';
import type { CustomAppIcon } from '~/app-icons/custom-icons';
import InputSheet from '~/ui/settings-kit/input-sheet';
import { format, messages } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { ActionSheets } from '~/metro/api';
import * as toasts from '~/toasts/api';
import { icons } from '~/assets/api';

const SHEET = 'unbound-custom-app-icons';
const NAME_SHEET = 'unbound-custom-app-icon-name';
const MAX_NAME = 32;

async function install(name: string, image: string) {
	if (!canSyncAppIcons() && canInstallHomeScreenIcon()) {
		if (await addHomeScreenIcon(name, image)) {
			toasts.info('UNBOUND_APP_ICON_PROFILE_REQUIRED');
		} else {
			toasts.error(messages.UNBOUND_APP_ICON_INSTALL_FAILED);
		}

		return;
	}

	const progress = toasts.info('UNBOUND_APP_ICON_INSTALLING', { name });
	const installed = await addCustomIcon(name, image);

	progress.close();

	if (installed) {
		toasts.success('UNBOUND_APP_ICON_ADDED', { name });
	} else {
		toasts.warning('UNBOUND_APP_ICON_PENDING', { name });
	}
}

function askName(image: string) {
	ActionSheets.openLazy(Promise.resolve({ default: InputSheet }), NAME_SHEET, {
		label: format('UNBOUND_APP_ICON_NAME'),
		value: '',
		variant: 'text',
		keyboardType: 'default',
		maxLength: MAX_NAME,
		validate: (text: string) =>
			text.trim() ? undefined : format('UNBOUND_APP_ICON_NAME_EMPTY'),
		onChange: (name: string) => {
			install(name.trim(), image).catch((error) => toasts.error(error));
		},
		onClose: () => ActionSheets.hideActionSheet(NAME_SHEET),
	});
}

async function add() {
	const image = await pickCustomIconImage();

	if (image) {
		askName(image);
	}
}

async function remove(icon: CustomAppIcon) {
	if (await removeCustomIcon(icon.id)) {
		toasts.success('UNBOUND_APP_ICON_REMOVED', { name: icon.name });
	} else {
		toasts.warning('UNBOUND_APP_ICON_PENDING', { name: icon.name });
	}
}

/**
 * @description Opens an action sheet for adding or removing custom app icons.
 */
export async function openCustomIconsSheet(): Promise<void> {
	const homeScreen = !canSyncAppIcons() && canInstallHomeScreenIcon();

	if (!homeScreen && !canSyncAppIcons()) return;

	const custom = homeScreen ? [] : await readCustomIcons();

	Discord.showSimpleActionSheet({
		key: SHEET,
		header: {
			title: homeScreen
				? messages.UNBOUND_APP_ICON_HOME_SCREEN
				: messages.UNBOUND_APP_ICON_CUSTOM,
		},
		options: [
			{
				label: homeScreen
					? messages.UNBOUND_APP_ICON_ADD_HOME_SCREEN
					: messages.UNBOUND_APP_ICON_ADD,
				icon: icons['ImagePlusIcon'] ?? icons['PlusLargeIcon'],
				onPress: () => void add().catch((error) => toasts.error(error)),
			},
			...custom.map((icon) => ({
				label: format('UNBOUND_APP_ICON_REMOVE', { name: icon.name }),
				icon: icons['TrashIcon'],
				isDestructive: true,
				onPress: () => void remove(icon).catch((error) => toasts.error(error)),
			})),
		],
	});
}
