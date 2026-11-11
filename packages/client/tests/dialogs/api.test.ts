import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';
import enUS from '@i18n/en-US.json';

import { coreI18nMock } from '../helpers/core-i18n';

type ActionButtonProps = {
	text: string;
	variant: string;
	onPress: () => void;
};

type ActionButton = ReactElement<ActionButtonProps>;

type ActionsProps = {
	children: ActionButton[];
};

type WatcherProps = {
	onClose?: () => void;
};

type ExtraContentProps = {
	children: ReactElement<WatcherProps>[];
};

type Opened = {
	key: string;
	props: {
		title: string;
		content?: string;
		extraContent: ReactElement<ExtraContentProps>;
		actions: ReactElement<ActionsProps>;
	};
};

const opened: Opened[] = [];
const dismissed: string[] = [];

mock.module('react-native', () => ({ Alert: { alert: () => undefined } }));

mock.module('~/metro/design', () => ({
	Discord: {
		AlertModal: () => null,
		AlertActionButton: () => null,
		openAlert: (key: string, element: Opened['props'] & ReactElement) =>
			void opened.push({ key, props: element.props as Opened['props'] }),
		dismissAlert: (key: string) => void dismissed.push(key),
	},
}));

mock.module('~/i18n/api', coreI18nMock);

const { alert, confirm, dismissAll, showDialog } = await import('~/dialogs/api');

function buttonsOf(dialog: Opened | undefined): ActionButton[] {
	return [dialog?.props.actions.props.children ?? []].flat();
}

// Discord unmounts the dialog's content when the backdrop or the back gesture closes it.
function unmount(dialog: Opened | undefined) {
	for (const child of dialog?.props.extraContent.props.children ?? []) {
		child?.props?.onClose?.();
	}
}

function settled<T>(promise: Promise<T>): Promise<T | 'pending'> {
	return Promise.race([
		promise,
		new Promise<'pending'>((done) => setTimeout(done, 0, 'pending')),
	]);
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

	test('confirm resolves true on the confirm button, with each key resolved', async () => {
		const yes = confirm('UNBOUND_DELETE_TITLE', {
			titleVars: { name: 'Rule' },
			body: 'UNBOUND_DELETE_BODY',
			confirm: 'UNBOUND_DELETE',
			destructive: true,
		});
		const [dialog] = opened;
		const buttons = buttonsOf(dialog);

		expect(dialog?.props).toMatchObject({
			title: 'Delete {name}? {"name":"Rule"}',
			content: enUS.UNBOUND_DELETE_BODY,
		});
		expect(buttons.map((button) => [button.props.text, button.props.variant])).toEqual([
			['Delete', 'destructive'],
			['Cancel', 'secondary'],
		]);

		buttons[0]?.props.onPress();
		unmount(dialog);
		expect(await yes).toBe(true);
	});

	test('confirm resolves false on cancel, the backdrop and a dismiss', async () => {
		const cancelled = confirm('UNBOUND_DELETE', { confirm: 'UNBOUND_DELETE' });

		buttonsOf(opened[0])[1]?.props.onPress();
		unmount(opened[0]);
		expect(await cancelled).toBe(false);

		const backdrop = confirm('UNBOUND_DELETE', { confirm: 'UNBOUND_DELETE' });

		expect(await settled(backdrop)).toBe('pending');
		unmount(opened[1]);
		expect(await backdrop).toBe(false);

		const dismissed = confirm('UNBOUND_DELETE', { confirm: 'UNBOUND_DELETE' });

		dismissAll();
		expect(await dismissed).toBe(false);
	});

	test('the confirm button keeps its result when the press unmounts the dialog first', async () => {
		const yes = confirm('UNBOUND_DELETE', { confirm: 'UNBOUND_DELETE' });

		unmount(opened[0]);
		buttonsOf(opened[0])[0]?.props.onPress();
		expect(await yes).toBe(true);
	});

	test('alert shows one OK button and resolves however it closes', async () => {
		const pressed = alert('UNBOUND_OK', { body: 'UNBOUND_DELETE_BODY' });
		const buttons = buttonsOf(opened[0]);

		expect(buttons.map((button) => button.props.text)).toEqual(['OK']);
		buttons[0]?.props.onPress();
		expect(await settled(pressed)).toBeUndefined();

		const closed = alert('UNBOUND_DEPENDENCIES_TITLE', {
			titleVars: { name: 'Rule' },
			confirm: 'UNBOUND_DELETE',
		});

		expect(buttonsOf(opened[1]).map((button) => button.props.text)).toEqual(['Delete']);
		unmount(opened[1]);
		expect(await settled(closed)).toBeUndefined();
	});
});
