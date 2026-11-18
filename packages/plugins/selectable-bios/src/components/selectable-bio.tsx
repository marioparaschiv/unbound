import { cloneElement, useState, type ReactElement } from 'react';
import { TextInput } from 'react-native';

import useStyles, { variantStyle } from '~/components/selectable-bio.style';

type BioTextProps = { bio?: string; textVariant?: string };

type SelectableBioProps = { text: ReactElement<object>; props: BioTextProps };

/**
 * @description Discord's bio text, which a long press turns into a read-only text field in the same place with the
 * whole bio selected, so any part of it can be selected and copied. Links stay tappable until then, and the bio
 * turns back into text once the field loses focus.
 * @param props The bio Discord rendered and the props it was rendered with.
 * @returns The bio.
 */
export default function SelectableBio({ text, props }: SelectableBioProps) {
	const styles = useStyles();
	const [selecting, setSelecting] = useState(false);
	const bio = props.bio ?? '';

	if (!selecting || !bio) {
		return cloneElement(text, { onLongPress: () => setSelecting(true) } as object);
	}

	return (
		<TextInput
			value={bio}
			multiline
			scrollEnabled={false}
			autoFocus
			selectTextOnFocus
			showSoftInputOnFocus={false}
			caretHidden
			onChangeText={() => undefined}
			onBlur={() => setSelecting(false)}
			style={[variantStyle(props.textVariant), styles.field]}
		/>
	);
}
