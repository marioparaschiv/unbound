#include "LoaderDiagnostics.h"

namespace loader::diagnostics {
static bool isContinuationByte(char byte)
{
    return (static_cast<unsigned char>(byte) & 0xC0) == 0x80;
}

static std::string known(const std::string &value)
{
    return value.empty() ? "unknown" : value;
}

std::string bannerSubject(const std::string &subject)
{
    if (subject.size() <= kBannerSubjectLength)
    {
        return subject;
    }
    size_t length = kBannerSubjectLength;
    while (length > 0 && isContinuationByte(subject[length]))
    {
        length--;
    }
    return subject.substr(0, length) + "...";
}

std::string developmentBuildBanner(const BuildInfo &info)
{
    return std::string(kDevelopmentBuildTitle) + "\n#" + known(info.commit) + " - " +
           bannerSubject(info.subject) + " - " + known(info.branch) +
           "\nBuilt: " + known(info.timestamp);
}
}
