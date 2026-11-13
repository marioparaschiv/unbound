//! The Metro explorer: the device's Metro modules a page at a time, loading one that has not loaded,
//! and a loaded module's exports as a tree, one value's children a page at a time. Getters run only
//! when asked. Serde copies of `@unbound-app/debugger-protocol`'s `metro.ts`, sent over the debugger
//! connection like the object explorer's frames.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::bridge::BridgeFrame;
use crate::session::{Devtools, Inner};

/// The most modules a device returns for one request (`METRO_MODULES_PAGE_SIZE`).
pub const METRO_MODULES_PAGE_SIZE: u32 = 200;
/// The most properties a device returns for one request (`METRO_CHILDREN_PAGE_SIZE`).
pub const METRO_CHILDREN_PAGE_SIZE: u32 = 100;
/// The most matches a device collects for one search request (`METRO_SEARCH_PAGE_SIZE`).
pub const METRO_SEARCH_PAGE_SIZE: u32 = 50;

/// The bridge gives the device 15 s; this waits a little longer for its answer.
const METRO_TIMEOUT: Duration = Duration::from_secs(17);

/// Whether a module's factory has run: `Failed` when it threw.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MetroModuleStatus {
	Loaded,
	Unloaded,
	Failed,
}

impl MetroModuleStatus {
	pub const ALL: [Self; 3] = [Self::Loaded, Self::Unloaded, Self::Failed];

	pub fn label(self) -> &'static str {
		match self {
			Self::Loaded => "Loaded",
			Self::Unloaded => "Unloaded",
			Self::Failed => "Failed",
		}
	}
}

/// One Metro module.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MetroModule {
	pub id: u32,
	pub status: MetroModuleStatus,
	/// A loaded module's file path, else its first export names.
	#[serde(default)]
	pub label: Option<String>,
}

/// What a value is, which picks its colour; `Getter` is an accessor that has not run.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MetroValueKind {
	String,
	Number,
	Boolean,
	Nullish,
	Symbol,
	Function,
	Class,
	Array,
	Object,
	Error,
	Getter,
	#[serde(other)]
	Other,
}

/// One value in the tree: a module's exports, a property, or a slot such as `[[Prototype]]`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MetroValue {
	pub key: String,
	pub kind: MetroValueKind,
	pub text: String,
	/// Lists the value's children, or runs a getter. The same object always has the same ref.
	#[serde(default, rename = "ref", skip_serializing_if = "Option::is_none")]
	pub value_ref: Option<String>,
	/// An engine slot such as `[[Prototype]]` rather than a property.
	#[serde(default, skip_serializing_if = "std::ops::Not::not")]
	pub internal: bool,
}

impl MetroValue {
	/// Whether the value opens to list children.
	pub fn expandable(&self) -> bool {
		self.value_ref.is_some() && self.kind != MetroValueKind::Getter
	}
}

/// What to list the children of: a loaded module's exports, or a value by its ref.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetroTarget {
	Module(u32),
	Ref(String),
}

/// A page of modules, how many match, and how many of all the registry's have loaded.
#[derive(Clone, Debug, PartialEq)]
pub struct ModulesPage {
	pub modules: Vec<MetroModule>,
	pub total: u32,
	pub loaded: u32,
	pub count: u32,
}

/// A module after loading it, and how many modules have loaded now.
#[derive(Clone, Debug, PartialEq)]
pub struct LoadedModule {
	pub module: MetroModule,
	pub loaded: u32,
}

/// One Load All batch: what it ran, how many threw, and how many modules are still to run.
#[derive(Clone, Debug, PartialEq)]
pub struct LoadAllBatch {
	pub attempted: u32,
	pub failed: u32,
	pub remaining: u32,
	pub loaded: u32,
	pub count: u32,
}

/// A key a search matched: its module, the keys from the exports down to it, and its value.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MetroMatch {
	pub module: MetroModule,
	/// Property keys or `[[Prototype]]`; empty when the exports themselves match.
	pub path: Vec<String>,
	pub value: MetroValue,
}

/// A loaded module that reported the source file it was built from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MetroFile {
	pub id: u32,
	pub path: String,
}

