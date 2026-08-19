FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
