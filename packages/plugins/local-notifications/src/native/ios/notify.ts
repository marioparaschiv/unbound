import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

const ALERT_SOUND_BADGE = 7;
const MARKER = 'unboundLocalNotification';

/** Where a notification leads when tapped. */
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

/**
 * @description The identifier a notification for a message gets.
 * @param messageId The message.
 * @returns The identifier.
 */
export function notificationId(messageId: string): string {
	return `unbound-${messageId}`;
}
