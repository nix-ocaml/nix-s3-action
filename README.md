# nix-s3-action

Configure credentials for a Nix binary cache on S3 or an S3-compatible service,
then upload build results at the end of the job.

The action runs on Node.js 24 and supports Linux and macOS runners with Nix
installed. Self-hosted runners must support the Node.js 24 action runtime.

## Getting started

```yaml
- uses: cachix/install-nix-action@v31
- uses: nix-ocaml/nix-s3-action@fork
  with:
    endpoint: s3://my-cache
    signingKey: ${{ secrets.NIX_CACHE_SIGNING_KEY }}
    awsAccessKeyId: ${{ secrets.AWS_ACCESS_KEY_ID }}
    awsSecretAccessKey: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
- run: nix build
```

For S3-compatible services, include the service URL in the endpoint query string,
for example `s3://my-cache?endpoint=https://example.com`.

Set `skipPush: true` to configure credentials while leaving uploads to another
step. Use `pathsToPush` to upload specific store paths instead of every new build
result. See [action.yml](action.yml) for all inputs.

If signing credentials are unavailable, such as on pull requests from forks,
cache setup and upload are skipped. Keep signing keys and AWS credentials in
GitHub Actions secrets.

## Development

Enter the pinned Node.js 24 development environment:

```sh
nix develop
```

Install dependencies, rebuild the shipped bundle, and run the tests:

```sh
yarn install --frozen-lockfile
yarn build
yarn test
```

Commit changes to `dist/main/index.js` alongside changes to the source or
runtime dependencies. CI checks that the bundle is current and exercises the
main and post-job action phases on Linux and macOS. Tests use dummy credentials
and mocked uploads.
