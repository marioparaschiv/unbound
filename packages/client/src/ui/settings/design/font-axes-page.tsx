import { useEffect } from 'react';

import { slotCoordinates, variableFace } from '~/fonts/slots';
import RestartRow from '~/ui/settings-kit/restart-row';
import SliderRow from '~/ui/settings-kit/slider-row';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { format } from '~/i18n/api';

import { weightLabel } from './font-labels';
import FontPreview from './font-preview';
import useFonts from './use-fonts';

/** The Discord font group and the slot of it the page sets. */
export type FontAxesParams = {
	group: string;
	/** The slot's key, such as `700` or `400-italic`. */
	slot: string;
};

type FontAxesPageProps = {
	route: { params: FontAxesParams };
};

// Weight and width span hundreds of units; slant and small axes need finer steps.
const axisStep = (min: number, max: number) => (max - min > 20 ? 1 : 0.1);

/**
 * @description One weight of a font group drawn by a variable font: a preview of it, then a slider per axis
 * the font offers. Ending a drag draws the weight at the new coordinates.
 */
function FontAxesPage({ route }: FontAxesPageProps) {
	const { group, slot: key } = route.params;
	const fonts = useFonts();
	const navigation = Discord.useNavigation();
	const slot = fonts.getSlots(group).find((entry) => entry.key === key);
	const used = fonts.getGroupFamilies(group);
	const faces = fonts
		.getFamilies()
		.filter((entry) => used.includes(entry.family))
		.flatMap((entry) => entry.faces);
	const face = slot ? variableFace(slot, faces) : undefined;

	useEffect(() => {
		if (slot) {
			navigation.setOptions({ title: weightLabel(slot.weight, slot.italic) });
		}
	}, [key]);

	// The face went away under the page, such as when the font was uninstalled.
	if (!slot || !face) return null;

	const coordinates = slotCoordinates(slot, face);

	return (
		<Page>
			{fonts.needsRestart() ? <RestartRow /> : null}
			<FontPreview
				lines={[
					{
						key: slot.key,
						family: slot.families[0] ?? '',
						label: slot.face?.fullName ?? weightLabel(slot.weight, slot.italic),
					},
				]}
			/>
			<Discord.TableRowGroup
				title={format('UNBOUND_FONTS_AXES')}
				helperText={format('UNBOUND_FONTS_AXES_HINT', { family: face.family })}
			>
				{(face.axes ?? [])
					.filter((axis) => !axis.hidden)
					.map((axis) => (
						<SliderRow
							key={axis.tag}
							label={axis.name || axis.tag}
							value={coordinates[axis.tag] ?? axis.default}
							defaultValue={axis.default}
							minimum={axis.min}
							maximum={axis.max}
							step={axisStep(axis.min, axis.max)}
							onChange={(value) =>
								void fonts.customizeSlot(slot, face, {
									...coordinates,
									[axis.tag]: value,
								})
							}
						/>
					))}
			</Discord.TableRowGroup>
		</Page>
	);
}

export default FontAxesPage;
