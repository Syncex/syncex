FROM node:26-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
COPY entrypoint.sh /entrypoint.sh
ENV NODE_ENV=production
RUN chmod +x /entrypoint.sh
USER node
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
