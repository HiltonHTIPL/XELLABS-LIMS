FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build then start. Volume-mounted source overrides COPY at runtime,
# so the build always uses the latest code from the host.
CMD ["sh", "-c", "npm run build && npm start -- -H 0.0.0.0"]
