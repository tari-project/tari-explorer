import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock the baseNodeClient
const mockClient = {
  searchUtxos: vi.fn(),
};

vi.mock("../../baseNodeClient.js", () => ({
  createClient: () => mockClient,
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

// Import the router after mocking
import searchCommitmentsRouter from "../search_commitments.js";

describe("search_commitments route", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());

    // Minimal mock for views - just return status
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = vi.fn((template, data) => {
        res.status(200).json({ template, data });
      });
      next();
    });

    app.use("/search/commitments", searchCommitmentsRouter);
  });

  describe("GET /", () => {
    it("should set cache headers", async () => {
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

      const response = await request(app)
        .get("/search/commitments?comm=a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });

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

    it("should search for UTXOs with multiple commitments", async () => {
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

      const commitment1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const commitment2 = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment1},${commitment2}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [
          Buffer.from(commitment1, "hex"),
          Buffer.from(commitment2, "hex"),
        ],
      });
    });

    it("should support different query parameter names", async () => {
      const mockUtxos = [];
      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      // Test with 'commitment'
      await request(app)
        .get(`/search/commitments?commitment=${commitment}`)
        .expect(200);

      // Test with 'c'
      await request(app)
        .get(`/search/commitments?c=${commitment}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(2);
    });

    it("should filter invalid hex commitments", async () => {
      const mockUtxos = [];
      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const validCommitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const invalidCommitment = "invalid_hex";

      const response = await request(app)
        .get(`/search/commitments?comm=${validCommitment},${invalidCommitment}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(validCommitment, "hex")],
      });
    });

    it("should handle whitespace and deduplicate commitments", async () => {
      const mockUtxos = [];
      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      const response = await request(app)
        .get(`/search/commitments?comm= ${commitment} , ${commitment} `)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(commitment, "hex")],
      });
    });

    it("should return 404 when no valid commitments provided", async () => {
      await request(app)
        .get("/search/commitments")
        .expect(404);

      await request(app)
        .get("/search/commitments?comm=invalid")
        .expect(404);

      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
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

      expect(response.text).toContain("Rendered: error");
      expect(response.text).toContain(mockError.message);
    });

    it("should handle client error and return JSON error when json parameter present", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchUtxos.mockRejectedValue(mockError);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}&json`)
        .expect(404);

      expect(response.body).toEqual({
        error: mockError,
      });
    });

    it("should handle empty results", async () => {
      mockClient.searchUtxos.mockResolvedValue([]);

      const commitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/commitments?comm=${commitment}`)
        .expect(200);

      expect(response.text).toContain("Rendered: search");
      expect(response.text).toContain("[]");
    });

    it("should handle case insensitive hex strings", async () => {
      const mockUtxos = [];
      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const lowerCaseCommitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const upperCaseCommitment = "A1B2C3D4E5F6789012345678901234567890123456789012345678901234567890";

      await request(app)
        .get(`/search/commitments?comm=${lowerCaseCommitment}`)
        .expect(200);

      await request(app)
        .get(`/search/commitments?comm=${upperCaseCommitment}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed case and special characters correctly", async () => {
      const mockUtxos = [];
      mockClient.searchUtxos.mockResolvedValue(mockUtxos);

      const mixedCommitment = "A1b2C3d4E5f6789012345678901234567890123456789012345678901234567890";

      const response = await request(app)
        .get(`/search/commitments?comm=${mixedCommitment}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(mixedCommitment, "hex")],
      });
    });

    it("should reject commitments with wrong length", async () => {
      const shortCommitment = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567";
      const longCommitment = "a1b2c3d4e5f67890123456789012345678901234567890123456789012345678901";

      await request(app)
        .get(`/search/commitments?comm=${shortCommitment}`)
        .expect(404);

      await request(app)
        .get(`/search/commitments?comm=${longCommitment}`)
        .expect(404);

      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });
  });
});
