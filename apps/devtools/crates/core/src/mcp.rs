//! The MCP server agents use. Tools are thin wrappers over [`Devtools`]; output is compact text
//! for trees and JSON for inspected values. The GUI serves it over streamable HTTP at
//! `http://127.0.0.1:8098/mcp` (sharing the user's session and selection); `unbound-devtools mcp`
//! serves it over stdio with no window.
//!
//! Tools:
//! - `status`: connection, bridge, element counts, selection.
//! - `connect_device`: ask the device over the Unbound bridge to dial this app, on the command
//!   line's bridge, a saved device (`preset`) or any `bridge`.
//! - `list_presets`, `save_preset`, `remove_preset`: the saved devices the GUI's menu shows.
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

mod format;

use std::net::SocketAddr;

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{Implementation, ServerCapabilities, ServerConfig};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{ServerHandler, ServiceExt, tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::Value as Json;

use crate::inspect::Section;
use crate::presets::{ConnectTarget, DevicePreset, parse_host};
use crate::query::{self, FindQuery, NameMatch};
use crate::session::Devtools;
use crate::store::{ElementId, ElementKind};
use crate::value::Path;

const INSTRUCTIONS: &str = "React DevTools for the Discord app running Unbound. \
Workflow: `status` (is a device attached? if not, `list_presets` and `connect_device`), then `find` or `tree` to get \
element ids, `inspect` an id for its props, state and hooks, then `select`, `highlight` or \
`override` it. Ids change when the tree remounts (after `filters`), so find again afterwards.";

/// Longest text a tool returns before it says it cut the rest.
const MAX_OUTPUT_CHARS: usize = 60_000;

#[derive(Clone)]
struct DevtoolsServer {
	devtools: Devtools,
}

#[derive(Deserialize, JsonSchema)]
struct TreeParams {
	/// Element id to start from; omit for the whole tree.
	root: Option<i64>,
	/// Levels below `root` to print (default 8).
	depth: Option<u32>,
	/// Most lines to print (default 300).
	max_nodes: Option<usize>,
}

#[derive(Deserialize, JsonSchema, Default)]
#[serde(rename_all = "lowercase")]
enum MatchMode {
	Exact,
	#[default]
	Contains,
	Regex,
}

#[derive(Deserialize, JsonSchema)]
struct FindParams {
	/// Component name without HOC wrappers: `MessageRow` matches `Memo(MessageRow)`.
	name: Option<String>,
	/// How `name` matches: `contains` (case-insensitive, default), `exact` or `regex`.
	#[serde(rename = "match", default)]
	match_mode: MatchMode,
	/// Exact React key.
	key: Option<String>,
	/// Element kind: function, class, memo, forward_ref, host, context, suspense, ...
	kind: Option<String>,
	/// Only search below this element id.
	within: Option<i64>,
	/// jq predicate over each candidate's inspected element, e.g. `.props.message.id == "1"` or
	/// `.hooks[] | select(.name == "State") | .value == true`. Inspects up to 200 candidates.
	props: Option<String>,
	/// Most results (default 50).
	limit: Option<usize>,
}

#[derive(Deserialize, JsonSchema)]
struct QueryParams {
	/// jq program run over the tree JSON (`{id, name, kind, key, hocs, children}` nodes).
	jq: String,
	/// Element id to start from; omit for every root.
	root: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
struct InspectParams {
	id: i64,
	/// Expand a placeholder (`{"$type": "object", ...}` in an earlier result): the section first,
	/// e.g. `["props", "message", "author"]` or `["hooks", 0, "value"]`.
	path: Option<Path>,
}

#[derive(Deserialize, JsonSchema)]
struct IdParams {
	/// Element id; omit or null to clear.
	id: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
struct OverrideParams {
	id: i64,
	/// `props`, `state`, `hooks` or `context`.
	section: String,
	/// Path inside the section, e.g. `["count"]`. For hooks it starts with the hook id from
	/// `inspect` (`[0]` replaces the first useState value, `[0, "open"]` a field of it).
	path: Path,
	/// The new value, any JSON.
	value: Json,
}

#[derive(Deserialize, JsonSchema)]
struct FiltersParams {
	/// Show host components (View, Text, ...) in the tree. Off by default.
	show_host_components: bool,
}

#[derive(Deserialize, JsonSchema)]
struct StoreGlobalParams {
	id: i64,
	/// Path from the element, section first: `["props", "message"]`, `["hooks", 0, "value"]`.
	path: Path,
}

#[derive(Deserialize, JsonSchema, Default)]
struct ConnectParams {
	/// A saved device's name from list_presets (case-insensitive).
	preset: Option<String>,
	/// A debugger bridge as host:port, e.g. `100.64.0.2:9090`, instead of a preset.
	bridge: Option<String>,
	/// With `bridge`: the host the device should dial back to reach this app. Omit to use the
	/// host in the device's debugger.address setting.
	advertise_host: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
struct SavePresetParams {
	/// A unique name, e.g. `iPhone VM`.
	name: String,
	/// The device's debugger bridge as host:port, e.g. `100.64.0.2:9090`.
	bridge: String,
	/// The host the device should dial back to reach this app. Omit to use the host in the
	/// device's debugger.address setting.
	advertise_host: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
struct PresetNameParams {
	name: String,
}

#[derive(Deserialize, JsonSchema)]
struct EvalParams {
	/// JavaScript evaluated on device; the last expression is returned.
	code: String,
}

#[tool_router]
impl DevtoolsServer {
	#[tool(
		description = "Connection state, element counts, selection and whether host \
		components are shown. Call first; if no backend is connected, call connect_device."
	)]
	async fn status(&self) -> Result<String, String> {
		serde_json::to_string_pretty(&self.devtools.status()).map_err(|error| error.to_string())
	}

	#[tool(
		description = "Ask the device, over the Unbound debugger bridge, to dial this app. \
		No arguments: the bridge this app was started with. `preset`: a saved device from \
		list_presets (it becomes the GUI's default). `bridge` (+ optional `advertise_host`): any \
		other bridge, once. Needs the bridge running and Discord started with loader.devtools on."
	)]
	async fn connect_device(
		&self,
		Parameters(params): Parameters<ConnectParams>,
	) -> Result<String, String> {
		let connected = match (params.preset, params.bridge, params.advertise_host) {
			(Some(_), Some(_), _) | (Some(_), _, Some(_)) => {
				return Err("pass either preset, or bridge with advertise_host".into());
			}
			(None, None, Some(_)) => return Err("advertise_host needs a bridge".into()),
			(Some(name), None, None) => self.devtools.connect_preset(&name).await,
			(None, Some(bridge), host) => {
				let target = ConnectTarget {
					bridge: bridge.parse().map_err(|error| format!("{error}"))?,
					advertise_host: parse_host(host.as_deref().unwrap_or_default())
						.map_err(|error| error.to_string())?,
				};
				self.devtools.connect_device_to(target).await
			}
			(None, None, None) => self.devtools.connect_device().await,
		};
		let url = connected.map_err(|error| format!("{error:#}"))?;

		Ok(format!(
			"The device is dialing {url}; call status in a moment to see the tree."
		))
	}

	#[tool(
		description = "Saved devices (name, bridge host:port, optional dial-back host), the \
		last one connected, and this app's own bridge. Pass a name to connect_device as preset."
	)]
	async fn list_presets(&self) -> Result<String, String> {
		let presets = self.devtools.presets().map_err(|error| error.to_string())?;
		let json = serde_json::json!({
			"devices": presets.devices,
			"last_used": presets.last_used,
			"default_bridge": self.devtools.default_target().bridge,
		});

		Ok(format::pretty(&json))
	}

	#[tool(
		description = "Save a device so connect_device (and the GUI's Connect menu) can dial it \
		by name. Names are unique, case-insensitive; remove_preset first to change one."
	)]
	async fn save_preset(
		&self,
		Parameters(params): Parameters<SavePresetParams>,
	) -> Result<String, String> {
		let preset = DevicePreset::parse(
			&params.name,
			&params.bridge,
			params.advertise_host.as_deref().unwrap_or_default(),
		)
		.map_err(|error| error.to_string())?;
		let name = preset.name.clone();

		self.devtools
			.save_preset(preset)
			.map_err(|error| error.to_string())?;
		Ok(format!(
			"Saved {name:?}. Connect with connect_device {{\"preset\": {name:?}}}."
		))
	}

	#[tool(description = "Delete a saved device by name.")]
	async fn remove_preset(
		&self,
		Parameters(params): Parameters<PresetNameParams>,
	) -> Result<String, String> {
		let removed = self
			.devtools
			.remove_preset(&params.name)
			.map_err(|error| error.to_string())?;

		Ok(format!("Removed {:?}.", removed.name))
	}

	#[tool(
		description = "Indented outline of the component tree: `<Name key=\"k\"> #id kind`. \
		Use root to zoom into a subtree from find. `!n ?n` are error and warning counts."
	)]
	async fn tree(&self, Parameters(params): Parameters<TreeParams>) -> Result<String, String> {
		let store = self.devtools.store();
		let text = query::tree_text(
			&store,
			params.root.map(ElementId),
			Some(params.depth.unwrap_or(8)),
			params.max_nodes.unwrap_or(300),
		);

		Ok(if text.is_empty() {
			"The tree is empty; is a device connected?".into()
		} else {
			text
		})
	}

	#[tool(
		description = "Find elements (findInReactTree): by name, key, kind and subtree, \
		optionally narrowed by a jq predicate over each candidate's inspected props/state/hooks. \
		Returns `#id <Name key> kind  in Parent > ... > Root`. Next: inspect an id."
	)]
	async fn find(&self, Parameters(params): Parameters<FindParams>) -> Result<String, String> {
		let name = match (params.name, params.match_mode) {
			(None, _) => None,
			(Some(name), MatchMode::Exact) => Some(NameMatch::Exact(name)),
			(Some(name), MatchMode::Contains) => Some(NameMatch::Contains(name)),
			(Some(name), MatchMode::Regex) => Some(NameMatch::Regex(
				regex::Regex::new(&name).map_err(|error| format!("bad regex: {error}"))?,
			)),
		};
		let kinds = match params.kind.as_deref() {
			None => Vec::new(),
			Some(label) => vec![ElementKind::from_label(label).ok_or_else(|| {
				format!("unknown kind {label:?}; use one of {}", format::KIND_LABELS)
			})?],
		};
		let query = FindQuery {
			name,
			key: params.key,
			kinds,
			within: params.within.map(ElementId),
			limit: Some(params.limit.unwrap_or(50)),
		};

		let Some(predicate) = params.props else {
			let ids = query::find(&self.devtools.store(), &query);
			return Ok(format::matches(&self.devtools.store(), &ids, None));
		};

		let found = query::find_by_props(&self.devtools, &query, &predicate).await?;
		Ok(format::matches(
			&self.devtools.store(),
			&found.ids,
			Some(&found),
		))
	}

	#[tool(description = "Run any jq program over the tree as JSON: nested \
		`{id, name, kind, key, hocs, errors, warnings, children}`. Example: \
		`[.. | objects | select(.kind == \"memo\") | .id]`. Only names and keys, not props: use \
		find with props for those.")]
	async fn query(&self, Parameters(params): Parameters<QueryParams>) -> Result<String, String> {
		let devtools = self.devtools.clone();
		let outputs = tokio::task::spawn_blocking(move || {
			query::run_jq_on_tree(
				&devtools,
				params.root.map(ElementId),
				&params.jq,
				|output| output.to_string(),
			)
		})
		.await
		.map_err(|error| format!("the query did not finish: {error}"))??;
		let text = outputs.join("\n");

		Ok(format::cap(text, MAX_OUTPUT_CHARS))
	}

	#[tool(
		description = "Props, state, hooks (with ids for override), context, owners and \
		source of one element, as JSON. Deep values arrive as placeholders \
		`{\"$type\", \"$preview\"}`; pass their path to expand one."
	)]
	async fn inspect(
		&self,
		Parameters(params): Parameters<InspectParams>,
	) -> Result<String, String> {
		let id = ElementId(params.id);
		let json = match params.path {
			Some(path) => self
				.devtools
				.inspect_path(id, path)
				.await
				.map(|value| value.to_json()),
			None => self
				.devtools
				.inspect(id)
				.await
				.map(|element| element.to_json()),
		}
		.map_err(|error| error.to_string())?;

		Ok(format::cap(format::pretty(&json), MAX_OUTPUT_CHARS))
	}

	#[tool(
		description = "Select an element in the DevTools window (the user sees it), or clear \
		the selection with no id."
	)]
	async fn select(&self, Parameters(params): Parameters<IdParams>) -> Result<String, String> {
		let id = params.id.map(ElementId);

		if let Some(id) = id
			&& self.devtools.store().get(id).is_none()
		{
			return Err(format!("#{} is not in the tree", id.0));
		}

		self.devtools.select(id);
		Ok(format::selection(&self.devtools.store(), id))
	}

	#[tool(
		description = "The element selected in the DevTools window (by the user, the device's \
		inspector or select), with its ancestors."
	)]
	async fn selected(&self) -> Result<String, String> {
		Ok(format::selection(
			&self.devtools.store(),
			self.devtools.selected(),
		))
	}

	#[tool(
		name = "override",
		description = "Set a prop, state key, hook value or context value \
		on device; the component re-renders. Inspect first for paths and hook ids. Example: \
		{id, section: \"state\", path: [\"count\"], value: 42}."
	)]
	async fn override_value(
		&self,
		Parameters(params): Parameters<OverrideParams>,
	) -> Result<String, String> {
		let section = Section::from_label(&params.section).ok_or_else(|| {
			format!(
				"section must be props, state, hooks or context, not {:?}",
				params.section
			)
		})?;

		self.devtools
			.override_value(ElementId(params.id), section, params.path, params.value)
			.await
			.map_err(|error| error.to_string())?;

		Ok("Sent. Inspect the element again to see the new value.".into())
	}

	#[tool(description = "Flash the element's native view on the device screen; no id clears it.")]
	async fn highlight(&self, Parameters(params): Parameters<IdParams>) -> Result<String, String> {
		self.devtools.highlight(params.id.map(ElementId));
		Ok("Done.".into())
	}

	#[tool(
		description = "Show or hide host components (View, Text, ...). The tree remounts \
		with new ids, so find again afterwards."
	)]
	async fn filters(
		&self,
		Parameters(params): Parameters<FiltersParams>,
	) -> Result<String, String> {
		self.devtools
			.set_show_host_components(params.show_host_components);
		Ok(format!(
			"Host components {}. Ids are reassigned; find elements again.",
			if params.show_host_components {
				"shown"
			} else {
				"hidden"
			}
		))
	}

	#[tool(
		description = "Expose a value from an element as a global `$reactTemp<n>` on device \
		for eval (e.g. a callback prop to call). Inspect the element first."
	)]
	async fn store_global(
		&self,
		Parameters(params): Parameters<StoreGlobalParams>,
	) -> Result<String, String> {
		let name = self
			.devtools
			.store_as_global(ElementId(params.id), params.path)
			.map_err(|error| error.to_string())?;

		Ok(format!("Stored as {name}; use it in eval."))
	}

	#[tool(
		description = "Evaluate JavaScript on device over the Unbound debugger bridge and \
		return the result as text. Pairs with store_global."
	)]
	async fn eval(&self, Parameters(params): Parameters<EvalParams>) -> Result<String, String> {
		let text = self
			.devtools
			.eval(&params.code)
			.await
			.map_err(|error| format!("{error:#}"))?;

		Ok(format::cap(text, MAX_OUTPUT_CHARS))
	}
}

