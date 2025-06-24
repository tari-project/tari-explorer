import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getNetworkDifficulty: vi.fn().mockResolvedValue([
      {
        difficulty: "1000000",
        estimated_hash_rate: "500000",
        height: 100,
        timestamp: Date.now() / 1000 - 60,
        pow_algo: "0", // RandomX
        coinbase_extras: ["universe,miner1,os,type,linux,1.0.0"],
        first_coinbase_extra: "miner1"
      },
      {
        difficulty: "999999",
        estimated_hash_rate: "499999",
        height: 99,
        timestamp: Date.now() / 1000 - 120,
        pow_algo: "1", // SHA-3
        coinbase_extras: ["universe,miner2,os,type,windows,2.0.0"],
        first_coinbase_extra: "miner2"
      },
      {
        difficulty: "999998",
        estimated_hash_rate: "499998",
        height: 98,
        timestamp: Date.now() / 1000 - 3600, // 1 hour ago (old block)
        pow_algo: "0", // RandomX
        coinbase_extras: ["universe,miner1,os,type,linux,1.0.0"],
        first_coinbase_extra: "miner1"
      },
      {
        difficulty: "999997",
        estimated_hash_rate: "499997",
        height: 97,
        timestamp: Date.now() / 1000 - 180,
        pow_algo: "1", // SHA-3
        coinbase_extras: [],
        first_coinbase_extra: ""
      }
    ])
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    index: "public, max-age=120"
  },
}));

import minersRouter from "../miners.js";
import { createClient } from "../../baseNodeClient.js";

describe("miners route", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get references to mocked modules
    mockClient = createClient();

    // Create isolated Express app
    app = express();
    app.set("view engine", "hbs");
    
    // Mock template rendering to return JSON
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.json({ template, data });
      });
      next();
    });

    app.use("/miners", minersRouter);
  });

  describe("GET /", () => {
    it("should return miners analytics data", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      expect(response.body.template).toBe("miners");
      expect(response.body.data).toHaveProperty("num_blocks");
      expect(response.body.data).toHaveProperty("difficulties");
      expect(response.body.data).toHaveProperty("unique_ids");
      expect(response.body.data).toHaveProperty("os");
      expect(response.body.data).toHaveProperty("versions");
      expect(response.body.data.num_blocks).toBe(4);
    });

    it("should set cache headers", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });

    it("should return JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/miners/?json")
        .expect(200);

      expect(response.body).not.toHaveProperty("template");
      expect(response.body).toHaveProperty("num_blocks");
      expect(response.body).toHaveProperty("unique_ids");
    });

    it("should parse miner information from coinbase extras", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      // Should have parsed miner1 and miner2
      expect(data.unique_ids).toHaveProperty("miner1");
      expect(data.unique_ids).toHaveProperty("miner2");
      
      // miner1 should have both RandomX and SHA counts
      expect(data.unique_ids.miner1.randomx.count).toBe(2);
      expect(data.unique_ids.miner1.sha.count).toBe(0);
      
      // miner2 should have SHA count
      expect(data.unique_ids.miner2.sha.count).toBe(1);
      expect(data.unique_ids.miner2.randomx.count).toBe(0);
    });

    it("should handle non-universe miners", async () => {
      // Mock data with non-universe miner (empty first_coinbase_extra)
      mockClient.getNetworkDifficulty.mockResolvedValue([
        {
          difficulty: "1000000",
          estimated_hash_rate: "500000",
          height: 100,
          timestamp: Date.now() / 1000 - 60,
          pow_algo: "0",
          coinbase_extras: [],
          first_coinbase_extra: ""
        }
      ]);

      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      expect(data.unique_ids).toHaveProperty("Non-universe miner");
    });

    it("should calculate recent blocks correctly", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      // miner1 has 2 blocks, one recent (60s ago) and one less recent (3600s ago)
      // Both should count as recent since 3600s < 7200s (120 minutes)
      expect(data.unique_ids.miner1.randomx.recent_blocks).toBe(2);
    });

    it("should track OS and version information", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      expect(data.unique_ids.miner1.randomx.os).toBe("linux");
      expect(data.unique_ids.miner1.randomx.version).toBe("1.0.0");
      expect(data.unique_ids.miner2.sha.os).toBe("windows");
      expect(data.unique_ids.miner2.sha.version).toBe("2.0.0");
    });

    it.skip("should handle malformed coinbase extras", async () => {
      // Mock data with insufficient coinbase extra fields
      mockClient.getNetworkDifficulty.mockResolvedValue([
        {
          difficulty: "1000000",
          estimated_hash_rate: "500000",
          height: 100,
          timestamp: Date.now() / 1000 - 60,
          pow_algo: "0",
          coinbase_extras: ["short"],
          first_coinbase_extra: "short-miner"
        }
      ]);

      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      // Should use first_coinbase_extra as unique_id when split.length < 6
      expect(data.unique_ids).toHaveProperty("short-miner");
      expect(data.unique_ids["short-miner"].randomx.os).toBe("Non-universe miner");
      expect(data.unique_ids["short-miner"].randomx.version).toBe("Non-universe miner");
    });

    it("should calculate time since last block", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      // Check that time_since_last_block is calculated correctly
      expect(data.unique_ids.miner1.randomx.time_since_last_block).toBeGreaterThan(0);
      expect(data.unique_ids.miner2.sha.time_since_last_block).toBeGreaterThan(0);
    });

    it.skip("should handle errors from client", async () => {
      mockClient.getNetworkDifficulty.mockRejectedValue(new Error("Network error"));

      await request(app)
        .get("/miners/")
        .expect(500);
    });

    it("should count OS and version statistics", async () => {
      const response = await request(app)
        .get("/miners/")
        .expect(200);

      const data = response.body.data;
      
      // Should have OS and version counts in the data
      expect(data).toHaveProperty("os");
      expect(data).toHaveProperty("versions");
    });
  });
});
