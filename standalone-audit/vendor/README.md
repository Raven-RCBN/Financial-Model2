# Coordinate timezone lookup

Vendored `tz.js` from `@photostructure/tz-lookup` 11.7.0 (CC0-1.0), renamed `.cjs` for Node ESM interoperability. No executable install hooks or runtime network calls.

Source: https://github.com/photostructure/tz-lookup
Package: https://registry.npmjs.org/@photostructure/tz-lookup/-/tz-lookup-11.7.0.tgz

Uses compressed geographical boundaries; timezone resolution can be approximate near borders. Node's IANA timezone rules determine each local calendar date, including DST. Audit stores the resolved zone at finalization and uses Africa/Lagos when no valid captured coordinates exist.
