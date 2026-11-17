#pragma once

#import <Foundation/Foundation.h>

namespace loader::ios {
bool isDeallocating(__unsafe_unretained id object);
id ownableObject(__unsafe_unretained id object);
}
