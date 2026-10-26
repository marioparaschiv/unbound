#include "LoaderToolbox.h"

namespace loader::toolbox {
static std::string text(const nlohmann::json &item, const char *key)
{
    return item.is_object() && item.contains(key) && item[key].is_string()
               ? item[key].get<std::string>()
               : std::string();
}

static bool flag(const nlohmann::json &item, const char *key)
{
    return item.is_object() && item.contains(key) && item[key].is_boolean() &&
           item[key].get<bool>();
}

MenuStep menuStep(const nlohmann::json &item, bool confirmed)
{
    if (!item.is_object() || text(item, "kind") == "toggle")
    {
        return MenuStep::None;
    }
    if (flag(item, "destructive") && !confirmed)
    {
        return MenuStep::Confirm;
    }
    if (text(item, "kind") == "platform")
    {
        return MenuStep::Platform;
    }
    if (item.contains("prompt") && item["prompt"].is_object())
    {
        return MenuStep::Prompt;
    }
    return MenuStep::Run;
}

MenuOutcome menuOutcome(const nlohmann::json &item, const std::string &result)
{
    if (!text(item, "failure").empty() && result != "true")
    {
        return MenuOutcome::Failed;
    }
    return flag(item, "restartsApp") ? MenuOutcome::Restart : MenuOutcome::Done;
}

const char *menuStepName(MenuStep step)
{
    switch (step)
    {
        case MenuStep::None:
            return "none";
        case MenuStep::Confirm:
            return "confirm";
        case MenuStep::Platform:
            return "platform";
        case MenuStep::Prompt:
            return "prompt";
        case MenuStep::Run:
            return "run";
    }
    return "none";
}

const char *menuOutcomeName(MenuOutcome outcome)
{
    switch (outcome)
    {
        case MenuOutcome::Done:
            return "done";
        case MenuOutcome::Failed:
            return "failed";
        case MenuOutcome::Restart:
            return "restart";
    }
    return "done";
}

static nlohmann::json menuRequest(const std::string &request)
{
    nlohmann::json parsed = nlohmann::json::parse(request, nullptr, false);
    return parsed.is_object() ? parsed : nlohmann::json::object();
}

std::string menuStepFor(const std::string &request)
{
    const nlohmann::json input = menuRequest(request);
    return menuStepName(menuStep(input.value("item", nlohmann::json()), flag(input, "confirmed")));
}

std::string menuOutcomeFor(const std::string &request)
{
    const nlohmann::json input = menuRequest(request);
    return menuOutcomeName(
        menuOutcome(input.value("item", nlohmann::json()), text(input, "result")));
}

bool isShakeGesture(double seconds)
{
    return seconds >= kShakeMinimumSeconds && seconds <= kShakeMaximumSeconds;
}

std::string discordVersionLabel(const std::optional<std::string> &version, const std::string &build)
{
    return version ? *version + " (" + build + ")" : std::string();
}

std::vector<std::string> appFolderURLs(const std::string &documents, bool jailbroken)
{
    std::vector<std::string> urls;
    if (jailbroken)
    {
        urls.push_back("filza://view" + documents);
    }
    urls.push_back("shareddocuments://" + documents);
    return urls;
}
}
