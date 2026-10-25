cmake_minimum_required(VERSION 3.22)
project(unbound_core CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(UNBOUND_VENDOR_DIR ${CMAKE_CURRENT_LIST_DIR}/../vendor)

option(UNBOUND_CORE_BUNDLE_JSI "Compile jsi.cpp into the core library" ON)
option(UNBOUND_CORE_TESTS "Build the core host tests" OFF)
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

file(GLOB UNBOUND_CORE_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/src/*.cpp)
if(UNBOUND_CORE_BUNDLE_JSI)
    list(APPEND UNBOUND_CORE_SOURCES ${UNBOUND_VENDOR_DIR}/react/jsi/jsi.cpp)
endif()

if(UNBOUND_CORE_FFI_TARGET)
    file(GLOB UNBOUND_CORE_FFI_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/src/ffi/*.cpp)
    list(APPEND UNBOUND_CORE_SOURCES ${UNBOUND_CORE_FFI_SOURCES})
endif()

add_library(unbound_core STATIC ${UNBOUND_CORE_SOURCES})
if(UNBOUND_CORE_FFI_TARGET)
    target_link_libraries(unbound_core PUBLIC ${UNBOUND_CORE_FFI_TARGET})
endif()
target_include_directories(unbound_core PUBLIC
    ${CMAKE_CURRENT_LIST_DIR}/include
    ${UNBOUND_VENDOR_DIR}
    ${UNBOUND_VENDOR_DIR}/react)
target_compile_options(unbound_core PRIVATE -fvisibility=hidden -fexceptions -frtti)

if(NOT UNBOUND_VERSION)
    file(STRINGS ${CMAKE_CURRENT_LIST_DIR}/../ios/control UNBOUND_CONTROL_VERSION REGEX "^Version:")
    string(REGEX REPLACE "^Version:[ \t]*" "" UNBOUND_VERSION "${UNBOUND_CONTROL_VERSION}")
endif()
target_compile_definitions(unbound_core PRIVATE UNBOUND_VERSION="${UNBOUND_VERSION}")

if(UNBOUND_CORE_TESTS)
    enable_testing()
    file(GLOB UNBOUND_CORE_TEST_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/tests/*.cpp)
    if(NOT UNBOUND_CORE_FFI_TARGET)
        list(FILTER UNBOUND_CORE_TEST_SOURCES EXCLUDE REGEX "native_ffi_call[^/]*\\.cpp$")
    endif()
    foreach(test_source ${UNBOUND_CORE_TEST_SOURCES})
        get_filename_component(test_name ${test_source} NAME_WE)
        add_executable(${test_name} ${test_source})
        target_link_libraries(${test_name} PRIVATE unbound_core)
        add_test(NAME ${test_name} COMMAND ${test_name})
    endforeach()
endif()
