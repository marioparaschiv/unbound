#import "Plugins.h"

@implementation Plugins
static NSMutableArray *plugins = nil;

+ (NSString *)makeJSON
{
    return [Utilities JSONStringFromObject:plugins options:0 fallback:@"[]"];
};

+ (void)init
{
    plugins = [CoreBridge scanPluginsIn:FileSystem.documents];
};

@end
