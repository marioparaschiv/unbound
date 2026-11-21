import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const ALERT_SOUND_BADGE = 7;
const MARKER = 'unboundLocalNotification';
const CATEGORY = 'unbound-message';
const DELEGATE_SELECTOR =
	'userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:';

/** The action ids the plugin's notifications carry. */
export const ACTIONS = { reply: 'unbound-reply', read: 'unbound-read' } as const;

/** The words on a notification's action buttons. */
export type ActionLabels = { reply: string; send: string; placeholder: string; read: string };

/** What the user picked on one of the plugin's notifications. */
export type NotificationAction = { action: string; target: NotificationTarget; text?: string };

export type NotificationTarget = { channelId: string; guildId?: string; messageId: string };

type ObjC = NativeBridge['objc'];

function center(objc: ObjC): NativeObjectHandle {
	return objc.call(
		objc.getClass('UNUserNotificationCenter')!,
		'currentNotificationCenter',
	) as NativeObjectHandle;
}

/**
 * @description Asks for notification permission once; iOS remembers the answer.
 * @param native The plugin's native bridge.
 */
export function askPermission({ objc }: NativeBridge): void {
	const done = objc.block(
		{ returnType: 'void', args: ['bool', 'object'] },
		(() => undefined) as never,
	);

	objc.invoke(center(objc), 'requestAuthorizationWithOptions:completionHandler:', [
		ALERT_SOUND_BADGE,
		done,
	]);
}

/**
 * @description Posts a local notification at once, carrying where it leads.
 * @param native The plugin's native bridge.
 * @param text The title and body.
 * @param target The message it is about.
 */
export function postNotification(
	{ objc }: NativeBridge,
	text: { title: string; body: string },
	target: NotificationTarget,
): void {
	const content = objc.create('UNMutableNotificationContent', 'init', []) as NativeObjectHandle;

	objc.invoke(content, 'setTitle:', [text.title]);
	objc.invoke(content, 'setBody:', [text.body]);
	objc.invoke(content, 'setThreadIdentifier:', [target.channelId]);
	objc.invoke(content, 'setSound:', [
		objc.call(objc.getClass('UNNotificationSound')!, 'defaultSound'),
	]);
	objc.invoke(content, 'setUserInfo:', [{ [MARKER]: true, ...target }]);
	objc.invoke(content, 'setCategoryIdentifier:', [CATEGORY]);

	const request = objc.call(
		objc.getClass('UNNotificationRequest')!,
		'requestWithIdentifier:content:trigger:',
		notificationId(target.messageId),
		content,
		null,
	);

	objc.invoke(center(objc), 'addNotificationRequest:withCompletionHandler:', [request, null]);
}

/**
 * @description Lists which of the plugin's notifications are still in Notification Center. Tapping one removes it, so
 * the ones that disappeared while Discord was away were opened or cleared.
 * @param native The plugin's native bridge.
 * @returns The identifiers still delivered.
 */
export function deliveredIds({ objc }: NativeBridge): Promise<string[]> {
	return new Promise((resolve) => {
		const done = objc.block({ returnType: 'void', args: ['object'] }, ((
			notifications: NativeObjectHandle | null,
		) => {
			const list = notifications ? objc.array(notifications) : [];

			resolve(
				list.map((item) => {
					const request = objc.invoke(
						item as NativeObjectHandle,
						'request',
						[],
					) as NativeObjectHandle;

					return String(objc.invoke(request, 'identifier', []));
				}),
			);
		}) as never);

		objc.invoke(center(objc), 'getDeliveredNotificationsWithCompletionHandler:', [done]);
	});
}

