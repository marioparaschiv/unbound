cmake_minimum_required(VERSION 3.22)
project(unbound_core C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(UNBOUND_VENDOR_DIR ${CMAKE_CURRENT_LIST_DIR}/../vendor)

option(UNBOUND_CORE_BUNDLE_JSI "Compile jsi.cpp into the core library" ON)
option(UNBOUND_CORE_TESTS "Build the core host tests" OFF)
option(UNBOUND_CORE_FUZZ "Build the native bridge libFuzzer target" OFF)
option(UNBOUND_CORE_JSI_FUZZ "Build the JSI conversion fuzzer against a host Hermes" OFF)
set(UNBOUND_HERMES_SOURCE_DIR "" CACHE PATH "Hermes checkout whose jsi.h matches vendor/react/jsi/jsi.h")

if(UNBOUND_CORE_JSI_FUZZ)
    if(NOT UNBOUND_CORE_TESTS OR NOT UNBOUND_HERMES_SOURCE_DIR)
        message(FATAL_ERROR "UNBOUND_CORE_JSI_FUZZ needs UNBOUND_CORE_TESTS=ON and UNBOUND_HERMES_SOURCE_DIR")
    endif()
    set(UNBOUND_CORE_BUNDLE_JSI OFF CACHE BOOL "" FORCE)
    set(HERMES_ENABLE_TEST_SUITE OFF CACHE BOOL "" FORCE)
    set(HERMES_ENABLE_INTL OFF CACHE BOOL "" FORCE)
    set(HERMES_BUILD_APPLE_FRAMEWORK OFF CACHE BOOL "" FORCE)
    add_subdirectory(${UNBOUND_HERMES_SOURCE_DIR} hermes EXCLUDE_FROM_ALL)
endif()
set(UNBOUND_CORE_FFI_TARGET "" CACHE STRING "libffi target that enables ffi.symbol and ffi.call")

if(UNBOUND_CORE_TESTS AND NOT UNBOUND_CORE_FFI_TARGET)
    find_path(UNBOUND_HOST_FFI_INCLUDE_DIR ffi.h
        HINTS /opt/homebrew/opt/libffi/include /usr/local/opt/libffi/include
        PATH_SUFFIXES ffi)
    find_library(UNBOUND_HOST_FFI_LIBRARY ffi
        HINTS /opt/homebrew/opt/libffi/lib /usr/local/opt/libffi/lib)
    if(UNBOUND_HOST_FFI_INCLUDE_DIR AND UNBOUND_HOST_FFI_LIBRARY)
        add_library(unbound_host_ffi INTERFACE)
        target_include_directories(unbound_host_ffi INTERFACE ${UNBOUND_HOST_FFI_INCLUDE_DIR})
        target_link_libraries(unbound_host_ffi INTERFACE ${UNBOUND_HOST_FFI_LIBRARY})
        set(UNBOUND_CORE_FFI_TARGET unbound_host_ffi)
    endif()
endif()

set(UNBOUND_BUNDLE_SIGNING_KEY_FILE ${CMAKE_CURRENT_LIST_DIR}/keys/bundle-signing.pub CACHE FILEPATH "Base64 Ed25519 public key that client bundles must be signed with")
set(UNBOUND_BUNDLE_SIGNING_KEY "")
if(EXISTS ${UNBOUND_BUNDLE_SIGNING_KEY_FILE})
    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${UNBOUND_BUNDLE_SIGNING_KEY_FILE})
    file(READ ${UNBOUND_BUNDLE_SIGNING_KEY_FILE} UNBOUND_BUNDLE_SIGNING_KEY)
    string(STRIP "${UNBOUND_BUNDLE_SIGNING_KEY}" UNBOUND_BUNDLE_SIGNING_KEY)
endif()
if(UNBOUND_BUNDLE_SIGNING_KEY)
    message(STATUS "Bundle signature verification: on, key from ${UNBOUND_BUNDLE_SIGNING_KEY_FILE}")
