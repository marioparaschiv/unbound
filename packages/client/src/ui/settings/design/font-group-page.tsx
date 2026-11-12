import { useEffect } from 'react';

import RestartRow from '~/ui/settings-kit/restart-row';
import { Discord } from '~/metro/components';
import { nearestFace } from '~/fonts/slots';
import Page from '~/ui/components/page';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import { groupLabel, weightLabel } from './font-labels';
import FontSampleIcon from './font-sample-icon';
import FontSlotRow from './font-slot-row';
import FontPreview from './font-preview';
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
 * @description One Discord font group's page: a preview of its upright weights, Default and every installed
 * family, then one row per weight to fine-tune. Choosing a family points each weight at that family's
 * closest face; a weight row then pins any face of the families in use.
 */
function FontGroupPage({ route }: FontGroupPageProps) {
	const { group } = route.params;
	const fonts = useFonts();
	const navigation = Discord.useNavigation();
	const used = fonts.getGroupFamilies(group);
	const families = fonts.getFamilies();
	const slots = fonts.getSlots(group);
	// Several families, set one weight at a time, match no single row.
	const value = used.length === 0 ? DEFAULT : used.length === 1 ? used[0] : undefined;
	const choices = families.filter((entry) => used.includes(entry.family));

	useEffect(() => {
		navigation.setOptions({ title: groupLabel(group) });
	}, [group]);

	function choose(family: string) {
		const face = families.find((entry) => entry.family === family)?.faces[0];

		void (face ? fonts.setOverride(group, face.id) : fonts.clearOverride(group));
	}

	return (
		<Page>
			{fonts.needsRestart() ? <RestartRow /> : null}
			<FontPreview
				lines={slots
					.filter((slot) => !slot.italic)
					.map((slot) => ({
						key: slot.key,
						family: slot.families[0] ?? '',
						label: slot.face?.fullName ?? weightLabel(slot.weight),
					}))}
			/>
			<Discord.TableRadioGroup
				title={format('UNBOUND_FONTS')}
				helperText={format('UNBOUND_FONTS_HINT')}
				value={value}
				onChange={(picked: string) => choose(picked)}
			>
				<Discord.TableRadioRow
					label={format('UNBOUND_DEFAULT')}
					icon={<Discord.TableRowIcon source={icons.LettersIcon} />}
					value={DEFAULT}
				/>
				{families.map(({ family, faces }) => (
					<Discord.TableRadioRow
						key={family}
						label={family}
						subLabel={format('UNBOUND_FONTS_STYLES', { count: faces.length })}
						icon={<FontSampleIcon family={nearestFace(faces, 400)?.postScriptName} />}
						value={family}
					/>
				))}
			</Discord.TableRadioGroup>
			{choices.length ? (
				<Discord.TableRowGroup
					title={format('UNBOUND_FONTS_WEIGHTS')}
					helperText={format('UNBOUND_FONTS_WEIGHTS_HINT')}
				>
					{slots.map((slot) => (
						<FontSlotRow key={slot.key} group={group} slot={slot} choices={choices} />
					))}
				</Discord.TableRowGroup>
			) : null}
		</Page>
	);
}

export default FontGroupPage;
