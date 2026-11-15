import { describe, expect, test } from 'bun:test';

import { findTargetProblem, type TargetCheck } from '~/lib/mod-guard';

const CHECK: TargetCheck = {
	moderatorId: 'mod',
	targetId: 'target',
	botId: 'bot',
	ownerId: 'owner',
	moderatorPosition: 10,
	targetPosition: 5,
	botPosition: 20,
};

describe('findTargetProblem', () => {
	test('allows a target below the moderator and the bot', () => {
		expect(findTargetProblem(CHECK)).toBeUndefined();
	});

	test('refuses the moderator, the bot and the owner', () => {
		expect(findTargetProblem({ ...CHECK, targetId: 'mod' })).toContain('yourself');
		expect(findTargetProblem({ ...CHECK, targetId: 'bot' })).toContain('myself');
		expect(findTargetProblem({ ...CHECK, targetId: 'owner' })).toContain('owner');
	});

	test('refuses a target at or above the moderator, unless the moderator owns the server', () => {
		expect(findTargetProblem({ ...CHECK, targetPosition: 10 })).toContain('below yours');
		expect(
			findTargetProblem({ ...CHECK, moderatorId: 'owner', targetPosition: 10 }),
		).toBeUndefined();
	});

	test('refuses a target at or above the bot', () => {
		expect(
			findTargetProblem({ ...CHECK, moderatorPosition: 30, targetPosition: 20 }),
		).toContain('below mine');
	});

	test('checks no roles for a user outside the server', () => {
		expect(
			findTargetProblem({ ...CHECK, targetPosition: undefined, moderatorPosition: 0 }),
		).toBeUndefined();
	});
});
