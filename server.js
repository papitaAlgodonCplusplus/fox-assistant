const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: 'uploads/' });

// Initialize OpenAI client for DeepInfra/Kokoro TTS
const ttsClient = new OpenAI({
    baseURL: "https://api.deepinfra.com/v1/openai",
    apiKey: process.env.DEEPINFRA_API_KEY,
});

// Transcribe using Whisper (unchanged)
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const filePath = req.file.path;
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('model', 'whisper-1');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        fs.unlinkSync(filePath);
        res.json({ text: response.data.text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Middleware
app.use(express.json());

// Configuration - IMPORTANT: Set this in your environment variables
const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY || 'your-deepinfra-api-key';
if (DEEPINFRA_API_KEY === 'your-deepinfra-api-key') {
    console.error('❌ Please set your DEEPINFRA_API_KEY environment variable');
    process.exit(1);
}

const DEEPINFRA_API_URL = 'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M';

// Speak using Kokoro TTS via DeepInfra HTTP API
app.post('/speak', async (req, res) => {
    const { 
        text, 
        output_format = 'mp3', 
        preset_voice = ['af_bella'], 
        speed = 1.0,
        stream = true,
        return_timestamps = false
    } = req.body;

    console.log('🔊 Received text for Kokoro TTS:', text);

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        const response = await axios.post(DEEPINFRA_API_URL, {
            text,
            output_format,
            preset_voice,
            speed,
            stream,
            return_timestamps
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPINFRA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': stream ? 'application/x-ndjson' : 'application/json'
            },
            responseType: stream ? 'stream' : 'json'
        });

        if (stream) {
            // Handle streaming response
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', 'inline; filename=tts_output.mp3');
            
            response.data.pipe(res);
            
            response.data.on('error', (error) => {
                console.error('❌ Audio streaming error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Audio streaming failed' });
                }
            });
        } else {
            // Handle non-streaming response
            const audioData = response.data.audio;
            if (!audioData) {
                throw new Error('No audio data received from DeepInfra API');
            }

            // Convert base64 audio to buffer if needed
            const audioBuffer = Buffer.from(audioData, 'base64');
            
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', 'inline; filename=tts_output.mp3');
            res.send(audioBuffer);
        }

    } catch (err) {
        console.error('❌ Kokoro TTS Error:', err.message);
        
        // Handle the error response without causing circular JSON issues
        const errorResponse = {
            error: err.message,
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data
        };
        
        res.status(err.response?.status || 500).json(errorResponse);
    }
});

app.listen(PORT, () => {
    console.log(`🔊 Server is running on http://localhost:${PORT}`);
});