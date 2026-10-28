#pragma once

#include <cstdint>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader::native {
using HandleMatcher = std::function<std::optional<std::string>(const nlohmann::json &)>;
using HandleRelease = std::function<void(const std::string &id, uint64_t issues)>;

class HandleLeaseLedger;

class HandleLeases
{
public:
    HandleLeases(HandleMatcher matcher, HandleRelease release);

    facebook::jsi::Value adopt(facebook::jsi::Runtime &runtime, const nlohmann::json &value) const;
    size_t               liveHandles() const;

private:
    facebook::jsi::Value convert(facebook::jsi::Runtime &runtime, const nlohmann::json &value,
                                 size_t depth) const;

    HandleMatcher                      matcher_;
    std::shared_ptr<HandleLeaseLedger> ledger_;
};
}
