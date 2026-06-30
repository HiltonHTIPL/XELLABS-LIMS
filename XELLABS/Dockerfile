FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
