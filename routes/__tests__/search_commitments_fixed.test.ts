import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies using established pattern from working tests
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    searchUtxos: vi.fn(),
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

import searchCommitmentsRouter from "../search_commitments.js";
import { createClient } from "../../baseNodeClient.js";

describe("search_commitments route", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app with established pattern
    app = express();
    app.set("view engine", "hbs");
    
    // Mock res.render to return JSON instead of attempting Handlebars rendering
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => res.json({ template, ...data }));
      next();
    });

    app.use("/search/commitments", searchCommitmentsRouter);

    // Get mock instance
    mockClient = createClient();
  });

  describe("GET /", () => {
    it("should return search form as HTML", async () => {
      const response = await request(app)
        .get("/search/commitments")
        .expect(200);

      expect(response.body).toEqual({
        template: "search_commitments"
      });
    });

    it("should return search form as JSON", async () => {
      const response = await request(app)
        .get("/search/commitments?json")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({});
    });

    it("should set cache headers", async () => {
      const response = await request(app)
        .get("/search/commitments")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });
  });

  describe("GET with commitment parameter", () => {
    it("should search for UTXOs with single commitment", async () => {
      const mockUtxos = [
        {
          commitment: "abc123",
          output: {
            features: { output_type: "standard" },
            commitment: "abc123",
            range_proof: "proof123",
          },
        },
      ];

      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(commitment, "hex")],
      });
      expect(response.body.template).toBe("search");
    });

    it("should return JSON when json query parameter is present", async () => {
      const mockUtxos = [
        {
          commitment: "abc123",
          output: {
            features: { output_type: "standard" },
            commitment: "abc123",
            range_proof: "proof123",
          },
        },
      ];

      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}&json`)
        .expect(200);

      expect(response.body).toEqual({
        items: mockUtxos,
      });
    });

    it("should handle client error and return error page", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchUtxos.mockRejectedValue(mockError);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}`)
        .expect(404);

      expect(response.body.template).toBe("error");
    });

    it("should return 404 when no valid commitments provided", async () => {
      await request(app)
        .get("/search/commitments")
        .expect(200); // This should show the form, not 404

      await request(app)
        .get("/search/commitments?comm=invalid")
        .expect(404);

      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });
  });
});
