#!/bin/sh
# Starts the demo: PostgreSQL, Mailpit and the app, in this order, in one container.
# PostgreSQL keeps its files in /var/lib/postgresql/data: mount a volume there to keep the data when
# the container is removed. Stopping the container stops the three processes, the database last.
set -eu

PGDATA=/var/lib/postgresql/data

# --- PostgreSQL (listens only inside the container) -----------------------------------------------
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su-exec postgres initdb -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 > /dev/null
fi
su-exec postgres pg_ctl -D "$PGDATA" -w -s -l /tmp/postgres.log -o "-c listen_addresses=127.0.0.1" start
su-exec postgres psql -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname = 'mountain_hut'" | grep -q 1 \
  || su-exec postgres createdb -U postgres -h 127.0.0.1 mountain_hut

# --- Mailpit: the emails of the app stay here, and are read on port 8025 --------------------------
su-exec node mailpit --listen 0.0.0.0:8025 --smtp 127.0.0.1:1025 > /tmp/mailpit.log 2>&1 &
mail_pid=$!

# --- The app --------------------------------------------------------------------------------------
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/mountain_hut"
export SMTP_HOST="${SMTP_HOST:-127.0.0.1}"
export SMTP_PORT="${SMTP_PORT:-1025}"
cd /app/server
su-exec node node scripts/migrate.js
su-exec node node scripts/seed.js

su-exec node node src/index.js &
app_pid=$!

# The app first, so no request meets a closed database; then Mailpit; PostgreSQL last.
shutdown() {
  trap '' TERM INT
  kill -TERM "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  kill -TERM "$mail_pid" 2>/dev/null || true
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w -s stop || true
}
trap 'shutdown; exit 0' TERM INT

echo
echo "The demo is ready."
echo "  The app:     ${APP_URL}"
echo "  The emails:  http://localhost:8025 (Mailpit)"
echo "  Accounts:    emily.parker@quota.example, james.taylor@quota.example, oliver.wilson@quota.example,"
echo "               lucas.bennett@quota.example (hiker). Password: quota-demo-2026"
echo

# The app stopped by itself: stop the rest and give back its exit code.
status=0
wait "$app_pid" || status=$?
shutdown
exit "$status"
