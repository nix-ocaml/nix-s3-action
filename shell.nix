{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShell {
  packages = [
    pkgs.nodejs_24
    (pkgs.yarn.override { nodejs = pkgs.nodejs_24; })
  ];
}
