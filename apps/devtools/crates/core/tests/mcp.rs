//! Drives the MCP server over plain HTTP JSON-RPC, as an MCP client would, against a session with
//! the harness device attached.

mod common;

use serde_json::{Value as Json, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use unbound_devtools_core::mcp;

use common::connected_session;

struct Reply {
	session: Option<String>,
	status: u16,
	/// The JSON-RPC message, from a JSON body or the SSE stream's `data:` line.
	message: Option<Json>,
}

async fn post(addr: std::net::SocketAddr, session: Option<&str>, body: &Json) -> Reply {
	let body = body.to_string();
	let session_header = session
		.map(|id| format!("Mcp-Session-Id: {id}\r\n"))
		.unwrap_or_default();
	let request = format!(
		"POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\n\
		 Accept: application/json, text/event-stream\r\nContent-Length: {}\r\n{session_header}\
		 Connection: close\r\n\r\n{body}",
		addr.port(),
		body.len()
	);
	let mut stream = TcpStream::connect(addr).await.expect("MCP server accepts");
	stream
		.write_all(request.as_bytes())
		.await
		.expect("request writes");
	let mut raw = Vec::new();
	stream.read_to_end(&mut raw).await.expect("response reads");

	let raw = String::from_utf8(raw).expect("utf-8 response");
	let (head, body) = raw.split_once("\r\n\r\n").expect("headers end");
	let status = head
		.split(' ')
		.nth(1)
		.and_then(|code| code.parse().ok())
		.expect("status code");
	let header = |name: &str| {
		head.lines().find_map(|line| {
			let (key, value) = line.split_once(':')?;
			key.eq_ignore_ascii_case(name)
				.then(|| value.trim().to_owned())
		})
	};
	let body = if header("transfer-encoding").is_some_and(|value| value.contains("chunked")) {
		dechunk(body)
	} else {
		body.to_owned()
	};
	let message = body
		.lines()
		.filter_map(|line| line.strip_prefix("data:"))
		.chain(std::iter::once(body.as_str()))
		.find_map(|text| {
			serde_json::from_str::<Json>(text.trim())
				.ok()
				.filter(|json| json.is_object())
		});

	Reply {
		session: header("mcp-session-id"),
		status,
		message,
	}
}

fn dechunk(mut body: &str) -> String {
	let mut out = String::new();

	while let Some((size, rest)) = body.split_once("\r\n") {
		let Ok(size) = usize::from_str_radix(size.trim(), 16) else {
			break;
		};

		if size == 0 || rest.len() < size {
			break;
		}

		out.push_str(&rest[..size]);
		body = rest[size..].trim_start_matches("\r\n");
	}

	out
}

fn call(id: u64, tool: &str, arguments: Json) -> Json {
	json!({
		"jsonrpc": "2.0",
		"id": id,
		"method": "tools/call",
		"params": { "name": tool, "arguments": arguments },
	})
}

fn tool_text(reply: &Reply) -> String {
	let result = &reply.message.as_ref().expect("a JSON-RPC reply")["result"];
	assert_ne!(result["isError"], json!(true), "tool failed: {result}");

	result["content"][0]["text"]
		.as_str()
		.expect("text content")
		.to_owned()
}

#[tokio::test(flavor = "multi_thread")]
async fn an_mcp_client_finds_and_inspects_over_http() {
	let Some((devtools, _device)) = connected_session().await else {
		return;
	};
	let addr = mcp::serve_http(devtools.clone(), "127.0.0.1:0".parse().expect("addr"))
		.await
		.expect("MCP server binds");

	let init = post(
		addr,
		None,
		&json!({
			"jsonrpc": "2.0",
			"id": 1,
			"method": "initialize",
			"params": {
				"protocolVersion": "2025-03-26",
				"capabilities": {},
				"clientInfo": { "name": "test", "version": "1" },
			},
		}),
	)
	.await;
	assert_eq!(init.status, 200);
	let instructions =
		init.message.as_ref().expect("initialize result")["result"]["instructions"].clone();
	assert!(
		instructions
			.as_str()
			.is_some_and(|text| text.contains("find")),
		"{instructions}"
	);
	let session = init.session.expect("a session id");

	let initialized = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
	assert_eq!(post(addr, Some(&session), &initialized).await.status, 202);

	let list = post(
		addr,
		Some(&session),
		&json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
	)
	.await;
	let tools = &list.message.expect("tools/list result")["result"]["tools"];
	let names: Vec<&str> = tools
		.as_array()
		.expect("tools")
		.iter()
		.filter_map(|tool| tool["name"].as_str())
		.collect();
	for expected in [
		"status",
		"connect_device",
		"tree",
		"find",
		"query",
		"inspect",
		"select",
		"selected",
		"override",
		"highlight",
		"filters",
		"store_global",
		"eval",
	] {
		assert!(
			names.contains(&expected),
			"missing tool {expected} in {names:?}"
		);
	}

	let found = post(
		addr,
		Some(&session),
		&call(3, "find", json!({ "name": "MessageRow", "match": "exact", "props": ".props.message.content == \"hello 2\"" })),
	)
	.await;
	let text = tool_text(&found);
	assert!(text.starts_with("1 match:"), "{text}");
	assert!(
		text.contains("<MessageRow key=\"m2\"> memo  in Channel > Context.Provider > App"),
		"{text}"
	);
	assert!(text.contains("Inspected 3 of 3 candidates."), "{text}");

	let id: i64 = text
		.lines()
		.nth(1)
		.and_then(|line| line.strip_prefix('#')?.split(' ').next()?.parse().ok())
		.expect("an id");
	let inspected = tool_text(
		&post(
			addr,
			Some(&session),
			&call(4, "inspect", json!({ "id": id })),
		)
		.await,
	);
	let inspected: Json = serde_json::from_str(&inspected).expect("inspect returns JSON");
	assert_eq!(inspected["props"]["message"]["content"], json!("hello 2"));

	let selected = tool_text(
		&post(
			addr,
			Some(&session),
			&call(5, "select", json!({ "id": id })),
		)
		.await,
	);
	assert!(
		selected.starts_with(&format!("Selected #{id} <MessageRow")),
		"{selected}"
	);
	assert_eq!(
		devtools.selected().map(|id| id.0),
		Some(id),
		"the session's selection moved"
	);

	let bad = post(
		addr,
		Some(&session),
		&call(6, "find", json!({ "kind": "widget" })),
	)
	.await;
	assert_eq!(
		bad.message.expect("reply")["result"]["isError"],
		json!(true)
	);
}
