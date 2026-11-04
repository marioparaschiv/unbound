import type { ReactElement } from 'react';

import InputRow, { type InputRowProps } from '~/ui/settings-kit/input-row';

/** Props for `MultilineRow`: an `InputRow`'s, without its variant. */
export type MultilineRowProps = Omit<InputRowProps, 'variant' | 'keyboardType'>;

/**
 * @description A settings text input that grows with its text, Discord's `TextArea`.
 * @param props The input's label, saved text, validation and change handler.
 * @returns The input.
 */
function MultilineRow(props: MultilineRowProps): ReactElement {
	return <InputRow {...props} variant='multiline' />;
}

export default MultilineRow;
