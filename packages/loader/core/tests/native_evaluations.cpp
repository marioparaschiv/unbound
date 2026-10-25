#include <cassert>
#include <string>

#include "NativeEvaluations.h"

using loader::native::EvaluationHistory;

int main()
{
    EvaluationHistory &history = EvaluationHistory::shared();
    history.clear();

    assert(history.record({{"id", "e1"}, {"code", "1 + 1"}, {"ok", true}, {"value", "2"}}));
    auto records = history.records();
    assert(records.size() == 1);
    assert(records[0].identifier == "e1" && records[0].code == "1 + 1" && records[0].ok);
    assert(records[0].value == std::optional<std::string>("2") && !records[0].error);

    assert(!history.record({{"code", "1"}, {"ok", true}}));
    assert(!history.record({{"id", "e1"}, {"ok", true}}));
    assert(!history.record({{"id", "e1"}, {"code", "1"}}));
    assert(!history.record("not an object"));
    assert(!history.record({{"id", "e1"}, {"code", "1"}, {"ok", true}, {"value", 2}}));
    assert(!history.record(
        {{"id", "e1"}, {"code", "1"}, {"ok", true}, {"logs", {{{"level", 4}, {"message", "x"}}}}}));
    assert(history.records().size() == 1);

    assert(history.record(
        {{"id", "e2"},
         {"code", "boom()"},
         {"ok", false},
         {"error", "ReferenceError"},
         {"logs",
          {{{"level", 2}, {"message", "careful"}}, {{"level", 3}, {"message", "failed"}}}}}));
    auto failed = history.records().back();
    assert(!failed.ok && failed.error == std::optional<std::string>("ReferenceError"));
    assert(failed.logs.size() == 2);
    assert(failed.logs[0].level == loader::native::EvaluationLogLevel::Warn &&
           failed.logs[1].message == "failed");

    nlohmann::json serialized = history.json();
    assert(serialized.size() == 2 && serialized[1]["logs"][1]["level"] == 3 &&
           serialized[0]["error"].is_null());

    std::string long_code(loader::native::kEvaluationFieldLimit + 10, 'a');
    assert(history.record({{"id", "e3"}, {"code", long_code}, {"ok", true}}));
    assert(history.records().back().code ==
           std::string(loader::native::kEvaluationFieldLimit, 'a') + "... (10 more bytes)");

    std::string accented = "a\xC3\xA9";
    assert(loader::native::truncatedText(accented, 2) == "a... (2 more bytes)");

    for (int index = 0; index < 60; index++)
    {
        history.record({{"id", "n" + std::to_string(index)}, {"code", "x"}, {"ok", true}});
    }
    assert(history.records().size() == loader::native::kEvaluationHistoryLimit);
    assert(history.records().front().identifier == "n10");

    history.clear();
    assert(history.records().empty());
    return 0;
}
