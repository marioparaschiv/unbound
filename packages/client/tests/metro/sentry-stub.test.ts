import { describe, expect, test } from 'bun:test';
import React from 'react';

import { createSentryStub } from '~/metro/sentry-stub';

describe('the Sentry stub', () => {
	test('answers the calls Discord makes without starting Sentry', async () => {
		const sentry = createSentryStub();
		const scope = sentry.getCurrentScope();

		expect(sentry.__esModule).toBe(true);
		expect(sentry.init({ dsn: 'x' })).toBeUndefined();
		expect(sentry.captureException(new Error('x'))).toBe('');
		expect(sentry.getClient()).toBeUndefined();
		expect(scope.setTag('a', 'b')).toBeUndefined();
		expect(scope.then).toBeUndefined();
		expect(await sentry.flush()).toBe(true);
		expect(await sentry.crashedLastRun()).toBe(false);
		expect(sentry.reactNavigationIntegration().registerNavigationContainer({})).toBeUndefined();

		const Component = () => null;

		expect(sentry.withProfiler(Component)).toBe(Component);
	});

	test('runs the withScope callback with a scope', () => {
		const sentry = createSentryStub();
		let received: MetroExport;

		sentry.withScope((scope: MetroExport) => {
			received = scope;
		});

		expect(received).toBe(sentry.getCurrentScope());
	});

	test('builds an ErrorBoundary that renders children, then its fallback after an error', () => {
		globalThis.React = React;

		const { ErrorBoundary } = createSentryStub();
		const errors: Error[] = [];
		const boundary = new ErrorBoundary({
			children: 'content',
			fallback: ({ error }: { error: Error }) => error.message,
			onError: (error: Error) => void errors.push(error),
		});

		expect(boundary.render()).toBe('content');

		const error = new Error('broke');

		boundary.state = ErrorBoundary.getDerivedStateFromError(error);
		boundary.componentDidCatch(error, { componentStack: '' });

		expect(boundary.render()).toBe('broke');
		expect(errors).toEqual([error]);
		expect(createSentryStub().ErrorBoundary).toBe(ErrorBoundary);
	});
});
