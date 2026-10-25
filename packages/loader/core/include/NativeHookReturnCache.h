#pragma once

#include <map>
#include <mutex>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "NativeResourceBudget.h"

namespace loader::native
{
    std::string canonicalJSON(const nlohmann::json &value);

    class HookReturnCache
    {
    public:
        explicit HookReturnCache(NativeResourceBudget &budget);

        void                       set(const std::string &token, const nlohmann::json &self,
                                       const nlohmann::json &arguments, const nlohmann::json &value);
        bool                       remove(const std::string &token, const nlohmann::json &self,
                                          const nlohmann::json &arguments);
        size_t                     clear(const std::string &token);
        size_t                     clearAll();
        std::optional<std::string> find(const std::string &token, const nlohmann::json &self,
                                        const nlohmann::json &arguments) const;
        std::optional<std::string> findSerialized(const std::string &token, const std::string &selfJSON,
                                                  const std::string &argumentsJSON) const;
        size_t                     size() const;

    private:
        static std::string key(const nlohmann::json &self, const nlohmann::json &arguments);

        NativeResourceBudget                                     &budget_;
        mutable std::mutex                                        mutex_;
        std::map<std::string, std::map<std::string, std::string>> entries_;
    };
}
