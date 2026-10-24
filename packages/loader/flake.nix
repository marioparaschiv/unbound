{
  description = "Theos development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    allSystems = [
      "x86_64-linux" # 64bit AMD/Intel x86
    ];

    forAllSystems = fn:
      nixpkgs.lib.genAttrs allSystems
      (system: fn {pkgs = import nixpkgs {inherit system;};});
  in {
    devShells = forAllSystems ({pkgs}: {
      default = let
        rev = "82af6911de5f8d8bafe98945ed1ae3d4f4537218";

        llvm-swift = builtins.fetchurl {
          url = "https://github.com/CRKatri/llvm-project/releases/download/swift-5.3.2-RELEASE/swift-5.3.2-RELEASE-ubuntu18.04.tar.zst";
          sha256 = "1mhr91n6p0sahqdmlpz4fr539g9rwrwq0k9mx9ikg6gcl4ddjzfk";
        };

        theos-src = pkgs.fetchgit {
          url = "https://github.com/theos/theos";
          rev = rev;
          sha256 = "sha256-T6k8XFnSGFrdy1S2JNXZHZGHJ/NpG09uW20G7bdPIv0=";
          leaveDotGit = true;
          fetchSubmodules = true;
        };

        theos-sdks = pkgs.fetchFromGitHub {
          owner = "theos";
          repo = "sdks";
          rev = "bb425abf3acae8eac328b828628b82df544d2774";
          sha256 = "sha256-cZfCEWI+Nuon/cbZLBNpqwGNIbiPg184a0NjblrkaQ4=";
        };

        rpath = pkgs.lib.makeLibraryPath [
          pkgs.gcc-unwrapped.lib
          pkgs.glibc
          pkgs.libedit
          pkgs.ncurses5
          pkgs.swift
          pkgs.util-linux
          pkgs.zlib
        ];

        theos = pkgs.stdenv.mkDerivation {
          name = "theos";
          version = rev;

          srcs = [llvm-swift theos-src theos-sdks];

          nativeBuildInputs = [pkgs.autoPatchelfHook];
          buildInputs = [pkgs.patchelf pkgs.zstd];

          phases = ["installPhase"];

          installPhase = ''
            mkdir -p $out/share
            THEOS=$out/share/theos
            # install theos
            cp -r --no-preserve=mode,ownership ${theos-src} $THEOS
            # install llvm-swift
            tar -xf ${llvm-swift} -C $TMPDIR
            mkdir -p $THEOS/toolchain/linux/iphone $THEOS/toolchain/swift
            mv $TMPDIR/swift-5.3.2-RELEASE-ubuntu18.04/* $THEOS/toolchain/linux/iphone/
            ln -s $THEOS/toolchain/linux/iphone $THEOS/toolchain/swift
            # install 14.5 sdk
            cp -r --no-preserve=mode,ownership ${theos-sdks}/iPhoneOS14.5.sdk $THEOS/sdks
            # mutate perl scripts so they use `/usr/bin/env perl` as a shebang
            find $THEOS -type f -name '*.pl' -exec sed -i 's|#!/usr/bin/perl|#!/usr/bin/env perl|g' {} \;
            chmod +x $(find $THEOS -type f -name '*.pl')
            # mutate bin/bash scripts so they use `/usr/bin/env bash` as a shebang
            find $THEOS/bin -type f -exec sed -i 's|#!/bin/bash|#!/usr/bin/env bash|g' {} \;
            chmod +x $THEOS/bin/*
            # install nic.pl
            mkdir -p $out/bin
            cat <<EOF >$out/bin/theos-nic
            #!/usr/bin/env bash
            perl $THEOS/bin/nic.pl
            EOF
            chmod +x $out/bin/theos-nic
            # patchELF all executables
            find $THEOS -type f -executable -exec patchelf --replace-needed libedit.so.2 libedit.so.0 {} \;
            find $THEOS -type f -executable -exec patchelf --set-rpath ${rpath} --set-interpreter $(cat $NIX_CC/nix-support/dynamic-linker) {} \;
            # manual fix for an annoying bug
            cat <<EOF >$THEOS/toolchain/linux/iphone/bin/ld
            #!/bin/sh
            LD_LIBRARY_PATH="\$(dirname "\$0")"/../lib:${rpath} "\$(dirname "\$0")"/ld64 "\$@"
            EOF
          '';
        };

        # modeled after: https://archlinux.org/groups/x86_64/base-devel/
        base-devel = with pkgs; [
          autoconf
          automake
          binutils
          bison
          fakeroot
          file
          findutils
          flex
          gawk
          gcc
          gettext
          gnumake
          groff
          gzip
          libtool
          m4
          patch
          pkgconf
          texinfo
          which
          zstd
        ];
      in
        pkgs.mkShell {
          buildInputs = with pkgs; base-devel ++ [git perl unzip ncurses5 theos go];
          shellHook = ''
            export THEOS=${theos}/share/theos
          '';
        };
    });
  };
}