else()
    message(STATUS "Bundle signature verification: off, ${UNBOUND_BUNDLE_SIGNING_KEY_FILE} does not exist")
endif()

set(UNBOUND_PR_NUMBER "$ENV{UNBOUND_PR_NUMBER}" CACHE STRING "Pull request number a test build trusts the PR bundle key for; empty for production builds")
set(UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE ${CMAKE_CURRENT_LIST_DIR}/keys/pr-bundle-signing.pub CACHE FILEPATH "Base64 Ed25519 public key that pull request test bundles may be signed with")
set(UNBOUND_PR_BUNDLE_SIGNING_KEY "")
string(LENGTH "${UNBOUND_PR_NUMBER}" UNBOUND_PR_NUMBER_LENGTH)
if(UNBOUND_PR_NUMBER STREQUAL "")
    set(UNBOUND_PR_NUMBER 0)
elseif(NOT UNBOUND_PR_NUMBER MATCHES "^[1-9][0-9]*$" OR UNBOUND_PR_NUMBER_LENGTH GREATER 9)
    message(FATAL_ERROR "UNBOUND_PR_NUMBER must be a pull request number, not \"${UNBOUND_PR_NUMBER}\"")
else()
    if(NOT EXISTS ${UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE})
        message(FATAL_ERROR "A pull request build needs ${UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE}")
    endif()
    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE})
    file(READ ${UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE} UNBOUND_PR_BUNDLE_SIGNING_KEY)
    string(STRIP "${UNBOUND_PR_BUNDLE_SIGNING_KEY}" UNBOUND_PR_BUNDLE_SIGNING_KEY)
    message(STATUS "Pull request build #${UNBOUND_PR_NUMBER}: also trusts ${UNBOUND_PR_BUNDLE_SIGNING_KEY_FILE}")
endif()

