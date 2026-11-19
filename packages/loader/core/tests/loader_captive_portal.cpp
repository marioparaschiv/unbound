#include <cassert>

#include "LoaderCaptivePortal.h"

int main()
{
    loader::CaptiveProbe apple{"http://captive.apple.com/hotspot-detect.html", "Success"};
    assert(!loader::isCaptivePortal(
        "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>", apple));
    assert(loader::isCaptivePortal("<html><title>Hotel Wi-Fi login</title></html>", apple));
    assert(!loader::isCaptivePortal(std::nullopt, apple));

    loader::CaptiveProbe google{"http://connectivitycheck.gstatic.com/generate_204", ""};
    assert(!loader::isCaptivePortal(std::string(), google));
    assert(loader::isCaptivePortal("<html>Sign in to continue</html>", google));
    assert(!loader::isCaptivePortal(std::nullopt, google));

    assert(!loader::platformCaptiveProbe().url.empty());
    return 0;
}
