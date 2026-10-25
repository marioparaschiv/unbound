#include <cassert>
#include <string>

#include "LoaderDiagnostics.h"

using namespace loader::diagnostics;

int main()
{
    assert(std::string(kIncompatibleHostMessage).find("incompatible") != std::string::npos);

    assert(bannerSubject("fix: short") == "fix: short");
    const std::string exact(kBannerSubjectLength, 'a');
    assert(bannerSubject(exact) == exact);
    assert(bannerSubject(exact + "b") == exact + "...");
    const std::string accented = std::string(kBannerSubjectLength - 1, 'a') + "\xC3\xA9tail";
    assert(bannerSubject(accented) == std::string(kBannerSubjectLength - 1, 'a') + "...");

    assert(developmentBuildBanner({"c05d3486", "feat(loader): drive the dev overlay from core",
                                   "feat/loader-leftovers", "2026-10-25 20:00:00 CET"}) ==
           "DEVELOPMENT BUILD - DO NOT USE\n#c05d3486 - feat(loader): drive the dev overlay ... - "
           "feat/loader-leftovers\nBuilt: 2026-10-25 20:00:00 CET");
    assert(developmentBuildBanner({}) ==
           "DEVELOPMENT BUILD - DO NOT USE\n#unknown -  - unknown\nBuilt: unknown");
    return 0;
}
