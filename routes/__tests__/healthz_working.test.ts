import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getVersion: vi.fn().mockResolvedValue({ value: "1.2.3" }),
  })),
}));

import healthzRouter from "../healthz.js";

describe("healthz route (working)", () => {
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

    app.use("/healthz", healthzRouter);
  });

  it("should return version information as HTML", async () => {
    const response = await request(app)
      .get("/healthz")
      .expect(200);

    expect(response.body).toEqual({
      template: "healthz",
      data: { version: "1.2.3" }
    });
  });

  it("should return version information as JSON", async () => {
    const response = await request(app)
      .get("/healthz?json")
      .expect(200);

    expect(response.body).toEqual({ version: "1.2.3" });
  });
});
