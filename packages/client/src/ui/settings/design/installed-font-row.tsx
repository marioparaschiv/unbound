import { memo } from 'react';

import type { FontFamily } from '~/fonts/manager';
import { confirmText } from '~/dialogs/feedback';
import { sourceOrigin } from '~/fonts/sources';
import { Discord } from '~/metro/components';
import { nearestFace } from '~/fonts/slots';
import { Manager } from '~/addons/manager';
import { showDialog } from '~/dialogs/api';
import { format } from '~/i18n/api';

import FontSampleIcon from './font-sample-icon';

// Brand names as the providers write them; a link or a local file names no provider.
const PROVIDERS: Record<string, string> = {
	google: 'Google',
	fontsource: 'Fontsource',
	fontshare: 'Fontshare',
	fontsquirrel: 'Font Squirrel',
	dafont: 'DaFont',
	github: 'GitHub',
};

type InstalledFontRowProps = {
	family: FontFamily;
};

/**
 * @description One installed family: "Aa" in its regular face, its name, style count and provider.
 * Pressing it offers to delete every face of it; font groups using it go back to Discord's font.
 */
function InstalledFontRow({ family }: InstalledFontRowProps) {
	const fonts = Manager.for('font');
	const [first] = family.faces;
	const regular = nearestFace(family.faces, 400);
	const origin = first ? sourceOrigin(first.source) : undefined;
	const provider = origin ? PROVIDERS[origin.provider] : undefined;
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
			await fonts.uninstall(face.id);
		}
	}

	return (
		<Discord.TableRow
			label={family.family}
			icon={<FontSampleIcon family={regular?.postScriptName} />}
			subLabel={provider ? `${styles} · ${provider}` : styles}
			onPress={remove}
		/>
	);
}

export default memo(InstalledFontRow);
