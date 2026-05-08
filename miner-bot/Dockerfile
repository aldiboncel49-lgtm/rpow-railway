FROM node:22-alpine

WORKDIR /app

# Copy miner source
COPY miner-bot/miner.ts ./
COPY miner-bot/package.json ./

# Env defaults (override di Railway)
ENV RPOW_SERVER_URL=http://localhost:8080
ENV RPOW_EMAIL=""
ENV RPOW_SESSION_COOKIE=""
ENV RETRY_DELAY_MS=5000
ENV MAX_RETRIES=999999
ENV MINE_INTERVAL_MS=0
ENV LOG_LEVEL=info

CMD ["node", "--experimental-strip-types", "miner.ts"]
