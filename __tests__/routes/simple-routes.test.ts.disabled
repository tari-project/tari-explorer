import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getVersion: vi.fn(),
    getTipInfo: vi.fn(),
    getTokens: vi.fn(),
  })),
}));

vi.mock("@fast-csv/format", () => ({
  format: vi.fn(() => {
    const mockStream = {
      pipe: vi.fn().mockReturnThis(),
      write: vi.fn(),
      end: vi.fn(),
    };
    return mockStream;
  }),
}));

import healthzRouter from "../../routes/healthz.js";
import exportRouter from "../../routes/export.js";
import assetsRouter from "../../routes/assets.js";
import { createClient } from "../../baseNodeClient.js";
import { format } from "@fast-csv/format";

describe("Simple Routes", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app
    app = express();
    app.set("view engine", "hbs");
    
    // Mock res.render to return JSON instead of attempting Handlebars rendering
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => res.json({ template, ...data }));
      next();
    });

    app.use("/healthz", healthzRouter);
    app.use("/export", exportRouter);
    app.use("/assets", assetsRouter);

    // Get mock instance
    mockClient = createClient();
  });

  describe("healthz route", () => {
    describe("GET /", () => {
      it("should return version information as HTML", async () => {
        const mockVersion = { value: "1.2.3" };
        mockClient.getVersion.mockResolvedValue(mockVersion);

        const response = await request(app)
          .get("/healthz")
          .expect(200);

        expect(mockClient.getVersion).toHaveBeenCalledWith({});
        expect(response.body).toEqual({
          template: "healthz",
          data: {
            version: "1.2.3"
          }
        });
      });

      it("should return version information as JSON when json query parameter is present", async () => {
        const mockVersion = { value: "2.0.0" };
        mockClient.getVersion.mockResolvedValue(mockVersion);

        const response = await request(app)
          .get("/healthz?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.getVersion).toHaveBeenCalledWith({});
        expect(response.body).toEqual({
          version: "2.0.0"
        });
      });

      it("should handle client errors", async () => {
        const mockError = new Error("Connection failed");
        mockClient.getVersion.mockRejectedValue(mockError);

        await request(app)
          .get("/healthz")
          .expect(500);

        expect(mockClient.getVersion).toHaveBeenCalledWith({});
      });

      it("should handle different version formats", async () => {
        const mockVersion = { value: "v1.0.0-alpha.1" };
        mockClient.getVersion.mockResolvedValue(mockVersion);

        const response = await request(app)
          .get("/healthz?json")
          .expect(200);

        expect(response.body).toEqual({
          version: "v1.0.0-alpha.1"
        });
      });

      it("should handle null version response", async () => {
        const mockVersion = { value: null };
        mockClient.getVersion.mockResolvedValue(mockVersion);

        const response = await request(app)
          .get("/healthz?json")
          .expect(200);

        expect(response.body).toEqual({
          version: null
        });
      });
    });
  });

  describe("export route", () => {
    describe("GET /", () => {
      it("should return export page as HTML", async () => {
        const response = await request(app)
          .get("/export")
          .expect(200);

        expect(response.body).toEqual({
          template: "export"
        });
      });

      it("should return export data as JSON", async () => {
        const response = await request(app)
          .get("/export?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({});
      });
    });

    describe("GET /headers", () => {
      it("should set correct CSV headers and call format", async () => {
        const mockFormat = format as any;
        const mockStream = {
          pipe: vi.fn().mockReturnThis(),
          write: vi.fn(),
          end: vi.fn(),
        };
        mockFormat.mockReturnValue(mockStream);

        const response = await request(app)
          .get("/export/headers")
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(response.headers['content-disposition']).toBe('attachment; filename="headers.csv"');
        expect(mockFormat).toHaveBeenCalledWith({
          headers: ['height', 'hash', 'prev_hash', 'timestamp', 'output_mr', 'kernel_mr']
        });
      });

      it("should handle CSV generation errors", async () => {
        const mockFormat = format as any;
        mockFormat.mockImplementation(() => {
          throw new Error("CSV generation failed");
        });

        await request(app)
          .get("/export/headers")
          .expect(500);
      });
    });

    describe("GET /kernels", () => {
      it("should set correct CSV headers for kernels", async () => {
        const mockFormat = format as any;
        const mockStream = {
          pipe: vi.fn().mockReturnThis(),
          write: vi.fn(),
          end: vi.fn(),
        };
        mockFormat.mockReturnValue(mockStream);

        const response = await request(app)
          .get("/export/kernels")
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(response.headers['content-disposition']).toBe('attachment; filename="kernels.csv"');
        expect(mockFormat).toHaveBeenCalledWith({
          headers: ['excess_sig', 'fee', 'lock_height']
        });
      });
    });

    describe("GET /outputs", () => {
      it("should set correct CSV headers for outputs", async () => {
        const mockFormat = format as any;
        const mockStream = {
          pipe: vi.fn().mockReturnThis(),
          write: vi.fn(),
          end: vi.fn(),
        };
        mockFormat.mockReturnValue(mockStream);

        const response = await request(app)
          .get("/export/outputs")
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(response.headers['content-disposition']).toBe('attachment; filename="outputs.csv"');
        expect(mockFormat).toHaveBeenCalledWith({
          headers: ['commitment', 'features', 'proof']
        });
      });
    });
  });

  describe("assets route", () => {
    describe("GET /", () => {
      it("should return assets list as HTML", async () => {
        const mockTokens = [
          { asset_public_key: "token1", total_supply: "1000" },
          { asset_public_key: "token2", total_supply: "2000" }
        ];
        mockClient.getTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .get("/assets")
          .expect(200);

        expect(mockClient.getTokens).toHaveBeenCalledWith({});
        expect(response.body).toEqual({
          template: "assets",
          tokens: mockTokens
        });
      });

      it("should return assets list as JSON", async () => {
        const mockTokens = [
          { asset_public_key: "token1", total_supply: "1000" }
        ];
        mockClient.getTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .get("/assets?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.getTokens).toHaveBeenCalledWith({});
        expect(response.body).toEqual({
          tokens: mockTokens
        });
      });

      it("should handle empty tokens list", async () => {
        mockClient.getTokens.mockResolvedValue([]);

        const response = await request(app)
          .get("/assets?json")
          .expect(200);

        expect(response.body).toEqual({
          tokens: []
        });
      });

      it("should handle client errors", async () => {
        const mockError = new Error("Token fetch failed");
        mockClient.getTokens.mockRejectedValue(mockError);

        await request(app)
          .get("/assets")
          .expect(500);

        expect(mockClient.getTokens).toHaveBeenCalledWith({});
      });

      it("should handle null tokens response", async () => {
        mockClient.getTokens.mockResolvedValue(null);

        const response = await request(app)
          .get("/assets?json")
          .expect(200);

        expect(response.body).toEqual({
          tokens: null
        });
      });
    });

    describe("GET /:asset_public_key", () => {
      it("should return specific asset details as HTML", async () => {
        const mockTokens = [
          { asset_public_key: "token123", total_supply: "5000", description: "Test Token" }
        ];
        mockClient.getTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .get("/assets/token123")
          .expect(200);

        expect(mockClient.getTokens).toHaveBeenCalledWith({
          asset_public_key: "token123"
        });
        expect(response.body).toEqual({
          template: "asset",
          asset_public_key: "token123",
          token: mockTokens[0]
        });
      });

      it("should return specific asset details as JSON", async () => {
        const mockTokens = [
          { asset_public_key: "token456", total_supply: "3000" }
        ];
        mockClient.getTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .get("/assets/token456?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.getTokens).toHaveBeenCalledWith({
          asset_public_key: "token456"
        });
        expect(response.body).toEqual({
          asset_public_key: "token456",
          token: mockTokens[0]
        });
      });

      it("should handle asset not found", async () => {
        mockClient.getTokens.mockResolvedValue([]);

        const response = await request(app)
          .get("/assets/nonexistent")
          .expect(200);

        expect(response.body).toEqual({
          template: "asset",
          asset_public_key: "nonexistent",
          token: undefined
        });
      });

      it("should handle client errors for specific asset", async () => {
        const mockError = new Error("Asset fetch failed");
        mockClient.getTokens.mockRejectedValue(mockError);

        await request(app)
          .get("/assets/token789")
          .expect(500);

        expect(mockClient.getTokens).toHaveBeenCalledWith({
          asset_public_key: "token789"
        });
      });

      it("should handle special characters in asset key", async () => {
        const assetKey = "token_with-special.chars";
        const mockTokens = [
          { asset_public_key: assetKey, total_supply: "1000" }
        ];
        mockClient.getTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .get(`/assets/${encodeURIComponent(assetKey)}`)
          .expect(200);

        expect(mockClient.getTokens).toHaveBeenCalledWith({
          asset_public_key: assetKey
        });
        expect(response.body.token.asset_public_key).toBe(assetKey);
      });
    });
  });
});
