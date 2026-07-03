import { useMemo } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { format } from '~/api/i18n';

import FontOverrideRow from './font-override-row';

/**
 * @description The Fonts tab: one override row per semantic target the Fonts manager exposes. The actual
 * font swap is applied by the native layer and takes effect on next launch, noted by a hint here.
 */
function FontsTab() {
	const fonts = getManager(ManagerKind.Fonts);
	const targets = useMemo(() => fonts.getTargets(), [fonts]);

	return (
		<Discord.TableRowGroup
			title={format('UNBOUND_FONTS')}
			description={format('UNBOUND_FONTS_HINT')}
		>
			{targets.map((target) => (
				<FontOverrideRow
					key={target.group}
					group={target.group}
					families={target.families}
				/>
			))}
		</Discord.TableRowGroup>
	);
}

export default FontsTab;
