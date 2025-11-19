// Vercel serverless function wrapper for Express app
import app from '../server/src/index.js';

// Vercel serverless function handler
// This wraps the Express app to work with Vercel's serverless functions
export default async (req: any, res: any) => {
  // Set VERCEL environment variable so server doesn't start listening
  process.env.VERCEL = '1';
  
  // Handle the request with Express app
  return app(req, res);
};

