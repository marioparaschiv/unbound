import { afterEach, describe, expect, test } from 'bun:test';
import type { AuditEvent } from '@unbound-app/web/bot';

import { createAuditTelemetry } from '~/lib/audit-telemetry';
import { otelEnvSchema } from '~/lib/env';

import RecordingExporter from './helpers/recording-exporter';

const EVENT: AuditEvent = {
	id: 33,
	kind: 'review.decided',
	subjectType: 'addon',
	subjectId: 'unbound.message-link-embeds',
	subjectName: 'Message Link Embeds',
	actor: { id: 'staff-1', name: 'Mario', image: null },
	data: { decision: 'approved', version: '1.0.0' },
	reason: 'Looks good.',
	createdAt: new Date('2026-10-26T00:16:49.591Z'),
};

const PRODUCTION = otelEnvSchema.parse({ NODE_ENV: 'production' });

describe('createAuditTelemetry', () => {
	let collector: ReturnType<typeof Bun.serve> | undefined;

	afterEach(async () => {
		await collector?.stop(true);
		collector = undefined;
	});

	// A stand-in OTLP/HTTP collector that records the paths it is posted to.
	function collect() {
		const paths: string[] = [];

		collector = Bun.serve({
			port: 0,
			fetch(request) {
				paths.push(new URL(request.url).pathname);

				return new Response('{}', { headers: { 'content-type': 'application/json' } });
			},
		});

		return { url: `http://127.0.0.1:${collector.port}/`, paths };
	}

	test('exports one log record per event naming who did what to which subject', async () => {
		const exporter = new RecordingExporter();
		const telemetry = createAuditTelemetry({ env: PRODUCTION, exporter });

		telemetry.emit(EVENT, 'Approved Message Link Embeds 1.0.0');
		await telemetry.shutdown();

		const [record, ...extra] = exporter.records;

		expect(extra).toHaveLength(0);
		expect(record?.body).toBe('Mario: Approved Message Link Embeds 1.0.0');
		expect(record?.hrTime).toEqual([Math.floor(EVENT.createdAt.getTime() / 1000), 591_000_000]);
		expect(record?.resource.attributes).toMatchObject({
			'service.name': 'unbound-discord-bot',
			'service.namespace': 'unbound',
			'deployment.environment.name': 'production',
		});
		expect(record?.attributes).toEqual({
			'event.name': 'unbound.audit.review.decided',
			'audit.event.id': 33,
			'audit.event.kind': 'review.decided',
			'audit.actor.id': 'staff-1',
			'audit.actor.name': 'Mario',
			'audit.subject.type': 'addon',
			'audit.subject.id': 'unbound.message-link-embeds',
			'audit.subject.name': 'Message Link Embeds',
			'audit.reason': 'Looks good.',
			'audit.data': '{"decision":"approved","version":"1.0.0"}',
		});
	});

	test('a dev bot files under its own -dev service, as telecord does', async () => {
		const exporter = new RecordingExporter();
		const env = otelEnvSchema.parse({ NODE_ENV: 'development', OTEL_SERVICE_NAME: 'bot' });
		const telemetry = createAuditTelemetry({ env, exporter });

		telemetry.emit(EVENT, 'x');
		await telemetry.shutdown();

		expect(exporter.records[0]?.resource.attributes).toMatchObject({
			'service.name': 'bot-dev',
			'deployment.environment.name': 'development',
		});
	});

	test('the startup setup leaves NODE_ENV unset, so the bot files as production', async () => {
		const saved = process.env.NODE_ENV;
		const exporter = new RecordingExporter();

		delete process.env.NODE_ENV;

		try {
			await import('~/lib/setup');
			expect(process.env.NODE_ENV).toBeUndefined();

			const env = otelEnvSchema.parse({ ...process.env });
			const telemetry = createAuditTelemetry({ env, exporter });

			telemetry.emit(EVENT, 'x');
			await telemetry.shutdown();
		} finally {
			process.env.NODE_ENV = saved;
		}

		expect(exporter.records[0]?.resource.attributes).toMatchObject({
			'service.name': 'unbound-discord-bot',
			'deployment.environment.name': 'production',
		});
	});

	test('a system action is attributed to System', async () => {
		const exporter = new RecordingExporter();
		const telemetry = createAuditTelemetry({ env: PRODUCTION, exporter });

		telemetry.emit({ ...EVENT, actor: null, reason: null }, 'Cancelled x');
		await telemetry.shutdown();

		expect(exporter.records[0]?.attributes).toMatchObject({
			'audit.actor.id': 'system',
			'audit.actor.name': 'System',
			'audit.reason': '',
		});
	});

	test('OTEL_ENABLED with OTEL_ENDPOINT posts to the collector; either alone sends nothing', async () => {
		const { url, paths } = collect();

		async function send(source: Record<string, string>) {
			const telemetry = createAuditTelemetry({ env: otelEnvSchema.parse(source) });

			telemetry.emit(EVENT, 'x');
			await telemetry.shutdown();
		}

		await send({ OTEL_ENDPOINT: url });
		await send({ OTEL_ENABLED: 'true' });
		expect(paths).toEqual([]);

		await send({ OTEL_ENABLED: 'true', OTEL_ENDPOINT: url });
		expect(paths).toEqual(['/v1/logs']);
	});
});
