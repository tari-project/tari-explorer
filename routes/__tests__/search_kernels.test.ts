import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    searchKernels: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

import searchKernelsRouter from "../search_kernels.js";

describe("search_kernels route (working)", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

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

    app.use("/search/kernels", searchKernelsRouter);
  });

  describe("GET /", () => {
    it("should return search form and set cache headers", async () => {
      const response = await request(app)
        .get("/search/kernels")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
      expect(response.body.template).toBe("search_kernels");
    });

    it("should return search form as JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/search/kernels?json")
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe("GET with kernel parameters", () => {
    it("should search for valid kernel with matching nonces and signatures", async () => {
      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const signature = "b1c2d3e4f5a6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(200);

      expect(response.body.template).toBe("search");
      expect(response.body.data).toHaveProperty("items");
    });

    it("should return JSON when json parameter present", async () => {
      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const signature = "b1c2d3e4f5a6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("should handle mismatched nonces and signatures by showing search form", async () => {
      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      // Missing signature
      
      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}`)
        .expect(200);
      
      expect(response.body.template).toBe("search_kernels");
    });

    it("should handle empty parameters by showing search form", async () => {
      const response = await request(app)
        .get("/search/kernels?nonces=&signatures=")
        .expect(200);
      
      expect(response.body.template).toBe("search_kernels");
    });

    it("should handle invalid hex values by showing search form", async () => {
      const response = await request(app)
        .get("/search/kernels?nonces=invalid&signatures=alsoinvalid")
        .expect(200);
      
      expect(response.body.template).toBe("search_kernels");
    });
  });

  describe("Multiple kernel search", () => {
    it("should handle multiple nonces and signatures", async () => {
      const nonce1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const nonce2 = "b1c2d3e4f5a6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const sig1 = "c1d2e3f4a5b6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const sig2 = "d1e2f3a4b5c6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce1},${nonce2}&signatures=${sig1},${sig2}`)
        .expect(200);

      expect(response.body.template).toBe("search");
    });
  });
});