#[tool_handler]
impl ServerHandler for DevtoolsServer {
	fn get_info(&self) -> ServerConfig {
		ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
			.with_server_info(Implementation::new(
				"unbound-devtools",
				env!("CARGO_PKG_VERSION"),
			))
			.with_instructions(INSTRUCTIONS)
	}
}

/// Serves MCP over stdin/stdout until the client disconnects.
pub async fn serve_stdio(devtools: Devtools) -> anyhow::Result<()> {
	let service = DevtoolsServer { devtools }
		.serve(rmcp::transport::stdio())
		.await?;
	service.waiting().await?;
	Ok(())
}

/// Serves MCP over streamable HTTP at `http://<addr>/mcp`. Returns the bound address. The server
/// runs on the session's runtime until the process exits.
pub async fn serve_http(devtools: Devtools, addr: SocketAddr) -> anyhow::Result<SocketAddr> {
	let listener = std::net::TcpListener::bind(addr)?;
	listener.set_nonblocking(true)?;
	let bound = listener.local_addr()?;
	let runtime = devtools.runtime();

	runtime.spawn(async move {
		let service: StreamableHttpService<DevtoolsServer, LocalSessionManager> =
			StreamableHttpService::new(
				move || {
					Ok(DevtoolsServer {
						devtools: devtools.clone(),
					})
				},
				Default::default(),
				StreamableHttpServerConfig::default(),
			);
		let router = axum::Router::new().nest_service("/mcp", service);
		let served = match tokio::net::TcpListener::from_std(listener) {
			Ok(listener) => axum::serve(listener, router).await,
			Err(error) => Err(error),
		};

		if let Err(error) = served {
			tracing::error!(%error, "the MCP HTTP server stopped");
		}
	});

	Ok(bound)
}
