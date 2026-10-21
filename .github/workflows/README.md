# Workflows

- `ci.yml` runs the build and all local smoke tests on every push to `main` and
  every pull request. It needs no secrets.
- `release.yml` runs on a `v*` tag: it verifies that the tag matches
  `package.json`, builds and tests the plugin, publishes to npm with provenance,
  and creates a GitHub Release.

## Required secret

`release.yml` expects a repository secret named `NPM_TOKEN`: a granular npm
access token with read/write permission for the `dsh-polza` package (or an
automation token with 2FA bypass enabled if the account enforces 2FA for
writes). Add it under **Settings → Secrets and variables → Actions**.

An alternative to the token is npm Trusted Publishing: configure the package on
npmjs.com to trust this repository and the `release.yml` workflow, then remove
the `NODE_AUTH_TOKEN` environment entry. The workflow already requests the
`id-token: write` permission needed for OIDC.
