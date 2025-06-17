# syntax = docker/dockerfile:1.3

ARG NODE_VERSION=22-bookworm-slim
ARG EXTERNAL_LIBS_LOCATION=./external_libs
ARG BASE_NODE_PROTO=../proto/base_node.proto

# Build stage to include devDependencies
FROM node:${NODE_VERSION} AS builder
WORKDIR /usr/src/app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/ ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
RUN npm install ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
COPY --chown=node:node . .
RUN cp -fvr ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/proto applications/minotari_app_grpc/proto
RUN npm run build

FROM node:${NODE_VERSION}
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --chown=node:node package.json package-lock.json ./
# Changed to install only production dependencies in the final stage
RUN npm ci --only=production
COPY --chown=node:node ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/ ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
RUN npm install ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
# Changed to copy build output from builder stage
COPY --from=builder /usr/src/app/build ./build
RUN cp -fvr ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/proto applications/minotari_app_grpc/proto

ENV BASE_NODE_PROTO=${BASE_NODE_PROTO}
EXPOSE 4000
USER node
CMD ["dumb-init", "node", "./build/index.js"]
