import type { FontFamily } from '~/fonts/manager';
import { variableFace, type FontSlot } from '~/fonts/slots';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import { format } from '~/i18n/api';

import FontSampleIcon from './font-sample-icon';
import { weightLabel } from './font-labels';

type FontSlotRowProps = {
	/** The Discord font group the slot belongs to. */
	group: string;
	slot: FontSlot;
	/** The families whose faces the sheet offers: those the group uses. */
	choices: FontFamily[];
};

const SLOT_SHEET = 'unbound-font-slot';

/**
 * @description One weight of a font group, led by "Aa" in the face drawing it and trailed by that face's
 * name. Pressing it offers Default, every face of the families in use, its own style first, and, when one
 * is variable, a page to set its axes, under the current face's name.
 */
function FontSlotRow({ group, slot, choices }: FontSlotRowProps) {
	const fonts = Manager.for('font');
	const navigation = Discord.useNavigation();
	const label = weightLabel(slot.weight, slot.italic);
	const current = slot.face?.fullName ?? format('UNBOUND_DEFAULT');

	function open() {
		const mismatch = (italic: boolean) => Number(italic !== slot.italic);
		const faces = choices
			.flatMap((family) => family.faces)
			.sort(
				(a, b) =>
					mismatch(a.style === 'italic') - mismatch(b.style === 'italic') ||
					a.weight - b.weight,
			);
		const customize = variableFace(slot, faces)
			? [
					{
						label: format('UNBOUND_FONTS_CUSTOMIZE'),
						onPress: () => navigation.push(Screens.FontAxes, { group, slot: slot.key }),
					},
				]
			: [];

		Discord.showSimpleActionSheet({
			key: SLOT_SHEET,
			header: { title: label, subtitle: current },
			options: [
				{
					label: format('UNBOUND_DEFAULT'),
					onPress: () => void fonts.setSlot(slot, undefined),
				},
				...customize,
				...faces.map((face) => ({
					label: face.fullName,
					onPress: () => void fonts.setSlot(slot, face.id),
				})),
			],
		});
	}

	return (
		<Discord.TableRow
			label={label}
			icon={<FontSampleIcon family={slot.families[0]} italic={slot.italic} />}
			trailing={<Discord.TableRow.TrailingText text={current} />}
			arrow
			onPress={open}
		/>
	);
}

export default FontSlotRow;
