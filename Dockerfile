# syntax = docker/dockerfile:1.3

# https://hub.docker.com/_/node
ARG NODE_VERSION=22-bookworm-slim

FROM node:$NODE_VERSION

ARG EXTERNAL_LIBS_LOCATION=./external_libs
ARG BASE_NODE_PROTO=../proto/base_node.proto

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init

ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --chown=node:node . .
#RUN npm ci --only=production --omit=dev ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
#RUN npm ci --only=production --omit=dev
RUN npm install ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
RUN npm install
# Hack - bring proto files in
RUN cp -fvr ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/proto applications/minotari_app_grpc/proto
#RUN npm install debug
RUN npm run build


ENV BASE_NODE_PROTO=${BASE_NODE_PROTO}

EXPOSE 4000

USER node
CMD ["dumb-init", "node", "./build/index.js"]
