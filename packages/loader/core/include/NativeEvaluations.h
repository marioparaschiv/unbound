#pragma once

#include <chrono>
#include <cstddef>
#include <deque>
#include <jsi/jsi.h>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace loader::native {
constexpr size_t kEvaluationHistoryLimit  = 50;
constexpr size_t kEvaluationFieldLimit    = 16384;
constexpr size_t kEvaluationLogLineLimit  = 200;
constexpr size_t kEvaluationLogFieldLimit = 512;

enum class EvaluationLogLevel
{
    Log   = 1,
    Warn  = 2,
    Error = 3,
};

struct EvaluationLogLine {
    EvaluationLogLevel level;
    std::string        message;
};

struct EvaluationRecord {
    std::string                           identifier;
    std::string                           code;
    bool                                  ok = false;
    std::optional<std::string>            value;
    std::optional<std::string>            error;
    std::vector<EvaluationLogLine>        logs;
    std::chrono::system_clock::time_point recordedAt;
};

std::string      truncatedText(const std::string &text, size_t limit);
EvaluationRecord parseEvaluationRecord(const nlohmann::json &input);
nlohmann::json   evaluationRecordJSON(const EvaluationRecord &record);

class EvaluationHistory
{
public:
    static EvaluationHistory &shared();

    bool                          record(const nlohmann::json &input);
    std::vector<EvaluationRecord> records() const;
    nlohmann::json                json() const;
    void                          clear();

private:
    mutable std::mutex           mutex_;
    std::deque<EvaluationRecord> records_;
};

facebook::jsi::Function makeRecordEvaluationFunction(facebook::jsi::Runtime &runtime);
}
