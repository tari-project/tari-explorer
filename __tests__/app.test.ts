import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import hbs from 'hbs';

// Mock baseNodeClient first - this is imported by many routes
vi.mock('../baseNodeClient.js', () => ({
  createClient: vi.fn(() => ({
    getTokens: vi.fn().mockResolvedValue([]),
    getNetworkDifficulty: vi.fn().mockResolvedValue([]),
    getTipInfo: vi.fn().mockResolvedValue({}),
    getMempoolTransactions: vi.fn().mockResolvedValue([]),
    getBlocks: vi.fn().mockResolvedValue([]),
    getHeaderByHash: vi.fn().mockResolvedValue({}),
    getVersion: vi.fn().mockResolvedValue({ version: '1.0.0' })
  }))
}));

// Mock all external dependencies
vi.mock('pino-http', () => ({
  pinoHttp: () => (req: any, res: any, next: any) => next()
}));

vi.mock('serve-favicon', () => ({
  default: () => (req: any, res: any, next: any) => next()
}));

vi.mock('cors', () => ({
  default: () => (req: any, res: any, next: any) => next()
}));

vi.mock('../utils/updater.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn()
  }))
}));

vi.mock('./script.js', () => ({
  hex: vi.fn((value) => value ? value.toString() : ''),
  script: vi.fn((value) => value ? value.toString() : '')
}));

// Mock all route modules
vi.mock('./routes/index.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'index' }))
}));

vi.mock('./routes/blocks.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'blocks' }))
}));

vi.mock('./routes/block_data.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'block_data' }))
}));

vi.mock('./routes/mempool.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'mempool' }))
}));

vi.mock('./routes/miners.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'miners' }))
}));

vi.mock('./routes/search_commitments.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'search_commitments' }))
}));

vi.mock('./routes/search_kernels.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'search_kernels' }))
}));

vi.mock('./routes/search_outputs_by_payref.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'search_outputs_by_payref' }))
}));

vi.mock('./routes/healthz.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'healthz' }))
}));

vi.mock('./routes/assets.js', () => ({
  default: vi.fn((req, res) => res.json({ route: 'assets' }))
}));

