#include "JailbreakDetection.h"

#import <Foundation/Foundation.h>
#include <dlfcn.h>
#include <mach-o/dyld.h>

#include "LoaderEnvironment.h"

static NSString *activeBootstrapRoot()
{
    auto        rootGetter = reinterpret_cast<const char *(*)()>(dlsym(RTLD_DEFAULT, "get_jbroot"));
    const char *root       = rootGetter ? rootGetter() : nullptr;
    if (root && root[0])
        return [@(root) stringByResolvingSymlinksInPath];

    Dl_info info{};
    if (!dladdr(reinterpret_cast<const void *>(&detectedJailbreak), &info) || !info.dli_fname)
        return nil;
    NSString *image = [@(info.dli_fname) stringByResolvingSymlinksInPath];
    for (NSString *suffix in
         @[ @"/Library/MobileSubstrate/DynamicLibraries/", @"/usr/lib/TweakInject/" ])
    {
        NSRange range = [image rangeOfString:suffix];
        if (range.location != NSNotFound && range.location > 0)
            return [image substringToIndex:range.location];
    }
    return nil;
}

std::string detectedJailbreak()
{
    NSString *root = activeBootstrapRoot();
    if (!root)
        return "";

    std::vector<std::string> markers;
    for (NSString *marker in @[
             @".installed_relaxin", @".installed_nekojb", @".installed_nathanlr",
             @".palecursus_strapped", @".installed_palera1n", @".installed_dopamine",
             @".xia0o0o0o_jb_installed"
         ])
    {
        if ([[NSFileManager defaultManager]
                fileExistsAtPath:[root stringByAppendingPathComponent:marker]])
            markers.emplace_back(marker.UTF8String);
    }
    std::vector<std::string> images;
    uint32_t                 count = _dyld_image_count();
    for (uint32_t index = 0; index < count; ++index)
    {
        const char *name = _dyld_get_image_name(index);
        if (name)
            images.emplace_back([[@(name) stringByResolvingSymlinksInPath] UTF8String]);
    }
    auto roothideGetter =
        reinterpret_cast<bool (*)()>(dlsym(RTLD_DEFAULT, "jbclient_roothide_jailbroken"));
    std::string name = loader::environment::jailbreakName(root.UTF8String, markers, images,
                                                          roothideGetter && roothideGetter());
    if (name != "Dopamine")
        return name;
    NSString *version =
        [NSString stringWithContentsOfFile:[root stringByAppendingPathComponent:@"basebin/.version"]
                                  encoding:NSUTF8StringEncoding
                                     error:nil];
    NSString *trimmed =
        [version stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return loader::environment::jailbreakLabel(name, trimmed ? trimmed.UTF8String : "");
}
