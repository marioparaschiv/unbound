import { Constants, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import compareSemanticVersions from '@utilities/compareSemanticVersions';
import { TintedIcon, TrailingText } from '@ui/components/misc';
import { AddonCard } from '@ui/settings/sources/addon-card';
import { useIcon, type Bundle } from '@managers/sources';
import { Media, Redesign } from '@metro/components';
import Empty from '@ui/components/internal/empty';
import type { Addon } from '@typings/managers';
import { DCDFileManager } from '@api/storage';
import { Overflow } from '@ui/components';
import { fastFindByProps } from '@metro';
import * as Managers from '@managers';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import { Keys } from '@constants';

const parser = fastFindByProps('parse', 'parseToAST', 'reactParserFor', { lazy: true });
const { Text } = fastFindByProps('TextStyleSheet', 'Text');

function parse({ text }: { text: string }) {
  const reactParse = parser.parse;

  return reactParse(text, true, {
    allowHeading: true,
    allowLinks: true,
    allowList: true,
  }).map(node => typeof node === 'string' ? (
		<Text
			key={node}
			variant={'text-md/normal'}
			color={'text-normal'}
		>
			{node}
		</Text>
	) : node);
}

const useStyles = StyleSheet.createStyles({
	header: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 28,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginBottom: 0
	},

	description: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14,
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		marginBottom: 0,
		marginTop: -4
	}
});

