FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

RUN mkdir -p /data

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "dist-server/server/index.js"]
