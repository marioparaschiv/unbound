#pragma once

#include <cstdint>
#include <functional>
#include <future>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace loader {
nlohmann::json             scanPlugins(const std::string &documents, uint32_t bytecodeVersion = 0);
nlohmann::json             scanThemes(const std::string &documents);
nlohmann::json             scanFonts(const std::string &documents);
std::optional<std::string> readPluginBytecode(const std::string &documents,
                                              const std::string &folder, uint32_t bytecodeVersion);
std::optional<std::string> readPluginSource(const std::string &documents,
                                            const std::string &folder);

class AddonState
{
public:
    void prescan(const std::string &documents, uint32_t bytecodeVersion);
    void scan(const std::string &documents, uint32_t bytecodeVersion = 0);

    nlohmann::json                plugins() const;
    nlohmann::json                themes() const;
    nlohmann::json                fonts() const;
    std::optional<nlohmann::json> theme(const std::string &id) const;

private:
    struct Scanned {
        std::string    documents;
        uint32_t       bytecodeVersion = 0;
        nlohmann::json plugins;
        nlohmann::json themes;
        nlohmann::json fonts;
    };

    static Scanned scanAll(const std::string &documents, uint32_t bytecodeVersion);
    bool           adoptPrescan(const std::string &documents, uint32_t bytecodeVersion);

    std::mutex                  prescanMutex_;
    std::shared_future<Scanned> prescan_;
    bool                        scanned_ = false;

    mutable std::mutex mutex_;
    nlohmann::json     plugins_ = nlohmann::json::array();
    nlohmann::json     themes_  = nlohmann::json::array();
    nlohmann::json     fonts_   = nlohmann::json::array();
};
}
