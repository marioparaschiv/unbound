#pragma once

#include <cstdint>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>

namespace loader::system_exits {
constexpr const char *kSystemExitsFile = "system-exits.json";
constexpr int64_t     kSummaryWindowMs = 7ll * 24 * 60 * 60 * 1000;

enum class ExitKind
{
    Memory,
    Watchdog,
    CPU,
    LockedFile,
    Hang,
};

std::string exitKindName(ExitKind kind);
int64_t     parseMetricKitTimestamp(const std::string &timestamp);
int64_t     parseMetricKitDuration(const std::string &duration);

void recordMetricKitMetrics(const std::string &documents, const std::string &payloadJSON);
void recordMetricKitDiagnostics(const std::string &documents, const std::string &payloadJSON);
void recordExit(const std::string &documents, const std::string &key, ExitKind kind, int64_t at,
                int64_t durationMs = 0);

nlohmann::json summary(const std::string &documents, int64_t now);
}
