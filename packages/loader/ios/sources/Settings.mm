#include <istream>
#include <ostream>
#include <streambuf>

#import "Settings.h"
#import "SettingsCore.h"

#include <memory>

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static const NSTimeInterval kSettingsSaveDebounce = 0.3;

static std::unique_ptr<loader::SettingsStore> gStore;
static dispatch_source_t                      saveTimer = nil;

static std::string toStdString(NSString *value)
{
    const char *utf8 = value.UTF8String;
    return utf8 ? std::string(utf8) : std::string();
}

static id objectFromJSON(const nlohmann::json &value)
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
        case nlohmann::json::value_t::array:
        {
            NSMutableArray *array = [NSMutableArray arrayWithCapacity:value.size()];
            for (const nlohmann::json &item : value)
            {
                [array addObject:objectFromJSON(item) ?: [NSNull null]];
            }
            return array;
        }
        case nlohmann::json::value_t::object:
        {
            NSMutableDictionary *dictionary = [NSMutableDictionary dictionaryWithCapacity:value.size()];
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

static nlohmann::json jsonFromObject(id value)
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

loader::SettingsStore &UnboundSettingsStore()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *path = [NSString pathWithComponents:@[ FileSystem.documents, @"settings.json" ]];
        gStore         = std::make_unique<loader::SettingsStore>(toStdString(path));
        gStore->load();
    });
    return *gStore;
}

@implementation Settings

+ (void)init
{
    loader::SettingsStore &store = UnboundSettingsStore();
    NSString              *path  = @(store.path().c_str());

    [FileSystem monitor:path
               onChange:^{
                   [Settings loadSettings];
                   [[NSNotificationCenter defaultCenter]
                       postNotificationName:SettingsDidChangeNotification
                                     object:nil];
               }
            autoRestart:YES];
}

+ (void)loadSettings
{
    UnboundSettingsStore().load();
}

+ (id)rawValueForStore:(NSString *)store key:(NSString *)key
{
    std::optional<nlohmann::json> value = UnboundSettingsStore().get(toStdString(store), toStdString(key));
    return value ? objectFromJSON(*value) : nil;
}

+ (NSString *)getString:(NSString *)store key:(NSString *)key def:(NSString *)def
{
    return [Settings rawValueForStore:store key:key] ?: def;
}

+ (NSDictionary *)getDictionary:(NSString *)store key:(NSString *)key def:(NSDictionary *)def
{
    return [Settings rawValueForStore:store key:key] ?: def;
}

+ (BOOL)getBoolean:(NSString *)store key:(NSString *)key def:(BOOL)def
{
    return UnboundSettingsStore().getBoolean(toStdString(store), toStdString(key), def);
}

+ (void)set:(NSString *)store key:(NSString *)key value:(id)value
{
    UnboundSettingsStore().set(toStdString(store), toStdString(key), jsonFromObject(value));
    [Settings scheduleSave];
}

+ (void)reset
{
    UnboundSettingsStore().replace("{}");
    [Settings save];
}

+ (void)scheduleSave
{
    @synchronized([Settings class])
    {
        if (saveTimer)
        {
            dispatch_source_cancel(saveTimer);
        }

        saveTimer = [Utilities createDebounceTimer:kSettingsSaveDebounce
                                              queue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0)
                                              block:^{ [Settings save]; }];
    }
}

+ (void)save
{
    if (!UnboundSettingsStore().save())
    {
        [Logger error:LOG_CATEGORY_SETTINGS format:@"Failed to write settings.json."];
    }
}

+ (NSString *)getSettings
{
    return @(UnboundSettingsStore().serialize().c_str());
}

+ (BOOL)loadFromJSONString:(NSString *)json error:(NSError **)error
{
    if (!UnboundSettingsStore().replace(toStdString(json)))
    {
        if (error)
        {
            *error = [NSError errorWithDomain:@"Settings"
                                         code:2
                                     userInfo:@{NSLocalizedDescriptionKey : @"Root must be a JSON object"}];
        }
        return NO;
    }

    [Settings save];
    [[NSNotificationCenter defaultCenter] postNotificationName:SettingsDidChangeNotification object:nil];
    return YES;
}

@end
