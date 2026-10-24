cmake_minimum_required(VERSION 3.22.1)
project(unbound_ffi C ASM)

set(LIBFFI_SOURCE ${CMAKE_CURRENT_LIST_DIR}/../../../../../../vendor/libffi)

if(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64")
    set(LIBFFI_TARGET AARCH64)
    set(LIBFFI_ARCH aarch64)
    set(LIBFFI_ARCH_SOURCES ${LIBFFI_SOURCE}/src/aarch64/ffi.c ${LIBFFI_SOURCE}/src/aarch64/sysv.S)
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    set(LIBFFI_TARGET X86_64)
    set(LIBFFI_ARCH x86)
    set(LIBFFI_ARCH_SOURCES
        ${LIBFFI_SOURCE}/src/x86/ffi64.c
        ${LIBFFI_SOURCE}/src/x86/unix64.S
        ${LIBFFI_SOURCE}/src/x86/ffiw64.c
        ${LIBFFI_SOURCE}/src/x86/win64.S)
else()
    message(FATAL_ERROR "libffi is not configured for ${CMAKE_SYSTEM_PROCESSOR}")
endif()

set(TARGET ${LIBFFI_TARGET})
set(HAVE_LONG_DOUBLE 1)
set(FFI_EXEC_TRAMPOLINE_TABLE 0)
set(VERSION 3.8.0)
set(FFI_VERSION_STRING 3.8.0)
set(FFI_VERSION_NUMBER 30800)
set(LIBFFI_GENERATED ${CMAKE_CURRENT_BINARY_DIR}/include)
configure_file(${LIBFFI_SOURCE}/include/ffi.h.in ${LIBFFI_GENERATED}/ffi.h @ONLY)
configure_file(${LIBFFI_SOURCE}/src/${LIBFFI_ARCH}/ffitarget.h ${LIBFFI_GENERATED}/ffitarget.h COPYONLY)

add_library(unbound_ffi STATIC
    ${LIBFFI_SOURCE}/src/prep_cif.c
    ${LIBFFI_SOURCE}/src/types.c
    ${LIBFFI_SOURCE}/src/raw_api.c
    ${LIBFFI_SOURCE}/src/java_raw_api.c
    ${LIBFFI_SOURCE}/src/closures.c
    ${LIBFFI_SOURCE}/src/tramp.c
    ${LIBFFI_ARCH_SOURCES})
target_include_directories(unbound_ffi
    PUBLIC ${LIBFFI_GENERATED}
    PRIVATE ${CMAKE_CURRENT_LIST_DIR} ${LIBFFI_SOURCE}/include ${LIBFFI_SOURCE}/src/${LIBFFI_ARCH})
target_compile_options(unbound_ffi PRIVATE -fvisibility=hidden -Wno-deprecated-declarations)
