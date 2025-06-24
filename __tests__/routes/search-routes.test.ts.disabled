import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    searchUtxos: vi.fn(),
    searchKernels: vi.fn(),
    searchPaymentReferences: vi.fn(),
  })),
}));

import searchCommitmentsRouter from "../../routes/search_commitments.js";
import searchKernelsRouter from "../../routes/search_kernels.js";
import searchOutputsByPayrefRouter from "../../routes/search_outputs_by_payref.js";
import { createClient } from "../../baseNodeClient.js";

describe("Search Routes", () => {
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

    app.use("/search/commitments", searchCommitmentsRouter);
    app.use("/search/kernels", searchKernelsRouter);
    app.use("/search/outputs_by_payref", searchOutputsByPayrefRouter);

    // Get mock instance
    mockClient = createClient();
  });

  describe("search_commitments route", () => {
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
    });

    describe("GET /:commitment", () => {
      it("should search for valid commitment and return HTML", async () => {
        const commitment = "abcdef1234567890";
        const mockResults = [
          { 
            commitment: commitment,
            features: { output_type: 0 },
            proof: "proof123"
          }
        ];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments/${commitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [commitment] 
        });
        expect(response.body).toEqual({
          template: "search_commitments",
          commitment: commitment,
          outputs: mockResults
        });
      });

      it("should search for valid commitment and return JSON", async () => {
        const commitment = "fedcba0987654321";
        const mockResults = [
          { commitment: commitment, features: { output_type: 1 } }
        ];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments/${commitment}?json`)
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [commitment] 
        });
        expect(response.body).toEqual({
          commitment: commitment,
          outputs: mockResults
        });
      });

      it("should handle hex string with 0x prefix", async () => {
        const commitment = "0xabcdef1234567890";
        const expectedCommitment = "abcdef1234567890";
        const mockResults = [];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments/${commitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [expectedCommitment] 
        });
        expect(response.body.commitment).toBe(expectedCommitment);
      });

      it("should handle commitment not found", async () => {
        const commitment = "nonexistent123456";
        mockClient.searchUtxos.mockResolvedValue([]);

        const response = await request(app)
          .get(`/search/commitments/${commitment}`)
          .expect(200);

        expect(response.body).toEqual({
          template: "search_commitments",
          commitment: commitment,
          outputs: []
        });
      });

      it("should handle invalid hex commitment", async () => {
        const invalidCommitment = "notahexstring!@#";

        await request(app)
          .get(`/search/commitments/${invalidCommitment}`)
          .expect(400);
      });

      it("should handle client errors", async () => {
        const commitment = "abcdef1234567890";
        const mockError = new Error("Search failed");
        mockClient.searchUtxos.mockRejectedValue(mockError);

        await request(app)
          .get(`/search/commitments/${commitment}`)
          .expect(500);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [commitment] 
        });
      });

      it("should handle uppercase hex strings", async () => {
        const commitment = "ABCDEF1234567890";
        const expectedCommitment = "abcdef1234567890";
        const mockResults = [];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments/${commitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [expectedCommitment] 
        });
        expect(response.body.commitment).toBe(expectedCommitment);
      });
    });

    describe("query parameter variations", () => {
      it("should handle commitment query parameter", async () => {
        const commitment = "abcdef1234567890";
        const mockResults = [];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments?commitment=${commitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [commitment] 
        });
      });

      it("should handle commitments query parameter (plural)", async () => {
        const commitment = "fedcba0987654321";
        const mockResults = [];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments?commitments=${commitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [commitment] 
        });
      });

      it("should prioritize path parameter over query parameter", async () => {
        const pathCommitment = "pathcommitment123";
        const queryCommitment = "querycommitment456";
        const mockResults = [];
        mockClient.searchUtxos.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/commitments/${pathCommitment}?commitment=${queryCommitment}`)
          .expect(200);

        expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
          commitments: [pathCommitment] 
        });
        expect(response.body.commitment).toBe(pathCommitment);
      });
    });
  });

  describe("search_kernels route", () => {
    describe("GET /", () => {
      it("should return search form as HTML", async () => {
        const response = await request(app)
          .get("/search/kernels")
          .expect(200);

        expect(response.body).toEqual({
          template: "search_kernels"
        });
      });

      it("should return search form as JSON", async () => {
        const response = await request(app)
          .get("/search/kernels?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({});
      });
    });

    describe("GET /:signature", () => {
      it("should search for valid kernel signature and return HTML", async () => {
        const signature = "kernel123abc456def";
        const mockResults = [
          { 
            excess_sig: signature,
            fee: "1000",
            lock_height: "0"
          }
        ];
        mockClient.searchKernels.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/kernels/${signature}`)
          .expect(200);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [signature] 
        });
        expect(response.body).toEqual({
          template: "search_kernels",
          signature: signature,
          kernels: mockResults
        });
      });

      it("should search for valid kernel signature and return JSON", async () => {
        const signature = "kernel789xyz123abc";
        const mockResults = [
          { excess_sig: signature, fee: "2000" }
        ];
        mockClient.searchKernels.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/kernels/${signature}?json`)
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [signature] 
        });
        expect(response.body).toEqual({
          signature: signature,
          kernels: mockResults
        });
      });

      it("should handle 0x prefix in signature", async () => {
        const signature = "0xkernel123abc456def";
        const expectedSignature = "kernel123abc456def";
        const mockResults = [];
        mockClient.searchKernels.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/kernels/${signature}`)
          .expect(200);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [expectedSignature] 
        });
        expect(response.body.signature).toBe(expectedSignature);
      });

      it("should handle kernel not found", async () => {
        const signature = "nonexistentkernel";
        mockClient.searchKernels.mockResolvedValue([]);

        const response = await request(app)
          .get(`/search/kernels/${signature}`)
          .expect(200);

        expect(response.body).toEqual({
          template: "search_kernels",
          signature: signature,
          kernels: []
        });
      });

      it("should handle invalid hex signature", async () => {
        const invalidSignature = "notvalidsignature!@#";

        await request(app)
          .get(`/search/kernels/${invalidSignature}`)
          .expect(400);
      });

      it("should handle client errors", async () => {
        const signature = "kernel123abc456def";
        const mockError = new Error("Kernel search failed");
        mockClient.searchKernels.mockRejectedValue(mockError);

        await request(app)
          .get(`/search/kernels/${signature}`)
          .expect(500);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [signature] 
        });
      });
    });

    describe("query parameter variations", () => {
      it("should handle signature query parameter", async () => {
        const signature = "querykernel123456";
        const mockResults = [];
        mockClient.searchKernels.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/kernels?signature=${signature}`)
          .expect(200);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [signature] 
        });
      });

      it("should handle signatures query parameter (plural)", async () => {
        const signature = "pluralkernel789abc";
        const mockResults = [];
        mockClient.searchKernels.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/kernels?signatures=${signature}`)
          .expect(200);

        expect(mockClient.searchKernels).toHaveBeenCalledWith({ 
          signatures: [signature] 
        });
      });
    });
  });

  describe("search_outputs_by_payref route", () => {
    describe("GET /", () => {
      it("should return search form as HTML", async () => {
        const response = await request(app)
          .get("/search/outputs_by_payref")
          .expect(200);

        expect(response.body).toEqual({
          template: "search_outputs_by_payref"
        });
      });

      it("should return search form as JSON", async () => {
        const response = await request(app)
          .get("/search/outputs_by_payref?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({});
      });
    });

    describe("GET /:payment_reference", () => {
      it("should search for valid payment reference and return HTML", async () => {
        const paymentRef = "payref123abc456def";
        const mockResults = [
          { 
            payment_reference: paymentRef,
            commitment: "commitment123",
            features: { output_type: 0 }
          }
        ];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
        expect(response.body).toEqual({
          template: "search_outputs_by_payref",
          payment_reference: paymentRef,
          outputs: mockResults
        });
      });

      it("should search for valid payment reference and return JSON", async () => {
        const paymentRef = "payref789xyz123abc";
        const mockResults = [
          { payment_reference: paymentRef, commitment: "commit456" }
        ];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}?json`)
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
        expect(response.body).toEqual({
          payment_reference: paymentRef,
          outputs: mockResults
        });
      });

      it("should handle 0x prefix in payment reference", async () => {
        const paymentRef = "0xpayref123abc456def";
        const expectedPaymentRef = "payref123abc456def";
        const mockResults = [];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [expectedPaymentRef] 
        });
        expect(response.body.payment_reference).toBe(expectedPaymentRef);
      });

      it("should handle payment reference not found", async () => {
        const paymentRef = "nonexistentpayref";
        mockClient.searchPaymentReferences.mockResolvedValue([]);

        const response = await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}`)
          .expect(200);

        expect(response.body).toEqual({
          template: "search_outputs_by_payref",
          payment_reference: paymentRef,
          outputs: []
        });
      });

      it("should handle invalid hex payment reference", async () => {
        const invalidPaymentRef = "notvalidpayref!@#";

        await request(app)
          .get(`/search/outputs_by_payref/${invalidPaymentRef}`)
          .expect(400);
      });

      it("should handle client errors", async () => {
        const paymentRef = "payref123abc456def";
        const mockError = new Error("Payment reference search failed");
        mockClient.searchPaymentReferences.mockRejectedValue(mockError);

        await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}`)
          .expect(500);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
      });

      it("should handle case sensitivity correctly", async () => {
        const paymentRef = "PayRef123ABC456def";
        const expectedPaymentRef = "payref123abc456def";
        const mockResults = [];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref/${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [expectedPaymentRef] 
        });
        expect(response.body.payment_reference).toBe(expectedPaymentRef);
      });
    });

    describe("query parameter variations", () => {
      it("should handle payment_reference query parameter", async () => {
        const paymentRef = "querypayref123456";
        const mockResults = [];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref?payment_reference=${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
      });

      it("should handle payment_references query parameter (plural)", async () => {
        const paymentRef = "pluralpayref789abc";
        const mockResults = [];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref?payment_references=${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
      });

      it("should handle payref query parameter (short form)", async () => {
        const paymentRef = "shortpayref456def";
        const mockResults = [];
        mockClient.searchPaymentReferences.mockResolvedValue(mockResults);

        const response = await request(app)
          .get(`/search/outputs_by_payref?payref=${paymentRef}`)
          .expect(200);

        expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({ 
          payment_references: [paymentRef] 
        });
      });
    });
  });

  describe("hex validation edge cases", () => {
    it("should reject empty strings", async () => {
      await request(app)
        .get("/search/commitments/")
        .expect(404); // Express routes empty path as not found
    });

    it("should reject very short hex strings", async () => {
      await request(app)
        .get("/search/commitments/ab")
        .expect(400);
    });

    it("should accept long valid hex strings", async () => {
      const longHex = "a".repeat(128);
      mockClient.searchUtxos.mockResolvedValue([]);

      const response = await request(app)
        .get(`/search/commitments/${longHex}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
        commitments: [longHex] 
      });
    });

    it("should handle mixed case hex strings consistently", async () => {
      const mixedCase = "AbCdEf123456";
      const expectedLowerCase = "abcdef123456";
      mockClient.searchUtxos.mockResolvedValue([]);

      const response = await request(app)
        .get(`/search/commitments/${mixedCase}`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({ 
        commitments: [expectedLowerCase] 
      });
      expect(response.body.commitment).toBe(expectedLowerCase);
    });
  });
});
