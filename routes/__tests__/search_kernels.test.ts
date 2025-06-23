import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: () => ({
    searchKernels: vi.fn(),
  }),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
  },
}));

// Import the router after mocking
import searchKernelsRouter from "../search_kernels.js";
import { createClient } from "../../baseNodeClient.js";
import cacheSettings from "../../cacheSettings.js";

describe("search_kernels route", () => {
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

    app.use("/search/kernels", searchKernelsRouter);
  });

  describe("GET /", () => {
    it("should set cache headers", async () => {
      const mockKernels = [
        {
          kernel: {
            features: "PLAIN",
            excess: "abc123",
            public_nonce: "def456",
            signature: "ghi789",
          },
        },
      ];

      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(200);

      expect(response.headers["cache-control"]).toBe(mockCacheSettings.newBlocks);
    });

    it("should search for kernels with single nonce/signature pair", async () => {
      const mockKernels = [
        {
          kernel: {
            features: "PLAIN",
            excess: "abc123",
            public_nonce: "def456",
            signature: "ghi789",
          },
        },
      ];

      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(nonce, "hex"),
            signature: Buffer.from(signature, "hex"),
          },
        ],
      });
      expect(response.text).toContain("Rendered: search");
    });

    it("should search for kernels with multiple nonce/signature pairs", async () => {
      const mockKernels = [];
      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const nonce1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature1 = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";
      const nonce2 = "c3d4e5f6789012345678901234567890123456789012345678901234567890a1b2";
      const signature2 = "d4e5f6789012345678901234567890123456789012345678901234567890a1b2c3";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce1},${nonce2}&signatures=${signature1},${signature2}`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(nonce1, "hex"),
            signature: Buffer.from(signature1, "hex"),
          },
          {
            public_nonce: Buffer.from(nonce2, "hex"),
            signature: Buffer.from(signature2, "hex"),
          },
        ],
      });
    });

    it("should filter invalid hex nonces and signatures", async () => {
      const mockKernels = [];
      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const validNonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const validSignature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";
      const invalidNonce = "invalid_hex";
      const invalidSignature = "also_invalid";

      const response = await request(app)
        .get(`/search/kernels?nonces=${validNonce},${invalidNonce}&signatures=${validSignature},${invalidSignature}`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(validNonce, "hex"),
            signature: Buffer.from(validSignature, "hex"),
          },
        ],
      });
    });

    it("should handle whitespace in nonces and signatures", async () => {
      const mockKernels = [];
      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces= ${nonce} &signatures= ${signature} `)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(nonce, "hex"),
            signature: Buffer.from(signature, "hex"),
          },
        ],
      });
    });

    it("should return 404 when no nonces provided", async () => {
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      await request(app)
        .get(`/search/kernels?signatures=${signature}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it("should return 404 when no signatures provided", async () => {
      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      await request(app)
        .get(`/search/kernels?nonces=${nonce}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it("should return 404 when nonces and signatures count mismatch", async () => {
      const nonce1 = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const nonce2 = "c3d4e5f6789012345678901234567890123456789012345678901234567890a1b2";
      const signature1 = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      await request(app)
        .get(`/search/kernels?nonces=${nonce1},${nonce2}&signatures=${signature1}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it("should return 404 when invalid hex values result in empty arrays", async () => {
      await request(app)
        .get("/search/kernels?nonces=invalid&signatures=also_invalid")
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it("should return JSON when json query parameter is present", async () => {
      const mockKernels = [
        {
          kernel: {
            features: "PLAIN",
            excess: "abc123",
            public_nonce: "def456",
            signature: "ghi789",
          },
        },
      ];

      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.body).toEqual({
        items: mockKernels,
      });
    });

    it("should handle client error and return error page", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchKernels.mockRejectedValue(mockError);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(404);

      expect(response.text).toContain("Rendered: error");
      expect(response.text).toContain(mockError.message);
    });

    it("should handle client error and return JSON error when json parameter present", async () => {
      const mockError = new Error("Client connection failed");
      mockClient.searchKernels.mockRejectedValue(mockError);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(404);

      expect(response.body).toEqual({
        error: mockError,
      });
    });

    it("should handle empty results", async () => {
      mockClient.searchKernels.mockResolvedValue([]);

      const nonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const signature = "b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(200);

      expect(response.text).toContain("Rendered: search");
      expect(response.text).toContain("[]");
    });

    it("should handle case insensitive hex strings", async () => {
      const mockKernels = [];
      mockClient.searchKernels.mockResolvedValue(mockKernels);

      const lowerCaseNonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const upperCaseSignature = "B2C3D4E5F6789012345678901234567890123456789012345678901234567890A1";

      const response = await request(app)
        .get(`/search/kernels?nonces=${lowerCaseNonce}&signatures=${upperCaseSignature}`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(lowerCaseNonce, "hex"),
            signature: Buffer.from(upperCaseSignature, "hex"),
          },
        ],
      });
    });

    it("should reject hex strings with wrong length", async () => {
      const shortNonce = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567";
      const longSignature = "b2c3d4e5f67890123456789012345678901234567890123456789012345678901";

      await request(app)
        .get(`/search/kernels?nonces=${shortNonce}&signatures=${longSignature}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });
  });
});
