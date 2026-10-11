import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createApiRouter } from './routes/api';
import { createReposRouter } from './routes/repos';
import { SimulationService } from './services/simulation-service';

export const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Simulation State Service Instance
const simulationService = new SimulationService();

// Attach API Routes under /api
app.use('/api', createApiRouter(simulationService));
app.use('/api/repos', createReposRouter());

// Production Single-Service Serving:
// If client/dist exists, serve the built Vite SPA directly from Express
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'client/dist');
const resolvedDist = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altClientDistPath)
  ? altClientDistPath
  : null;

if (resolvedDist) {
  app.use(express.static(resolvedDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(resolvedDist, 'index.html'));
  });
} else {
  // Fallback root route if client is not built yet
  app.get('/', (_req, res) => {
    res.json({
      app: 'PatchPilot Backend API',
      status: 'ONLINE',
      description: 'AI-Powered Software Failure Detective & Cascading Impact Engine',
      documentation: '/api/health',
      frontendNote: 'To serve the frontend through Express as ONE unified service, run: npm run build',
    });
  });
}

// Start Server if invoked directly
let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[PatchPilot Server] Service running on http://localhost:${PORT}`);
    console.log(`[PatchPilot Server] API Health probe: http://localhost:${PORT}/api/health`);
    if (resolvedDist) {
      console.log(`[PatchPilot Server] Serving unified frontend SPA from ${resolvedDist}`);
    }
  });
}

export { server, simulationService };
