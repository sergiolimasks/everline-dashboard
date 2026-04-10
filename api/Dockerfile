FROM node:20-alpine

WORKDIR /app

# Install deps (includes tsx — we run TS directly in production via tsx for simplicity)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
