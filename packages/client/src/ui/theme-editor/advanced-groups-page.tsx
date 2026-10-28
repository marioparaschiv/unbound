import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { isEdited } from '~/lib/theme-draft';
import { Screens } from '~/lib/constants';
import ThemeStore from '~/stores/themes';
import { Page } from '~/ui/components';

import { ADVANCED_GROUPS } from './token-registry';
import useEditorScreen from './use-editor-screen';
import TokenGroupPage from './token-group-page';

type AdvancedGroupsPageProps = {
	groups: ReadonlyMap<string, readonly string[]>;
};

/**
 * @description Every Discord colour by area, each group with how many of its colours the draft edits.
 */
function AdvancedGroupsPage({ groups }: AdvancedGroupsPageProps) {
	const navigation = Discord.useNavigation();
	const preview = ThemeStore((state) => state.preview);

	useEditorScreen();

	function openGroup(key: string, title: string) {
		navigation.push(Screens.Custom, {
			title,
			render: () => <TokenGroupPage tokens={groups.get(key) ?? []} />,
		});
	}

	return (
		<Page>
			<Discord.TableRowGroup description={Messages.UNBOUND_THEME_ADVANCED_HINT}>
				{ADVANCED_GROUPS.map(({ key, title }) => {
					const tokens = groups.get(key) ?? [];
					const edited = preview
						? tokens.filter((token) => isEdited(preview, [token])).length
						: 0;

					return tokens.length ? (
						<Discord.TableRow
							key={key}
							label={format(title)}
							arrow
							trailing={
								<Discord.TableRow.TrailingText
									text={
										edited
											? format('UNBOUND_THEME_EDITED_COUNT', {
													edited,
													total: tokens.length,
												})
											: String(tokens.length)
									}
								/>
							}
							onPress={() => openGroup(key, format(title))}
						/>
					) : null;
				})}
			</Discord.TableRowGroup>
		</Page>
	);
}

export default AdvancedGroupsPage;
