import { InMemoryLogRecordExporter, type ReadableLogRecord } from '@opentelemetry/sdk-logs';

/** An in-memory exporter that keeps its records past `shutdown()`, which the stock one clears. */
export class RecordingExporter extends InMemoryLogRecordExporter {
	records: ReadableLogRecord[] = [];

	override export(...args: Parameters<InMemoryLogRecordExporter['export']>) {
		this.records.push(...args[0]);
		super.export(...args);
	}
}

export default RecordingExporter;
