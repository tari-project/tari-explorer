import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getVersion: vi.fn(),
  })),
}));

import healthzRouter from "../../routes/healthz.js";
import { createClient } from "../../baseNodeClient.js";

describe("healthz route", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app
    app = express();
    app.set("view engine", "hbs");
    app.use("/healthz", healthzRouter);

    // Get mock instance
    mockClient = createClient();
  });

  describe("GET /", () => {
    it("should return version information as HTML", async () => {
      const mockVersion = { value: "1.2.3" };
      mockClient.getVersion.mockResolvedValue(mockVersion);

      // Mock res.render to avoid template rendering issues
      const renderSpy = vi.fn();
      app.use((req, res, next) => {
        res.render = renderSpy.mockImplementation((template, data) => {
          res.json({ template, ...data });
        });
        next();
      });

      const response = await request(app)
        .get("/healthz")
        .expect(200);

      expect(mockClient.getVersion).toHaveBeenCalledWith({});
      expect(renderSpy).toHaveBeenCalledWith("healthz", { version: "1.2.3" });
      expect(response.body).toEqual({
        template: "healthz",
        version: "1.2.3"
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

    it("should return JSON when json parameter has any value", async () => {
      const mockVersion = { value: "3.1.0" };
      mockClient.getVersion.mockResolvedValue(mockVersion);

      const response = await request(app)
        .get("/healthz?json=true")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        version: "3.1.0"
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

    it("should handle client errors with JSON response", async () => {
      const mockError = new Error("gRPC timeout");
      mockClient.getVersion.mockRejectedValue(mockError);

      await request(app)
        .get("/healthz?json")
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

    it("should handle empty version response", async () => {
      const mockVersion = { value: "" };
      mockClient.getVersion.mockResolvedValue(mockVersion);

      const response = await request(app)
        .get("/healthz?json")
        .expect(200);

      expect(response.body).toEqual({
        version: ""
      });
    });
  });
});
