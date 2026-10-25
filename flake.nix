{
  inputs.nixpkgs.url = "github:nix-ocaml/nix-overlays";

  outputs =
    { nixpkgs, ... }:
    {
      devShells = nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (system: {
        default = import ./shell.nix {
          pkgs = nixpkgs.legacyPackages.${system};
        };
      });
    };
}
