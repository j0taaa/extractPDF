const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const ollama = require('ollama');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ENV = process.env.ENVIRONMENT || 'local';

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

async function pdfToImages(pdfPath, outputDir) {
  console.log('Converting PDF to images:', pdfPath);
  await fs.mkdir(outputDir, { recursive: true });
  const { Poppler } = require('pdf-poppler');
  const poppler = new Poppler();
  const opts = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: 'page',
  };
  await poppler.convert(pdfPath, opts);
  const files = await fs.readdir(outputDir);
  const images = files.filter(f => f.endsWith('.png')).sort((a, b) => a.localeCompare(b)).map(f => path.join(outputDir, f));
  console.log('Generated images:', images);
  return images;
}

function getNested(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && current[key] !== undefined && current[key] !== null) {
      current = current[key];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
}

async function analyzeImage(imagePath, page, userPrompt) {
  console.log(`Analyzing page ${page}:`, imagePath);
  const imageBase64 = await fs.readFile(imagePath, { encoding: 'base64' });
  const prompt = `${userPrompt}\nReturn a JSON object of any data you find on the page. Include the page number.`;

  if (ENV === 'openrouter') {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'mistral-tiny',
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [{
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64
            }]
          }
        ]
      })
    });
    const data = await response.json();
    const content = getNested(data, ['choices', 0, 'message', 'content']);
    console.log(`OpenRouter response for page ${page}:`, content);
    return content;
  } else {
    const result = await ollama.chat({
      model: 'gemma3n:4b',
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [imageBase64]
        }
      ]
    });
    const content = getNested(result, ['message', 'content']);
    console.log(`Ollama response for page ${page}:`, content);
    return content;
  }
}

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    console.log('Upload received:', req.file && req.file.originalname);
    if (!req.file) {
      console.log('No file provided');
      return res.status(400).json({ error: 'No PDF uploaded' });
    }
    const userPrompt = req.body.prompt || 'Extract all information.';
    const pdfPath = req.file.path;
    const outputDir = path.join('temp', path.parse(pdfPath).name);
    const pages = await pdfToImages(pdfPath, outputDir);
    console.log('Total pages to analyze:', pages.length);

    const results = [];
    for (let i = 0; i < pages.length; i++) {
      const content = await analyzeImage(pages[i], i + 1, userPrompt);
      let json;
      try { json = JSON.parse(content); } catch (e) { json = { page: i + 1, raw: content }; }
      results.push(json);
    }

    console.log('Analysis complete');
    res.json({ results });
    await fs.rm(pdfPath);
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
