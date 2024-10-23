import { View, Text, Image, Dimensions, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { lazy, useEffect, useMemo, useState } from 'react';
import { TintedIcon, TrailingText } from '@ui/misc/forms';
import { useIcon, type Bundle } from '@managers/sources';
import { Media, Discord } from '@api/metro/components';
import { AddonCard } from '@ui/sources/addon-card';
import { Constants } from '@api/metro/common';
import { SettingsKeys } from '@constants';
import Empty from '@ui/misc/empty-state';
import { findByProps } from '@api/metro';
import { Linking } from '@api/metro/api';
import * as Managers from '@managers';
import { Semver } from '@utilities';
import { Overflow } from '@ui/misc';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import fs from '@api/fs';

import useStyles from './addon-page.style';

const parser = findByProps('parse', 'parseToAST', 'reactParserFor', { lazy: true });

function parse({ text }: { text: string; }) {
	const reactParse = parser.parse;

	return reactParse(text, true, {
		allowHeading: true,
		allowLinks: true,
		allowList: true,
	}).map(node => typeof node === 'string' ? (
		<Discord.Text
			key={node}
			variant='text-md/normal'
			color='text-normal'
		>
			{node}
		</Discord.Text>
	) : node);
}

const infoMap = {
	name: {
		icon: 'ic_add_text',
		i18n: 'NAME'
	},
	id: {
		icon: 'ic_star_filled',
		i18n: 'IDENTIFIER'
	},
	version: {
		icon: 'ic_text_channel_16px',
		i18n: 'VERSION'
	},
	main: {
		icon: 'BookCheckIcon',
		i18n: 'BUNDLE'
	}
} as const;

enum StateKind {
	Install,
	Update,
	Uninstall
}

const getStates = (addon: Bundle[number], manager: typeof Managers[keyof typeof Managers]) => [
	{
		text: Strings.UNBOUND_INSTALL,
		icon: Icons['ic_download_24px'],
		onPress: () => manager.installWithToast(addon.manifest.url),
		variant: 'primary'
	},
	{
		text: Strings.UNBOUND_UPDATE,
		icon: Icons['ic_message_retry'],
		onPress: () => manager.installWithToast(addon.manifest.url),
		variant: 'primary'
	},
	{
		text: Strings.UNBOUND_UNINSTALL,
		icon: Icons['trash'],
		onPress: () => manager.delete(addon.manifest.id),
		variant: 'primary'
	}
];

function useControlState({ readme, changelog, styles, name }: { readme: string, changelog: Bundle[number]['changelog'], styles: any, name: string; }) {
	const controlState = Discord.useSegmentedControlState({
		defaultIndex: 0,
		items: [
			{
				label: Strings.UNBOUND_INFORMATION,
				id: 'information',
				page: typeof readme === 'string' && readme !== '' ? (
					<Discord.Card
						border={'faint'}
						shadow={'low'}
						variant={'primary'}
						style={{ margin: 14 }}
					>
						{parse({ text: readme })}
					</Discord.Card>
				) : (
					<Empty>
						{Strings.UNBOUND_ADDON_NO_README.format({ name })}
					</Empty>
				)
			},
			{
				label: Strings.UNBOUND_CHANGELOG,
				id: 'changelog',
				page: typeof changelog === 'object' ? (
					<Discord.Card
						border={'faint'}
						shadow={'low'}
						variant={'primary'}
						style={{ margin: 14 }}
					>
						{Object.entries(changelog).map(([version, changes]) => {
							return <View key={version} style={{ marginBottom: 8 }}>
								<Text style={[styles.header, { fontSize: 22 }]}>
									{version}
								</Text>

								{parse({ text: changes.map(change => `* ${change}`).join('\n') })}
							</View>;
						})}
					</Discord.Card>
				) : (
					<Empty>
						{Strings.UNBOUND_ADDON_NO_CHANGELOG.format({ name })}
					</Empty>
				)
			}
		],
		pageWidth: Dimensions.get('window').width
	});

	return controlState;
}

function Header({ addon, styles }: { addon: Bundle[number], styles: any; }) {
	const manager = useMemo(() => Managers[addon.type], []);
	const entities = manager.useEntities();
	const icon = useIcon(addon.manifest.icon);
	const [state, setState] = useState(StateKind.Install);

	useEffect(() => {
		const entity = manager.entities.get(addon.manifest.id);

		switch (true) {
			case !entity: {
				setState(StateKind.Install);
				break;
			}

			case Semver.isGreater(addon.manifest.version, entity.data.version): {
				setState(StateKind.Update);
				break;
			}

			// If all else fails we can assume the addon should be uninstalled
			default: {
				setState(StateKind.Uninstall);
				break;
			}
		}
	}, [entities, addon]);

	return <>
		<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
			<TintedIcon
				source={icon}
				size={60}
			/>
			<View style={{ flexDirection: 'column', marginLeft: 16, justifyContent: 'center' }}>
				<Text style={[styles.header, { marginRight: 8 }]}>
					{addon.manifest.name}
				</Text>
				<Text style={styles.description}>
					{Strings.UNBOUND_BY_AUTHORS.format({ authors: addon.manifest.authors.map(author => author.name).join(', ') })}
				</Text>
			</View>
			<View style={{ flexGrow: 1 }} />
			<Overflow
				items={[
					...([StateKind.Install, StateKind.Update].includes(state) ? [
						{
							get label() {
								// For searching: UNBOUND_INSTALL_ADDON - UNBOUND_UPDATE_ADDON
								return Strings[`UNBOUND_${state === StateKind.Install ? 'INSTALL' : 'UPDATE'}_ADDON`].format({ type: addon.manifest.name });
							},

							iconSource: Icons[state === StateKind.Install ? 'ic_download_24px' : 'ic_message_retry'],
							action() {
								manager.installWithToast(addon.manifest.url);
							}
						}
					] : []),
					...([StateKind.Uninstall, StateKind.Update].includes(state) ? [
						{
							get label() {
								return Strings.UNBOUND_UNINSTALL_ADDON.format({ type: addon.manifest.name });
							},

							iconSource: Icons['trash'],
							action() {
								manager.delete(addon.manifest.id);
							}
						},
						{
							get label() {
								return Strings.UNBOUND_REFETCH_ADDON.format({ type: addon.manifest.name });
							},

							iconSource: Icons['RetryIcon'],
							action() {
								manager.installWithToast(addon.manifest.url);
							}
						}
					] : []),
					{
						get label() {
							return Strings.UNBOUND_VIEW_MANIFEST;
						},

						iconSource: Icons['ic_upload'],
						action() {
							Linking.openURL(addon.manifest.url);
						}
					}
				]}
			/>
		</View>
		<Discord.Button
			size={'md'}
			iconPosition={'start'}
			{...getStates(addon, manager)[state]}
		/>
	</>;
}

function Screenshots({ addon }: { addon: Bundle[number]; }) {
	const [screenshots, setScreenshots] = useState([]);

	useEffect(() => {
		if (addon.screenshots && addon.screenshots.length > 0) {
			const tempScreenshots = [];

			for (const screenshot of addon.screenshots) {
				const uri = `file://${fs.Documents}/${screenshot}`;

				Image.getSize(uri, (width, height) => {
					const { scale } = Dimensions.get('screen');

					tempScreenshots.push({
						uri,
						width: width / scale,
						height: height / scale
					});
				}, console.error);
			}

			setScreenshots(tempScreenshots);
		}
	}, []);

	return <>
		<FlatList
			data={screenshots}
			horizontal
			keyExtractor={(_, idx) => String(idx)}
			showsHorizontalScrollIndicator={false}
			renderItem={({ item: { uri, width, height }, index }) => {
				return <TouchableOpacity
					key={index}
					onPress={({ nativeEvent }) => {
						Media.openMediaModal({
							originLayout: {
								width: 0,
								height: 0,
								x: nativeEvent.pageX,
								y: nativeEvent.pageY,
								resizeMode: 'fill'
							},
							initialIndex: 0,
							initialSources: [
								{
									uri,
									sourceURI: uri,
									width,
									height
								}
							]
						});
					}}
					style={{
						maxWidth: 348 * (width / height),
						maxHeight: 348,
						margin: 12
					}}
				>
					<Image
						source={{ uri }}
						style={{
							aspectRatio: width / height,
							maxWidth: 348 * (width / height),
							maxHeight: 348,
							height,
							borderRadius: 16
						}}
					/>
				</TouchableOpacity>;
			}}
		/>
		{screenshots.length > 0 && <Discord.TableRowDivider />}
	</>;
}

function Control({ readme, changelog, styles, name }) {
	const controlState = useControlState({ readme, changelog, styles, name });

	return <>
		<Discord.Tabs state={controlState} />

		{/* Undo the margins that the view higher applies */}
		<View style={{ marginHorizontal: -14 }}>
			<Discord.SegmentedControlPages state={controlState} />
		</View>
	</>;
}

function Information({ addon }: { addon: Bundle[number]; }) {
	return <>
		<Discord.TableRowGroup title={Strings.UNBOUND_INFORMATION}>
			<FlatList
				data={Object.entries(infoMap)}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				ItemSeparatorComponent={Discord.TableRowDivider}
				renderItem={({ item: [prop, { icon, i18n }] }) => (
					<Discord.TableRow
						key={prop}
						label={Strings[`UNBOUND_${i18n}`]}
						trailing={(
							<TrailingText>
								{(() => {
									const text: string = addon.manifest[prop];

									if (addon.type === 'Icons' && prop === 'main') {
										const index = text.lastIndexOf('/');
										return text.slice(index + 1);
									};

									return text;
								})()}
							</TrailingText>
						)}
						icon={<Discord.TableRowIcon source={Icons[icon]} />}
					/>
				)}
				ListEmptyComponent={(
					<Empty>
						{Strings.UNBOUND_SOURCE_EMPTY}
					</Empty>
				)}
			/>
		</Discord.TableRowGroup>
	</>;
}

export function AddonPage({ addon, navigation }: { addon: Bundle[number], navigation: any; }) {
	const source = useMemo(() => Managers.Sources.entities.get(addon.source), []);
	const styles = useStyles();

	return <ScrollView>
		<View style={{ marginTop: 12, marginHorizontal: 14 }}>
			<Header addon={addon} styles={styles} />
			<View style={{ marginVertical: 16, gap: 10 }}>
				<Discord.TableRowDivider />
				<Text style={[styles.header, { fontSize: 18, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD, textAlign: 'center' }]}>
					{addon.manifest.description ?? Strings.UNBOUND_ADDON_NO_DESCRIPTION}
				</Text>
				<Discord.TableRowDivider />
				<Screenshots addon={addon} />

				<Control
					readme={addon.readme}
					changelog={addon.changelog}
					styles={styles}
					name={addon.manifest.name}
				/>

				<Information addon={addon} />

				{Array.isArray(addon.suggest) && addon.suggest.length > 0 && (
					<View style={{ marginTop: 4, marginBottom: 12, gap: 6 }}>
						<Text style={[styles.description, { fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>{Strings.UNBOUND_SUGGESTED}</Text>
						<FlatList
							data={addon.suggest}
							keyExtractor={(_, idx) => String(idx)}
							horizontal
							showsHorizontalScrollIndicator={false}
							renderItem={({ item }) => {
								return <AddonCard
									addon={source.instance?.find(addon => addon.manifest.id === item)}
									navigation={navigation}
								/>;
							}}
						/>
					</View>
				)}

				<Discord.RowButton
					icon={Icons['grid']}
					label={Strings['UNBOUND_ADDON_FROM_SOURCE'].format({ name: addon.manifest.name, source: source.data.name })}
					subLabel={Strings['UNBOUND_RETURN_TO_SOURCE'].format({ source: source.data.name })}
					variant={'secondary'}
					onPress={() => {
						navigation.push(SettingsKeys.Custom, {
							title: source.data.name,
							render: () => {
								const Addons = lazy(() => import('@ui/sources/addons').then(({ Addons }) => ({ default: Addons })));
								return <Addons source={source as any} navigation={navigation} />;
							}
						});
					}}
				/>
				<TrailingText style={{ textAlign: 'center', fontSize: 12 }}>
					{source.data.name} {'→'} {addon.manifest.name}
				</TrailingText>
			</View>
		</View>
	</ScrollView>;
}