file(GLOB_RECURSE UNBOUND_BEARSSL_SOURCES CONFIGURE_DEPENDS ${UNBOUND_VENDOR_DIR}/bearssl/src/*.c)
add_library(unbound_bearssl STATIC ${UNBOUND_BEARSSL_SOURCES})
target_include_directories(unbound_bearssl PRIVATE ${UNBOUND_VENDOR_DIR}/bearssl/src)
target_include_directories(unbound_bearssl PUBLIC ${UNBOUND_VENDOR_DIR}/bearssl/inc)
target_compile_options(unbound_bearssl PRIVATE -fvisibility=hidden)

# Google's WOFF2 decoder and the Brotli decoder it needs, for installing `.woff2` fonts.
file(GLOB UNBOUND_WOFF2_SOURCES CONFIGURE_DEPENDS
    ${UNBOUND_VENDOR_DIR}/brotli/c/common/*.c
    ${UNBOUND_VENDOR_DIR}/brotli/c/dec/*.c
    ${UNBOUND_VENDOR_DIR}/woff2/src/*.cc)
add_library(unbound_woff2 STATIC ${UNBOUND_WOFF2_SOURCES})
target_include_directories(unbound_woff2 PRIVATE ${UNBOUND_VENDOR_DIR}/brotli/c/include)
target_include_directories(unbound_woff2 PUBLIC ${UNBOUND_VENDOR_DIR}/woff2/include)
target_compile_options(unbound_woff2 PRIVATE -fvisibility=hidden -w)

file(GLOB UNBOUND_CORE_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/src/*.cpp)
list(APPEND UNBOUND_CORE_SOURCES
    ${UNBOUND_VENDOR_DIR}/monocypher/monocypher.c
    ${UNBOUND_VENDOR_DIR}/monocypher/monocypher-ed25519.c
    ${UNBOUND_VENDOR_DIR}/miniz/miniz_unbound.c)
if(UNBOUND_CORE_BUNDLE_JSI)
    list(APPEND UNBOUND_CORE_SOURCES ${UNBOUND_VENDOR_DIR}/react/jsi/jsi.cpp)
endif()

if(UNBOUND_CORE_FFI_TARGET)
    file(GLOB UNBOUND_CORE_FFI_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/src/ffi/*.cpp)
    list(APPEND UNBOUND_CORE_SOURCES ${UNBOUND_CORE_FFI_SOURCES})
endif()

add_library(unbound_core STATIC ${UNBOUND_CORE_SOURCES})
target_link_libraries(unbound_core PRIVATE unbound_bearssl unbound_woff2)
if(UNBOUND_CORE_FFI_TARGET)
    target_link_libraries(unbound_core PUBLIC ${UNBOUND_CORE_FFI_TARGET})
endif()
if(UNBOUND_CORE_JSI_FUZZ)
    target_link_libraries(unbound_core PUBLIC jsi)
endif()
target_include_directories(unbound_core PUBLIC
    ${CMAKE_CURRENT_LIST_DIR}/include
    ${UNBOUND_VENDOR_DIR}
    ${UNBOUND_VENDOR_DIR}/react)
target_compile_options(unbound_core PRIVATE -fvisibility=hidden $<$<COMPILE_LANGUAGE:CXX>:-fexceptions -frtti -Werror=return-type>)

if(NOT UNBOUND_VERSION)
    file(STRINGS ${CMAKE_CURRENT_LIST_DIR}/../ios/control UNBOUND_CONTROL_VERSION REGEX "^Version:")
    string(REGEX REPLACE "^Version:[ \t]*" "" UNBOUND_VERSION "${UNBOUND_CONTROL_VERSION}")
    # version.json is the release version; CI stamps it into ios/control, which local builds leave
    # stale, so the newer one wins.
    file(READ ${CMAKE_CURRENT_LIST_DIR}/../version.json UNBOUND_VERSION_JSON)
    string(JSON UNBOUND_RELEASE_VERSION GET "${UNBOUND_VERSION_JSON}" version)
    if(UNBOUND_VERSION VERSION_LESS UNBOUND_RELEASE_VERSION)
        set(UNBOUND_VERSION "${UNBOUND_RELEASE_VERSION}")
    endif()
endif()
set_source_files_properties(${CMAKE_CURRENT_LIST_DIR}/src/LoaderVersion.cpp PROPERTIES
    COMPILE_DEFINITIONS UNBOUND_VERSION="${UNBOUND_VERSION}")
set_source_files_properties(${CMAKE_CURRENT_LIST_DIR}/src/LoaderBundleSignature.cpp PROPERTIES
    COMPILE_DEFINITIONS "UNBOUND_BUNDLE_SIGNING_KEY=\"${UNBOUND_BUNDLE_SIGNING_KEY}\";UNBOUND_PR_NUMBER=${UNBOUND_PR_NUMBER};UNBOUND_PR_BUNDLE_SIGNING_KEY=\"${UNBOUND_PR_BUNDLE_SIGNING_KEY}\"")
if(UNBOUND_DEFAULT_BUNDLE_URL)
    set_source_files_properties(${CMAKE_CURRENT_LIST_DIR}/src/LoaderUpdater.cpp PROPERTIES
        COMPILE_DEFINITIONS UNBOUND_DEFAULT_BUNDLE_URL="${UNBOUND_DEFAULT_BUNDLE_URL}")
endif()

if(UNBOUND_CORE_TESTS)
    enable_testing()
    file(GLOB UNBOUND_CORE_TEST_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/tests/*.cpp)
    if(NOT UNBOUND_CORE_FFI_TARGET)
        list(FILTER UNBOUND_CORE_TEST_SOURCES EXCLUDE REGEX "native_ffi_call[^/]*\\.cpp$")
    endif()
    if(NOT APPLE)
        list(FILTER UNBOUND_CORE_TEST_SOURCES EXCLUDE REGEX "loader_crypto_commoncrypto\\.cpp$")
    endif()
    foreach(test_source ${UNBOUND_CORE_TEST_SOURCES})
        get_filename_component(test_name ${test_source} NAME_WE)
        add_executable(${test_name} ${test_source})
        target_link_libraries(${test_name} PRIVATE unbound_core)
        target_compile_definitions(${test_name} PRIVATE UNBOUND_BOOTSTRAP_DIR="${CMAKE_CURRENT_LIST_DIR}/../bootstrap" UNBOUND_CORE_TEST_VECTORS_DIR="${CMAKE_CURRENT_LIST_DIR}/tests/vectors")
        add_test(NAME ${test_name} COMMAND ${test_name})
    endforeach()
endif()

if(UNBOUND_CORE_FUZZ)
    add_executable(native_bridge_libfuzzer ${CMAKE_CURRENT_LIST_DIR}/tests/fuzz/native_bridge_libfuzzer.cpp)
    target_link_libraries(native_bridge_libfuzzer PRIVATE unbound_core)
    target_compile_options(native_bridge_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
    target_link_options(native_bridge_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
    add_executable(font_files_libfuzzer ${CMAKE_CURRENT_LIST_DIR}/tests/fuzz/font_files_libfuzzer.cpp)
    target_link_libraries(font_files_libfuzzer PRIVATE unbound_core)
    target_compile_options(font_files_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
    target_link_options(font_files_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
endif()

if(UNBOUND_CORE_JSI_FUZZ)
    foreach(jsi_fuzz_target native_jsi_fuzz native_jsi_libfuzzer)
        if(jsi_fuzz_target STREQUAL native_jsi_libfuzzer AND NOT UNBOUND_CORE_FUZZ)
            continue()
        endif()
        add_executable(${jsi_fuzz_target} ${CMAKE_CURRENT_LIST_DIR}/tests/jsi-fuzz/${jsi_fuzz_target}.cpp)
        target_link_libraries(${jsi_fuzz_target} PRIVATE unbound_core hermesvm_a)
        target_include_directories(${jsi_fuzz_target} PRIVATE ${UNBOUND_HERMES_SOURCE_DIR}/API ${UNBOUND_HERMES_SOURCE_DIR}/public)
    endforeach()
    if(UNBOUND_CORE_FUZZ)
        target_compile_options(native_jsi_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
        target_link_options(native_jsi_libfuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
    endif()
    add_test(NAME native_jsi_fuzz COMMAND native_jsi_fuzz)
    # Every tests/hermes/*.cpp runs as its own ctest against Hermes, with the bootstrap and
    # vector paths defined; a few need hermesc or the FFI flag as well.
    file(GLOB UNBOUND_HERMES_TEST_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/tests/hermes/*.cpp)
    foreach(test_source ${UNBOUND_HERMES_TEST_SOURCES})
        get_filename_component(test_name ${test_source} NAME_WE)
        add_executable(${test_name} ${test_source})
        target_link_libraries(${test_name} PRIVATE unbound_core hermesvm_a)
        target_include_directories(${test_name} PRIVATE ${UNBOUND_HERMES_SOURCE_DIR}/API ${UNBOUND_HERMES_SOURCE_DIR}/public)
        target_compile_definitions(${test_name} PRIVATE
            UNBOUND_BOOTSTRAP_DIR="${CMAKE_CURRENT_LIST_DIR}/../bootstrap"
            UNBOUND_CORE_TEST_VECTORS_DIR="${CMAKE_CURRENT_LIST_DIR}/tests/vectors"
            UNBOUND_TEST_FFI=$<IF:$<BOOL:${UNBOUND_CORE_FFI_TARGET}>,1,0>)
        add_test(NAME ${test_name} COMMAND ${test_name})
    endforeach()
    target_compile_definitions(unbound_native_hermes PRIVATE UNBOUND_HERMESC="$<TARGET_FILE:hermesc>")
    add_dependencies(unbound_native_hermes hermesc)
endif()

