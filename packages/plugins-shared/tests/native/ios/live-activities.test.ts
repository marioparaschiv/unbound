import type { NativeObjCBridge } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import {
	endLiveActivities,
	liveActivitiesAvailable,
	startLiveActivity,
} from '~/native/ios/live-activities';

function bridgeWith(activities: { id: string; name: string }[], present = true) {
	const calls: unknown[][] = [];
	const handle = Object.create(null);
	const objc = {
		getClass: () => (present ? handle : null),
		call: (_target: unknown, selector: string, ...args: unknown[]) => {
			calls.push([selector, ...args]);
			if (selector === 'isAvailable') return true;
			if (selector === 'activities') return JSON.stringify(activities);
			if (selector === 'start:') return 'activity-1';
			return true;
		},
	} as unknown as NativeObjCBridge;

	return { objc, calls };
}

describe('live activities', () => {
	test('starts, updates and ends one activity with its name', () => {
		const { objc, calls } = bridgeWith([]);
		const activity = startLiveActivity(objc, 'timer', { title: 'Break', endsAt: 1 });

		expect(activity?.id).toBe('activity-1');
		expect(JSON.parse(String(calls[0]![1]))).toEqual({
			title: 'Break',
			endsAt: 1,
			name: 'timer',
		});
		activity?.update({ title: 'Done', progress: 1 });
		activity?.end();
		expect(calls.map(([selector]) => selector)).toEqual(['start:', 'update:json:', 'end:']);
	});

	test('ends only the activities started under a name', () => {
		const { objc, calls } = bridgeWith([
			{ id: 'a', name: 'timer' },
			{ id: 'b', name: 'other' },
		]);

		expect(endLiveActivities(objc, 'timer')).toBe(1);
		expect(calls.filter(([selector]) => selector === 'end:')).toEqual([['end:', 'a']]);
	});

	test('reports nothing on an install without the extension', () => {
		const { objc } = bridgeWith([], false);

		expect(liveActivitiesAvailable(objc)).toBe(false);
		expect(startLiveActivity(objc, 'timer', { title: 'x' })).toBeUndefined();
		expect(endLiveActivities(objc, 'timer')).toBe(0);
	});
});
