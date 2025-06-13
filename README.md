# Tari explorer

## No client-side JavaScript block explorer (tari-text-explorer)

### Dependencies

- `npm install`

### Build

- `npm run build`

### Start server

- `npm start`

### Build and run the server in dev mode watch

- `npm run dev`

## Useful environment variables

To run, export the following environment variables:

- PORT `Port of service` (Default: `4000`)
- BASE_NODE_GRPC_URL `Base node GRPC URL` (Default: `localhost:18142`)
-
- BASE_NODE_PROTO `location of base_node.proto` (Default: `../proto/base_node.proto`)
- TARI_EXPLORER_INDEX_CACHE_SETTINGS `Index cache` (Default: `public, max-age=120, s-maxage=60, stale-while-revalidate=30`)
- TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS `Mempool cache` (Default: `public, max-age=15, s-maxage=15, stale-while-revalidate=15`)
- TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS `Old blocks cache` (Default: `public, max-age=604800, s-maxage=604800, stale-while-revalidate=604800`)
- TARI_EXPLORER_NEW_BLOCKS_CACHE_SETTINGS `New blocks cache` (Default: `public, max-age=120, s-maxage=60, stale-while-revalidate=30`)
- TARI_EXPLORER_OLD_BLOCK_DELTA_TIP `Delta tip between old and new` (Default: `5040`)

### Running the Minotari Node

- Download the latest release from https://github.com/tari-project/tari/releases
- Start the node with the following command:

```bash
    ./minotari_node \
     -b syncNode-ip4 \
     --network mainnet \
     --disable-splash-screen \
     --non-interactive-mode \
     --grpc-enabled \
     -p bypass_range_proof_verification=true \
     -p base_node.grpc_address=/ip4/127.0.0.1/tcp/18142 \
     -p base_node.grpc_server_allow_methods=\"get_tokens_in_circulation,get_tip_info,get_sync_info,get_sync_progress,get_mempool_stats,get_version,get_network_status,list_headers,get_mempool_transactions,get_active_validator_nodes,get_blocks\" \
     --mining-enabled
```

Requrired allow methods:

- get_tokens_in_circulation
- get_tip_info
- get_sync_info
- get_sync_progress
- get_mempool_stats
- get_version
- get_network_status
- list_headers
- get_mempool_transactions
- get_active_validator_nodes
- get_blocks
