import type { ReactElement } from 'react';

import InputRow, { type InputRowProps } from '~/ui/settings-kit/input-row';

/** Props for `SecretRow`: an `InputRow`'s, without its variant. */
export type SecretRowProps = Omit<InputRowProps, 'variant' | 'keyboardType'>;

/**
 * @description A settings text input that hides what is typed, for tokens and passwords. A snapshot of the settings masks its value.
 * @param props The input's label, saved text and change handler.
 * @returns The input.
 */
function SecretRow(props: SecretRowProps): ReactElement {
	return <InputRow {...props} variant='secret' />;
}

export default SecretRow;
