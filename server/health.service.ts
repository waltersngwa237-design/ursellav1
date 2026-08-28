import { serverSupabase } from './business-tools.service.ts';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  checks: {
    application: boolean;
    database: {
      connected: boolean;
      latencyMs?: number;
      error?: string;
    };
    aiEngine: {
      model: string;
      isConfigured: boolean;
    };
    paymentGateway: {
      momoConfigured: boolean;
      stripeConfigured: boolean;
    };
  };
  system: {
    memoryUsageMB: number;
    nodeVersion: string;
  };
}

export class HealthService {
  private static startTime = Date.now();

  static async performHealthCheck(detailed: boolean = false): Promise<HealthCheckResult> {
    const dbStart = Date.now();
    let dbConnected = false;
    let dbError: string | undefined;

    try {
      const { error } = await serverSupabase.from('businesses').select('id', { count: 'exact', head: true });
      if (!error) {
        dbConnected = true;
      } else {
        dbError = error.message;
      }
    } catch (e: any) {
      dbError = e?.message || 'Database connection error';
    }

    const dbLatency = Date.now() - dbStart;
    const isGeminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_GEMINI_API_KEY')
    );

    const isHealthy = dbConnected;
    const status: HealthCheckResult['status'] = isHealthy ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        application: true,
        database: {
          connected: dbConnected,
          latencyMs: dbLatency,
          error: detailed ? dbError : undefined,
        },
        aiEngine: {
          model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
          isConfigured: isGeminiConfigured,
        },
        paymentGateway: {
          momoConfigured: Boolean(process.env.MOMO_API_KEY),
          stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        },
      },
      system: {
        memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        nodeVersion: process.version,
      },
    };
  }
}
