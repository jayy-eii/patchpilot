import { Router, Request, Response } from 'express';
import { SimulationService } from '../services/simulation-service';
import { TestRunnerService } from '../services/test-runner-service';

export const createApiRouter = (simulationService: SimulationService): Router => {
  const router = Router();

  // Health check endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'PatchPilot API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Get current services topology
  router.get('/services', (_req: Request, res: Response) => {
    const services = simulationService.getServices();
    res.json({
      success: true,
      data: services,
      total: services.length,
    });
  });

  // Get current dependency edges
  router.get('/dependencies', (_req: Request, res: Response) => {
    const dependencies = simulationService.getDependencies();
    res.json({
      success: true,
      data: dependencies,
      total: dependencies.length,
    });
  });

  // Trigger failure simulation
  router.post('/simulations', (req: Request, res: Response) => {
    try {
      const { serviceId } = req.body;
      if (!serviceId || typeof serviceId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: serviceId is required and must be a string.',
        });
      }

      const result = simulationService.runSimulation(serviceId.trim());
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message || 'Simulation execution failed.',
      });
    }
  });

  // Reset simulation back to baseline healthy state
  router.post('/simulations/reset', (_req: Request, res: Response) => {
    const result = simulationService.resetSimulation();
    res.json({
      success: true,
      data: result,
    });
  });

  // Get incident reports history
  router.get('/incidents', (_req: Request, res: Response) => {
    const incidents = simulationService.getIncidents();
    res.json({
      success: true,
      data: incidents,
      total: incidents.length,
    });
  });

  // Get repair recommendations for a specific service
  router.get('/recommendations/:serviceId', (req: Request, res: Response) => {
    try {
      const { serviceId } = req.params;
      const recommendations = simulationService.getRecommendations(serviceId);
      res.json({
        success: true,
        serviceId,
        data: recommendations,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get demo scenarios
  router.get('/scenarios', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: simulationService.getScenarios(),
    });
  });

  // Apply a demo scenario
  router.post('/scenarios/:scenarioId/apply', (req: Request, res: Response) => {
    try {
      const { scenarioId } = req.params;
      const result = simulationService.applyScenario(scenarioId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get test suite results (cached or last verified)
  router.get('/tests', (_req: Request, res: Response) => {
    const results = TestRunnerService.getLastVerifiedResult();
    res.json({
      success: true,
      data: results,
    });
  });

  // Execute live Vitest test run
  router.post('/tests/run', async (_req: Request, res: Response) => {
    try {
      const results = await TestRunnerService.executeVitestSuite();
      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute test runner.',
      });
    }
  });

  return router;
};
