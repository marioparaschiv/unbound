import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { Portal } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';

import {
	ChatItem,
	DraftStore,
	MessageRecord,
	RowManager,
	SelectedChannelStore,
	Users,
} from '~/preview/modules';
import { patchPreviewButton } from '~/preview/platform';

/**
 * @description Adds a button to the chat input that previews the draft as Discord would render it once sent.
 * Patches the render of `ChatInputRightActions` on iOS and `ChatInputSendButton` on Android. The preview draws with
 * `ChatItem`, builds its message with `MessageRecord` and `RowManager`, and reads the draft from `DraftStore`, the
 * channel from `SelectedChannelStore` and the author from `UserStore`. The Addon scope removes the patch when the
 * plugin stops.
 */
export function startPreview(): void {
	const EyeIcon = assets.getIdByName('EyeIcon');

	const ready = ensureModules({
		ChatItem,
		MessageRecord,
		RowManager,
		DraftStore,
		SelectedChannelStore,
		Portal,
		Users,
	});

	if (!ready) return;

	if (EyeIcon === undefined) {
		skipFeature('the EyeIcon asset was not found');

		return;
	}

	patchPreviewButton(EyeIcon);
}
