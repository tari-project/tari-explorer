import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Readable } from "stream";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getNetworkDifficulty: vi.fn(),
  })),
}));

vi.mock("@fast-csv/format", () => ({
  format: vi.fn(() => {
    const mockStream = new Readable({
      read() {},
    });
    mockStream.pipe = vi.fn((destination) => {
      // Simulate writing CSV data to the response
      destination.write("height,difficulty,timestamp\n");
      destination.write("100,1000000,1640995200\n");
      destination.write("101,1100000,1640995260\n");
      destination.end();
      return destination;
    });
    mockStream.write = vi.fn();
    mockStream.end = vi.fn();
    return mockStream;
  }),
}));

import exportRouter from "../../routes/export.js";
import { createClient } from "../../baseNodeClient.js";
import { format } from "@fast-csv/format";

describe("export route", () => {
  let app: express.Application;
  let mockClient: any;
  let mockFormat: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app
    app = express();
    app.use("/export", exportRouter);

    // Get mock instances
    mockClient = createClient();
    mockFormat = format as any;
  });

  describe("GET /", () => {
    it("should export network difficulty data as CSV", async () => {
      const mockDifficulties = [
        { height: 100, difficulty: 1000000, timestamp: 1640995200 },
        { height: 101, difficulty: 1100000, timestamp: 1640995260 },
        { height: 102, difficulty: 1200000, timestamp: 1640995320 },
      ];

      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get("/export")
        .expect(200);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
        from_tip: 1000,
      });

      expect(response.headers["content-disposition"]).toBe(
        'attachment; filename="data.csv"'
      );
      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");

      // Verify format was called with headers
      expect(mockFormat).toHaveBeenCalledWith({ headers: true });
    });

    it("should handle empty difficulty data", async () => {
      mockClient.getNetworkDifficulty.mockResolvedValue([]);

      await request(app)
        .get("/export")
        .expect(200);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
        from_tip: 1000,
      });
    });

    it("should handle client errors", async () => {
      const mockError = new Error("Network error");
      mockClient.getNetworkDifficulty.mockRejectedValue(mockError);

      await request(app)
        .get("/export")
        .expect(500);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
        from_tip: 1000,
      });
    });

    it("should handle large datasets", async () => {
      // Create a large dataset
      const largeDifficulties = Array.from({ length: 1000 }, (_, i) => ({
        height: i,
        difficulty: 1000000 + i * 1000,
        timestamp: 1640995200 + i * 60,
      }));

      mockClient.getNetworkDifficulty.mockResolvedValue(largeDifficulties);

      const response = await request(app)
        .get("/export")
        .expect(200);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
        from_tip: 1000,
      });

      expect(response.headers["content-disposition"]).toBe(
        'attachment; filename="data.csv"'
      );
    });

    it("should handle null/undefined difficulty values", async () => {
      const mockDifficulties = [
        { height: 100, difficulty: null, timestamp: 1640995200 },
        { height: 101, difficulty: undefined, timestamp: 1640995260 },
        { height: 102, difficulty: 0, timestamp: 1640995320 },
      ];

      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      await request(app)
        .get("/export")
        .expect(200);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
        from_tip: 1000,
      });
    });

    it("should set correct CSV headers", async () => {
      mockClient.getNetworkDifficulty.mockResolvedValue([
        { height: 100, difficulty: 1000000, timestamp: 1640995200 },
      ]);

      const response = await request(app)
        .get("/export")
        .expect(200);

      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain("data.csv");
      expect(response.headers["content-type"]).toMatch(/text\/csv/);
    });
  });
});
