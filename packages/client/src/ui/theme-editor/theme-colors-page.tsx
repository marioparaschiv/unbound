import { useEffect, useMemo } from 'react';

import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import ThemeStore from '~/themes/state';
import Page from '~/ui/components/page';

import { COLOR_GROUPS, groupTokens, tokenLabel } from './token-groups';
import useEditorScreen from './use-editor-screen';
import ThemeColorRow from './theme-color-row';
import { tokenNames } from './token-colors';

type ThemeColorsParams = {
	/** The group to list the colours of; the groups themselves are listed without one. */
	group?: string;
};

type ThemeColorsPageProps = {
	route: { params?: ThemeColorsParams };
};

/**
 * @description All Colors: every group of Discord's colours with how many are edited, or, given a group, each of its colours.
 */
function ThemeColorsPage({ route }: ThemeColorsPageProps) {
	const navigation = Discord.useNavigation();
	const group = route.params?.group;
	const draft = ThemeStore((state) => state.preview);
	const scroll = useEditorScreen({
		screen: Screens.ThemeColors,
		params: group ? { group } : undefined,
	});
	const groups = useMemo(() => groupTokens(tokenNames()), []);
	const title = COLOR_GROUPS.find(({ key }) => key === group)?.title;

	useEffect(() => {
		if (title) {
			navigation.setOptions({ title: messages[title] });
		}
	}, [title]);

	if (group) {
		return (
			<Page {...scroll}>
				<Discord.TableRowGroup>
					{(groups.get(group) ?? []).map((name) => (
						<ThemeColorRow key={name} label={tokenLabel(name)} tokens={[name]} />
					))}
				</Discord.TableRowGroup>
			</Page>
		);
	}

	return (
		<Page {...scroll}>
			<Discord.TableRowGroup>
				{COLOR_GROUPS.map(({ key, title }) => {
					const names = groups.get(key) ?? [];
					const edited = names.filter((name) => draft && name in draft.semantic).length;

					return names.length ? (
						<Discord.TableRow
							key={key}
							label={messages[title]}
							subLabel={
								edited
									? format('UNBOUND_THEME_EDITED_COUNT', { edited })
									: undefined
							}
							trailing={<Discord.TableRowTrailingText text={String(names.length)} />}
							arrow
							onPress={() => navigation.push(Screens.ThemeColors, { group: key })}
						/>
					) : null;
				})}
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ThemeColorsPage;
