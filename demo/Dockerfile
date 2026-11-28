# The demo image: the app of the Dockerfile in the root, with PostgreSQL and Mailpit inside, so that one
# `docker run` starts everything and nothing else is needed (no code, no Compose file, no database).
# It is for demos and for trying the app: the data lives in the container, and the seed creates demo
# accounts with a public password. docs/docker-demo.md explains how to run it.
#
# Build it from this folder, giving the image of the app:
#   docker build -f demo/Dockerfile --build-arg APP_IMAGE=<the image of the app> demo
# docker.yml does it after it has published the image of the app, and publishes the result to Docker Hub.

ARG APP_IMAGE=ghcr.io/stealve/se2-project-team16-mountain-hut:latest

FROM axllent/mailpit:v1.29 AS mailpit

FROM ${APP_IMAGE}

# The app image runs as node; this one starts as root to prepare PostgreSQL, and su-exec gives each
# process to its own user. Alpine keeps the extensions of PostgreSQL in postgresql16-contrib: the
# migrations need btree_gist (the rule that two hikes of a hiker cannot overlap, 006_hike.sql).
USER root
RUN apk add --no-cache postgresql16 postgresql16-contrib su-exec \
    && mkdir -p /run/postgresql /var/lib/postgresql/data \
    && chown postgres:postgres /run/postgresql /var/lib/postgresql/data
COPY --from=mailpit /mailpit /usr/local/bin/mailpit
COPY entrypoint.sh /usr/local/bin/demo-entrypoint.sh
RUN chmod +x /usr/local/bin/demo-entrypoint.sh

# The address of the website, for the links in the emails: change it with -e when the port changes.
ENV APP_URL=http://localhost:3001

EXPOSE 3001 8025

HEALTHCHECK --interval=5s --timeout=3s --start-period=60s --retries=10 \
    CMD wget -q -O /dev/null http://127.0.0.1:3001/ || exit 1

ENTRYPOINT ["demo-entrypoint.sh"]
