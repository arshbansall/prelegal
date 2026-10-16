#!/usr/bin/env bash
# Stop Prelegal. The database is discarded with the container.
exec "$(dirname "$0")/docker.sh" stop
