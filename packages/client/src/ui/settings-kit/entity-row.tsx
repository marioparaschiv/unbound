import { isSnowflake } from '@unbound-app/contracts/settings-schema';
import type { EntityDisplay } from '@unbound-app/types/settings';
import type { ReactElement } from 'react';

import useEntityName from '~/ui/settings-kit/use-entity-name';
import InputRow from '~/ui/settings-kit/input-row';
import { messages } from '~/i18n/api';

/** Props for `EntityRow`. */
export type EntityRowProps = {
	/** What the id names. */
	entity: EntityDisplay;
	/** The input's label. */
	label: string;
	/** The saved id; empty for none. */
	value: string;
	/** Dims the row and ignores input. Defaults to false. */
	disabled?: boolean;
	/** Called with a typed id, or an empty string to clear it. */
	onChange: (value: string) => void;
};

/**
 * @description A settings input for a Discord id, showing the name the client's stores hold for it. It takes an id typed or pasted; it has no search.
 * @param props The row's entity, label, saved id and change handler.
 * @returns The input.
 */
function EntityRow({
	entity,
	label,
	value,
	disabled = false,
	onChange,
}: EntityRowProps): ReactElement {
	const name = useEntityName(entity, value);

	return (
		<InputRow
			label={label}
			subLabel={name}
			value={value}
			keyboardType='number-pad'
			disabled={disabled}
			validate={(text) =>
				text === '' || isSnowflake(text) ? undefined : messages.UNBOUND_SETTING_NOT_AN_ID
			}
			onChange={onChange}
		/>
	);
}

export default EntityRow;
