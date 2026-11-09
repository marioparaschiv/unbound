#include "LoaderSettings.h"

#include "LoaderJSON.h"

namespace loader {
static std::vector<std::string> splitKeyPath(const std::string &key)
{
    std::vector<std::string> parts;
    size_t                   start = 0;
    while (start <= key.size())
    {
        size_t end = key.find('.', start);
        if (end == std::string::npos)
        {
            parts.push_back(key.substr(start));
            break;
        }
        parts.push_back(key.substr(start, end - start));
        start = end + 1;
    }
    return parts;
}

SettingsStore::SettingsStore(std::string path, std::chrono::milliseconds diskRecheck)
    : path_(std::move(path)), diskRecheck_(diskRecheck)
{
}

nlohmann::json SettingsStore::snapshot() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    parseAllLocked();
    return data_;
}

std::string SettingsStore::serialize() const
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked();
    parseAllLocked();
    return data_.dump(2);
}

bool SettingsStore::replace(const std::string &json)
{
    nlohmann::json parsed = parseBoundedJSON(json);
    if (parsed.is_discarded() || !parsed.is_object())
    {
        return false;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    data_ = std::move(parsed);
    raw_.clear();
    dirty_ = true;
    return true;
}

const nlohmann::json *SettingsStore::findLocked(const std::string &store,
                                                const std::string &key) const
{
    refreshLocked();
    parseStoreLocked(store);

    auto storeEntry = data_.find(store);
    if (storeEntry == data_.end() || !storeEntry->is_object())
    {
        return nullptr;
    }

    const nlohmann::json *current = &*storeEntry;
    if (key.empty())
    {
        return current;
    }

    for (const std::string &part : splitKeyPath(key))
    {
        if (!current->is_object())
        {
            return nullptr;
        }

        auto next = current->find(part);
        if (next == current->end())
        {
            return nullptr;
        }
        current = &*next;
    }

    return current->is_null() ? nullptr : current;
}

std::optional<nlohmann::json> SettingsStore::get(const std::string &store,
                                                 const std::string &key) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    const nlohmann::json       *value = findLocked(store, key);
    return value ? std::optional<nlohmann::json>(*value) : std::nullopt;
}

bool SettingsStore::read(const std::string &store, const std::string &key,
                         const std::function<void(const nlohmann::json &)> &reader) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    const nlohmann::json       *value = findLocked(store, key);
    if (value)
    {
        reader(*value);
    }
    return value != nullptr;
}

bool SettingsStore::getBoolean(const std::string &store, const std::string &key,
                               bool fallback) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    const nlohmann::json       *value = findLocked(store, key);
    if (!value)
    {
        return fallback;
    }

    if (value->is_boolean())
    {
        return value->get<bool>();
    }

    if (value->is_number())
    {
        return value->get<double>() != 0;
    }

    if (value->is_string())
    {
        const std::string &text = value->get_ref<const std::string &>();
        return text == "true" || text == "1" || text == "yes";
    }

    return fallback;
}

std::string SettingsStore::getString(const std::string &store, const std::string &key,
                                     const std::string &fallback) const
{
    std::lock_guard<std::mutex> lock(mutex_);
    const nlohmann::json       *value = findLocked(store, key);
    if (!value || !value->is_string())
    {
        return fallback;
    }

    return value->get<std::string>();
}

void SettingsStore::set(const std::string &store, const std::string &key, nlohmann::json value)
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked(true);
    setLocked(store, key, std::move(value));
}

void SettingsStore::remove(const std::string &store, const std::string &key)
{
    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked(true);
    removeLocked(store, key);
}

bool SettingsStore::apply(const nlohmann::json &changes)
{
    return stage(changes) && save();
}

bool SettingsStore::stage(const nlohmann::json &changes)
{
    if (!changes.is_array() || jsonNestsTooDeeply(changes))
    {
        return false;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    refreshLocked(true);
    applyLocked(changes);
    return true;
}

bool SettingsStore::flush()
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!dirty_)
        {
            return true;
        }
    }
    return save();
}

void SettingsStore::applyLocked(const nlohmann::json &changes)
{
    for (const nlohmann::json &change : changes)
    {
        if (!change.is_object() || !change.contains("store") || !change["store"].is_string())
        {
            continue;
        }
        if (change.contains("clear") && change["clear"].is_boolean() && change["clear"].get<bool>())
        {
            const std::string &store  = change["store"].get_ref<const std::string &>();
            bool               erased = data_.erase(store) > 0;
            erased                    = raw_.erase(store) > 0 || erased;
            dirty_                    = erased || dirty_;
            continue;
        }
        if (!change.contains("key") || !change["key"].is_string())
        {
            continue;
        }

        const std::string store = change["store"].get<std::string>();
        const std::string key   = change["key"].get<std::string>();
        if (change.contains("remove") && change["remove"].is_boolean() &&
            change["remove"].get<bool>())
        {
            removeLocked(store, key);
        }
        else
        {
            setLocked(store, key,
                      change.contains("value") ? change["value"] : nlohmann::json(nullptr));
        }
    }
}

void SettingsStore::setLocked(const std::string &store, const std::string &key,
                              nlohmann::json value)
{
    dirty_ = true;
    parseStoreLocked(store);

    nlohmann::json &payload = data_[store];
    if (!payload.is_object())
    {
        payload = nlohmann::json::object();
    }

    std::vector<std::string> parts   = splitKeyPath(key);
    nlohmann::json          *current = &payload;
    for (size_t index = 0; index + 1 < parts.size(); index++)
    {
        nlohmann::json &next = (*current)[parts[index]];
        if (!next.is_object())
        {
            next = nlohmann::json::object();
        }
        current = &next;
    }

    (*current)[parts.back()] = std::move(value);
}

void SettingsStore::removeLocked(const std::string &store, const std::string &key)
{
    parseStoreLocked(store);
    auto payload = data_.find(store);
    if (payload == data_.end() || !payload->is_object())
    {
        return;
    }

    std::vector<std::string>      parts   = splitKeyPath(key);
    std::vector<nlohmann::json *> parents = {&*payload};
    for (size_t index = 0; index + 1 < parts.size(); index++)
    {
        auto next = parents.back()->find(parts[index]);
        if (next == parents.back()->end() || !next->is_object())
        {
            return;
        }
        parents.push_back(&*next);
    }

    if (parents.back()->erase(parts.back()) == 0)
    {
        return;
    }
    dirty_ = true;

    for (size_t index = parents.size() - 1; index > 0; index--)
    {
        if (!parents[index]->empty())
        {
            break;
        }
        parents[index - 1]->erase(parts[index - 1]);
    }

    if (payload->empty())
    {
        data_.erase(payload);
    }
}

const std::string &SettingsStore::path() const
{
    return path_;
}
}
