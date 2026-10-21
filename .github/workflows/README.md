# CI

`ci.yml` runs the build and the three local smoke tests on every push to `main`
and every pull request. It needs no secrets: the tests use mocked Polza
responses and a temporary harness home.
