import { useIcon, type Bundle } from '@managers/sources';
import { Theme, Constants } from '@api/metro/common';
import { Design } from '@api/metro/components';
import { TintedIcon } from '@ui/misc/forms';
import { View, Text } from 'react-native';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Keys } from '@constants';
import { lazy } from 'react';

import useStyles from './addon-card.style';

export function AddonCard({ addon, navigation }: { addon: Bundle[number], navigation: any; }) {
	const { manifest: { id, icon: _icon, name, description, version }, type } = addon;
	const icon = useIcon(_icon);
	const styles = useStyles();

	return <Design.Card
		key={id}
		border='faint'
		shadow='low'
		variant='primary'
		style={styles.card}
		onPress={() => navigation.push(Keys.Custom, {
			title: addon.manifest.name,
			render: () => {
				const AddonPage = lazy(() => import('@ui/sources/addon-page').then(({ AddonPage }) => ({ default: AddonPage })));

				return <AddonPage
					addon={addon}
					navigation={navigation}
				/>;
			}
		})}
	>
		<View style={{ flexDirection: 'row' }}>
			<TintedIcon
				source={icon}
				size={60}
			/>
			<View style={{ flexDirection: 'column', marginLeft: 8, justifyContent: 'center' }}>
				<View style={{ flexDirection: 'row', marginBottom: 8 }}>
					<Text style={[styles.header, { marginRight: 8 }]}>
						{name}
					</Text>
					<Text style={[styles.description, { fontSize: 20, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>
						{version}
					</Text>
				</View>
				<Text style={[styles.description, { marginTop: -8, flexWrap: 'wrap', maxWidth: 148 }]}>
					{description}
				</Text>
			</View>
		</View>
		<View style={{
			position: 'absolute',
			right: 0,
			backgroundColor: Theme.unsafe_rawColors.BRAND_500,
			borderBottomLeftRadius: 10,
			borderTopRightRadius: 14,
			padding: 6
		}}>
			<TintedIcon
				source={Icons[Managers[type].icon]}
				size={12}
			/>
		</View>
	</Design.Card>;
}