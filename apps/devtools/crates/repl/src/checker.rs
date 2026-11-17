//! A language-server client for tsrs, which runs on threads in this process: requests and replies
//! cross two in-memory pipes as ordinary LSP frames, so no binary ships or starts beside the app.
//! Calls block until the server answers; the UI makes them on a background thread.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, PipeWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use anyhow::{Context as _, anyhow};
use lsp_types::{
	CompletionResponse, CompletionTextEdit, Diagnostic, Hover, NumberOrString, Position,
	SignatureHelp,
};
use parking_lot::Mutex;
use serde_json::{Value, json};

use crate::position::{range_from_lsp, to_lsp};
use crate::project::{self, BUFFER, HISTORY, RESULTS, SCRIPTS};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// Errors the console's own rewriting causes, not the user: re-running `const x` redeclares it in
/// the history, though on device it runs as a `var`.
/// Top-level `await` is fine too: the console runs such an entry in an async arrow, though tsrs
/// checks it as a script.
const IGNORED_CODES: [i64; 7] = [2451, 2300, 1308, 1375, 1378, 1431, 1432];

#[derive(Default)]
struct Document {
	version: i32,
	text: String,
}

struct Inner {
	root: PathBuf,
	writer: Mutex<PipeWriter>,
	pending: Mutex<HashMap<i64, Sender<Value>>>,
	next_id: AtomicI64,
	documents: Mutex<HashMap<&'static str, Document>>,
	/// Held from syncing the buffer until its answer arrives, so a concurrent query with other
	/// text can't swap the buffer in between.
	query: Mutex<()>,
}

/// The console's TypeScript checker: completions, hovers and errors for the buffer, with every
/// earlier entry and result in scope.
#[derive(Clone)]
pub struct Checker {
	inner: Arc<Inner>,
}

/// `file://` URI of a path, with `/` separators and a leading `/` before a Windows drive.
fn file_uri(path: &Path) -> String {
	let text = path.to_string_lossy().replace('\\', "/");
	let text = if text.starts_with('/') {
		text
	} else {
		format!("/{text}")
	};
	let mut uri = String::from("file://");
	for byte in text.bytes() {
		match byte {
			b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'/' | b'-' | b'_' | b'.' | b'~' | b':' => {
				uri.push(byte as char);
			}
			_ => uri.push_str(&format!("%{byte:02X}")),
		}
	}
	uri
}

fn write_frame(writer: &mut impl Write, message: &Value) -> std::io::Result<()> {
	let body = message.to_string();
	write!(writer, "Content-Length: {}\r\n\r\n{body}", body.len())?;
	writer.flush()
}

/// The next frame, or `None` once the server's side of the pipe closes.
fn read_frame(reader: &mut impl BufRead) -> Option<Value> {
	let mut length = None;
	loop {
		let mut line = String::new();
		if reader.read_line(&mut line).ok()? == 0 {
			return None;
		}
		let line = line.trim();
		if line.is_empty() {
			break;
		}
		if let Some(value) = line.strip_prefix("Content-Length:") {
			length = value.trim().parse().ok();
		}
	}
	let mut body = vec![0; length?];
	reader.read_exact(&mut body).ok()?;
	serde_json::from_slice(&body).ok()
}

/// What the client answers to the server's own requests: no settings, and acknowledgements.
fn answer(method: &str, params: &Value) -> Value {
	match method {
		"workspace/configuration" => {
			let items = params["items"].as_array().map_or(0, Vec::len);
			Value::Array(vec![Value::Null; items])
		}
		_ => Value::Null,
	}
}

