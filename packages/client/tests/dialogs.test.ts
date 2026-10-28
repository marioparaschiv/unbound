import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';

type ActionButtonProps = {
	text: string;
	variant: string;
	onPress: () => void;
};

type ActionButton = ReactElement<ActionButtonProps>;

type ActionsProps = {
	children: ActionButton[];
};

type Opened = {
	key: string;
	props: {
		title: string;
		content?: string;
		actions: ReactElement<ActionsProps>;
	};
};

const opened: Opened[] = [];
const dismissed: string[] = [];

mock.module('react-native', () => ({ Alert: { alert: () => undefined } }));

mock.module('~/api/metro/design', () => ({
	Discord: {
		AlertModal: () => null,
		AlertActionButton: () => null,
		openAlert: (key: string, element: Opened['props'] & ReactElement) =>
			void opened.push({ key, props: element.props as Opened['props'] }),
		dismissAlert: (key: string) => void dismissed.push(key),
	},
}));

const { confirm, dismissAll, showDialog } = await import('~/api/dialogs');

function buttonsOf(dialog: Opened | undefined): ActionButton[] {
	return [dialog?.props.actions.props.children ?? []].flat();
}

beforeEach(() => {
	opened.length = 0;
	dismissed.length = 0;
});

describe('dialogs', () => {
	test("opens Discord's alert with the buttons in order and the cancel button last", () => {
		const presses: string[] = [];
		const handle = showDialog({
			title: 'Delete?',
			body: 'Gone for good.',
			buttons: [
				{ label: 'Delete', variant: 'destructive', onPress: () => presses.push('delete') },
			],
			cancel: 'Keep',
			onCancel: () => presses.push('cancel'),
		});
		const [dialog] = opened;
		const buttons = buttonsOf(dialog);

		expect(dialog?.key).toBe(handle.key);
		expect(handle.key).toMatch(/^unbound-dialog-/);
		expect(dialog?.props).toMatchObject({ title: 'Delete?', content: 'Gone for good.' });
		expect(buttons.map((button) => [button.props.text, button.props.variant])).toEqual([
			['Delete', 'destructive'],
			['Keep', 'secondary'],
		]);

		buttons[1]?.props.onPress();
		expect(presses).toEqual(['cancel']);
	});

	test('gives every dialog its own key and closes the ones still open', () => {
		const first = showDialog({ title: 'One' });
		const second = showDialog({ title: 'Two', cancel: true });

		expect(first.key).not.toBe(second.key);

		buttonsOf(opened[1])[0]?.props.onPress();
		dismissAll();

		expect(dismissed).toEqual([first.key]);
	});

	test('confirm resolves with the button the user pressed', async () => {
		const yes = confirm({ title: 'Install?', confirmLabel: 'Install' });

		buttonsOf(opened[0])[0]?.props.onPress();
		expect(await yes).toBe(true);

		const no = confirm({ title: 'Install?', confirmLabel: 'Install', destructive: true });
		const buttons = buttonsOf(opened[1]);

		expect(buttons[0]?.props.variant).toBe('destructive');
		buttons[1]?.props.onPress();
		expect(await no).toBe(false);
	});
});
