//! The view finder: the device's native views, a page of one level at a time, one view's properties
//! when it is selected, and an outline on screen. Serde copies of `@unbound-app/debugger-protocol`'s
//! `views.ts`, sent over the debugger connection; the bridge answers each request on the controller
//! that asked.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::session::{Devtools, RequestError};

/// The bridge gives the device 15 s (`VIEWS_TIMEOUT_MS`); this waits a little longer for its answer.
const VIEWS_TIMEOUT: Duration = Duration::from_secs(17);

/// A rectangle in screen coordinates: dp on Android, points on iOS.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewFrame {
	pub x: f64,
	pub y: f64,
	pub width: f64,
	pub height: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
	Visible,
	Invisible,
	Gone,
}

/// One native view, with only its top-level properties.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewNode {
	/// The device's id for the view, valid until the roots are listed again.
	pub id: String,
	/// The fully qualified Java class name, or the Objective-C class name.
	pub class_name: String,
	/// The Android resource entry name of the view's id, or the iOS accessibility identifier.
	pub resource_name: Option<String>,
	pub frame: ViewFrame,
	pub visibility: Visibility,
	/// Opacity from 0 to 1, when the platform reports it.
	pub alpha: Option<f64>,
	/// The text a text view shows, cut short by the device.
	pub text: Option<String>,
	pub child_count: u32,
}

impl ViewNode {
	/// The class name without its package or module, as the tree shows it.
	pub fn short_name(&self) -> &str {
		self.class_name
			.rsplit(['.', '$'])
			.next()
			.unwrap_or(&self.class_name)
	}
}

/// The most views a device returns for one request (`VIEWS_PAGE_SIZE`); a longer level is read in pages.
pub const VIEWS_PAGE_SIZE: u32 = 100;

/// One page of a level's views, and how many the level holds in all.
#[derive(Clone, Debug, PartialEq)]
pub struct ViewPage {
	pub nodes: Vec<ViewNode>,
	/// `None` from a device that predates paging, which sends the whole level.
	pub total: Option<u32>,
}

/// A property value: text, a number, a flag or nothing.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PropertyValue {
	Null,
	Bool(bool),
	Number(f64),
	String(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PropertyKind {
	/// A `#RRGGBBAA` string, drawn as a swatch.
	Color,
}

/// One property of a native view.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewProperty {
	pub key: String,
	pub value: PropertyValue,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub kind: Option<PropertyKind>,
	/// The unit a number is in, such as `dp`, `pt` or `px`.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub unit: Option<String>,
}

/// A titled group of properties, such as Layout or Accessibility.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ViewSection {
	pub title: String,
	pub properties: Vec<ViewProperty>,
}

/// What a device reads about one view when it is selected, for patching it with the native bridge.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewDetails {
	/// The view's class, then each superclass up to the platform's root view class.
	pub class_chain: Vec<String>,
	pub sections: Vec<ViewSection>,
}

/// A device's answer to a views or view details request.
pub(crate) enum ViewReply {
	Page(ViewPage),
	Details(ViewDetails),
}

/// What the device answered, or why it could not.
pub(crate) type ViewsReply = Result<ViewReply, String>;

impl Devtools {
	/// Lists a page of the children of `parent` from `offset`, or of the root views when `None`;
	/// listing the roots renews every id.
	pub async fn list_views(
		&self,
		parent: Option<String>,
		offset: u32,
	) -> Result<ViewPage, RequestError> {
		match self.request_views(views_request(parent, offset)).await? {
			ViewReply::Page(page) => Ok(page),
			ViewReply::Details(_) => Err(RequestError::Device(
				"The device answered with a view's details.".into(),
			)),
		}
	}

	/// Reads the class chain and properties of the listed view `node`.
	pub async fn view_details(&self, node: &str) -> Result<ViewDetails, RequestError> {
		match self.request_views(view_details_request(node)).await? {
			ViewReply::Details(details) => Ok(details),
			ViewReply::Page(_) => Err(RequestError::Device(
				"The device answered with a page of views.".into(),
			)),
		}
	}

	/// Sends a view finder request with a fresh id and waits for the device's answer to it.
	async fn request_views(
		&self,
		mut request: serde_json::Value,
	) -> Result<ViewReply, RequestError> {
		let id = uuid::Uuid::new_v4().to_string();
		let (reply, response) = oneshot::channel();
		request["id"] = id.clone().into();
		let frame = request.to_string();
		self.inner.views.lock().insert(id.clone(), reply);

		if !self.inner.send_to_bridge(frame) {
			self.inner.views.lock().remove(&id);
			return Err(RequestError::NotConnected);
		}

		let waited = self
			.on_runtime(tokio::time::timeout(VIEWS_TIMEOUT, response))
			.await
			.map_err(|error| RequestError::Device(error.to_string()))?;

		match waited {
			Ok(Ok(Ok(reply))) => Ok(reply),
			Ok(Ok(Err(error))) => Err(RequestError::Device(error)),
			Ok(Err(_)) => Err(RequestError::NotConnected),
			Err(_) => {
				self.inner.views.lock().remove(&id);
				Err(RequestError::Timeout(VIEWS_TIMEOUT.as_millis() as u64))
			}
		}
	}

	/// Outlines the view with this id on the device, or clears the outline when `None`.
	pub fn highlight_view(&self, id: Option<&str>) {
		let frame = json!({ "type": "view-highlight", "node": id }).to_string();
		self.inner.send_to_bridge(frame);
	}
}

/// A `views-request` frame without its `id`, which `request_views` adds.
pub(crate) fn views_request(parent: Option<String>, offset: u32) -> serde_json::Value {
	// The protocol's `parent` is a string or absent; the bridge drops a request with `null`.
	let mut request =
		json!({ "type": "views-request", "offset": offset, "limit": VIEWS_PAGE_SIZE });
	if let Some(parent) = parent {
		request["parent"] = parent.into();
	}
	request
}

/// A `view-details-request` frame without its `id`, which `request_views` adds.
pub(crate) fn view_details_request(node: &str) -> serde_json::Value {
	json!({ "type": "view-details-request", "node": node })
}

/// Delivers a `views-result` or `view-details-result` to the request waiting on its id.
pub(crate) fn settle(devtools: &crate::session::Inner, id: &str, reply: ViewsReply) {
	if let Some(waiter) = devtools.views.lock().remove(id) {
		let _ = waiter.send(reply);
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_node_reads_the_protocols_shape() {
		let node: ViewNode = serde_json::from_value(json!({
			"id": "3",
			"className": "com.facebook.react.views.view.ReactViewGroup",
			"resourceName": null,
			"frame": { "x": 0, "y": 24.5, "width": 411, "height": 60 },
			"visibility": "visible",
			"alpha": 1,
			"text": null,
			"childCount": 2,
		}))
		.expect("a view node");

		assert_eq!(node.short_name(), "ReactViewGroup");
		assert_eq!(node.visibility, Visibility::Visible);
		assert_eq!(node.child_count, 2);
	}
}
