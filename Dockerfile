FROM node:16.17.0-bullseye-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init

ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --chown=node:node . .
#RUN npm ci --only=production --omit=dev libs/base_node_grpc_client
#RUN npm ci --only=production --omit=dev
RUN npm install ./libs/base_node_grpc_client/
RUN npm install
RUN npm install debug

EXPOSE 4000

USER node
#CMD ["dumb-init", "node", "app.js"]
#CMD ["npm", "start"]
CMD ["dumb-init", "node", "./bin/www"]
