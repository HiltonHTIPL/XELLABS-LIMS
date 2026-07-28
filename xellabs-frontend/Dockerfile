# syntax=docker/dockerfile:1
FROM node:20-alpine AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --include=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

# Build then start. Volume-mounted source overrides COPY at runtime,
# so the build always uses the latest code from the host.
CMD ["sh", "-c", "npm run build && npm start -- -H 0.0.0.0"]
