#!/usr/bin/env bash
# Shared implementation of the Mac and Linux start/stop scripts.
# Usage: scripts/docker.sh start|stop
set -euo pipefail

NAME=prelegal
IMAGE=prelegal
PORT=8000
URL="http://localhost:${PORT}"

cd "$(dirname "$0")/.."

start() {
  echo "Building the Prelegal image…"
  docker build -t "$IMAGE" .

  # Replace any running container. The database lives inside the container,
  # so every start begins with a fresh one.
  docker rm -f "$NAME" >/dev/null 2>&1 || true

  local env_args=()
  if [[ -f .env ]]; then
    env_args=(--env-file .env)
  else
    echo "Note: no .env file found in the project root; starting without it."
  fi

  # ${arr[@]+...} keeps `set -u` happy with an empty array on macOS's bash 3.2.
  docker run -d --name "$NAME" -p "${PORT}:8000" ${env_args[@]+"${env_args[@]}"} "$IMAGE" >/dev/null

  echo -n "Waiting for Prelegal to start"
  for _ in $(seq 1 30); do
    if curl -fsS "${URL}/api/health" >/dev/null 2>&1; then
      echo
      echo "Prelegal is running at ${URL}"
      return 0
    fi
    echo -n "."
    sleep 1
  done

  echo
  echo "Prelegal did not become healthy within 30 seconds. Container logs:" >&2
  docker logs "$NAME" >&2 || true
  return 1
}

stop() {
  # `docker rm -f` succeeds even when there is no such container, so check first.
  if [[ -n "$(docker ps -aq --filter "name=^${NAME}$")" ]]; then
    docker rm -f "$NAME" >/dev/null
    echo "Prelegal stopped."
  else
    echo "Prelegal is not running."
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  *)
    echo "Usage: $0 start|stop" >&2
    exit 2
    ;;
esac
