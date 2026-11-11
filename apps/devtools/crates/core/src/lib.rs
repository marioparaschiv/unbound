//! The frontend half of React DevTools for Unbound.
//!
//! A device runs the client build's `devtools.<bytecode>.bundle` (react-devtools-core's backend) and dials
//! this frontend over a WebSocket. [`Devtools`] owns that socket, decodes the backend's frames into
//! an element [`Store`], and answers inspection and edit requests. The GUI and the MCP server are
//! both thin front-ends over one [`Devtools`] handle, so an agent sees exactly what the user sees.

pub mod bridge;
mod connect;
pub mod inspect;
mod link;
pub mod mcp;
pub mod operations;
pub mod presets;
pub mod protocol;
pub mod query;
mod server;
mod session;
pub mod store;
pub mod ubd;
pub mod value;

pub use bridge::DeviceInfo;
pub use inspect::{Hook, InspectedElement, OwnerRef, Section};
pub use link::LinkStatus;
pub use presets::{BridgeAddr, ConnectTarget, DevicePreset, PresetError, Presets};
pub use query::{FindQuery, JqFilter, NameMatch};
pub use session::{BridgeState, Config, ConnectionState, Devtools, RequestError, Status};
pub use store::{Element, ElementId, ElementKind, RendererId, Row, Store};
pub use value::{Meta, Path, PathSegment, Value};

/// The port react-devtools-core's backend dials by default.
pub const DEFAULT_DEVTOOLS_PORT: u16 = 8097;
/// The Unbound debugger bridge's port (`@unbound-app/debugger-protocol`'s `DEFAULT_BRIDGE_PORT`),
/// checked against the protocol's contract fixture in `bridge::contract`.
pub const DEFAULT_BRIDGE_PORT: u16 = 9090;
/// Where the GUI serves its MCP endpoint (`http://127.0.0.1:8098/mcp`).
pub const DEFAULT_MCP_PORT: u16 = 8098;