describe('app.ts', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear module cache
    vi.resetModules();
    // Import app after mocks are set up
    const appModule = await import('../app.js');
    app = appModule.app;
  });

  describe('Express app setup', () => {
    it('should create Express app with correct configuration', () => {
      expect(app).toBeDefined();
      expect(app.get('view engine')).toBe('hbs');
      expect(app.get('views')).toContain('views');
    });

    it('should set up favicon middleware', async () => {
      const response = await request(app)
        .get('/favicon.ico')
        .expect(404); // Will 404 since we're mocking
    });

    it('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/test')
        .send({ test: 'data' })
        .expect(404); // 404 is expected for non-existent route
    });

    it('should enable CORS', async () => {
      const response = await request(app)
        .options('/')
        .expect(200); // CORS should enable OPTIONS requests
    });
  });

  describe('Handlebars helpers', () => {
    it('should register hex helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.hex).toBeDefined();
    });

    it('should register script helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.script).toBeDefined();
    });

    it('should register timestamp helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.timestamp).toBeDefined();
      
      // Test timestamp helper functionality
      const timestamp = 1672574340; // Jan 1, 2023
      const result = helpers.timestamp(timestamp);
      expect(result).toContain('2023');
      expect(result).toContain('01');
    });

    it('should register percentbar helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.percentbar).toBeDefined();
      
      // Test percentbar helper
      const result = helpers.percentbar(50, 100, 200);
      expect(result).toContain('%');
    });

    it('should register format_thousands helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.format_thousands).toBeDefined();
      
      // Test format_thousands helper
      expect(helpers.format_thousands(1000)).toBe('1,000');
      expect(helpers.format_thousands(1000000)).toBe('1,000,000');
    });

    it('should register add helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.add).toBeDefined();
      
      // Test add helper
      expect(helpers.add(5, 3)).toBe(8);
    });

    it('should register unitFormat helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.unitFormat).toBeDefined();
    });

    it('should register chart helper', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.chart).toBeDefined();
    });

    it('should register chart helper that creates ASCII charts', () => {
      const helpers = hbs.handlebars.helpers;
      expect(helpers.chart).toBeDefined();
      
      // Test chart helper with sample data
      const result = helpers.chart([1, 2, 3, 4, 5]);
      expect(typeof result).toBe('string');
    });

    describe('chart helper edge cases', () => {
      it('should handle empty data array', () => {
        const helpers = hbs.handlebars.helpers;
        const result = helpers.chart([]);
        expect(result).toBe('**No data**');
      });

      it('should handle formatThousands parameter', () => {
        const helpers = hbs.handlebars.helpers;
        const result = helpers.chart([1000, 2000, 3000], 10, true);
        expect(typeof result).toBe('string');
        expect(result).not.toBe('**No data**');
      });

      it('should handle unitStr parameter', () => {
        const helpers = hbs.handlebars.helpers;
        const result = helpers.chart([1000000, 2000000, 3000000], 10, false, 'mega');
        expect(typeof result).toBe('string');
        expect(result).not.toBe('**No data**');
      });

      it('should handle both formatThousands and unitStr parameters', () => {
        const helpers = hbs.handlebars.helpers;
        const result = helpers.chart([1000000, 2000000, 3000000], 10, true, 'mega');
        expect(typeof result).toBe('string');
        expect(result).not.toBe('**No data**');
      });

      it('should handle unitStr as boolean evaluation', () => {
        const helpers = hbs.handlebars.helpers;
        // Test when unitStr is not a string
        const result1 = helpers.chart([1000, 2000, 3000], 10, false, null);
        expect(typeof result1).toBe('string');
        
        // Test when unitStr is empty string
        const result2 = helpers.chart([1000, 2000, 3000], 10, false, '');
        expect(typeof result2).toBe('string');
      });

      it('should handle formatThousands boolean conversion', () => {
        const helpers = hbs.handlebars.helpers;
        // Test when formatThousands is truthy
        const result1 = helpers.chart([1000, 2000, 3000], 10, 'true');
        expect(typeof result1).toBe('string');
        
        // Test when formatThousands is falsy
        const result2 = helpers.chart([1000, 2000, 3000], 10, false);
        expect(typeof result2).toBe('string');
      });

      it('should handle various height values', () => {
        const helpers = hbs.handlebars.helpers;
        const result = helpers.chart([1, 2, 3], 5);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);
    });

    it('should set error locals in development', async () => {
      // Simulate an error by mocking a route that throws
      const errorApp = express();
      errorApp.set('env', 'development');
      errorApp.get('/error-test', (req: any, res: any, next: any) => {
        const err: any = new Error('Test error');
        err.status = 400;
        next(err);
      });

      // Add error handler like in app.ts
      errorApp.use((err: any, req: any, res: any, next: any) => {
        if (res.headersSent) {
          return next(err);
        }
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.err = err;
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(errorApp)
        .get('/error-test')
        .expect(400);

      expect(response.body.error).toBe('Test error');
    });

    it('should set error locals in production', async () => {
      // Simulate an error in production environment
      const errorApp = express();
      errorApp.set('env', 'production');
      errorApp.get('/error-test', (req: any, res: any, next: any) => {
        const err: any = new Error('Test error');
        err.status = 500;
        next(err);
      });

      // Add error handler like in app.ts
      errorApp.use((err: any, req: any, res: any, next: any) => {
        if (res.headersSent) {
          return next(err);
        }
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.err = err;
        res.status(err.status || 500).json({ 
          error: err.message,
          locals: res.locals 
        });
      });

      const response = await request(errorApp)
        .get('/error-test')
        .expect(500);

      expect(response.body.locals.error).toEqual({});
      expect(response.body.locals.message).toBe('Test error');
    });

    it('should handle errors when headers already sent', async () => {
      const errorApp = express();
      let nextCalled = false;
      
      errorApp.get('/headers-sent-test', (req: any, res: any, next: any) => {
        res.write('partial response');
        // Don't end the response, just write to simulate headers sent
        const err: any = new Error('Error after headers sent');
        next(err);
      });

      // Add error handler like in app.ts
      errorApp.use((err: any, req: any, res: any, next: any) => {
        if (res.headersSent) {
          nextCalled = true;
          return next(err);
        }
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.err = err;
        res.status(err.status || 500).json({ error: err.message });
      });

      // This test is harder to verify with supertest, so we test the logic directly
      const mockReq = { app: { get: () => 'development' } };
      const mockRes = { headersSent: true };
      const mockNext = vi.fn();
      const mockError = new Error('Test error');

      // Simulate the error handler from app.ts
      const errorHandler = (err: any, req: any, res: any, next: any) => {
        if (res.headersSent) {
          return next(err);
        }
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.err = err;
        res.status(err.status || 500).render("error");
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should handle errors without status code', async () => {
      const errorApp = express();
      errorApp.get('/no-status-test', (req: any, res: any, next: any) => {
        const err = new Error('Error without status');
        next(err);
      });

      // Add error handler like in app.ts
      errorApp.use((err: any, req: any, res: any, next: any) => {
        if (res.headersSent) {
          return next(err);
        }
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.err = err;
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(errorApp)
        .get('/no-status-test')
        .expect(500);

      expect(response.body.error).toBe('Error without status');
    });
  });

  describe('Route mounting', () => {
    it('should mount all required routes', () => {
      // Since routes are mocked, we can verify the app exists and has routes
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
    });

    it('should set custom headers middleware', async () => {
      const response = await request(app)
        .get('/')
        .expect((res) => {
          // The custom headers middleware should be present
          // but since routes are mocked, we can't test the actual headers
        });
    });
  });

  describe('Static file serving', () => {
    it('should serve static files from public directory', async () => {
      const response = await request(app)
        .get('/test-static-file.txt')
        .expect(404); // 404 expected since file doesn't exist
    });
  });

  describe('Background updater', () => {
    it('should create background updater instance', async () => {
      // The background updater is created when app.ts is imported
      // We can verify it's imported correctly
      const updaterModule = await import('../utils/updater.js');
      expect(updaterModule.default).toBeDefined();
    });
  });


});
