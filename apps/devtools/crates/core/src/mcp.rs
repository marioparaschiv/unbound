//! The MCP server agents use. Tools are thin wrappers over [`Devtools`]; output is compact text
//! for trees and JSON for inspected values. The GUI serves it over streamable HTTP at
//! `http://127.0.0.1:8098/mcp` (sharing the user's session and selection); `unbound-devtools mcp`
//! serves it over stdio with no window.
//!
//! Tools:
//! - `status`: connection, bridge, element counts, selection.
//! - `connect_device`: ask the device over the Unbound bridge to dial this app.
//! - `tree`: indented outline from a root id, with depth and node limits.
//! - `find`: findInReactTree. Filter by name (exact, contains, regex), key, kind, subtree, and
//!   optionally a jq predicate over each candidate's inspected element (`.props.message.id == "1"`).
//! - `query`: run any jq program over the tree JSON.
//! - `inspect`: props, state, hooks, context, owners and source of one element; `path` expands a
//!   placeholder.
//! - `select` / `selected`: move or read the GUI's selection.
//! - `override`: edit a prop, state, hook or context value on device.
//! - `highlight`: flash an element's view on device.
//! - `filters`: show or hide host components.
//! - `store_global` and `eval`: expose a value as `$reactTemp<n>` and run JS against it.

use std::net::SocketAddr;

use crate::session::Devtools;

/// Serves MCP over stdin/stdout until the client disconnects.
pub async fn serve_stdio(devtools: Devtools) -> anyhow::Result<()> {
	todo!()
}

/// Serves MCP over streamable HTTP at `http://<addr>/mcp`. Returns the bound address.
pub async fn serve_http(devtools: Devtools, addr: SocketAddr) -> anyhow::Result<SocketAddr> {
	todo!()
}
