/**
 * ProSalonPOS — Global Error Handler
 * Catches all unhandled errors and returns a clean JSON response.
 * In Phase 3, this will also log to Sentry.
 */
export default function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  var status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
}
