import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Critical: Mock BEFORE importing any modules that use the mocked function
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getVersion: vi.fn().mockResolvedValue({ value: "test-version" }),
  })),
}));

// Import AFTER mocking
import healthzRouter from "../healthz.js";
import { createClient } from "../../baseNodeClient.js";

describe("Simple Test Demo", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create isolated Express app
    app = express();
    app.set("view engine", "hbs");
    
    // Mock template rendering
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.json({ template, data });
      });
      next();
    });

    // Mount router
    app.use("/healthz", healthzRouter);

    // Get mock client instance
    mockClient = (createClient as any)();
  });

  it("should work with proper mocking", async () => {
    const response = await request(app)
      .get("/healthz");

    console.log("Response status:", response.status);
    console.log("Response body:", response.body);
    console.log("Mock was called:", mockClient.getVersion.mock.calls.length > 0);
    
    // First let's just see what we get
    expect(response.status).toBe(200);
  });
});
