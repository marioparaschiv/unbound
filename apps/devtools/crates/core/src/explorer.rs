//! The native object explorer: an object's class chain, each class's members a page at a time, the
//! values of the members on screen, and the images and classes the runtime has loaded. Serde copies
//! of `@unbound-app/debugger-protocol`'s `explorer.ts`, sent over the debugger connection like the
//! view finder's frames.

use std::collections::HashMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::bridge::BridgeFrame;
use crate::session::{Devtools, Inner};

/// The most members a device returns for one request (`EXPLORER_MEMBERS_PAGE_SIZE`).
pub const EXPLORER_MEMBERS_PAGE_SIZE: u32 = 100;
/// The most images or classes a device returns for one request (`EXPLORER_CLASSES_PAGE_SIZE`).
pub const EXPLORER_CLASSES_PAGE_SIZE: u32 = 200;
/// The most values one request reads (`EXPLORER_VALUES_LIMIT`).
pub const EXPLORER_VALUES_LIMIT: usize = 50;

/// The bridge gives the device 15 s; this waits a little longer for its answer.
const EXPLORER_TIMEOUT: Duration = Duration::from_secs(17);

/// What a page explores: a View Tree node, an object a value pointed at, or a class by name.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerTarget {
	Node(String),
	Object(String),
	ClassName(String),
}

/// A group of members one class declares. iOS has the first five, Android the last four with methods.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExplorerMemberKind {
	Properties,
	Ivars,
	Methods,
	ClassMethods,
	Protocols,
	Fields,
	Constructors,
	Interfaces,
}

impl ExplorerMemberKind {
	pub const IOS: [Self; 5] = [
		Self::Properties,
		Self::Ivars,
		Self::Methods,
		Self::ClassMethods,
		Self::Protocols,
	];
	pub const ANDROID: [Self; 4] = [
		Self::Fields,
		Self::Methods,
		Self::Constructors,
		Self::Interfaces,
	];

	pub fn label(self) -> &'static str {
		match self {
			Self::Properties => "Properties",
			Self::Ivars => "Ivars",
			Self::Methods => "Methods",
			Self::ClassMethods => "Class Methods",
			Self::Protocols => "Protocols",
			Self::Fields => "Fields",
			Self::Constructors => "Constructors",
			Self::Interfaces => "Interfaces",
		}
	}

	/// `count` members of this kind in words, such as `1 property` or `3 class methods`.
	pub fn count(self, count: u32) -> String {
		let (one, many) = match self {
			Self::Properties => ("property", "properties"),
			Self::Ivars => ("ivar", "ivars"),
			Self::Methods => ("method", "methods"),
			Self::ClassMethods => ("class method", "class methods"),
			Self::Protocols => ("protocol", "protocols"),
			Self::Fields => ("field", "fields"),
			Self::Constructors => ("constructor", "constructors"),
			Self::Interfaces => ("interface", "interfaces"),
		};
		format!("{count} {}", if count == 1 { one } else { many })
	}

	/// Whether an object's members of this kind hold values the device can read.
	pub fn has_values(self) -> bool {
		matches!(self, Self::Properties | Self::Ivars | Self::Fields)
	}
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerPlatform {
	Ios,
	Android,
}

impl ExplorerPlatform {
	pub fn kinds(self) -> &'static [ExplorerMemberKind] {
		match self {
			Self::Ios => &ExplorerMemberKind::IOS,
			Self::Android => &ExplorerMemberKind::ANDROID,
		}
	}
}

/// One class of an object's chain, with how many members of each kind it declares.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerClass {
	pub name: String,
	#[serde(default)]
	pub image: Option<String>,
	#[serde(default)]
	pub instance_size: Option<u64>,
	#[serde(default)]
	pub counts: HashMap<ExplorerMemberKind, u32>,
}

/// Whether the device reads a member's value on its own (`auto`), only when asked because it runs
/// code (`manual`), or never because it is unsafe.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerRead {
	#[default]
	Auto,
	Manual,
	Never,
}

/// One member a class declares; `kind` and `name` identify it within its class.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerMember {
	pub name: String,
	pub kind: ExplorerMemberKind,
	/// The decoded type: a property's or field's type, an ivar's, or a method's return type.
	#[serde(default, rename = "type")]
	pub ty: Option<String>,
	/// The declaration as source, such as `- (void)setText:(NSString *)text`.
	#[serde(default)]
	pub signature: Option<String>,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub return_type: Option<String>,
	/// A method's parameter types, in order; Android's are class names, as `hooks.hook` takes them.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub parameters: Option<Vec<String>>,
	/// A property's attributes, such as `nonatomic`, `copy`, `readonly` or `getter=isHidden`.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub attributes: Option<Vec<String>>,
	#[serde(default, rename = "static", skip_serializing_if = "Option::is_none")]
	pub is_static: Option<bool>,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub offset: Option<u64>,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub size: Option<u64>,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub image: Option<String>,
	#[serde(default)]
	pub read: ExplorerRead,
}

