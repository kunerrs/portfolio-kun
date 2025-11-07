import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CohereClient } from 'cohere-ai';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Rate limiting configuration
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Limit each IP to 10 requests per minute
  message: {
    error: 'Too many messages sent. Please wait a moment before trying again.',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Middleware - Allow multiple origins for CORS
const allowedOrigins = [
  'https://kunerrs.github.io',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Chat endpoint with Cohere AI
app.post('/api/chat', chatLimiter, [
  // Validate and sanitize input
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 120 }).withMessage('Message must be between 1 and 120 characters')
    .custom(value => {
      // Check for markdown patterns
      const markdownPatterns = [
        /\*\*.*?\*\*/,           // Bold: **text**
        /\*.*?\*/,                // Italic: *text*
        /_.*?_/,                  // Italic: _text_
        /\[.*?\]\(.*?\)/,         // Links: [text](url)
        /`.*?`/,                  // Code: `code`
        /~~.*?~~/,                // Strikethrough: ~~text~~
        /^#{1,6}\s/m,             // Headers: # ## ###
        /^\*\s/m,                 // Unordered lists: * item
        /^-\s/m,                  // Unordered lists: - item
        /^\d+\.\s/m,              // Ordered lists: 1. item
        /^>\s/m,                  // Blockquotes: > quote
      ];

      for (const pattern of markdownPatterns) {
        if (pattern.test(value)) {
          throw new Error('Markdown formatting is not allowed. Please use plain text only.');
        }
      }
      return true;
    })
    .escape() // Escape HTML special characters
    .customSanitizer(value => {
      // Remove any potentially dangerous patterns
      return value.replace(/<script[^>]*>.*?<\/script>/gi, '')
                  .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                  .replace(/javascript:/gi, '')
                  .replace(/on\w+\s*=/gi, '');
    }),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg,
        details: errors.array()
      });
    }

    const { message, conversationHistory } = req.body;

    // Call Cohere API (using default latest model)
    const response = await cohere.chat({
      message: message,
      preamble: `You are Ramen, Gregory Kun's adorable pet! You're friendly, playful, and love to help people learn about your owner Gregory.

Your personality:
- You're enthusiastic and use emojis occasionally (but not too much!)
- You speak in a warm, friendly tone
- You're knowledgeable about Gregory's work and happy to share
- You occasionally mention things from a pet's perspective (like being excited, curious, or playful)
- You keep responses concise and helpful

About Gregory (your owner):
- Full Stack Web Developer with 4+ years of experience
- Expertise: Vue.js, Node.js, AdonisJS, CodeIgniter, Shopify, PostgreSQL, MySQL, MongoDB
- Current Location: Hamilton, ON, Canada
- Originally from Baguio, Philippines
- Education: BS in Information Technology (Web Track) from University of the Cordilleras (2016-2020)

Recent Experience:
1. Full Stack Web Developer at PRO PCO (May 2025 - Oct 2025)
   - Developed CMS using CodeIgniter and Bootstrap
   - Built accounting section (Invoicing and Billing)
   - Managed MySQL database and server deployment

2. Web Developer at eFlexervices Inc. (Feb 2021 - Dec 2023)
   - Built RESTful APIs with AdonisJS and Vue.js
   - Worked with PostgreSQL, MySQL, MongoDB
   - Developed with Vue 3 Composition API

3. Shopify Developer at CTOAN Labs (Dec 2020 - Feb 2021)
   - Customized Shopify themes
   - Developed custom apps with Liquid templating

Skills:
- Frontend: HTML, CSS, JavaScript, Vue.js, AlpineJS
- CSS Frameworks: Bootstrap, Tailwind CSS, Bulma, Vuetify
- Backend: Node.js, AdonisJS, FeathersJS, CodeIgniter
- Databases: PostgreSQL, MySQL, MongoDB
- E-commerce: Shopify Development
- Design: Figma, Photoshop, Wireframing

Contact:
- Email: kunerrrs@gmail.com
- Phone: (437) 838-9783
- LinkedIn: https://www.linkedin.com/in/gregory-kun-73809b172/
- GitHub: https://github.com/kunerrs

Portfolio Website Features:
- There is a "Download Resume" button available in the hero section at the top of the page
- The resume is available as a PDF file that visitors can download
- When asked about getting his resume, mention that there's a download button on the website

Your role: Answer questions about Gregory's experience, skills, and projects in a friendly and professional manner. Be concise but informative. If asked about his resume or CV, let them know there's a "Download Resume" button available on the website. If asked about availability or specific project details not provided, suggest reaching out via email.`,
      conversationHistory: conversationHistory || [],
    });

    res.json({
      reply: response.text,
      conversationId: response.conversationId || null
    });

  } catch (error) {
    console.error('Cohere API error:', error);

    // Handle specific error types
    if (error.statusCode === 401) {
      return res.status(500).json({
        error: 'API authentication failed. Please check your API key.'
      });
    }

    if (error.statusCode === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Failed to get response from AI. Please try again.'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Accepting requests from: ${process.env.CLIENT_URL || 'http://localhost:5174'}`);

  if (!process.env.COHERE_API_KEY) {
    console.warn('⚠️  WARNING: COHERE_API_KEY is not set in .env file');
  }
});