impl Checker {
	/// Unpacks the project, starts the server and completes the LSP handshake. Takes about a
	/// second; call it off the UI thread.
	pub fn start() -> anyhow::Result<Self> {
		let root = project::prepare().context("Failed to unpack the console's type project")?;
		let (server_in, client_out) = std::io::pipe()?;
		let (client_in, server_out) = std::io::pipe()?;
		let server = tsrs_lsp::new_server(tsrs_lsp::ServerOptions {
			in_: tsrs_lsp::to_reader(server_in),
			out: tsrs_lsp::to_writer(server_out),
			err: Box::new(std::io::sink()),
			cwd: root.to_string_lossy().into_owned(),
			fs: Some(Arc::new(tsrs_vfs::bundled::wrap_fs(tsrs_vfs::osvfs::fs()))),
			default_library_path: tsrs_vfs::bundled::default_lib_path(),
			typings_location: String::new(),
			parse_cache: None,
			npm_install: None,
			spawn: None,
			progress_delay: Duration::ZERO,
			set_parent_process_id: None,
		});
		std::thread::Builder::new()
			.name("console-tsrs".into())
			.spawn(move || {
				if let Err(error) = server.run(&tsrs_core::context::Context::background()) {
					tracing::warn!("The console's type checker stopped: {}", error.message);
				}
			})?;
		let checker = Self {
			inner: Arc::new(Inner {
				root,
				writer: Mutex::new(client_out),
				pending: Mutex::new(HashMap::new()),
				next_id: AtomicI64::new(1),
				documents: Mutex::new(HashMap::new()),
				query: Mutex::new(()),
			}),
		};
		checker.spawn_reader(client_in)?;
		checker.initialize()?;

		Ok(checker)
	}

	fn spawn_reader(&self, pipe: impl Read + Send + 'static) -> anyhow::Result<()> {
		let inner = Arc::downgrade(&self.inner);
		std::thread::Builder::new()
			.name("console-tsrs-reader".into())
			.spawn(move || {
				let mut reader = BufReader::new(pipe);
				while let Some(message) = read_frame(&mut reader) {
					let Some(inner) = inner.upgrade() else {
						return;
					};
					let checker = Checker { inner };
					checker.receive(message);
				}
			})?;

		Ok(())
	}

	fn receive(&self, message: Value) {
		let id = message.get("id").cloned();
		match (message.get("method").and_then(Value::as_str), id) {
			(Some(method), Some(id)) => {
				let result = answer(method, &message["params"]);
				self.send(&json!({ "jsonrpc": "2.0", "id": id, "result": result }));
			}
			(None, Some(id)) => {
				let sender = id
					.as_i64()
					.and_then(|id| self.inner.pending.lock().remove(&id));
				if let Some(sender) = sender {
					let _ = sender.send(message);
				}
			}
			// Notifications: pushed diagnostics and logs. The console pulls diagnostics instead.
			_ => {}
		}
	}

	fn send(&self, message: &Value) {
		if let Err(error) = write_frame(&mut *self.inner.writer.lock(), message) {
			tracing::warn!("Failed to write to the console's type checker: {error}");
		}
	}

	fn notify(&self, method: &str, params: Value) {
		self.send(&json!({ "jsonrpc": "2.0", "method": method, "params": params }));
	}

