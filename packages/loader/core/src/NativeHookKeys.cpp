#include "NativeHookKeys.h"

#include <atomic>
#include <nlohmann/json.hpp>

namespace loader::native {
static std::atomic_uint64_t gNextHookIdentifier{1};

uint64_t nextHookIdentifier()
{
    return gNextHookIdentifier.fetch_add(1);
}

std::string hookCallbackKey(std::string_view platform, std::string_view id)
{
    std::string key(platform);
    key += "-hook:";
    key += id;
    return key;
}

std::string receiverCoalesceKey(std::string_view platform, std::string_view id,
                                std::string_view receiver)
{
    std::string key = hookCallbackKey(platform, id);
    key += ":";
    key += receiver;
    return key;
}

std::optional<std::string> coalescedHookKey(std::string_view platform, std::string_view token,
                                            const std::string &payload)
{
    nlohmann::json parsed = nlohmann::json::parse(payload, nullptr, false);
    if (!parsed.is_object())
    {
        return std::nullopt;
    }
    auto self = parsed.find("self");
    if (self == parsed.end() || !self->is_object())
    {
        return std::nullopt;
    }
    auto type  = self->find("type");
    auto value = self->find("value");
    if (type == self->end() || !type->is_string() || *type != "handle" || value == self->end() ||
        !value->is_string())
    {
        return std::nullopt;
    }
    return receiverCoalesceKey(platform, token, value->get_ref<const std::string &>());
}
}
