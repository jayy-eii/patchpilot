import { Router, Request, Response } from 'express';
import { SimulationService } from '../services/simulation-service';
import { TestRunnerService } from '../services/test-runner-service';
import { TopologyValidator } from '../engine/topology-validator';

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

  // Import custom architecture topology JSON
  router.post('/topology/import', (req: Request, res: Response) => {
    const validation = TopologyValidator.validate(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Architecture validation failed.',
        errors: validation.errors,
      });
    }

    const result = simulationService.importTopology(
      validation.sanitizedServices!,
      validation.sanitizedDependencies!
    );

    res.json({
      success: true,
      data: result,
    });
  });

  // Restore baseline e-commerce sample architecture
  router.post('/topology/restore-sample', (_req: Request, res: Response) => {
    const result = simulationService.restoreSampleTopology();
    res.json({
      success: true,
      data: result,
    });
  });

  // Export current architecture topology as JSON
  router.get('/topology/export', (_req: Request, res: Response) => {
    const result = simulationService.exportTopology();
    res.json({
      success: true,
      data: result,
    });
  });

  // Blast-radius ranking and Single Point of Failure (SPOF) detector
  router.get('/analysis/spof-ranking', (_req: Request, res: Response) => {
    const ranking = simulationService.getBlastRadiusRanking();
    res.json({
      success: true,
      data: ranking,
      total: ranking.length,
    });
  });

  // Longest dependency chain and circular dependencies analysis
  router.get('/analysis/dependency-chains', (_req: Request, res: Response) => {
    const analysis = simulationService.getDependencyChainAnalysis();
    res.json({
      success: true,
      data: analysis,
    });
  });

  // Trigger single failure simulation
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

  // Trigger multi-failure simulation (2+ concurrent failures)
  router.post('/simulations/multi', (req: Request, res: Response) => {
    try {
      const { serviceIds } = req.body;
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Validation Error: 'serviceIds' must be a non-empty array of service IDs.",
        });
      }

      const result = simulationService.runMultiSimulation(serviceIds);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message || 'Multi-failure simulation failed.',
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

  // Get test suite results (cached or live)
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