/// Every loaded module's file path, sorted, and how many modules have not loaded to report one.
#[derive(Clone, Debug, PartialEq)]
pub struct FilesPage {
	pub files: Vec<MetroFile>,
	pub unloaded: u32,
	pub count: u32,
}

/// A batch of search matches, and where the next batch continues (`None` when the search is done).
#[derive(Clone, Debug, PartialEq)]
pub struct SearchPage {
	pub matches: Vec<MetroMatch>,
	pub cursor: Option<u32>,
	/// How many loaded modules are searched so far, of `total`.
	pub searched: u32,
	pub total: u32,
}

/// A value, a page of its properties, how many it has, and its slots.
#[derive(Clone, Debug, PartialEq)]
pub struct ChildrenPage {
	pub value: MetroValue,
	pub children: Vec<MetroValue>,
	pub total: u32,
	pub internal: Vec<MetroValue>,
}

/// Why the device could not answer a Metro request (`MetroError['code']`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MetroErrorCode {
	/// The ref is gone, such as after a JavaScript reload.
	Stale,
	UnknownModule,
	Unloaded,
	#[serde(other)]
	Failed,
}

/// A Metro request that failed: never sent, unanswered, or refused by the device.
#[derive(Clone, Debug, PartialEq, thiserror::Error)]
pub enum MetroError {
	#[error("No device is connected.")]
	NotConnected,
	#[error("The device did not answer within {0} ms.")]
	Timeout(u64),
	#[error("{message}")]
	Device {
		code: MetroErrorCode,
		message: String,
	},
}

impl MetroError {
	pub fn code(&self) -> Option<MetroErrorCode> {
		match self {
			Self::Device { code, .. } => Some(*code),
			Self::NotConnected | Self::Timeout(_) => None,
		}
	}

	pub fn is_stale(&self) -> bool {
		self.code() == Some(MetroErrorCode::Stale)
	}

	fn device(message: impl Into<String>) -> Self {
		Self::Device {
			code: MetroErrorCode::Failed,
			message: message.into(),
		}
	}
}

/// A device's answer to one Metro request.
pub(crate) enum MetroReply {
	Modules(ModulesPage),
	Load(LoadedModule),
	LoadAll(LoadAllBatch),
	Search(SearchPage),
	Files(FilesPage),
	Children(ChildrenPage),
	Read(MetroValue),
}

pub(crate) type MetroOutcome = Result<MetroReply, MetroError>;

const ANOTHER_FRAME: &str = "The device answered with another frame.";

