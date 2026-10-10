import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import { createSessionMiddleware } from './middleware/session.js';
import { helmetMiddleware, globalRateLimiter, sanitizeHeaders, suspiciousRequestLogger } from './middleware/security.js';
import { csrfProtection, csrfTokenProvider } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sanitizeInput } from './middleware/validation.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the Express application
const createApp = () => {
  const app = express();

  // Trust proxy (for X-Forwarded-* headers)
  app.set('trust proxy', 1);

  // Security middlewares
  app.use(helmetMiddleware);
  app.use(sanitizeHeaders);
  app.use(suspiciousRequestLogger);

  // CORS — permissive in dev only, restricted in production via CORS_ORIGIN env var
  app.use(cors({
    origin: config.isDev ? true : process.env.CORS_ORIGIN?.split(',') || false, // lgtm[js/cors-misconfiguration]
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Workspace-ID'],
    exposedHeaders: ['X-CSRF-Token'],
  }));

  // Global rate limiting
  app.use('/api', globalRateLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Input sanitization
  app.use(sanitizeInput);

  // Sessions
  app.use(createSessionMiddleware());

  // CSRF
  app.use(csrfTokenProvider);
  app.use('/api', csrfProtection);

  // API routes
  app.use('/api/v1', apiRoutes);

  // Serve uploaded files (payee images) from the persisted uploads volume.
  // Registered for all environments so images resolve in production too.
  app.use('/uploads', express.static(config.paths.uploads));

  // Serve frontend in production
  const clientPath = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  } else if (config.isDev) {
    // Development home page
    app.get('/', (req, res) => {
      res.json({
        name: 'BudgetOS API',
        version: '1.0.0',
        status: 'running',
        documentation: '/api/v1/health',
        environment: config.env,
      });
    });
  }

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
