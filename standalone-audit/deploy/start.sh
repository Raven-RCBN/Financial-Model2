#!/bin/sh
set -eu
cd /home/deploy_audit/app
exec /usr/bin/node server.mjs
