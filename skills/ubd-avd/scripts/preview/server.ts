// Relays WebRTC signalling and tab input between index.html and the emulator's gRPC; video flows peer to peer.
import { readdirSync, readFileSync } from 'node:fs';
import * as protoLoader from '@grpc/proto-loader';
import { Type, type Static } from 'typebox';
import type { ServerWebSocket } from 'bun';
import * as grpc from '@grpc/grpc-js';
import { Value } from 'typebox/value';
import { join } from 'node:path';

const sdk = process.env.ANDROID_HOME;
const grpcPort = process.env.AVD_GRPC_PORT ?? '8554';
const previewPort = Number(process.env.AVD_PREVIEW_PORT ?? 8560);
const serial = process.env.AVD_SERIAL ?? 'emulator-5554';
// The nav buttons go through adb, since gRPC key events reach Android only on an AVD with hw.keyboard=yes.
const navKeys: Record<string, string> = {
	back: 'KEYCODE_BACK',
	home: 'KEYCODE_HOME',
	recents: 'KEYCODE_APP_SWITCH',
};

if (!sdk) {
	throw new Error('ANDROID_HOME is unset; start the preview through up.sh');
}

const adb = join(sdk, 'platform-tools/adb');

type Empty = Record<string, never>;
type Callback<T> = (error: grpc.ServiceError | null, value: T) => void;
type ConfigEntry = { key: string; value: string };
type ConfigEntries = { entry: ConfigEntry[] };
type EmulatorStatus = { hardwareConfig: ConfigEntries };
type RtcId = { guid: string };
type JsepMessage = { id: RtcId; message: string };
type EmulatorMouse = { x: number; y: number; buttons: number; display: number };
type EmulatorKey = { eventType: KeyEventType; key: string };
type EmulatorInput = { mouse_event: EmulatorMouse } | { key_event: EmulatorKey };
type KeyEventType = 'keydown' | 'keyup';

type ControllerClient = {
	getStatus(request: Empty, metadata: grpc.Metadata, callback: Callback<EmulatorStatus>): void;
	streamInputEvent(
		metadata: grpc.Metadata,
		callback: Callback<Empty>,
	): grpc.ClientWritableStream<EmulatorInput>;
};

type RtcClient = {
	requestRtcStream(request: Empty, metadata: grpc.Metadata, callback: Callback<RtcId>): void;
	receiveJsepMessages(id: RtcId, metadata: grpc.Metadata): grpc.ClientReadableStream<JsepMessage>;
	sendJsepMessage(message: JsepMessage, metadata: grpc.Metadata, callback: Callback<Empty>): void;
};

type ClientConstructor<T> = new (address: string, credentials: grpc.ChannelCredentials) => T;
type ControlPackage = {
	EmulatorController: ClientConstructor<ControllerClient>;
	Rtc: ClientConstructor<RtcClient>;
};
type EmulationPackage = { control: ControlPackage };
type AndroidPackage = { emulation: EmulationPackage };
type EmulatorProtos = { android: AndroidPackage };

// The JSEP signals the emulator and the tab trade: an SDP, an ICE candidate, or a goodbye.
const jsepSignalSchema = Type.Object({
	type: Type.Optional(Type.String()),
	sdp: Type.Optional(Type.String()),
	candidate: Type.Optional(Type.String()),
	sdpMid: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	sdpMLineIndex: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
	usernameFragment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	bye: Type.Optional(Type.String()),
});

// What index.html sends: signalling, pointer input in device pixels, key events, nav buttons, and repaint requests.
const tabMessageSchema = Type.Union([
	Type.Object({ type: Type.Literal('jsep'), message: jsepSignalSchema }),
	Type.Object({
		type: Type.Literal('mouse'),
		x: Type.Integer(),
		y: Type.Integer(),
		buttons: Type.Integer(),
	}),
	Type.Object({
		type: Type.Literal('key'),
		event: Type.Union([Type.Literal('keydown'), Type.Literal('keyup')]),
		key: Type.String(),
	}),
	Type.Object({ type: Type.Literal('nav'), key: Type.String() }),
	Type.Object({ type: Type.Literal('repaint') }),
]);

