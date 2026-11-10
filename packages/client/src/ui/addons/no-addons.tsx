import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';

import HeroBadge from '~/ui/settings/updates/hero-badge';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import { icons } from '~/assets/api';

import useStyles from './no-addons.style';

type NoAddonsProps = {
	kind: AddonKind;
};

/**
 * @description The empty state of an addon page with nothing installed, laid out like the updates hero: a brand
 * badge, a nudge and a button that opens the marketplace on the page's tab.
 */
function NoAddons({ kind }: NoAddonsProps) {
	const styles = useStyles();
	const navigation = Discord.useNavigation();
	const type = messages[Manager.for(kind).label].toLowerCase();

	return (
		<View style={styles.container}>
			<HeroBadge tone='brand' icon='PuzzlePieceIcon' spinning={false} />
			<View style={styles.text}>
				<Discord.Text
					variant='heading-lg/bold'
					color='mobile-text-heading-primary'
					style={styles.centered}
				>
					{messages.UNBOUND_NO_ADDONS_TITLE}
				</Discord.Text>
				<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.centered}>
					{format('UNBOUND_NO_ADDONS_BODY', { type })}
				</Discord.Text>
			</View>
			<Discord.Button
				size='md'
				variant='primary'
				icon={icons['ShopIcon']}
				text={messages.UNBOUND_BROWSE_MARKETPLACE}
				onPress={() => navigation.push(Screens.Marketplace, { kind })}
			/>
		</View>
	);
}

export default NoAddons;
