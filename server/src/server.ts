import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes/api';
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

// Attach API Routes
app.use('/api', createApiRouter(simulationService));

// Root info route
app.get('/', (_req, res) => {
  res.json({
    app: 'PatchPilot Backend API',
    status: 'ONLINE',
    description: 'AI-Powered Software Failure Detective & Cascading Impact Engine',
    documentation: '/api/health',
  });
});

// Start Server if invoked directly
let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[PatchPilot Backend] Service running on http://localhost:${PORT}`);
    console.log(`[PatchPilot Backend] Health probe available at http://localhost:${PORT}/api/health`);
  });
}

export { server, simulationService };