function categoryActions(objc: ObjC, labels: ActionLabels): NativeObjectHandle[] {
	const reply = objc.call(
		objc.getClass('UNTextInputNotificationAction')!,
		'actionWithIdentifier:title:options:textInputButtonTitle:textInputPlaceholder:',
		ACTIONS.reply,
		labels.reply,
		0,
		labels.send,
		labels.placeholder,
	) as NativeObjectHandle;
	const read = objc.call(
		objc.getClass('UNNotificationAction')!,
		'actionWithIdentifier:title:options:',
		ACTIONS.read,
		labels.read,
		0,
	) as NativeObjectHandle;

	return [reply, read];
}

function otherCategories(objc: ObjC, existing: NativeObjectHandle): NativeObjectHandle[] {
	const all = objc.invoke(existing, 'allObjects', []);
	const list = (
		Array.isArray(all) ? all : objc.array(all as NativeObjectHandle)
	) as NativeObjectHandle[];

	return list.filter((item) => objc.invoke(item, 'identifier', []) !== CATEGORY);
}

/**
 * @description Adds the plugin's Reply and Mark as read buttons to its notifications, keeping Discord's own categories.
 * @param native The plugin's native bridge.
 * @param labels The button words.
 */
export function registerActions({ objc }: NativeBridge, labels: ActionLabels): void {
	const category = objc.call(
		objc.getClass('UNNotificationCategory')!,
		'categoryWithIdentifier:actions:intentIdentifiers:options:',
		CATEGORY,
		categoryActions(objc, labels),
		[],
		0,
	);
	const done = objc.block({ returnType: 'void', args: ['object'] }, ((
		existing: NativeObjectHandle | null,
	) => {
		const kept = existing ? otherCategories(objc, existing) : [];
		const all = objc.create('NSSet', 'initWithArray:', [[...kept, category]]);

		objc.invoke(center(objc), 'setNotificationCategories:', [all]);
	}) as never);

	objc.invoke(center(objc), 'getNotificationCategoriesWithCompletionHandler:', [done]);
}

type Info = Partial<NotificationTarget> & { [MARKER]?: boolean };

function readResponse(objc: ObjC, response: NativeObjectHandle): NotificationAction | undefined {
	const action = String(objc.invoke(response, 'actionIdentifier', []));
	const request = objc.invoke(
		objc.invoke(response, 'notification', []) as NativeObjectHandle,
		'request',
		[],
	) as NativeObjectHandle;
	const content = objc.invoke(request, 'content', []) as NativeObjectHandle;
	const info = objc.invoke(content, 'userInfo', []) as Info | null;

	if (!info?.[MARKER] || !info.channelId || !info.messageId) return undefined;

	const text = objc.respondsTo(response, 'userText')
		? String(objc.invoke(response, 'userText', []))
		: undefined;

	return {
		action,
		target: { channelId: info.channelId, guildId: info.guildId, messageId: info.messageId },
		text,
	};
}

/**
 * @description Calls back when the user picks an action on one of the plugin's notifications, by hooking the
 * notification center's delegate after Discord handled the response.
 * @param native The plugin's native bridge.
 * @param onAction Receives the action, the message it is about and any reply text.
 * @returns Whether the delegate could be hooked.
 */
export function listenForActions(
	{ objc }: NativeBridge,
	onAction: (picked: NotificationAction) => void,
): boolean {
	const delegate = objc.invoke(center(objc), 'delegate', []) as NativeObjectHandle | null;
	const name = delegate ? objc.className(delegate) : null;

	if (!name) return false;

	try {
		objc.hook(name, DELEGATE_SELECTOR, {
			after: ({ args }) => {
				const picked = readResponse(objc, args[1] as NativeObjectHandle);

				if (picked && picked.action !== 'com.apple.UNNotificationDefaultActionIdentifier') {
					onAction(picked);
				}
			},
		});
	} catch (error) {
		logger.warn(
			`Failed to hook ${name} ${DELEGATE_SELECTOR}, so notification actions are off:`,
			error,
		);

		return false;
	}

	return true;
}

/**
 * @description The identifier a notification for a message gets.
 * @param messageId The message.
 * @returns The identifier.
 */
export function notificationId(messageId: string): string {
	return `unbound-${messageId}`;
}
