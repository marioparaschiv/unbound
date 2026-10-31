import { ScrollView } from 'react-native';
import { useMemo } from 'react';

import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { format } from '~/i18n/api';

import FontOverrideRow from './font-override-row';

/**
 * @description The Fonts tab: one override row per semantic target the Fonts manager exposes. The actual
 * font swap is applied by the native layer and takes effect on next launch, noted by a hint here.
 */
function FontsTab() {
	const fonts = Manager.for('font');
	const targets = useMemo(() => fonts.getTargets(), [fonts]);

	return (
		<ScrollView contentContainerStyle={{ padding: 16 }}>
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
		</ScrollView>
	);
}

export default FontsTab;
