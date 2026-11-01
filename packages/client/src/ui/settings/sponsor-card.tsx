import { View } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { ActionSheets, Linking } from '~/metro/api';
import { SOCIAL_LINKS } from '~/core/constants';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import SponsorPerksSheet from './sponsor-perks-sheet';
import useStyles from './sponsor-card.style';

const SHEET_KEY = 'unbound-sponsor-perks';

function openPerks() {
	ActionSheets.openLazy(Promise.resolve({ default: SponsorPerksSheet }), SHEET_KEY, {
		onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
	});
}

/**
 * @description Asks the user to sponsor Unbound on GitHub, naming the perk it unlocks, with a link to
 * sponsor and a sheet listing every perk.
 */
function SponsorCard() {
	const styles = useStyles();

	return (
		<View style={styles.card}>
			<View style={styles.heading}>
				<View style={styles.heart}>
					<TintedIcon source={icons.HeartIcon ?? 0} size={18} tint='#FFFFFF' />
				</View>
				<Discord.Text variant='heading-md/bold' color='mobile-text-heading-primary'>
					{messages.UNBOUND_SPONSOR_TITLE}
				</Discord.Text>
			</View>
			<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.body}>
				{messages.UNBOUND_SPONSOR_BODY}
			</Discord.Text>
			<View style={styles.actions}>
				<View style={styles.action}>
					<Discord.Button
						text={messages.UNBOUND_SPONSOR}
						variant='primary'
						size='md'
						onPress={() => Linking.openURL(SOCIAL_LINKS.Sponsor)}
					/>
				</View>
				<View style={styles.action}>
					<Discord.Button
						text={messages.UNBOUND_SPONSOR_PERKS}
						variant='secondary'
						size='md'
						onPress={openPerks}
					/>
				</View>
			</View>
		</View>
	);
}

export default SponsorCard;
