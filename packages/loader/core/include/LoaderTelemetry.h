#pragma once

#include <string_view>

namespace loader {
// Discord's own analytics endpoints (`/api/v*/science`, `/api/v*/metrics`), which the loader
// answers locally as a backstop to the client's tracking builtin.
bool isTelemetryURL(std::string_view url);
}