impl ExplorerMember {
	pub fn is_static(&self) -> bool {
		self.is_static == Some(true)
	}

	/// The property attribute `prefix=value`, such as `getter` from `getter=isHidden`.
	pub fn attribute(&self, prefix: &str) -> Option<&str> {
		self.attributes.iter().flatten().find_map(|attribute| {
			attribute
				.strip_prefix(prefix)
				.and_then(|rest| rest.strip_prefix('='))
		})
	}

	pub fn has_attribute(&self, name: &str) -> bool {
		self.attributes
			.iter()
			.flatten()
			.any(|attribute| attribute == name)
	}
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerValueKind {
	Nil,
	Number,
	Bool,
	String,
	Object,
	Class,
	Struct,
	Pointer,
	Selector,
	Skipped,
	Error,
	#[serde(other)]
	Other,
}

/// One member's value as the device read it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerValue {
	pub name: String,
	pub kind: ExplorerValueKind,
	pub text: String,
	/// A ref that opens the object the value points at.
	#[serde(default)]
	pub object: Option<String>,
	#[serde(default)]
	pub class_name: Option<String>,
}

/// An object or class the explorer opened: its class chain, the class first.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerObject {
	/// The ref that reopens this object; `None` for a class page.
	#[serde(default, rename = "ref")]
	pub object_ref: Option<String>,
	pub class_name: String,
	#[serde(default)]
	pub description: Option<String>,
	pub platform: ExplorerPlatform,
	pub chain: Vec<ExplorerClass>,
}

/// A page of one class's members of one kind, and how many match in all.
#[derive(Clone, Debug, PartialEq)]
pub struct MembersPage {
	pub members: Vec<ExplorerMember>,
	pub total: u32,
}

/// A loaded binary image, on iOS.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerImage {
	pub path: String,
	pub name: String,
	pub class_count: u32,
}

/// A page of images (no image asked) or of one image's class names.
#[derive(Clone, Debug, PartialEq)]
pub struct ClassesPage {
	pub total: u32,
	pub images: Vec<ExplorerImage>,
	pub classes: Vec<String>,
}

/// Why the device could not answer an explorer request (`ExplorerError['code']`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExplorerErrorCode {
	/// The ref or node is gone, such as after a JavaScript reload.
	Stale,
	Disabled,
	Unavailable,
	Unsupported,
	UnknownClass,
	#[serde(other)]
	Failed,
}

/// An explorer request that failed: never sent, unanswered, or refused by the device.
#[derive(Clone, Debug, PartialEq, thiserror::Error)]
pub enum ExplorerError {
	#[error("No device is connected.")]
	NotConnected,
	#[error("The device did not answer within {0} ms.")]
	Timeout(u64),
	#[error("{message}")]
	Device {
		code: ExplorerErrorCode,
		message: String,
	},
}

impl ExplorerError {
	pub fn code(&self) -> Option<ExplorerErrorCode> {
		match self {
			Self::Device { code, .. } => Some(*code),
			Self::NotConnected | Self::Timeout(_) => None,
		}
	}

	pub fn is_stale(&self) -> bool {
		self.code() == Some(ExplorerErrorCode::Stale)
	}

	fn device(message: impl Into<String>) -> Self {
		Self::Device {
			code: ExplorerErrorCode::Failed,
			message: message.into(),
		}
	}
}

/// A device's answer to one explorer request.
pub(crate) enum ExplorerReply {
	Object(ExplorerObject),
	Members(MembersPage),
	Values(Vec<ExplorerValue>),
	Classes(ClassesPage),
}

pub(crate) type ExplorerOutcome = Result<ExplorerReply, ExplorerError>;

impl Devtools {
	/// Opens `target`: the object's class chain and the members each class declares, counted.
	pub async fn explorer_object(
		&self,
		target: &ExplorerTarget,
	) -> Result<ExplorerObject, ExplorerError> {
		match self.request_explorer(object_request(target)).await? {
			ExplorerReply::Object(object) => Ok(object),
			_ => Err(ExplorerError::device(
				"The device answered with another frame.",
			)),
		}
	}

