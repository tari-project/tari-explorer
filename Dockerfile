# https://hub.docker.com/_/node
ARG NODE_VERSION=26-trixie-slim

FROM node:$NODE_VERSION

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init

WORKDIR /usr/src/app
COPY --chown=node:node . .

# The .proto files are vendored in the repo and pinned by tari-proto.pin.json,
# so the build needs no network access beyond the npm registry.
RUN npm install
RUN npm run build

ENV NODE_ENV=production

EXPOSE 4000
USER node
CMD ["dumb-init", "node", "./build/index.js"]
