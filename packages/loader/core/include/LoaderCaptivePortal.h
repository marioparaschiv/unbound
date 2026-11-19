#pragma once

#include <optional>
#include <string>

namespace loader {
struct CaptiveProbe {
    std::string url;
    std::string expected;
};

CaptiveProbe platformCaptiveProbe();
bool isCaptivePortal(const std::optional<std::string> &body, const CaptiveProbe &probe);
}
