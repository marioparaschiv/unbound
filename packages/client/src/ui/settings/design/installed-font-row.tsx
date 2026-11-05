import { memo } from 'react';

import type { FontFamily } from '~/fonts/manager';
import { confirmText } from '~/dialogs/feedback';
import { sourceOrigin } from '~/fonts/sources';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { showDialog } from '~/dialogs/api';
import { format } from '~/i18n/api';

type InstalledFontRowProps = {
	family: FontFamily;
};

/**
 * @description One installed family: its name, style count and provider. Pressing it offers to delete
 * every face of it; font groups using it go back to Discord's font.
 */
function InstalledFontRow({ family }: InstalledFontRowProps) {
	const fonts = Manager.for('font');
	const [first] = family.faces;
	const provider = first ? sourceOrigin(first.source)?.provider : undefined;
	const styles = format('UNBOUND_FONTS_STYLES', { count: family.faces.length });

	async function remove() {
		const confirmed = await confirmText(showDialog, {
			title: format('UNBOUND_FONTS_REMOVE_CONFIRM', { family: family.family }),
			confirm: format('UNBOUND_DELETE'),
			cancel: format('UNBOUND_CANCEL'),
			destructive: true,
		});

		if (!confirmed) return;

		for (const face of family.faces) {
			await fonts.delete(face.id);
		}
	}

	return (
		<Discord.TableRow
			label={family.family}
			subLabel={provider ? `${styles} · ${provider}` : styles}
			onPress={remove}
		/>
	);
}

export default memo(InstalledFontRow);
