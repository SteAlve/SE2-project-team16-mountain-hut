# The image of the app, in two stages: the first builds the client, the second has only what runs.
# Build it from the root of the repository. docs/architecture.md (section 6) explains the setup.

# 1. Build the client
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# 2. The server, with its production dependencies and the built client
FROM node:22-alpine AS server
ENV NODE_ENV=production
ENV CLIENT_DIR=/app/client
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/migrations ./migrations
COPY server/scripts ./scripts
COPY server/src ./src
COPY --from=client /app/client/dist /app/client

USER node
EXPOSE 3001

# The migrations run before the server. exec gives the place to node, so SIGTERM reaches the server.
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/index.js"]
