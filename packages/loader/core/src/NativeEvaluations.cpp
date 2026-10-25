#include "NativeEvaluations.h"

#include <stdexcept>

#include "LoaderLog.h"
#include "NativePluginRuntime.h"

namespace loader::native
{
    namespace jsi = facebook::jsi;

    static constexpr size_t kEvaluationInputDepth = 4;

    static size_t codePointBoundary(const std::string &text, size_t limit)
    {
        size_t end = std::min(limit, text.size());
        while (end > 0 && end < text.size() && (static_cast<unsigned char>(text[end]) & 0xC0) == 0x80)
        {
            end--;
        }
        return end;
    }

    std::string truncatedText(const std::string &text, size_t limit)
    {
        if (text.size() <= limit)
        {
            return text;
        }

        size_t end = codePointBoundary(text, limit);
        return text.substr(0, end) + "... (" + std::to_string(text.size() - end) + " more bytes)";
    }

    static std::optional<std::string> optionalText(const nlohmann::json &input, const char *name)
    {
        auto found = input.find(name);
        if (found == input.end() || found->is_null())
        {
            return std::nullopt;
        }
        if (!found->is_string())
        {
            throw std::invalid_argument("value and error must be strings when present");
        }
        return truncatedText(found->get<std::string>(), kEvaluationFieldLimit);
    }

    static std::vector<EvaluationLogLine> parseLogs(const nlohmann::json &input)
    {
        std::vector<EvaluationLogLine> lines;
        auto                           found = input.find("logs");
        if (found == input.end() || found->is_null())
        {
            return lines;
        }
        if (!found->is_array())
        {
            throw std::invalid_argument("logs must be an array when present");
        }

        for (size_t index = 0; index < found->size(); index++)
        {
            const nlohmann::json &line = (*found)[index];
            const std::string     position = "logs[" + std::to_string(index) + "]";
            if (!line.is_object())
            {
                throw std::invalid_argument(position + " must be an object");
            }

            auto level   = line.find("level");
            auto message = line.find("message");
            if (level == line.end() || !level->is_number() || message == line.end() || !message->is_string())
            {
                throw std::invalid_argument(position + " must have a level of 1, 2 or 3 and a string message");
            }

            double number = level->get<double>();
            if (number != 1 && number != 2 && number != 3)
            {
                throw std::invalid_argument(position + " must have a level of 1, 2 or 3 and a string message");
            }

            if (lines.size() < kEvaluationLogLineLimit)
            {
                lines.push_back({static_cast<EvaluationLogLevel>(static_cast<int>(number)),
                                 truncatedText(message->get<std::string>(), kEvaluationFieldLimit)});
            }
        }
        return lines;
    }

    EvaluationRecord parseEvaluationRecord(const nlohmann::json &input)
    {
        if (!input.is_object())
        {
            throw std::invalid_argument("expected an evaluation record object");
        }

        auto identifier = input.find("id");
        auto code       = input.find("code");
        auto ok         = input.find("ok");
        if (identifier == input.end() || !identifier->is_string() || identifier->get<std::string>().empty() ||
            code == input.end() || !code->is_string() || ok == input.end() || !ok->is_boolean())
        {
            throw std::invalid_argument("id and code must be strings and ok must be a boolean");
        }

        EvaluationRecord record;
        record.identifier = truncatedText(identifier->get<std::string>(), kEvaluationFieldLimit);
        record.code       = truncatedText(code->get<std::string>(), kEvaluationFieldLimit);
        record.ok         = ok->get<bool>();
        record.value      = optionalText(input, "value");
        record.error      = optionalText(input, "error");
        record.logs       = parseLogs(input);
        record.recordedAt = std::chrono::system_clock::now();
        return record;
    }

    nlohmann::json evaluationRecordJSON(const EvaluationRecord &record)
    {
        nlohmann::json logs = nlohmann::json::array();
        for (const auto &line : record.logs)
        {
            logs.push_back({{"level", static_cast<int>(line.level)}, {"message", line.message}});
        }

        auto milliseconds =
            std::chrono::duration_cast<std::chrono::milliseconds>(record.recordedAt.time_since_epoch()).count();
        return {
            {"id", record.identifier},
            {"code", record.code},
            {"ok", record.ok},
            {"value", record.value ? nlohmann::json(*record.value) : nlohmann::json(nullptr)},
            {"error", record.error ? nlohmann::json(*record.error) : nlohmann::json(nullptr)},
            {"logs", std::move(logs)},
            {"recordedAt", milliseconds},
        };
    }

