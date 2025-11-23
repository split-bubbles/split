import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import dotenv from 'dotenv';
import { initializeApplication } from './startup';

// Import routes
import accountRoutes from './routes/accountRoutes';
import serviceRoutes from './routes/serviceRoutes';
import receiptRoutes from './routes/receiptRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 4000;

// Apply basic middleware
app.use(cors());
// Configure JSON body parser with higher limit to allow base64 images
const BODY_LIMIT = process.env.BODY_LIMIT || '25mb';
app.use(express.json({ limit: BODY_LIMIT }));

// API documentation route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: '0G Compute Network API Documentation',
}));

// API routes
const apiPrefix = '/api';

// Register routes
// app.use(`${apiPrefix}/account`, accountRoutes);
// app.use(`${apiPrefix}/services`, serviceRoutes);
app.use(`${apiPrefix}/reciepts`, receiptRoutes);

// Root route with basic info
app.get('/', (req, res) => {
  res.json({
    name: '0G Compute Network API',
    version: '1.0.0',
    documentation: '/docs',
    endpoints: {
      // account: `${apiPrefix}/account`,
      // services: `${apiPrefix}/services`,
      reciepts: `${apiPrefix}/reciepts`
    }
  });
});

// Simple error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle malformed JSON bodies from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload',
      message: err.message
    });
  }

  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: err.message
  });
});

// Initialize application and start server
const startServer = async () => {
  try {
    // Run initialization tasks
   // await initializeApplication();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`
  🚀 0G Compute Network API Server running on http://localhost:${PORT}
  📚 API Documentation: http://localhost:${PORT}/docs
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app; 