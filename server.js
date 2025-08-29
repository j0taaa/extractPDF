const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const ollama = require('ollama');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ENV = process.env.ENVIRONMENT || 'local';

app.use(express.static(path.join(__dirname, 'public')));

async function pdfToImages(pdfPath, outputDir) {
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
  return files.filter(f => f.endsWith('.png')).sort((a, b) => a.localeCompare(b)).map(f => path.join(outputDir, f));
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
    return getNested(data, ['choices', 0, 'message', 'content']);
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
    return getNested(result, ['message', 'content']);
  }
}

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const userPrompt = req.body.prompt || 'Extract all information.';
    const pdfPath = req.file.path;
    const outputDir = path.join('temp', path.parse(pdfPath).name);
    const pages = await pdfToImages(pdfPath, outputDir);

    const results = [];
    for (let i = 0; i < pages.length; i++) {
      const content = await analyzeImage(pages[i], i + 1, userPrompt);
      let json;
      try { json = JSON.parse(content); } catch (e) { json = { page: i + 1, raw: content }; }
      results.push(json);
    }

    res.json({ results });
    await fs.rm(pdfPath);
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
