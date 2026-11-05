import { View } from 'react-native';

import Empty from '~/ui/components/empty-state';
import { messages } from '~/i18n/api';

import useStyles from './icons-tab.style';
import HeaderInset from './header-inset';

/** @description The Icons tab's placeholder until icon packs get their own picker. */
function IconsTab() {
	const styles = useStyles();

	return (
		<HeaderInset>
			<View style={styles.center}>
				<Empty>{messages.UNBOUND_ICONS_PLACEHOLDER}</Empty>
			</View>
		</HeaderInset>
	);
}

export default IconsTab;
