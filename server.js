const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Use the newest Flash model available to new users. Older model IDs are kept
// as compatibility aliases so existing stored values continue to work.
const ALLOWED_MODELS = ['gemini-3.8-flash'];
const DEFAULT_MODEL = 'gemini-3.8-flash';
const LEGACY_MODEL_ALIASES = {
  'gemini-3.5-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash-lite': 'gemini-3.8-flash',
  'models/gemini-3.5-flash': 'gemini-3.8-flash',
  'models/gemini-2.5-flash': 'gemini-3.8-flash',
  'models/gemini-2.5-flash-lite': 'gemini-3.8-flash',
};

function normalizeModelName(modelName) {
  if (!modelName) return DEFAULT_MODEL;

  const rawModel = String(modelName).trim();
  const cleanedModel = rawModel.replace(/^models\//i, '');
  const alias = LEGACY_MODEL_ALIASES[rawModel] || LEGACY_MODEL_ALIASES[cleanedModel];

  if (alias) return alias;
  if (ALLOWED_MODELS.includes(cleanedModel)) return cleanedModel;
  return DEFAULT_MODEL;
}

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '{}');
}

function loadHistory() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '{}');
  } catch (error) {
    console.error('Failed to read history file:', error);
    return {};
  }
}

function saveHistoryFile(data) {
  ensureStorage();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const requestedModel = req.body.model;
  const model = normalizeModelName(requestedModel);

  if (!userMessage) {
    return res.status(400).json({ error: 'Missing message' });
  }

  if (!API_KEY) {
    console.error('API_KEY environment variable is not configured');
    return res.status(500).json({ error: 'Server API key is not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'API request failed' });
    }

    const text = data.candidates?.map((candidate) => candidate.content?.parts?.map((part) => part.text).join('') || '').join('') || 'Sorry, I could not get a response';
    res.json({ text, model });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Persistent chat history (stored in data/history.json on this machine) ---

app.get('/api/history', (req, res) => {
  const history = loadHistory();
  res.json(Object.values(history));
});

app.post('/api/history', (req, res) => {
  const { id, title, messages, timestamp } = req.body;
  if (!id || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing id or messages' });
  }
  const history = loadHistory();
  history[id] = {
    id,
    title: title || 'New Chat',
    messages,
    timestamp: timestamp || new Date().toISOString(),
  };
  saveHistoryFile(history);
  res.json({ ok: true });
});

app.delete('/api/history/:id', (req, res) => {
  const history = loadHistory();
  delete history[req.params.id];
  saveHistoryFile(history);
  res.json({ ok: true });
});

app.delete('/api/history', (req, res) => {
  saveHistoryFile({});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  ensureStorage();
  console.log(`Server running on http://localhost:${PORT}`);
});
