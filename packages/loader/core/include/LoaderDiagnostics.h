#pragma once

#include <cstddef>
#include <string>

namespace loader::diagnostics {
struct BuildInfo {
    std::string commit;
    std::string subject;
    std::string branch;
    std::string timestamp;
};

constexpr const char *kIncompatibleHostMessage =
    "This version of Discord is incompatible with this version of Unbound.";
constexpr const char *kDevelopmentBuildTitle = "DEVELOPMENT BUILD - DO NOT USE";
constexpr size_t      kBannerSubjectLength   = 36;
constexpr unsigned    kBannerSeconds         = 10;

std::string bannerSubject(const std::string &subject);
std::string developmentBuildBanner(const BuildInfo &info);
}
