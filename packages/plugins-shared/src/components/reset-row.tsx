import { Discord } from '@unbound-app/api/metro/components';

type ResetRowProps = {
	onReset: () => void;
};

/**
 * @description A settings group with one row that puts every setting on the page back to its default.
 * @param props What resetting does.
 * @returns The group.
 */
function ResetRow({ onReset }: ResetRowProps) {
	return (
		<Discord.TableRowGroup>
			<Discord.TableRow label='Reset all to defaults' variant='danger' onPress={onReset} />
		</Discord.TableRowGroup>
	);
}

export default ResetRow;