impl Devtools {
	/// Lists a page of the modules from `offset` whose id starts with, or label contains, `filter`,
	/// with `status` when set.
	pub async fn metro_modules(
		&self,
		filter: &str,
		status: Option<MetroModuleStatus>,
		offset: u32,
	) -> Result<ModulesPage, MetroError> {
		match self
			.request_metro(modules_request(filter, status, offset))
			.await?
		{
			MetroReply::Modules(page) => Ok(page),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Runs module `id`'s factory, and those of the modules it requires.
	pub async fn metro_load(&self, id: u32) -> Result<LoadedModule, MetroError> {
		match self.request_metro(load_request(id)).await? {
			MetroReply::Load(loaded) => Ok(loaded),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Runs the next batch of modules that have not loaded, skipping the device's blacklist. Repeat
	/// until `remaining` is 0.
	pub async fn metro_load_all(&self) -> Result<LoadAllBatch, MetroError> {
		match self.request_metro(load_all_request()).await? {
			MetroReply::LoadAll(batch) => Ok(batch),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Searches the loaded modules' keys for `query` from `cursor`, through properties and
	/// prototypes, until the device has a page of matches or its batch time is up.
	pub async fn metro_search(&self, query: &str, cursor: u32) -> Result<SearchPage, MetroError> {
		match self.request_metro(search_request(query, cursor)).await? {
			MetroReply::Search(page) => Ok(page),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Lists every loaded module's file path; a module reports its path only once it loads.
	pub async fn metro_files(&self) -> Result<FilesPage, MetroError> {
		match self.request_metro(files_request()).await? {
			MetroReply::Files(page) => Ok(page),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Describes `target` and lists a page of its properties from `offset`.
	pub async fn metro_children(
		&self,
		target: &MetroTarget,
		offset: u32,
	) -> Result<ChildrenPage, MetroError> {
		match self.request_metro(children_request(target, offset)).await? {
			MetroReply::Children(page) => Ok(page),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Runs the getter `getter_ref` stands for; what it throws comes back as an `Error` value.
	pub async fn metro_read(&self, getter_ref: &str) -> Result<MetroValue, MetroError> {
		match self.request_metro(read_request(getter_ref)).await? {
			MetroReply::Read(value) => Ok(value),
			_ => Err(MetroError::device(ANOTHER_FRAME)),
		}
	}

	/// Sends a Metro request with a fresh id and waits for the device's answer to it.
	async fn request_metro(&self, mut request: serde_json::Value) -> MetroOutcome {
		let id = uuid::Uuid::new_v4().to_string();
		let (reply, response) = oneshot::channel();
		request["id"] = id.clone().into();
		self.inner.metro.lock().insert(id.clone(), reply);

		if !self.inner.send_to_bridge(request.to_string()) {
			self.inner.metro.lock().remove(&id);
			return Err(MetroError::NotConnected);
		}

		let waited = self
			.on_runtime(tokio::time::timeout(METRO_TIMEOUT, response))
			.await
			.map_err(|error| MetroError::device(error.to_string()))?;

		match waited {
			Ok(Ok(outcome)) => outcome,
			Ok(Err(_)) => Err(MetroError::NotConnected),
			Err(_) => {
				self.inner.metro.lock().remove(&id);
				Err(MetroError::Timeout(METRO_TIMEOUT.as_millis() as u64))
			}
		}
	}
}

/// A `metro-modules-request` frame without its `id`; an empty `filter` and no `status` are left out.
pub(crate) fn modules_request(
	filter: &str,
	status: Option<MetroModuleStatus>,
	offset: u32,
) -> serde_json::Value {
	let mut request = json!({
		"type": "metro-modules-request",
		"offset": offset,
		"limit": METRO_MODULES_PAGE_SIZE,
	});
	if !filter.is_empty() {
		request["filter"] = filter.into();
	}
	if let Some(status) = status {
		request["status"] = json!(status);
	}
	request
}

/// A `metro-load-request` frame without its `id`.
pub(crate) fn load_request(id: u32) -> serde_json::Value {
	json!({ "type": "metro-load-request", "module": id })
}

/// A `metro-load-all-request` frame without its `id`.
pub(crate) fn load_all_request() -> serde_json::Value {
	json!({ "type": "metro-load-all-request" })
}

/// A `metro-search-request` frame without its `id`.
pub(crate) fn search_request(query: &str, cursor: u32) -> serde_json::Value {
	json!({
		"type": "metro-search-request",
		"query": query,
		"cursor": cursor,
		"limit": METRO_SEARCH_PAGE_SIZE,
	})
}

/// A `metro-files-request` frame without its `id`.
pub(crate) fn files_request() -> serde_json::Value {
	json!({ "type": "metro-files-request" })
}

/// A `metro-children-request` frame without its `id`.
pub(crate) fn children_request(target: &MetroTarget, offset: u32) -> serde_json::Value {
	json!({
		"type": "metro-children-request",
		"target": target,
		"offset": offset,
		"limit": METRO_CHILDREN_PAGE_SIZE,
	})
}

/// A `metro-read-request` frame without its `id`.
pub(crate) fn read_request(getter_ref: &str) -> serde_json::Value {
	json!({ "type": "metro-read-request", "ref": getter_ref })
}

/// The error a failed result frame carries.
fn failure(error: Option<String>, code: Option<MetroErrorCode>) -> MetroError {
	MetroError::Device {
		code: code.unwrap_or(MetroErrorCode::Failed),
		message: error.unwrap_or_else(|| "The device sent no answer.".into()),
	}
}

/// The outcome a `metro-*-result` frame carries, with its id; `None` for any other frame.
fn outcome(frame: BridgeFrame) -> Option<(String, MetroOutcome)> {
	let (id, reply, error, code) = match frame {
		BridgeFrame::MetroModulesResult {
			id,
			ok,
			modules,
			total,
			loaded,
			count,
			error,
			code,
		} => {
			let reply = ok.then(|| {
				let total = total.unwrap_or(modules.len() as u32);
				MetroReply::Modules(ModulesPage {
					modules,
					total,
					loaded: loaded.unwrap_or_default(),
					count: count.unwrap_or(total),
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroLoadResult {
			id,
			ok,
			module,
			loaded,
			error,
			code,
		} => {
			let reply = module.filter(|_| ok).map(|module| {
				MetroReply::Load(LoadedModule {
					module,
					loaded: loaded.unwrap_or_default(),
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroLoadAllResult {
			id,
			ok,
			attempted,
			failed,
			remaining,
			loaded,
			count,
			error,
			code,
		} => {
			let reply = remaining.filter(|_| ok).map(|remaining| {
				MetroReply::LoadAll(LoadAllBatch {
					attempted: attempted.unwrap_or_default(),
					failed: failed.unwrap_or_default(),
					remaining,
					loaded: loaded.unwrap_or_default(),
					count: count.unwrap_or_default(),
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroSearchResult {
			id,
			ok,
			matches,
			cursor,
			searched,
			total,
			error,
			code,
		} => {
			let reply = ok.then(|| {
				let total = total.unwrap_or_default();
				MetroReply::Search(SearchPage {
					matches,
					cursor,
					searched: searched.unwrap_or(total),
					total,
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroFilesResult {
			id,
			ok,
			files,
			unloaded,
			count,
			error,
			code,
		} => {
			let reply = ok.then(|| {
				let count = count.unwrap_or(files.len() as u32);
				MetroReply::Files(FilesPage {
					files,
					unloaded: unloaded.unwrap_or_default(),
					count,
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroChildrenResult {
			id,
			ok,
			value,
			children,
			total,
			internal,
			error,
			code,
		} => {
			let reply = value.filter(|_| ok).map(|value| {
				let total = total.unwrap_or(children.len() as u32);
				MetroReply::Children(ChildrenPage {
					value,
					children,
					total,
					internal,
				})
			});
			(id, reply, error, code)
		}
		BridgeFrame::MetroReadResult {
			id,
			ok,
			value,
			error,
			code,
		} => (id, value.filter(|_| ok).map(MetroReply::Read), error, code),
		_ => return None,
	};

	Some((id, reply.ok_or_else(|| failure(error, code))))
}

/// Delivers a `metro-*-result` frame to the request waiting on its id; other frames are ignored.
pub(crate) fn settle(inner: &Inner, frame: BridgeFrame) {
	let Some((id, outcome)) = outcome(frame) else {
		return;
	};

	if let Some(waiter) = inner.metro.lock().remove(&id) {
		let _ = waiter.send(outcome);
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_target_is_one_keyed_object() {
		assert_eq!(
			serde_json::to_value(MetroTarget::Module(4)).unwrap(),
			json!({ "module": 4 })
		);
		assert_eq!(
			serde_json::to_value(MetroTarget::Ref("e:1".into())).unwrap(),
			json!({ "ref": "e:1" })
		);
	}

	#[test]
	fn a_modules_request_leaves_out_empty_options() {
		let request = modules_request("", None, 200);
		assert!(request.get("filter").is_none() && request.get("status").is_none());
		let request = modules_request("Store", Some(MetroModuleStatus::Failed), 0);
		assert_eq!(request["status"], "failed");
	}

	#[test]
	fn an_unknown_code_or_kind_reads_as_the_catch_all() {
		let code: MetroErrorCode = serde_json::from_value(json!("brand-new")).unwrap();
		assert_eq!(code, MetroErrorCode::Failed);
		let code: MetroErrorCode = serde_json::from_value(json!("unknown-module")).unwrap();
		assert_eq!(code, MetroErrorCode::UnknownModule);
		let kind: MetroValueKind = serde_json::from_value(json!("bigint")).unwrap();
		assert_eq!(kind, MetroValueKind::Other);
	}

	#[test]
	fn a_getter_has_a_ref_but_does_not_open() {
		let value: MetroValue = serde_json::from_value(
			json!({ "key": "lazy", "kind": "getter", "text": "(…)", "ref": "e:3" }),
		)
		.unwrap();
		assert!(!value.expandable() && !value.internal);
	}
}
