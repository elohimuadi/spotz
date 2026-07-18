import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { PipelineError, searchPlaces } from './searchPipeline.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/search', async (req, res) => {
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
