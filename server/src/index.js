import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { PipelineError, previewLocation, searchPlaces } from './searchPipeline.js';

const app = express();
const port = process.env.PORT || 3001;
const developmentOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins.length > 0
  ? configuredOrigins
  : process.env.NODE_ENV === 'production'
    ? []
    : developmentOrigins;
const budgetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many searches from this connection. Please wait 15 minutes and try again.',
  },
});

app.use(cors({
  // Production must explicitly set CORS_ORIGIN to the deployed client origin.
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Returning false omits CORS headers without turning a blocked browser
    // preflight into an application-level 500 response.
    return callback(null, false);
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

app.post('/api/location-preview', budgetRequestLimiter, async (req, res) => {
  const { destination } = req.body;

  if (typeof destination !== 'string') {
    return res.status(400).json({ error: 'Destination must be text.' });
  }

  try {
    const location = await previewLocation(destination);
    return res.json({ location });
  } catch (error) {
    console.error('[location-preview error]', error.cause || error);
    const status = error instanceof PipelineError && error.step === 'configuration' ? 500 : 502;
    return res.status(status).json({ error: 'Could not preview this destination.' });
  }
});

app.post('/api/search', budgetRequestLimiter, async (req, res) => {
  const { destination, category } = req.body;

  if (typeof destination !== 'string' || !destination.trim()) {
    return res.status(400).json({ error: 'Destination is required.' });
  }

  if (destination.length > 200 || (category && (typeof category !== 'string' || category.length > 100))) {
    return res.status(400).json({ error: 'Search input is too long.' });
  }

  try {
    const places = await searchPlaces({
      destination: destination.trim(),
      category: typeof category === 'string' ? category.trim() : '',
    });

    return res.json(places);
  } catch (error) {
    console.error(`[${error.step || 'pipeline'} error]`, error.cause || error);

    if (error instanceof PipelineError) {
      const status = error.step === 'configuration' ? 500 : 502;
      return res.status(status).json({ error: error.message, step: error.step });
    }

    return res.status(500).json({ error: 'Unexpected search pipeline error.' });
  }
});

app.listen(port, () => {
  console.log(`Spotz API listening on http://localhost:${port}`);
});
