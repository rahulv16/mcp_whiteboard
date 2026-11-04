FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node *.mjs ./
COPY --chown=node:node public ./public
RUN mkdir -p /data && chown node:node /data
USER node
ENV WHITEBOARD_HOST=0.0.0.0 WHITEBOARD_PORT=4180 WHITEBOARD_DATA=/data
EXPOSE 4180
CMD ["node", "server.mjs"]
