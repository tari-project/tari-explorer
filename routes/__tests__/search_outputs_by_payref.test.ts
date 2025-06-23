import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: () => ({
    searchPaymentReferences: vi.fn(),
  }),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

// Import the router after mocking
import searchPayrefRouter from "../search_outputs_by_payref.js";
import { createClient } from "../../baseNodeClient.js";
import cacheSettings from "../../cacheSettings.js";

describe("search_outputs_by_payref route", () => {
  let app: express.Application;
  let mockClient: any;
  let mockCacheSettings: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mock instances
    mockClient = createClient();
    mockCacheSettings = cacheSettings;

    app = express();
    app.set("view engine", "hbs");
    app.set("views", "./views");

    // Mock the render function
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = vi.fn((template, data) => {
        res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });

    app.use("/search/payref", searchPayrefRouter);
  });

  describe("GET /", () => {
    it("should set cache headers", async () => {
      const mockOutputs = [
        {
          output: {
            features: { output_type: "standard" },
            commitment: "abc123",
            payment_reference: "def456",
          },
        },
      ];

      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}`)
        .expect(200);

      expect(response.headers["cache-control"]).toBe(mockCacheSettings.newBlocks);
    });

    it("should search for outputs with single payment reference", async () => {
      const mockOutputs = [
        {
          output: {
            features: { output_type: "standard" },
            commitment: "abc123",
            payment_reference: "def456",
          },
        },
      ];

      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true,
      });
      expect(response.text).toContain("Rendered: search_payref");
    });

    it("should search for outputs with multiple payment references", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const payref2 = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";
      const response = await request(app)
        .get(`/search/payref?pay=${payref1},${payref2}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref1, payref2],
        include_spent: true,
      });
    });

    it("should support different query parameter names", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      // Test with 'payref'
      await request(app)
        .get(`/search/payref?payref=${payref}`)
        .expect(200);

      // Test with 'p'
      await request(app)
        .get(`/search/payref?p=${payref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(2);
    });

    it("should filter invalid hex payment references", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const validPayref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const invalidPayref = "invalid_hex";

      const response = await request(app)
        .get(`/search/payref?pay=${validPayref},${invalidPayref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [validPayref],
        include_spent: true,
      });
    });

    it("should handle whitespace and deduplicate payment references", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      const response = await request(app)
        .get(`/search/payref?pay= ${payref} , ${payref} `)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true,
      });
    });

    it("should return 404 when no valid payment references provided", async () => {
      await request(app)
        .get("/search/payref")
        .expect(404);

      await request(app)
        .get("/search/payref?pay=invalid")
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it("should return JSON when json query parameter is present", async () => {
      const mockOutputs = [
        {
          output: {
            features: { output_type: "standard" },
            commitment: "abc123",
            payment_reference: "def456",
          },
        },
      ];

      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}&json`)
        .expect(200);

      expect(response.body).toEqual({
        items: mockOutputs,
      });
    });

    it("should handle client error and return error page", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchPaymentReferences.mockRejectedValue(mockError);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}`)
        .expect(404);

      expect(response.text).toContain("Rendered: error");
      expect(response.text).toContain(mockError.message);
    });

    it("should handle client error and return JSON error when json parameter present", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchPaymentReferences.mockRejectedValue(mockError);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}&json`)
        .expect(404);

      expect(response.body).toEqual({
        error: mockError,
      });
    });

    it("should handle empty results", async () => {
      mockClient.searchPaymentReferences.mockResolvedValue([]);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const response = await request(app)
        .get(`/search/payref?pay=${payref}`)
        .expect(200);

      expect(response.text).toContain("Rendered: search_payref");
      expect(response.text).toContain("[]");
    });

    it("should handle case insensitive hex strings", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const lowerCasePayref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const upperCasePayref = "A1B2C3D4E5F6789012345678901234567890123456789012345678901234567890";

      await request(app)
        .get(`/search/payref?pay=${lowerCasePayref}`)
        .expect(200);

      await request(app)
        .get(`/search/payref?pay=${upperCasePayref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(2);
    });

    it("should include spent outputs in search", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      const response = await request(app)
        .get(`/search/payref?pay=${payref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true,
      });
    });

    it("should handle mixed case hex strings correctly", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const mixedPayref = "A1b2C3d4E5f6789012345678901234567890123456789012345678901234567890";

      const response = await request(app)
        .get(`/search/payref?pay=${mixedPayref}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [mixedPayref],
        include_spent: true,
      });
    });

    it("should reject payment references with wrong length", async () => {
      const shortPayref = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567";
      const longPayref = "a1b2c3d4e5f67890123456789012345678901234567890123456789012345678901";

      await request(app)
        .get(`/search/payref?pay=${shortPayref}`)
        .expect(404);

      await request(app)
        .get(`/search/payref?pay=${longPayref}`)
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it("should handle large number of payment references", async () => {
      const mockOutputs = [];
      mockClient.searchPaymentReferences.mockResolvedValue(mockOutputs);

      const payrefs = [];
      for (let i = 0; i < 10; i++) {
        payrefs.push(`a1b2c3d4e5f6789012345678901234567890123456789012345678901234567${i.toString().padStart(3, '0')}`);
      }

      const response = await request(app)
        .get(`/search/payref?pay=${payrefs.join(',')}`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: payrefs,
        include_spent: true,
      });
    });
  });
});
