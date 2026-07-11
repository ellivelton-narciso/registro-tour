FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data/team-images

ENV TEAM_IMAGES_DIR=/data/team-images
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
