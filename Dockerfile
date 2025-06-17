# syntax = docker/dockerfile:1.3

FROM node:22-bookworm-slim AS builder

# Arguments for the builder stage
ARG EXTERNAL_LIBS_LOCATION=./external_libs
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
RUN npm install ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/
COPY . .
RUN cp -fvr ${EXTERNAL_LIBS_LOCATION}/base_node_grpc_client/proto applications/minotari_app_grpc/proto
RUN npm run build


# --- Production ---
FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy package.json and install ONLY production dependencies
COPY --from=builder /usr/src/app/package*.json ./
RUN npm ci --only=production

# Copy the compiled code and other necessary assets from the builder stage
COPY --from=builder --chown=node:node /usr/src/app/build ./build
COPY --from=builder --chown=node:node /usr/src/app/applications ./applications

ARG BASE_NODE_PROTO=../proto/base_node.proto
ENV BASE_NODE_PROTO=${BASE_NODE_PROTO}

EXPOSE 4000

USER node
CMD ["dumb-init", "node", "./build/index.js"]
