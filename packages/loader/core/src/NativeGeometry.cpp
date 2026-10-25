#include "NativeGeometry.h"

#include <cmath>
#include <stdexcept>
#include <string>

namespace loader::native
{
    namespace jsi = facebook::jsi;

    static double finiteField(const nlohmann::json &value, const char *subject, const char *field)
    {
        auto found = value.find(field);
        if (found == value.end() || !found->is_number())
        {
            throw std::invalid_argument(std::string(subject) + " " + field + " must be a number");
        }
        double number = found->get<double>();
        if (!std::isfinite(number))
        {
            throw std::invalid_argument(std::string(subject) + " " + field + " must be finite");
        }
        return number;
    }

    static double dimension(const nlohmann::json &value, const char *subject, const char *field)
    {
        double number = finiteField(value, subject, field);
        if (number < 0 || number > kMaximumNativeDimension)
        {
            throw std::invalid_argument(std::string(subject) + " " + field +
                                        " must be between 0 and 32768");
        }
        return number;
    }

    static double coordinate(const nlohmann::json &value, const char *subject, const char *field)
    {
        double number = finiteField(value, subject, field);
        if (number < -kMaximumNativeCoordinate || number > kMaximumNativeCoordinate)
        {
            throw std::invalid_argument(std::string(subject) + " " + field +
                                        " must be between -100000 and 100000");
        }
        return number;
    }

    static void requireObject(const nlohmann::json &value, const char *subject)
    {
        if (!value.is_object())
        {
            throw std::invalid_argument(std::string(subject) + " must be an object");
        }
    }

    NativeSize parseSize(const nlohmann::json &value)
    {
        requireObject(value, "size");
        return {dimension(value, "size", "width"), dimension(value, "size", "height")};
    }

    NativeFrame parseFrame(const nlohmann::json &value)
    {
        requireObject(value, "frame");
        return {coordinate(value, "frame", "x"), coordinate(value, "frame", "y"),
                dimension(value, "frame", "width"), dimension(value, "frame", "height")};
    }

    static nlohmann::json numericFields(jsi::Runtime &runtime, const jsi::Value &value,
                                        std::initializer_list<const char *> fields)
    {
        if (!value.isObject())
        {
            return nullptr;
        }
        jsi::Object    object = value.asObject(runtime);
        nlohmann::json result = nlohmann::json::object();
        for (const char *field : fields)
        {
            jsi::Value property = object.getProperty(runtime, field);
            if (property.isNumber())
            {
                result[field] = property.getNumber();
            }
        }
        return result;
    }

    NativeSize parseSize(jsi::Runtime &runtime, const jsi::Value &value)
    {
        return parseSize(numericFields(runtime, value, {"width", "height"}));
    }

    NativeFrame parseFrame(jsi::Runtime &runtime, const jsi::Value &value)
    {
        return parseFrame(numericFields(runtime, value, {"x", "y", "width", "height"}));
    }

    nlohmann::json toJSON(const NativeSize &size)
    {
        return {{"width", size.width}, {"height", size.height}};
    }

    nlohmann::json toJSON(const NativeFrame &frame)
    {
        return {{"x", frame.x}, {"y", frame.y}, {"width", frame.width}, {"height", frame.height}};
    }
}
