import type { NativeObjCBridge } from '@unbound-app/api/native';

export type LiveActivityContent = {
	title: string;
	subtitle?: string;
	symbol?: string;
	tint?: string;
	progress?: number;
	endsAt?: number;
};

export type LiveActivity = {
	id: string;
	update(content: LiveActivityContent): boolean;
	end(): boolean;
};

type ActivityBridge = Pick<NativeObjCBridge, 'getClass' | 'call'>;

type ListedActivity = { id: string; name: string };

const BRIDGE_CLASS = 'UnboundLiveActivities';

function bridgeOf(objc: ActivityBridge) {
	return objc.getClass(BRIDGE_CLASS) ?? undefined;
}

function listed(objc: ActivityBridge): ListedActivity[] {
	const bridge = bridgeOf(objc);
	const text = bridge ? objc.call(bridge, 'activities') : undefined;

	try {
		const parsed: ListedActivity[] = typeof text === 'string' ? JSON.parse(text) : [];

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/**
 * @description Checks that this install carries Unbound's Live Activities extension and the user allows Live Activities.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns Whether a Live Activity can start.
 */
export function liveActivitiesAvailable(objc: ActivityBridge): boolean {
	const bridge = bridgeOf(objc);

	return Boolean(bridge && objc.call(bridge, 'isAvailable'));
}

/**
 * @description Starts a Live Activity on the Lock Screen and in the Dynamic Island, with a title, subtitle, SF Symbol, tint and either a progress bar or a countdown to `endsAt`.
 * @param objc The Objective-C bridge from `context.native`.
 * @param name The plugin's name for its activities, which {@link endLiveActivities} ends by.
 * @param content What the activity shows.
 * @returns The running activity, or `undefined` when this install cannot start one.
 */
export function startLiveActivity(
	objc: ActivityBridge,
	name: string,
	content: LiveActivityContent,
): LiveActivity | undefined {
	const bridge = bridgeOf(objc);
	const id = bridge
		? objc.call(bridge, 'start:', JSON.stringify({ ...content, name }))
		: undefined;

	if (!bridge || typeof id !== 'string') return undefined;

	return {
		id,
		update: (next) => Boolean(objc.call(bridge, 'update:json:', id, JSON.stringify(next))),
		end: () => Boolean(objc.call(bridge, 'end:', id)),
	};
}

/**
 * @description Ends every Live Activity started under a name, such as the ones a plugin left running before it reloaded.
 * @param objc The Objective-C bridge from `context.native`.
 * @param name The name the activities were started with.
 * @returns How many activities ended.
 */
export function endLiveActivities(objc: ActivityBridge, name: string): number {
	const bridge = bridgeOf(objc);

	if (!bridge) return 0;

	return listed(objc).filter(
		(activity) => activity.name === name && Boolean(objc.call(bridge, 'end:', activity.id)),
	).length;
}
