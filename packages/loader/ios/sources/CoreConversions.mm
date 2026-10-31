#import "CoreConversions.h"

namespace astral::ios {
id objectFromJSON(const nlohmann::json &value)
{
    switch (value.type())
    {
        case nlohmann::json::value_t::boolean:
            return @(value.get<bool>());
        case nlohmann::json::value_t::number_integer:
            return @(value.get<int64_t>());
        case nlohmann::json::value_t::number_unsigned:
            return @(value.get<uint64_t>());
        case nlohmann::json::value_t::number_float:
            return @(value.get<double>());
        case nlohmann::json::value_t::string:
            return @(value.get<std::string>().c_str());
        case nlohmann::json::value_t::array: {
            NSMutableArray *array = [NSMutableArray arrayWithCapacity:value.size()];
            for (const nlohmann::json &item : value)
            {
                [array addObject:objectFromJSON(item) ?: [NSNull null]];
            }
            return array;
        }
        case nlohmann::json::value_t::object: {
            NSMutableDictionary *dictionary =
                [NSMutableDictionary dictionaryWithCapacity:value.size()];
            for (auto entry = value.begin(); entry != value.end(); ++entry)
            {
                dictionary[@(entry.key().c_str())] = objectFromJSON(entry.value()) ?: [NSNull null];
            }
            return dictionary;
        }
        default:
            return nil;
    }
}

nlohmann::json jsonFromObject(id value)
{
    if (!value || value == [NSNull null])
    {
        return nullptr;
    }
    if ([value isKindOfClass:[NSString class]])
    {
        return toStdString(value);
    }
    if ([value isKindOfClass:[NSNumber class]])
    {
        if (CFGetTypeID((__bridge CFTypeRef) value) == CFBooleanGetTypeID())
        {
            return static_cast<bool>([value boolValue]);
        }
        return [value doubleValue] == static_cast<double>([value longLongValue])
                   ? nlohmann::json([value longLongValue])
                   : nlohmann::json([value doubleValue]);
    }
    if ([value isKindOfClass:[NSArray class]])
    {
        nlohmann::json array = nlohmann::json::array();
        for (id item in (NSArray *) value)
        {
            array.push_back(jsonFromObject(item));
        }
        return array;
    }
    if ([value isKindOfClass:[NSDictionary class]])
    {
        nlohmann::json object = nlohmann::json::object();
        for (id key in (NSDictionary *) value)
        {
            if ([key isKindOfClass:[NSString class]])
            {
                object[toStdString(key)] = jsonFromObject(((NSDictionary *) value)[key]);
            }
        }
        return object;
    }
    return toStdString([value description]);
}
}
