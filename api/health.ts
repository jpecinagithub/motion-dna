/**
 * Minimal serverless health/version endpoint.
 * The app itself is fully client-side; this exists for deployment checks.
 */
export default function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    app: 'MOTION//DNA',
    version: '0.1.0',
    time: new Date().toISOString(),
  });
}
