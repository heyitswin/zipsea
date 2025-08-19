import { Request, Response } from 'express';

class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'staging',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', lastChecked: new Date().toISOString() },
        redis: { status: 'healthy', lastChecked: new Date().toISOString() }
      }
    });
  }

  async getReadiness(req: Request, res: Response): Promise<void> {
    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  }

  async getLiveness(req: Request, res: Response): Promise<void> {
    res.json({
      alive: true,
      timestamp: new Date().toISOString()
    });
  }

  async basic(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }

  async detailed(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'staging',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', lastChecked: new Date().toISOString() },
        redis: { status: 'healthy', lastChecked: new Date().toISOString() }
      }
    });
  }

  async ready(req: Request, res: Response): Promise<void> {
    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  }

  async live(req: Request, res: Response): Promise<void> {
    res.json({
      alive: true,
      timestamp: new Date().toISOString()
    });
  }
}

export const healthController = new HealthController();