	/// Lists a page of the members of `kind` that `class_name` declares, from `offset`, whose names
	/// contain `filter`.
	pub async fn explorer_members(
		&self,
		class_name: &str,
		kind: ExplorerMemberKind,
		offset: u32,
		filter: &str,
	) -> Result<MembersPage, ExplorerError> {
		match self
			.request_explorer(members_request(class_name, kind, offset, filter))
			.await?
		{
			ExplorerReply::Members(page) => Ok(page),
			_ => Err(ExplorerError::device(
				"The device answered with another frame.",
			)),
		}
	}

	/// Reads the values of `names`, members of `kind` that `class_name` declares, on the object
	/// `object`. Getters that run code run only with `invoke_getters`.
	pub async fn explorer_values(
		&self,
		object: &str,
		class_name: &str,
		kind: ExplorerMemberKind,
		names: &[String],
		invoke_getters: bool,
	) -> Result<Vec<ExplorerValue>, ExplorerError> {
		let request = values_request(object, class_name, kind, names, invoke_getters);
		match self.request_explorer(request).await? {
			ExplorerReply::Values(values) => Ok(values),
			_ => Err(ExplorerError::device(
				"The device answered with another frame.",
			)),
		}
	}

	/// Lists a page of the loaded images, or of the classes in `image`, whose names contain `filter`.
	pub async fn explorer_classes(
		&self,
		image: Option<&str>,
		filter: &str,
		offset: u32,
	) -> Result<ClassesPage, ExplorerError> {
		match self
			.request_explorer(classes_request(image, filter, offset))
			.await?
		{
			ExplorerReply::Classes(page) => Ok(page),
			_ => Err(ExplorerError::device(
				"The device answered with another frame.",
			)),
		}
	}

	/// Sends an explorer request with a fresh id and waits for the device's answer to it.
	async fn request_explorer(&self, mut request: serde_json::Value) -> ExplorerOutcome {
		let id = uuid::Uuid::new_v4().to_string();
		let (reply, response) = oneshot::channel();
		request["id"] = id.clone().into();
		self.inner.explorer.lock().insert(id.clone(), reply);

		if !self.inner.send_to_bridge(request.to_string()) {
			self.inner.explorer.lock().remove(&id);
			return Err(ExplorerError::NotConnected);
		}

		let waited = self
			.on_runtime(tokio::time::timeout(EXPLORER_TIMEOUT, response))
			.await
			.map_err(|error| ExplorerError::device(error.to_string()))?;

		match waited {
			Ok(Ok(outcome)) => outcome,
			Ok(Err(_)) => Err(ExplorerError::NotConnected),
			Err(_) => {
				self.inner.explorer.lock().remove(&id);
				Err(ExplorerError::Timeout(EXPLORER_TIMEOUT.as_millis() as u64))
			}
		}
	}
}

/// An `explorer-object-request` frame without its `id`.
pub(crate) fn object_request(target: &ExplorerTarget) -> serde_json::Value {
	json!({ "type": "explorer-object-request", "target": target })
}

/// An `explorer-members-request` frame without its `id`; an empty `filter` is left out.
pub(crate) fn members_request(
	class_name: &str,
	kind: ExplorerMemberKind,
	offset: u32,
	filter: &str,
) -> serde_json::Value {
	let mut request = json!({
		"type": "explorer-members-request",
		"className": class_name,
		"kind": kind,
		"offset": offset,
		"limit": EXPLORER_MEMBERS_PAGE_SIZE,
	});
	if !filter.is_empty() {
		request["filter"] = filter.into();
	}
	request
}

/// An `explorer-values-request` frame without its `id`.
pub(crate) fn values_request(
	object: &str,
	class_name: &str,
	kind: ExplorerMemberKind,
	names: &[String],
	invoke_getters: bool,
) -> serde_json::Value {
	json!({
		"type": "explorer-values-request",
		"object": object,
		"className": class_name,
		"kind": kind,
		"names": names,
		"invokeGetters": invoke_getters,
	})
}

/// An `explorer-classes-request` frame without its `id`; no `image` lists the images.
pub(crate) fn classes_request(image: Option<&str>, filter: &str, offset: u32) -> serde_json::Value {
	let mut request = json!({
		"type": "explorer-classes-request",
		"offset": offset,
		"limit": EXPLORER_CLASSES_PAGE_SIZE,
	});
	if let Some(image) = image {
		request["image"] = image.into();
	}
	if !filter.is_empty() {
		request["filter"] = filter.into();
	}
	request
}

