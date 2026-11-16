#include "LoaderStrings.h"

#include <map>
#include <mutex>
#include <nlohmann/json.hpp>

#include "LoaderFiles.h"

namespace loader {
namespace {
    using StringMap = std::map<std::string, std::string, std::less<>>;

    struct StringTable {
        std::mutex mutex;
        StringMap strings;
    };

    StringTable &table()
    {
        static StringTable shared;
        return shared;
    }

    std::string substitute(std::string message, const TextValues &values)
    {
        for (const auto &[name, value] : values)
        {
            const std::string placeholder = "{" + name + "}";
            for (size_t at = message.find(placeholder); at != std::string::npos;
                 at        = message.find(placeholder, at + value.size()))
            {
                message.replace(at, placeholder.size(), value);
            }
        }

        return message;
    }
}

void setStrings(const std::string &json)
{
    nlohmann::json parsed = nlohmann::json::parse(json, nullptr, false);
    StringMap strings;
    if (parsed.is_object())
    {
        for (const auto &[key, value] : parsed.items())
        {
            if (value.is_string() && !value.get<std::string>().empty())
            {
                strings.emplace(key, value.get<std::string>());
            }
        }
    }

    StringTable &shared = table();
    std::lock_guard<std::mutex> lock(shared.mutex);
    shared.strings = std::move(strings);
}

void loadStrings(const std::string &documents)
{
    setStrings(readTextFile(joinPath(documents, kLoaderStringsFile)).value_or(""));
}

std::string text(std::string_view key, std::string_view english, const TextValues &values)
{
    std::string message;
    {
        StringTable &shared = table();
        std::lock_guard<std::mutex> lock(shared.mutex);
        auto found = shared.strings.find(key);
        message    = found == shared.strings.end() ? std::string(english) : found->second;
    }

    return substitute(std::move(message), values);
}
}
