import { useEffect } from 'react';

import RestartRow from '~/ui/settings-kit/restart-row';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { format } from '~/i18n/api';

import useFonts from './use-fonts';

/** The Discord font group the page sets. */
export type FontGroupParams = {
	group: string;
};

type FontGroupPageProps = {
	route: { params: FontGroupParams };
};

// The radio value of Discord's own fonts; no family is named empty.
const DEFAULT = '';

/**
 * @description One Discord font group's page: Default, then every installed family. Choosing a family
 * points each weight of the group at that family's closest face, Default gives the group back its
 * fonts, and either returns to the Fonts tab.
 */
function FontGroupPage({ route }: FontGroupPageProps) {
	const { group } = route.params;
	const fonts = useFonts();
	const navigation = Discord.useNavigation();
	const used = fonts.getGroupFamilies(group);
	// Several families, set one weight at a time, match no single row.
	const value = used.length === 0 ? DEFAULT : used.length === 1 ? used[0] : undefined;

	useEffect(() => {
		navigation.setOptions({ title: group });
	}, [group]);

	function choose(family: string) {
		const face = fonts.getFamilies().find((entry) => entry.family === family)?.faces[0];

		void (face ? fonts.setOverride(group, face.id) : fonts.clearOverride(group));
		navigation.goBack();
	}

	return (
		<Page>
			{fonts.needsRestart() ? <RestartRow /> : null}
			<Discord.TableRadioGroup
				title={format('UNBOUND_FONTS')}
				value={value}
				onChange={(picked: string) => choose(picked)}
			>
				<Discord.TableRadioRow label={format('UNBOUND_DEFAULT')} value={DEFAULT} />
				{fonts.getFamilies().map(({ family, faces }) => (
					<Discord.TableRadioRow
						key={family}
						label={family}
						subLabel={format('UNBOUND_FONTS_STYLES', { count: faces.length })}
						value={family}
					/>
				))}
			</Discord.TableRadioGroup>
		</Page>
	);
}

export default FontGroupPage;