const infoMap = {
	name: {
		icon: 'ic_add_text',
		i18n: 'NAME'
	},
	id: {
		icon: 'feature_star',
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

function useControlState({ readme, changelog, styles, name }: { readme: string, changelog: Bundle[number]['changelog'], styles: any, name: string }) {
	const controlState = Redesign.useSegmentedControlState({
		defaultIndex: 0,
		items: [
			{
				label: Strings.UNBOUND_INFORMATION,
				id: 'information',
				page: typeof readme === 'string' && readme !== '' ? (
					<Redesign.Card
						border={'faint'}
						shadow={'low'}
						variant={'primary'}
						style={{ margin: 14 }}
					>
						{parse({ text: readme })}
					</Redesign.Card>
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
					<Redesign.Card
						border={'faint'}
						shadow={'low'}
						variant={'primary'}
						style={{ margin: 14 }}
					>
						{Object.entries(changelog).map(([version, changes]) => {
							return <RN.View key={version} style={{ marginBottom: 8 }}>
								<RN.Text style={[styles.header, { fontSize: 22 }]}>
									{version}
								</RN.Text>

								{parse({ text: changes.map(change => `* ${change}`).join('\n')})}
							</RN.View>;
						})}
					</Redesign.Card>
				) : (
					<Empty>
						{Strings.UNBOUND_ADDON_NO_CHANGELOG.format({ name })}
					</Empty>
				)
			}
		],
		pageWidth: ReactNative.Dimensions.get('window').width
	});

	return controlState;
}

function Header({ addon, styles }: { addon: Bundle[number], styles: any }) {
	const manager = React.useMemo(() => Managers[addon.type], []);
	const entities = manager.useEntities();
	const icon = useIcon(addon.manifest.icon);
	const [state, setState] = React.useState({
		text: Strings.UNBOUND_INSTALL,
		icon: Icons['ic_download_24px'],
		onPress: () => void manager.installWithToast(addon.manifest.url),
		variant: 'primary',
		kind: StateKind.Install
	});

	React.useEffect(() => {
		switch (true) {
			case !manager.entities.has(addon.manifest.id): {
				setState({
					text: Strings.UNBOUND_INSTALL,
					icon: Icons['ic_download_24px'],
					onPress: () => manager.installWithToast(addon.manifest.url),
					variant: 'primary',
					kind: StateKind.Install
				});

				break;
			}

			case compareSemanticVersions(addon.manifest.version, manager.entities.get(addon.manifest.id).data.version) > 0: {
				setState({
					text: Strings.UNBOUND_UPDATE,
					icon: Icons['ic_message_retry'],
					onPress: () => manager.installWithToast(addon.manifest.url),
					variant: 'primary',
					kind: StateKind.Update
				});

				break;
			}

			// If all else fails we can assume the addon should be uninstalled
			default: {
				setState({
					text: Strings.UNBOUND_UNINSTALL,
					icon: Icons['trash'],
					onPress: () => manager.delete(addon.manifest.id),
					variant: 'primary',
					kind: StateKind.Uninstall
				});

				break;
			}
		}
	}, [entities, addon]);

	return <>
		<RN.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
			<TintedIcon
				source={icon}
				size={60}
			/>
			<RN.View style={{ flexDirection: 'column', marginLeft: 16, justifyContent: 'center' }}>
				<RN.Text style={[styles.header, { marginRight: 8 }]}>
					{addon.manifest.name}
				</RN.Text>
				<RN.Text style={styles.description}>
					{Strings.UNBOUND_BY_AUTHORS.format({ authors: addon.manifest.authors.map(author => author.name).join(', ') })}
				</RN.Text>
			</RN.View>
			<RN.View style={{ flexGrow: 1 }} />
			<Overflow
				items={[
					...[StateKind.Install, StateKind.Update].includes(state.kind) ? [
						{
							get label() {
								// For searching: UNBOUND_INSTALL_ADDON - UNBOUND_UPDATE_ADDON
								return Strings[`UNBOUND_${state.kind === StateKind.Install ? 'INSTALL' : 'UPDATE'}_ADDON`].format({ type: addon.manifest.name });
							},

							iconSource: Icons[state.kind === StateKind.Install ? 'ic_download_24px' : 'ic_message_retry'],
							action() {
								manager.installWithToast(addon.manifest.url);
							}
						}
					] : [],
					...[StateKind.Uninstall, StateKind.Update].includes(state.kind) ? [
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
					] : [],
					{
						get label() {
							return Strings.UNBOUND_VIEW_MANIFEST;
						},

						iconSource: Icons['ic_upload'],
						action() {
							RN.Linking.openURL(addon.manifest.url);
						}
					}
				]}
			/>
		</RN.View>
		<Redesign.Button
			size={'md'}
			iconPosition={'start'}
			{...state}
		/>
	</>;
}

function Screenshots({ addon }: { addon: Bundle[number] }) {
	const [screenshots, setScreenshots] = React.useState([]);

	React.useEffect(() => {
		if (addon.screenshots && addon.screenshots.length > 0) {
			const tempScreenshots = [];

			for (const screenshot of addon.screenshots) {
				const uri = `file://${DCDFileManager.DocumentsDirPath}/${screenshot}`;

				RN.Image.getSize(uri, (width, height) => {
					const { scale } = RN.Dimensions.get('screen');

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
		<RN.FlatList
			data={screenshots}
			horizontal
			keyExtractor={(_, idx) => String(idx)}
			renderItem={({ item: { uri, width, height }, index }) => {
				return <RN.TouchableOpacity
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
					<RN.Image
						source={{ uri }}
						style={{
							aspectRatio: width / height,
							maxWidth: 348 * (width / height),
							maxHeight: 348,
							height,
						}}
					/>
				</RN.TouchableOpacity>;
			}}
		/>

		{screenshots.length > 0 && <Redesign.TableRowDivider />}
	</>;
}

function Control({ readme, changelog, styles, name }) {
	const controlState = useControlState({ readme, changelog, styles, name });

	return <>
		<Redesign.Tabs state={controlState} />

		{/* Undo the margins that the view higher applies */}
		<RN.View style={{ marginHorizontal: -14 }}>
			<Redesign.SegmentedControlPages state={controlState} />
		</RN.View>
	</>;
}

function Information({ addon, navigation, source }: { addon: Bundle[number], navigation: any, source: Addon }) {
	return <>
		<Redesign.TableRowGroup title={Strings.UNBOUND_INFORMATION}>
			<RN.FlatList
				data={Object.entries(infoMap)}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				ItemSeparatorComponent={Redesign.TableRowDivider}
				renderItem={({ item: [prop, { icon, i18n }] }) => (
					<Redesign.TableRow
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
						icon={<Redesign.TableRowIcon source={Icons[icon]} />}
					/>
				)}
				ListEmptyComponent={(
					<Empty>
						{Strings.UNBOUND_SOURCE_EMPTY}
					</Empty>
				)}
			/>
		</Redesign.TableRowGroup>
		<Redesign.RowButton
			icon={Icons['grid']}
			label={Strings['UNBOUND_ADDON_FROM_SOURCE'].format({ name: addon.manifest.name, source: source.data.name })}
			subLabel={Strings['UNBOUND_RETURN_TO_SOURCE'].format({ source: source.data.name })}
			variant={'secondary'}
			onPress={() => {
				navigation.push(Keys.Custom, {
					title: source.data.name,
					render: () => {
						const Addons = React.lazy(() => import('@ui/settings/sources/addons').then(({ Addons }) => ({ default: Addons })));
						return <Addons source={source as any} navigation={navigation} />;
					}
				});
			}}
		/>
		<TrailingText style={{ textAlign: 'center', fontSize: 12 }}>
			{source.data.name} {'→'} {addon.manifest.name}
		</TrailingText>
	</>;
}

export function AddonPage({ addon, navigation }: { addon: Bundle[number], navigation: any }) {
	const source = React.useMemo(() => Managers.Sources.entities.get(addon.source), []);
	const styles = useStyles();

	return <RN.ScrollView>
		<RN.View style={{ marginTop: 12, marginHorizontal: 14 }}>
			<Header addon={addon} styles={styles} />
			<RN.View style={{ marginVertical: 16, gap: 10 }}>
				<Redesign.TableRowDivider />
				<RN.Text style={[styles.header, { fontSize: 18, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD, textAlign: 'center' }]}>
					{addon.manifest.description ?? Strings.UNBOUND_ADDON_NO_DESCRIPTION}
				</RN.Text>
				<Redesign.TableRowDivider />

				{Array.isArray(addon.suggest) && addon.suggest.length > 0 && (
					<RN.View style={{ marginTop: 4, marginBottom: 12, gap: 6 }}>
						<RN.Text style={[styles.description, { fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>{Strings.UNBOUND_SUGGESTED}</RN.Text>
						<RN.FlatList
							data={addon.suggest}
							keyExtractor={(_, idx) => String(idx)}
							horizontal
							renderItem={({ item }) => {
								return <AddonCard
									addon={source.instance?.find(addon => addon.manifest.id === item)}
									navigation={navigation}
								/>;
							}}
						/>
					</RN.View>
				)}

				<Screenshots addon={addon} />

				<Control
					readme={addon.readme}
					changelog={addon.changelog}
					styles={styles}
					name={addon.manifest.name}
				/>

				<Information
					addon={addon}
					navigation={navigation}
					source={source}
				/>
			</RN.View>
		</RN.View>
	</RN.ScrollView>;
}