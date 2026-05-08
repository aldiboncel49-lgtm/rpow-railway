# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspaces --include-workspace-root --ignore-scripts

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm run build --workspace @rpow/shared
RUN npm run build --workspace @rpow/server

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Install tini sebagai init process (handle signal dengan benar)
RUN apk add --no-cache tini

# Copy server build
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/server/migrations ./apps/server/migrations

# Copy miner bot
COPY miner-bot/miner.ts ./miner-bot/miner.ts

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./start.sh"]
