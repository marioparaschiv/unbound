#import "Settings.h"

#include <istream>
#include <memory>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#include "LoaderPreferences.h"
#import "SettingsCore.h"

using astral::ios::toStdString;

NSString *const SettingsDidChangeNotification = @"SettingsDidChange";

static std::unique_ptr<loader::SettingsStore> gStore;

loader::SettingsStore &AstralSettingsStore()
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *path = [NSString
            pathWithComponents:@[ FileSystem.documents, @(loader::preferences::kSettingsFile) ]];
        gStore         = std::make_unique<loader::SettingsStore>(toStdString(path));
        gStore->load();
    });
    return *gStore;
}

@implementation Settings

+ (void)init
{
    loader::SettingsStore &store = AstralSettingsStore();
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
    AstralSettingsStore().load();
}

@end
