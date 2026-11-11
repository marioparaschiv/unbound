#import "Settings.h"

#include <istream>
#include <memory>
#include <ostream>
#include <streambuf>

#import "AddonsCore.h"
#import "CoreConversions.h"
#include "LoaderPreferences.h"
#import "SettingsCore.h"

using unbound::ios::toStdString;

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static void refreshSettingsCache()
{
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0),
                   ^{ UnboundSettingsStore().refreshCache(); });
}

loader::SettingsStore &UnboundSettingsStore()
{
    return UnboundLoader()->settings();
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
