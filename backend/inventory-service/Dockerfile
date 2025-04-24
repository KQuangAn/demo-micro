FROM node:23-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate --schema=src/prisma/schema.prisma

RUN npm run build

FROM node:23-alpine AS final

WORKDIR /app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/prisma ./src/prisma

ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000

CMD ["node", "dist/src/main.js"]