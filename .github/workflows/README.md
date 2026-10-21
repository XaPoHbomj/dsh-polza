# Workflows

- `ci.yml` runs the build and all local smoke tests on every push to `main` and
  every pull request. It needs no secrets.
- `release.yml` runs on a `v*` tag: it verifies that the tag matches
  `package.json`, builds and tests the plugin, publishes to npm with provenance,
  and creates a GitHub Release.

## npm Trusted Publishing

`release.yml` authenticates to npm through OIDC, not through a stored token.
Configure the package once on npmjs.com:

1. Open `https://www.npmjs.com/package/dsh-polza` → **Settings**.
2. Under **Trusted Publisher**, choose **GitHub Actions**.
3. Set organization/user to `XaPoHbomj`, repository to `dsh-polza`, workflow
   filename to `release.yml`, and leave the environment blank.
4. Save. No `NPM_TOKEN` secret is needed.

The workflow already requests `id-token: write`, which npm exchanges for a
short-lived publishing credential. `--provenance` attaches a signed provenance
statement to the published tarball.

If the trusted publisher is not configured, the release job fails at the publish
step with an authentication error. In that case a granular `NPM_TOKEN` can be
used temporarily by restoring the `NODE_AUTH_TOKEN` env entry on the publish
step.