	fn request(&self, method: &str, params: Value) -> anyhow::Result<Value> {
		let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
		let (sender, receiver) = mpsc::channel();
		self.inner.pending.lock().insert(id, sender);
		self.send(&json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }));
		let reply = receiver.recv_timeout(REQUEST_TIMEOUT);
		self.inner.pending.lock().remove(&id);
		let mut reply = reply.map_err(|_| anyhow!("Timed out on {method}"))?;
		if let Some(error) = reply.get("error") {
			return Err(anyhow!("Failed to {method}: {}", error["message"]));
		}

		Ok(reply["result"].take())
	}

	fn uri(&self, script: &str) -> String {
		file_uri(&self.inner.root.join(script))
	}

	fn initialize(&self) -> anyhow::Result<()> {
		self.request(
			"initialize",
			json!({
				"processId": null,
				"rootUri": file_uri(&self.inner.root),
				"capabilities": {
					"textDocument": {
						"completion": { "completionItem": { "snippetSupport": false, "documentationFormat": ["markdown", "plaintext"] } },
						"hover": { "contentFormat": ["markdown", "plaintext"] },
						"signatureHelp": { "signatureInformation": { "documentationFormat": ["markdown", "plaintext"] } },
						"diagnostic": {},
					},
				},
			}),
		)?;
		self.notify("initialized", json!({}));
		let mut documents = self.inner.documents.lock();
		for script in SCRIPTS {
			self.notify(
				"textDocument/didOpen",
				json!({ "textDocument": { "uri": self.uri(script), "languageId": "typescript", "version": 1, "text": "" } }),
			);
			documents.insert(
				script,
				Document {
					version: 1,
					text: String::new(),
				},
			);
		}

		Ok(())
	}

	/// Sends `text` as the script's new contents when it changed.
	fn sync(&self, script: &'static str, text: &str) {
		let mut documents = self.inner.documents.lock();
		let document = documents.entry(script).or_default();
		if document.text == text {
			return;
		}
		document.version += 1;
		document.text = text.to_owned();
		self.notify(
			"textDocument/didChange",
			json!({
				"textDocument": { "uri": self.uri(script), "version": document.version },
				"contentChanges": [{ "text": text }],
			}),
		);
	}

	/// Replaces the entries that ran, whose declarations later entries see.
	pub fn set_history(&self, text: &str) {
		self.sync(HISTORY, text);
	}

	/// Replaces the `$n` result declarations.
	pub fn set_results(&self, text: &str) {
		self.sync(RESULTS, text);
	}

	/// Completions at `position` in `buffer`. Positions here, in and out, count characters.
	pub fn completions(
		&self,
		buffer: &str,
		position: Position,
	) -> anyhow::Result<CompletionResponse> {
		let _query = self.inner.query.lock();
		self.sync(BUFFER, buffer);
		let result = self.request(
			"textDocument/completion",
			json!({ "textDocument": { "uri": self.uri(BUFFER) }, "position": to_lsp(buffer, position) }),
		)?;
		if result.is_null() {
			return Ok(CompletionResponse::Array(Vec::new()));
		}
		let mut response: CompletionResponse = serde_json::from_value(result)?;
		let items = match &mut response {
			CompletionResponse::Array(items) => items,
			CompletionResponse::List(list) => &mut list.items,
		};
		for edit in items.iter_mut().filter_map(|item| item.text_edit.as_mut()) {
			match edit {
				CompletionTextEdit::Edit(edit) => edit.range = range_from_lsp(buffer, edit.range),
				CompletionTextEdit::InsertAndReplace(edit) => {
					edit.insert = range_from_lsp(buffer, edit.insert);
					edit.replace = range_from_lsp(buffer, edit.replace);
				}
			}
		}

		Ok(response)
	}

	/// The type and docs of what is at `position` in `buffer`.
	pub fn hover(&self, buffer: &str, position: Position) -> anyhow::Result<Option<Hover>> {
		let _query = self.inner.query.lock();
		self.sync(BUFFER, buffer);
		let result = self.request(
			"textDocument/hover",
			json!({ "textDocument": { "uri": self.uri(BUFFER) }, "position": to_lsp(buffer, position) }),
		)?;
		let mut hover: Option<Hover> = serde_json::from_value(result)?;
		if let Some(range) = hover.as_mut().and_then(|hover| hover.range.as_mut()) {
			*range = range_from_lsp(buffer, *range);
		}

		Ok(hover)
	}

	/// The signatures of the call `position` sits in, with the argument it is on. `showing` says
	/// the help already shows, so tsrs keeps it while the caret moves through the call.
	pub fn signature_help(
		&self,
		buffer: &str,
		position: Position,
		showing: bool,
	) -> anyhow::Result<Option<SignatureHelp>> {
		let _query = self.inner.query.lock();
		self.sync(BUFFER, buffer);
		let result = self.request(
			"textDocument/signatureHelp",
			json!({
				"textDocument": { "uri": self.uri(BUFFER) },
				"position": to_lsp(buffer, position),
				// 1 is invoked, 3 a content change while the help shows.
				"context": { "triggerKind": if showing { 3 } else { 1 }, "isRetrigger": showing },
			}),
		)?;

		Ok(serde_json::from_value(result)?)
	}

	/// The buffer's type errors, less the ones the console's rewriting causes.
	pub fn diagnostics(&self, buffer: &str) -> anyhow::Result<Vec<Diagnostic>> {
		let _query = self.inner.query.lock();
		self.sync(BUFFER, buffer);
		let mut result = self.request(
			"textDocument/diagnostic",
			json!({ "textDocument": { "uri": self.uri(BUFFER) } }),
		)?;
		let items: Vec<Diagnostic> = serde_json::from_value(result["items"].take())?;

		Ok(items
			.into_iter()
			.filter(|item| {
				!matches!(item.code, Some(NumberOrString::Number(code)) if IGNORED_CODES.contains(&i64::from(code)))
			})
			.map(|item| Diagnostic {
				range: range_from_lsp(buffer, item.range),
				..item
			})
			.collect())
	}
}

static SHARED: OnceLock<Result<Checker, String>> = OnceLock::new();

/// The one checker this process runs, started on first use. Every console window shares it.
pub fn shared() -> Result<Checker, String> {
	SHARED
		.get_or_init(|| Checker::start().map_err(|error| format!("{error:#}")))
		.clone()
}
