import {
	BatchLogRecordProcessor,
	LoggerProvider,
	type LogRecordExporter,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { AuditEvent } from '@unbound-app/web/bot';
import { SeverityNumber } from '@opentelemetry/api';

import { createLogger } from '@unbound-app/logger';

import { otelEnvSchema, type OtelEnv } from '~/lib/env';

export type AuditTelemetry = {
	/** Records one moderation event as an OpenTelemetry log; a no-op without an exporter. */
	emit: (event: AuditEvent, summary: string) => void;
	/** Flushes the pending records and stops the exporter. */
	shutdown: () => Promise<void>;
};

export type AuditTelemetryOptions = {
	/** The telemetry variables; `process.env` by default. */
	env?: OtelEnv;
	/** Replaces the OTLP exporter, for tests; it exports even with `OTEL_ENABLED` off. */
	exporter?: LogRecordExporter;
};

const logger = createLogger('Bot', 'Telemetry');

const DISABLED: AuditTelemetry = { emit: () => void 0, shutdown: () => Promise.resolve() };

/**
 * @description Names the service as telecord does, so a dev bot files apart from production in SigNoz.
 * @param env The telemetry variables.
 * @returns `OTEL_SERVICE_NAME`, with `-dev` appended under `NODE_ENV=development`.
 */
export function serviceName(env: OtelEnv): string {
	return env.NODE_ENV === 'development' ? `${env.OTEL_SERVICE_NAME}-dev` : env.OTEL_SERVICE_NAME;
}

function exporterFor(env: OtelEnv): LogRecordExporter | undefined {
	if (!env.OTEL_ENABLED) return;

	if (!env.OTEL_ENDPOINT) {
		logger.warn(
			'OTEL_ENABLED is set without OTEL_ENDPOINT, so the audit trail is not exported.',
		);

		return;
	}

	return new OTLPLogExporter({ url: `${env.OTEL_ENDPOINT}/v1/logs` });
}

/**
 * @description Creates the exporter of the moderation audit trail to OpenTelemetry, one log record per event.
 * @param options The telemetry variables and, for tests, an exporter.
 * @returns The telemetry; a no-op unless `OTEL_ENABLED` and `OTEL_ENDPOINT` are set or an exporter is given.
 */
export function createAuditTelemetry(options: AuditTelemetryOptions = {}): AuditTelemetry {
	const { env = otelEnvSchema.parse(process.env), exporter = exporterFor(env) } = options;

	if (!exporter) {
		return DISABLED;
	}

	const provider = new LoggerProvider({
		resource: resourceFromAttributes({
			'service.name': serviceName(env),
			'service.namespace': 'unbound',
			'service.version': process.env.npm_package_version ?? 'unknown',
			'deployment.environment.name': env.NODE_ENV,
		}),
		processors: [new BatchLogRecordProcessor({ exporter })],
	});
	const audit = provider.getLogger('unbound.audit');

	return {
		emit(event, summary) {
			audit.emit({
				timestamp: event.createdAt,
				severityNumber: SeverityNumber.INFO,
				severityText: 'INFO',
				body: `${event.actor?.name ?? 'System'}: ${summary}`,
				attributes: {
					'event.name': `unbound.audit.${event.kind}`,
					'audit.event.id': event.id,
					'audit.event.kind': event.kind,
					'audit.actor.id': event.actor?.id ?? 'system',
					'audit.actor.name': event.actor?.name ?? 'System',
					'audit.subject.type': event.subjectType,
					'audit.subject.id': event.subjectId,
					'audit.subject.name': event.subjectName ?? event.subjectId,
					'audit.reason': event.reason ?? '',
					'audit.data': JSON.stringify(event.data) ?? 'null',
				},
			});
		},
		shutdown: () => provider.shutdown(),
	};
}

export const auditTelemetry = createAuditTelemetry();

export default { serviceName, createAuditTelemetry, auditTelemetry };
