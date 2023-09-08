# syntax = docker/dockerfile:1.3

# https://hub.docker.com/_/node
ARG NODE_VERSION=16-bullseye-slim

FROM node:$NODE_VERSION

ARG EXTERNAL_LIBS_LOCATION=./external_libs
ARG BASE_NODE_PROTO=../proto/base_node.proto

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init

ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --chown=node:node . .
#RUN npm ci --only=production --omit=dev ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
#RUN npm ci --only=production --omit=dev
RUN npm install ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
RUN npm install
#RUN npm install debug

ENV BASE_NODE_PROTO=${BASE_NODE_PROTO}

EXPOSE 4000

USER node
CMD ["dumb-init", "node", "./bin/www"]
