//! The frontend half of React DevTools for Unbound.
//!
//! A device runs the client build's `devtools.<bytecode>.bundle` (react-devtools-core's backend), and
//! Unbound's client carries its messages over the debugger socket. [`Devtools`] dials the debugger
//! bridge as a controller, decodes the backend's frames into an element [`Store`], answers
//! inspection and edit requests, and lists the device's native views. The GUI and the MCP server are
//! both thin front-ends over one [`Devtools`] handle, so an agent sees exactly what the user sees.

mod backend;
pub mod bridge;
mod connect;
mod device_address;
pub mod explorer;
pub mod inspect;
mod link;
pub mod mcp;
pub mod operations;
pub mod presets;
pub mod protocol;
pub mod query;
mod session;
pub mod store;
pub mod ubd;
pub mod value;
pub mod views;

pub use bridge::DeviceInfo;
pub use device_address::DeviceAddress;
pub use explorer::{
	ClassesPage, EXPLORER_CLASSES_PAGE_SIZE, EXPLORER_MEMBERS_PAGE_SIZE, EXPLORER_VALUES_LIMIT,
	ExplorerClass, ExplorerError, ExplorerErrorCode, ExplorerImage, ExplorerMember,
	ExplorerMemberKind, ExplorerObject, ExplorerPlatform, ExplorerRead, ExplorerTarget,
	ExplorerValue, ExplorerValueKind, MembersPage,
};
pub use inspect::{Hook, InspectedElement, OwnerRef, Section};
pub use link::LinkStatus;
pub use presets::{BridgeAddr, ConnectTarget, DevicePreset, PresetError, Presets};
pub use query::{FindQuery, JqFilter, NameMatch};
pub use session::{BridgeState, Config, ConnectionState, Devtools, RequestError, Status};
pub use store::{Element, ElementId, ElementKind, RendererId, Row, Store};
pub use value::{Meta, Path, PathSegment, Value};
pub use views::{
	PropertyKind, PropertyValue, VIEWS_PAGE_SIZE, ViewDetails, ViewFrame, ViewNode, ViewPage,
	ViewProperty, ViewSection, Visibility,
};

/// The Unbound debugger bridge's port (`@unbound-app/debugger-protocol`'s `DEFAULT_BRIDGE_PORT`),
/// checked against the protocol's contract fixture in `bridge::contract`.
pub const DEFAULT_BRIDGE_PORT: u16 = 9090;
/// Where the GUI serves its MCP endpoint (`http://127.0.0.1:8098/mcp`).
pub const DEFAULT_MCP_PORT: u16 = 8098;
