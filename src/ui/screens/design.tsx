import { useLayoutEffect, useState } from 'react';
import { Discord } from '@api/metro/components';
import AddonList from '@ui/addons/addon-list';
import { ManagerKind } from '@constants';
import { useAddons } from '@ui/hooks';
import { View } from 'react-native';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';


export default function Design() {
	const navigation = Discord.useNavigation();
	const [search, setSearch] = useState('');
	const addons = useAddons('Themes', search);

	useLayoutEffect(() => {
		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_THEMES} - ${addons.length}` : Strings.UNBOUND_THEMES
		});
	}, [addons]);

	return <View style={{ flex: 1, gap: 6, margin: 16 }}>
		<Discord.Stack direction='horizontal' spacing={8}>
			<View style={{ flex: 1 }}>
				<Discord.TextInput
					value={search}
					onChange={setSearch}
					size='md'
					returnKeyType='search'
					placeholder='Search'
					autoCorrect={false}
					autoCapillize='none'
					isClearable
					accessbilityRole='Search'
					isRound
				/>
			</View>
			<Discord.IconButton
				icon={Icons['PlusMediumIcon']}
				variant='tertiary'
				size='md'
			/>
		</Discord.Stack>
		<AddonList
			kind={ManagerKind.THEMES}
			isSearch={!!search}
			addons={addons}
		/>
	</View>;
};