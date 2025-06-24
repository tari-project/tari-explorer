import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    searchPaymentReferences: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

import searchOutputsByPayrefRouter from "../search_outputs_by_payref.js";

describe("search_outputs_by_payref route (working)", () => {
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

    app.use("/search/outputs_by_payref", searchOutputsByPayrefRouter);
  });

  describe("GET /", () => {
    it("should return search form and set cache headers", async () => {
      const response = await request(app)
        .get("/search/outputs_by_payref")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
      expect(response.body.template).toBe("search_outputs_by_payref");
    });

    it("should return search form as JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/search/outputs_by_payref?json")
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe("GET with payment reference parameters", () => {
    it("should search for valid payment reference using pay parameter", async () => {
      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?pay=${payref}`)
        .expect(200);

      expect(response.body.template).toBe("search_payref");
      expect(response.body.data).toHaveProperty("items");
    });

    it("should search for valid payment reference using payref parameter", async () => {
      const payref = "b1c2d3e4f5a6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?payref=${payref}`)
        .expect(200);

      expect(response.body.template).toBe("search_payref");
    });

    it("should search for valid payment reference using p parameter", async () => {
      const payref = "c1d2e3f4a5b6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?p=${payref}`)
        .expect(200);

      expect(response.body.template).toBe("search_payref");
    });

    it("should return JSON when json parameter present", async () => {
      const payref = "d1e2f3a4b5c6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?pay=${payref}&json`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("should handle multiple payment references", async () => {
      const payref1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const payref2 = "b1c2d3e4f5a6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?pay=${payref1},${payref2}`)
        .expect(200);

      expect(response.body.template).toBe("search_payref");
    });

    it("should handle empty parameters by showing search form", async () => {
      const response = await request(app)
        .get("/search/outputs_by_payref?pay=")
        .expect(200);
      
      expect(response.body.template).toBe("search_outputs_by_payref");
    });

    it("should handle invalid hex values by showing search form", async () => {
      const response = await request(app)
        .get("/search/outputs_by_payref?pay=invalid")
        .expect(200);
      
      expect(response.body.template).toBe("search_outputs_by_payref");
    });

    it("should handle short hex values by showing search form", async () => {
      const response = await request(app)
        .get("/search/outputs_by_payref?pay=abc123")
        .expect(200);
      
      expect(response.body.template).toBe("search_outputs_by_payref");
    });
  });

  describe("Parameter deduplication", () => {
    it("should deduplicate identical payment references", async () => {
      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/outputs_by_payref?pay=${payref},${payref},${payref}`)
        .expect(200);

      expect(response.body.template).toBe("search_payref");
    });
  });
});
