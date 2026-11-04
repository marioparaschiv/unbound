import { isHttpUrl } from '@unbound-app/contracts/settings-schema';
import type { ReactElement } from 'react';

import InputRow, { type InputRowProps } from '~/ui/settings-kit/input-row';
import { messages } from '~/i18n/api';

/** Props for `UrlRow`: an `InputRow`'s, without its variant and validation. */
export type UrlRowProps = Omit<InputRowProps, 'variant' | 'keyboardType' | 'validate'>;

/**
 * @description A settings input for an http or https URL, which saves only a URL or nothing.
 * @param props The input's label, saved URL and change handler.
 * @returns The input.
 */
function UrlRow(props: UrlRowProps): ReactElement {
	return (
		<InputRow
			{...props}
			keyboardType='url'
			validate={(text) =>
				text === '' || isHttpUrl(text) ? undefined : messages.UNBOUND_SETTING_NOT_A_URL
			}
		/>
	);
}

export default UrlRow;