type JsepSignal = Static<typeof jsepSignalSchema>;
type TabMessage = Static<typeof tabMessageSchema>;

type ServerMessage =
	| { type: 'error'; text: string }
	| { type: 'display'; width: number; height: number }
	| { type: 'jsep'; message: string };

type Emulator = { controller: ControllerClient; rtc: RtcClient; metadata: grpc.Metadata };
type Session = {
	emulator: Emulator;
	guid?: string;
	calls: grpc.Call[];
	input?: grpc.ClientWritableStream<EmulatorInput>;
};

const definition = protoLoader.loadSync(['emulator_controller.proto', 'rtc_service.proto'], {
	includeDirs: [join(sdk, 'emulator/lib')],
	keepCase: true,
	longs: Number,
	enums: String,
	defaults: true,
});

// UNKNOWN: walks grpc-js's runtime-built package object, whose shape only isEmulatorProtos establishes.
function child(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

// grpc-js builds the service clients from the .proto files at runtime; this checks both clients loaded, and the
// method shapes declared above follow emulator_controller.proto and rtc_service.proto.
function isEmulatorProtos(value: unknown): value is EmulatorProtos {
	const services = child(child(child(value, 'android'), 'emulation'), 'control');

	return (
		typeof child(services, 'EmulatorController') === 'function' &&
		typeof child(services, 'Rtc') === 'function'
	);
}

const protos: unknown = grpc.loadPackageDefinition(definition);

if (!isEmulatorProtos(protos)) {
	throw new Error(
		`The emulator's .proto files in ${sdk}/emulator/lib define no EmulatorController or Rtc`,
	);
}

const control = protos.android.emulation.control;
const page = join(import.meta.dir, 'index.html');

// Reads the emulator's discovery file on every connection, since a restarted emulator gets a new token.
function connect(): Emulator | undefined {
	// env.sh resolves the platform's folder (Linux and macOS differ) and up.sh passes it in.
	const directory =
		process.env.AVD_DISCOVERY_DIR ??
		join(process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.()}`, 'avd/running');
	let files: string[] = [];

	try {
		files = readdirSync(directory).filter((name) => /^pid_\d+\.ini$/.test(name));
	} catch {
		// No emulator has ever run in this login session, so the directory does not exist yet.
	}

	for (const file of files) {
		const entries = readFileSync(join(directory, file), 'utf8')
			.split('\n')
			.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]);
		const ini = Object.fromEntries(entries);

		if (ini['grpc.port'] !== grpcPort) {
			continue;
		}

		const address = `127.0.0.1:${grpcPort}`;
		const credentials = grpc.credentials.createInsecure();
		const metadata = new grpc.Metadata();

		metadata.add('authorization', `Bearer ${ini['grpc.token']}`);

		return {
			controller: new control.EmulatorController(address, credentials),
			rtc: new control.Rtc(address, credentials),
			metadata,
		};
	}

	return undefined;
}

function send(socket: ServerWebSocket<Session>, message: ServerMessage) {
	socket.send(JSON.stringify(message));
}

// The display size in device pixels, which input coordinates use, whatever size the video arrives at.
function sendDisplay(socket: ServerWebSocket<Session>) {
	const { controller, metadata } = socket.data.emulator;

	controller.getStatus({}, metadata, (error, status) => {
		if (error) {
			send(socket, {
				type: 'error',
				text: `Failed to read the display size: ${error.message}`,
			});

			return;
		}

		const config = new Map(
			status.hardwareConfig.entry.map((entry) => [entry.key, entry.value]),
		);

		send(socket, {
			type: 'display',
			width: Number(config.get('hw.lcd.width')),
			height: Number(config.get('hw.lcd.height')),
		});
	});
}

function startStream(socket: ServerWebSocket<Session>) {
	const session = socket.data;
	const { controller, rtc, metadata } = session.emulator;
	const input = controller.streamInputEvent(metadata, () => {
		// The stream ends when the tab closes; failures surface on the RTC stream instead.
	});

	session.input = input;
	session.calls.push(input);

	rtc.requestRtcStream({}, metadata, (error, id) => {
		if (error) {
			send(socket, {
				type: 'error',
				text: `Failed to start the WebRTC stream: ${error.message}`,
			});
			socket.close();

			return;
		}

		session.guid = id.guid;

		const messages = rtc.receiveJsepMessages(id, metadata);

		session.calls.push(messages);
		messages.on('data', (message: JsepMessage) =>
			send(socket, { type: 'jsep', message: message.message }),
		);
		// An emulator that stops ends the stream; closing the socket makes the tab reconnect to the next one.
		messages.on('end', () => socket.close());
		messages.on('error', (streamError: grpc.ServiceError) => {
			if (streamError.code === grpc.status.CANCELLED) {
				return;
			}

			send(socket, {
				type: 'error',
				text: `The emulator closed the stream: ${streamError.message}`,
			});
			socket.close();
		});
	});
}

function sendJsep(session: Session, signal: JsepSignal) {
	if (!session.guid) {
		return;
	}

	const { rtc, metadata } = session.emulator;
	const message = { id: { guid: session.guid }, message: JSON.stringify(signal) };

	rtc.sendJsepMessage(message, metadata, () => {
		// A failed signal shows up as a stalled connection in the tab's status line.
	});
}

// The emulator sends frames only on screen change, so a new viewer of a still screen stays black.
// SurfaceFlinger code 1004 redraws it unchanged; it needs root, hence the su fallback.
const repaint =
	'if [ "$(id -u)" = 0 ]; then service call SurfaceFlinger 1004; else su -c "service call SurfaceFlinger 1004"; fi';

// Mouse and key input arrive in device pixels and go through gRPC; nav buttons and repaints go through adb.
function forwardInput(session: Session, input: TabMessage) {
	if (input.type === 'repaint') {
		Bun.spawn([adb, '-s', serial, 'shell', repaint]);
	} else if (input.type === 'nav') {
		const keycode = navKeys[input.key];

		if (keycode) {
			Bun.spawn([adb, '-s', serial, 'shell', 'input', 'keyevent', keycode]);
		}
	} else if (input.type === 'mouse') {
		const { x, y, buttons } = input;

		session.input?.write({ mouse_event: { x, y, buttons, display: 0 } });
	} else if (input.type === 'key') {
		session.input?.write({ key_event: { eventType: input.event, key: input.key } });
	}
}

Bun.serve<Session, undefined>({
	hostname: '127.0.0.1',
	port: previewPort,
	fetch(request, server) {
		const { pathname } = new URL(request.url);

		if (pathname !== '/ws') {
			return new Response(Bun.file(page));
		}

		const emulator = connect();

		if (!emulator) {
			return new Response(`No emulator serves gRPC on port ${grpcPort}; run up.sh emu.`, {
				status: 503,
			});
		}

		const upgraded = server.upgrade(request, { data: { emulator, calls: [] } });

		return upgraded ? undefined : new Response('Upgrade failed', { status: 400 });
	},
	websocket: {
		open(socket) {
			sendDisplay(socket);
			startStream(socket);
		},
		message(socket, raw) {
			let message: unknown;

			try {
				message = JSON.parse(String(raw));
			} catch {
				// Not JSON, so not from index.html; drop it like any other unknown message.
				return;
			}

			if (!Value.Check(tabMessageSchema, message)) {
				return;
			}

			if (message.type === 'jsep') {
				sendJsep(socket.data, message.message);
			} else {
				forwardInput(socket.data, message);
			}
		},
		close(socket) {
			sendJsep(socket.data, { bye: 'please' });

			for (const call of socket.data.calls) {
				call.cancel();
			}
		},
	},
});

console.log(`AVD preview on http://127.0.0.1:${previewPort}, emulator gRPC on ${grpcPort}`);
