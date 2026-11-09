#import "Settings.h"

#include <istream>
#include <memory>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#include "LoaderPreferences.h"
#import "SettingsCore.h"

using unbound::ios::toStdString;

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static std::unique_ptr<loader::SettingsStore> gStore;

static void refreshSettingsCache()
{
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{ gStore->refreshCache(); });
}

loader::SettingsStore &UnboundSettingsStore()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *path = [NSString
            pathWithComponents:@[ FileSystem.documents, @(loader::preferences::kSettingsFile) ]];
        gStore         = std::make_unique<loader::SettingsStore>(toStdString(path));
        gStore->load();
        refreshSettingsCache();
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
    refreshSettingsCache();
}

@end
