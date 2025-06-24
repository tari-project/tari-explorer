import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    searchUtxos: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

import searchCommitmentsRouter from "../search_commitments.js";

describe("search_commitments route (working)", () => {
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

    app.use("/search/commitments", searchCommitmentsRouter);
  });

  describe("GET /", () => {
    it("should return search form and set cache headers", async () => {
      const response = await request(app)
        .get("/search/commitments")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
      expect(response.body.template).toBe("search_commitments");
    });

    it("should return search form as JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/search/commitments?json")
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe("GET with commitment parameter", () => {
    it("should search for valid commitment", async () => {
      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}`)
        .expect(200);

      expect(response.body.template).toBe("search");
      expect(response.body.data).toHaveProperty("items");
    });

    it("should support multiple commitments", async () => {
      const commitment1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      const commitment2 = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment1},${commitment2}`)
        .expect(200);

      expect(response.body.template).toBe("search");
    });

    it("should return JSON when json parameter present", async () => {
      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}&json`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("should handle invalid commitments by showing search form", async () => {
      const response = await request(app)
        .get("/search/commitments?comm=invalid")
        .expect(200);
      
      expect(response.body.template).toBe("search_commitments");
    });

    it("should handle empty commitment parameter by showing search form", async () => {
      const response = await request(app)
        .get("/search/commitments?comm=")
        .expect(200);
      
      expect(response.body.template).toBe("search_commitments");
    });
  });

  describe("Error handling", () => {
    it("should handle gRPC call successfully with mocked client", async () => {
      // This test just verifies that the route works with the mock
      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".substring(0, 64);
      
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}`)
        .expect(200);

      expect(response.body.template).toBe("search");
      expect(response.body.data).toHaveProperty("items");
    });
  });
});
