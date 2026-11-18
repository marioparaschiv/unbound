import type { ClosePanel } from '@unbound-plugins/shared/composer/composer-stack';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { requestPreview } from '~/lib/preview-requests';
import { usePreviewable } from '~/components/preview-button';

type PreviewRowProps = { channelId: string; icon: number; closePanel: ClosePanel };

/**
 * @description The Plugin Shortcut Panel's preview row, shown while there is something to preview; it closes the panel
 * before the preview opens.
 * @param props The channel, the eye icon and how to close the panel.
 * @returns The row, or nothing while the draft is empty.
 */
export default function PreviewRow({ channelId, icon, closePanel }: PreviewRowProps) {
	if (!usePreviewable(channelId)) return null;

	return (
		<ui.Row
			label={messages.PREVIEW_MESSAGE}
			icon={icon}
			arrow
			onPress={() => closePanel(() => requestPreview(channelId))}
		/>
	);
}
