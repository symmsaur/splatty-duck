{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.helix-pkg.url = "github:helix-editor/helix";
  inputs.fenix = {
    url = "github:nix-community/fenix";
    inputs.nixpkgs.follows = "nixpkgs";
  };
  outputs = { self, nixpkgs, helix-pkg, fenix, ... }:
    let
      disableCudaEnvFlag = builtins.getEnv "DISABLE_CUDA";
      system = "x86_64-linux";
      pkgs = (import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          cudaSupport = disableCudaEnvFlag != "1";
        };
      });
      rustToolchain = with fenix.packages."${system}"; combine [
        (stable.withComponents [ "cargo" "rustc" "rust-src" "rustfmt" "clippy"])
        targets."wasm32-unknown-unknown".stable.rust-std
      ];
      helixmaster = helix-pkg.packages.${system}.default;

      pds3 = pkgs.python3Packages.buildPythonPackage rec {
        pname = "pds3";
        version = "0.3.0";
        format = "setuptools";

        src = pkgs.fetchFromGitHub {
          owner = "mkelley";
          repo = pname;
          rev = "a4c4a0b4f7ffe7f0762d987f7fb95a986abf1759";
          hash = "sha256-QrOjf52ii1E+tvhGLC3uJSa1eRLS4ItdXNmOt1nFSCA=";
        };

        propagatedBuildInputs = [
          pkgs.python3Packages.astropy
          pkgs.python3Packages.ply
          pkgs.python3Packages.numpy
        ]; 
        doCheck = false;

      };
      

      pythonPackages = with pkgs.python3Packages; [
      pds3
      ipython
      ipdb
      matplotlib
      pandas
      numpy
      python-lsp-server
      black
      ];

      pythonWithPackages = pkgs.python3.withPackages (p: pythonPackages);

      devinputs = with pkgs; [
        duckdb
        fenix.packages."${system}".rust-analyzer
        # rust-analyzer
        ruff
        helixmaster
        nixfmt
        pythonWithPackages
        feh
        xclip
        rustToolchain
      ];
    in {
      devShells.x86_64-linux.default =
        (pkgs.mkShell.override { stdenv = pkgs.llvmPackages_14.stdenv; }) {
          buildInputs = devinputs;
          nativeBuildInputs = [ pkgs.cudatoolkit ];
          shellHook = ''
            export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:/run/opengl-driver/lib/"
            export EDITOR=hx
            export PYTHON=${pythonWithPackages}/bin/python
            export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:/run/opengl-driver/lib/:${
              pkgs.lib.makeLibraryPath ([
                pkgs.vulkan-loader 
                pkgs.libGL
                pkgs.libGLU
                pkgs.xorg.libX11
                pkgs.xorg.libXcursor
                pkgs.xorg.libXrandr
                pkgs.xorg.libXi
                pkgs.xorg.libxcb
                pkgs.libxkbcommon
                pkgs.pipewire
              ])
            }"
            export X11_X11_INCLUDE_PATH="${pkgs.xorg.libX11}/include"
            export X11_X11_LIB=${
              pkgs.lib.makeLibraryPath ([ pkgs.xorg.libX11 ])
            }
          '';
        };
      };
}
