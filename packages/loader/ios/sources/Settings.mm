#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "Settings.h"
#import "SettingsCore.h"

#include <memory>

#include "LoaderPreferences.h"

using unbound::ios::jsonFromObject;
using unbound::ios::objectFromJSON;
using unbound::ios::toStdString;

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static const NSTimeInterval kSettingsSaveDebounce = 0.3;

static std::unique_ptr<loader::SettingsStore> gStore;
static dispatch_source_t                      saveTimer = nil;

loader::SettingsStore &UnboundSettingsStore()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *path = [NSString pathWithComponents:@[ FileSystem.documents, @(loader::preferences::kSettingsFile) ]];
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

@end
