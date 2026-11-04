import { useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

/** Props for `ListRow`. */
export type ListRowProps = {
	/** The group's title. */
	title: string;
	/** Text shown under the group; none when omitted. */
	description?: string;
	/** The saved strings, in order. */
	value: string[];
	/** The most strings the list holds; none when omitted. */
	maxItems?: number;
	/** Returns why a string cannot be added, or `undefined` when it can. */
	validate?: (text: string) => string | undefined;
	disabled?: boolean;
	/** Called with the new list after each add, remove or move. */
	onChange: (value: string[]) => void;
};

function moved(list: string[], from: number, to: number): string[] {
	const next = [...list];
	const [item] = next.splice(from, 1);

	if (item !== undefined) {
		next.splice(to, 0, item);
	}

	return next;
}

/**
 * @description A titled, editable list of strings: each row moves up or down or is removed, and an input adds one.
 * @param props The group's title, saved strings, limit, validation and change handler.
 * @returns The group.
 */
function ListRow({
	title,
	description,
	value,
	maxItems = Infinity,
	validate,
	disabled = false,
	onChange,
}: ListRowProps): ReactElement {
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | undefined>(undefined);
	const full = value.length >= maxItems;

	function add() {
		const text = draft.trim();
		const problem = text
			? (validate?.(text) ??
				(value.includes(text) ? messages.UNBOUND_SETTING_DUPLICATE : undefined))
			: undefined;

		setError(problem);

		if (!text || problem || full) return;

		onChange([...value, text]);
		setDraft('');
	}

	return (
		<Discord.TableRowGroup title={title} description={description}>
			{value.map((item, index) => (
				<Discord.TableRow
					key={item}
					label={item}
					disabled={disabled}
					trailing={
						<View style={{ flexDirection: 'row', gap: 4 }}>
							<Discord.Button
								size='sm'
								variant='secondary'
								text='↑'
								disabled={disabled || index === 0}
								onPress={() => onChange(moved(value, index, index - 1))}
							/>
							<Discord.Button
								size='sm'
								variant='secondary'
								text='↓'
								disabled={disabled || index === value.length - 1}
								onPress={() => onChange(moved(value, index, index + 1))}
							/>
							<Discord.Button
								size='sm'
								variant='destructive'
								text={messages.UNBOUND_DELETE}
								disabled={disabled}
								onPress={() => onChange(value.filter((_, at) => at !== index))}
							/>
						</View>
					}
				/>
			))}
			{full ? null : (
				<Discord.TableRow
					label={
						<Discord.TextInput
							value={draft}
							onChange={setDraft}
							onSubmitEditing={add}
							placeholder={messages.UNBOUND_SETTING_ADD_ITEM}
							editable={!disabled}
							autoCapitalize='none'
							autoCorrect={false}
							status={error ? 'error' : undefined}
							errorMessage={error}
						/>
					}
					trailing={
						<Discord.Button
							size='sm'
							variant='primary'
							text={messages.UNBOUND_SETTING_ADD}
							disabled={disabled}
							onPress={add}
						/>
					}
				/>
			)}
		</Discord.TableRowGroup>
	);
}

export default ListRow;
