cmake_minimum_required(VERSION 3.22)
project(unbound_core CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(UNBOUND_VENDOR_DIR ${CMAKE_CURRENT_LIST_DIR}/../vendor)

option(UNBOUND_CORE_BUNDLE_JSI "Compile jsi.cpp into the core library" ON)
option(UNBOUND_CORE_TESTS "Build the core host tests" OFF)
set(UNBOUND_CORE_FFI_TARGET "" CACHE STRING "libffi target that enables ffi.symbol and ffi.call")

file(GLOB UNBOUND_CORE_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/src/*.cpp)
if(UNBOUND_CORE_BUNDLE_JSI)
    list(APPEND UNBOUND_CORE_SOURCES ${UNBOUND_VENDOR_DIR}/react/jsi/jsi.cpp)
endif()

if(UNBOUND_CORE_FFI_TARGET)
    list(APPEND UNBOUND_CORE_SOURCES ${CMAKE_CURRENT_LIST_DIR}/src/ffi/NativeFFI.cpp)
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

if(UNBOUND_CORE_TESTS)
    enable_testing()
    file(GLOB UNBOUND_CORE_TEST_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_LIST_DIR}/tests/*.cpp)
    foreach(test_source ${UNBOUND_CORE_TEST_SOURCES})
        get_filename_component(test_name ${test_source} NAME_WE)
        add_executable(${test_name} ${test_source})
        target_link_libraries(${test_name} PRIVATE unbound_core)
        add_test(NAME ${test_name} COMMAND ${test_name})
    endforeach()
endif()
