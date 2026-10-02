# Use Node.js 22 (matches .nvmrc)
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Chạy app
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV PORT=4000
EXPOSE 4000

# Apply reviewed migrations, then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
