import type { ReactElement } from 'react';

import { confirmText } from '~/dialogs/feedback';
import { format, messages } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { showDialog } from '~/dialogs/api';
import { icons } from '~/assets/api';

import { openInputDialog } from './input-dialog';
import useStyles from './list-row.style';

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
	/** Dims the row and ignores input. Defaults to false. */
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
 * @description A titled, editable list of strings: each row moves up or down, or is deleted after a confirmation; the
 * delete button stands apart from the arrows so it is hard to hit by mistake. An Add row opens
 * Discord's input dialog for a new one.
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
	const styles = useStyles();
	const full = value.length >= maxItems;

	function check(text: string) {
		const trimmed = text.trim();

		if (!trimmed) {
			return undefined;
		}

		return (
			validate?.(trimmed) ??
			(value.includes(trimmed) ? messages.UNBOUND_SETTING_DUPLICATE : undefined)
		);
	}

	function add(text: string) {
		const trimmed = text.trim();

		if (trimmed) {
			onChange([...value, trimmed]);
		}
	}

	async function remove(index: number) {
		const confirmed = await confirmText(showDialog, {
			title: format('UNBOUND_DELETE_TITLE', { name: value[index] ?? '' }),
			confirm: messages.UNBOUND_DELETE,
			cancel: messages.UNBOUND_CANCEL,
			destructive: true,
		});

		if (confirmed) {
			onChange(value.filter((_, at) => at !== index));
		}
	}

	function openAdd() {
		openInputDialog({
			label: title,
			subLabel: description,
			value: '',
			placeholder: messages.UNBOUND_SETTING_ADD_ITEM,
			variant: 'text',
			keyboardType: 'default',
			validate: check,
			onChange: add,
		});
	}

	return (
		<Discord.TableRowGroup title={title} description={description}>
			{value.map((item, index) => (
				<Discord.TableRow
					key={item}
					label={item}
					disabled={disabled}
					trailing={
						<Discord.Stack
							direction='horizontal'
							spacing={16}
							align='center'
							style={styles.trailing}
						>
							<Discord.Stack
								direction='horizontal'
								spacing={8}
								align='center'
								style={styles.trailing}
							>
								<Discord.IconButton
									size='sm'
									variant='secondary'
									pillStyle={styles.round}
									icon={icons['ArrowSmallUpIcon'] ?? 0}
									accessibilityLabel={messages.UNBOUND_MOVE_UP}
									disabled={disabled || index === 0}
									onPress={() => onChange(moved(value, index, index - 1))}
								/>
								<Discord.IconButton
									size='sm'
									variant='secondary'
									pillStyle={styles.round}
									icon={icons['ArrowSmallDownIcon'] ?? 0}
									accessibilityLabel={messages.UNBOUND_MOVE_DOWN}
									disabled={disabled || index === value.length - 1}
									onPress={() => onChange(moved(value, index, index + 1))}
								/>
							</Discord.Stack>
							<Discord.IconButton
								size='sm'
								variant='destructive'
								icon={icons['TrashIcon'] ?? 0}
								accessibilityLabel={messages.UNBOUND_DELETE}
								disabled={disabled}
								onPress={() => void remove(index)}
							/>
						</Discord.Stack>
					}
				/>
			))}
			{full ? null : (
				<Discord.TableRow
					label={messages.UNBOUND_SETTING_ADD_ITEM}
					icon={<Discord.TableRowIcon source={icons['PlusSmallIcon'] ?? 0} />}
					disabled={disabled}
					onPress={openAdd}
				/>
			)}
		</Discord.TableRowGroup>
	);
}

export default ListRow;
