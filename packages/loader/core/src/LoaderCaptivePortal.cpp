#include "LoaderCaptivePortal.h"

namespace loader {
CaptiveProbe platformCaptiveProbe()
{
#if defined(__ANDROID__)
    return {"http://connectivitycheck.gstatic.com/generate_204", ""};
#else
    return {"http://captive.apple.com/hotspot-detect.html", "Success"};
#endif
}

bool isCaptivePortal(const std::optional<std::string> &body, const CaptiveProbe &probe)
{
    if (!body)
    {
        return false;
    }

    return probe.expected.empty() ? !body->empty()
                                  : body->find(probe.expected) == std::string::npos;
}
}
