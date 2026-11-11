//! The view finder: the device's native views, one level at a time, and an outline on screen.
//! Serde copies of `@unbound-app/debugger-protocol`'s `views.ts`, sent over the debugger
//! connection; the bridge answers each `views-request` on the controller that asked.

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

/// What the device answered: the views, or why it could not list them.
pub(crate) type ViewsReply = Result<Vec<ViewNode>, String>;

impl Devtools {
	/// Lists the children of `parent`, or the root views when `None`, which renews every id.
	pub async fn list_views(&self, parent: Option<String>) -> Result<Vec<ViewNode>, RequestError> {
		let id = uuid::Uuid::new_v4().to_string();
		let (reply, response) = oneshot::channel();
		// The protocol's `parent` is a string or absent; the bridge drops a request with `null`.
		let mut request = json!({ "type": "views-request", "id": id });
		if let Some(parent) = parent {
			request["parent"] = parent.into();
		}
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
			Ok(Ok(Ok(nodes))) => Ok(nodes),
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

/// Delivers a `views-result` to the request waiting on its id.
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
