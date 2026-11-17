#pragma once

#include <string>
#include <vector>

#include "LoaderAddonActivity.h"

namespace loader::native {
struct RewritingHook {
    std::string target;
    std::string addon;
};

std::vector<std::string> conflictsAmong(const std::vector<RewritingHook> &hooks);
std::string addonDisplayName(AddonSlot slot);

void recordRewritingHook(const std::string &token, const std::string &target, AddonSlot addon);
void forgetRewritingHook(const std::string &token);
void forgetAllRewritingHooks();
std::vector<RewritingHook> recordedRewritingHooks();
}