/// The error a failed result frame carries.
fn failure(error: Option<String>, code: Option<ExplorerErrorCode>) -> ExplorerError {
	ExplorerError::Device {
		code: code.unwrap_or(ExplorerErrorCode::Failed),
		message: error.unwrap_or_else(|| "The device sent no answer.".into()),
	}
}

/// Delivers an `explorer-*-result` frame to the request waiting on its id; other frames are ignored.
pub(crate) fn settle(inner: &Inner, frame: BridgeFrame) {
	let (id, outcome) = match frame {
		BridgeFrame::ExplorerObjectResult {
			id,
			ok,
			object,
			error,
			code,
		} => {
			let outcome = match object {
				Some(object) if ok => Ok(ExplorerReply::Object(object)),
				_ => Err(failure(error, code)),
			};
			(id, outcome)
		}
		BridgeFrame::ExplorerMembersResult {
			id,
			ok,
			members,
			total,
			error,
			code,
		} => {
			let outcome = if ok {
				let total = total.unwrap_or(members.len() as u32);
				Ok(ExplorerReply::Members(MembersPage { members, total }))
			} else {
				Err(failure(error, code))
			};
			(id, outcome)
		}
		BridgeFrame::ExplorerValuesResult {
			id,
			ok,
			values,
			error,
			code,
		} => {
			let outcome = if ok {
				Ok(ExplorerReply::Values(values))
			} else {
				Err(failure(error, code))
			};
			(id, outcome)
		}
		BridgeFrame::ExplorerClassesResult {
			id,
			ok,
			total,
			images,
			classes,
			error,
			code,
		} => {
			let outcome = if ok {
				let images = images.unwrap_or_default();
				let classes = classes.unwrap_or_default();
				let total = total.unwrap_or((images.len() + classes.len()) as u32);
				Ok(ExplorerReply::Classes(ClassesPage {
					total,
					images,
					classes,
				}))
			} else {
				Err(failure(error, code))
			};
			(id, outcome)
		}
		_ => return,
	};

	if let Some(waiter) = inner.explorer.lock().remove(&id) {
		let _ = waiter.send(outcome);
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_target_is_one_keyed_object() {
		assert_eq!(
			serde_json::to_value(ExplorerTarget::ClassName("UIView".into())).unwrap(),
			json!({ "className": "UIView" })
		);
		assert_eq!(
			serde_json::to_value(ExplorerTarget::Node("4".into())).unwrap(),
			json!({ "node": "4" })
		);
	}

	#[test]
	fn requests_leave_out_empty_options() {
		let members = members_request("UIView", ExplorerMemberKind::ClassMethods, 100, "");
		assert_eq!(members["kind"], "classMethods");
		assert!(members.get("filter").is_none());
		let values = values_request(
			"e:1",
			"UIView",
			ExplorerMemberKind::Ivars,
			&["_layer".into()],
			false,
		);
		assert_eq!(values["invokeGetters"], false);
		let classes = classes_request(None, "UIKit", 0);
		assert!(classes.get("image").is_none());
		assert_eq!(classes["filter"], "UIKit");
	}

	#[test]
	fn a_count_names_one_member_in_the_singular() {
		assert_eq!(ExplorerMemberKind::Properties.count(1), "1 property");
		assert_eq!(ExplorerMemberKind::Properties.count(0), "0 properties");
		assert_eq!(ExplorerMemberKind::ClassMethods.count(2), "2 class methods");
	}

	#[test]
	fn a_member_reads_its_attributes() {
		let member: ExplorerMember = serde_json::from_value(json!({
			"name": "hidden",
			"kind": "properties",
			"type": "BOOL",
			"signature": "@property (nonatomic, getter=isHidden) BOOL hidden",
			"attributes": ["nonatomic", "getter=isHidden"],
			"read": "manual",
		}))
		.unwrap();
		assert_eq!(member.attribute("getter"), Some("isHidden"));
		assert!(member.has_attribute("nonatomic"));
		assert_eq!(member.read, ExplorerRead::Manual);
		assert!(!member.is_static());
	}

	#[test]
	fn an_unknown_code_or_value_kind_reads_as_the_catch_all() {
		let code: ExplorerErrorCode = serde_json::from_value(json!("brand-new")).unwrap();
		assert_eq!(code, ExplorerErrorCode::Failed);
		let code: ExplorerErrorCode = serde_json::from_value(json!("unknown-class")).unwrap();
		assert_eq!(code, ExplorerErrorCode::UnknownClass);
		let kind: ExplorerValueKind = serde_json::from_value(json!("weird")).unwrap();
		assert_eq!(kind, ExplorerValueKind::Other);
	}
}