    static LogLevel logLevel(EvaluationLogLevel level)
    {
        switch (level)
        {
            case EvaluationLogLevel::Error:
                return LogLevel::Error;
            case EvaluationLogLevel::Warn:
                return LogLevel::Warning;
            case EvaluationLogLevel::Log:
                return LogLevel::Info;
        }
        return LogLevel::Info;
    }

    static const char *levelName(EvaluationLogLevel level)
    {
        switch (level)
        {
            case EvaluationLogLevel::Error:
                return "error";
            case EvaluationLogLevel::Warn:
                return "warn";
            case EvaluationLogLevel::Log:
                return "log";
        }
        return "log";
    }

    static void logRecord(const EvaluationRecord &record)
    {
        std::string outcome = record.ok ? truncatedText(record.value.value_or("undefined"), kEvaluationLogFieldLimit)
                                        : truncatedText(record.error.value_or("unknown error"), kEvaluationLogFieldLimit);
        log(record.ok ? LogLevel::Info : LogLevel::Error, LOG_CATEGORY_DEBUGGER,
            "Eval " + record.identifier + (record.ok ? " succeeded" : " failed") + " (" +
                std::to_string(record.logs.size()) + " console lines)\n> " +
                truncatedText(record.code, kEvaluationLogFieldLimit) + "\n< " + outcome);

        for (const auto &line : record.logs)
        {
            log(logLevel(line.level), "debugger",
                "Eval " + record.identifier + " [" + levelName(line.level) + "] " +
                    truncatedText(line.message, kEvaluationLogFieldLimit));
        }
    }

    EvaluationHistory &EvaluationHistory::shared()
    {
        static EvaluationHistory history;
        return history;
    }

    bool EvaluationHistory::record(const nlohmann::json &input)
    {
        EvaluationRecord record;
        try
        {
            record = parseEvaluationRecord(input);
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Error, LOG_CATEGORY_DEBUGGER, std::string("Rejected evaluation record: ") + error.what());
            return false;
        }

        logRecord(record);

        std::lock_guard<std::mutex> lock(mutex_);
        records_.push_back(std::move(record));
        while (records_.size() > kEvaluationHistoryLimit)
        {
            records_.pop_front();
        }
        return true;
    }

    std::vector<EvaluationRecord> EvaluationHistory::records() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return {records_.begin(), records_.end()};
    }

    nlohmann::json EvaluationHistory::json() const
    {
        nlohmann::json result = nlohmann::json::array();
        for (const auto &record : records())
        {
            result.push_back(evaluationRecordJSON(record));
        }
        return result;
    }

    void EvaluationHistory::clear()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        records_.clear();
    }

    static nlohmann::json inputJSON(jsi::Runtime &runtime, const jsi::Value &value, size_t depth)
    {
        if (value.isBool())
        {
            return value.getBool();
        }
        if (value.isNumber())
        {
            return value.getNumber();
        }
        if (value.isString())
        {
            return value.getString(runtime).utf8(runtime);
        }
        if (!value.isObject() || depth >= kEvaluationInputDepth)
        {
            return nullptr;
        }

        jsi::Object object = value.asObject(runtime);
        if (object.isArray(runtime))
        {
            jsi::Array     array  = object.asArray(runtime);
            nlohmann::json result = nlohmann::json::array();
            for (size_t index = 0; index < array.size(runtime); index++)
            {
                result.push_back(inputJSON(runtime, array.getValueAtIndex(runtime, index), depth + 1));
            }
            return result;
        }

        nlohmann::json result = nlohmann::json::object();
        for (const char *name : {"id", "code", "ok", "value", "error", "logs", "level", "message"})
        {
            jsi::Value property = object.getProperty(runtime, name);
            if (!property.isUndefined())
            {
                result[name] = inputJSON(runtime, property, depth + 1);
            }
        }
        return result;
    }

    jsi::Function makeRecordEvaluationFunction(jsi::Runtime &runtime)
    {
        return makeFunction(runtime, "recordEvaluation", 1,
                            [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
                                try
                                {
                                    nlohmann::json input = count ? inputJSON(rt, args[0], 0) : nlohmann::json();
                                    return jsi::Value(EvaluationHistory::shared().record(input));
                                }
                                catch (...)
                                {
                                    log(LogLevel::Error, LOG_CATEGORY_DEBUGGER, "Rejected evaluation record: reading it failed");
                                    return jsi::Value(false);
                                }
                            });
    }
}
