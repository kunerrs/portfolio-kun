# Portfolio Backend Server

Backend API server for the portfolio website with Cohere AI integration.

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your Cohere API key:

```env
COHERE_API_KEY=your_actual_cohere_api_key_here
PORT=3000
CLIENT_URL=http://localhost:5174
```

### 3. Get Cohere API Key

1. Go to https://cohere.com/
2. Sign up for a free account
3. Navigate to https://dashboard.cohere.com/api-keys
4. Create a new API key
5. Copy it to your `.env` file

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### Chat with AI

```
POST /api/chat
```

Request Body:
```json
{
  "message": "Tell me about Gregory's experience with Vue.js",
  "conversationHistory": []  // Optional
}
```

Response:
```json
{
  "reply": "Gregory has extensive experience with Vue.js...",
  "conversationId": "conv_123"
}
```

## Testing the API

You can test the API using curl:

```bash
# Health check
curl http://localhost:3000/health

# Chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What technologies does Gregory know?"}'
```

## Connecting to Frontend

The frontend (client) should make requests to:
- Local Development: `http://localhost:3000/api/chat`
- Production: Update to your deployed backend URL

Update `client/js/alpine-data.js` to use the backend:

```javascript
async sendMessage() {
    if (this.chatInput.trim() === '') return;

    this.chatMessages.push({
        text: this.chatInput,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    const userMessage = this.chatInput;
    this.chatInput = '';
    this.isTyping = true;

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage }),
        });

        const data = await response.json();

        this.isTyping = false;
        this.chatMessages.push({
            text: data.reply,
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    } catch (error) {
        this.isTyping = false;
        this.chatMessages.push({
            text: 'Sorry, I\'m having trouble connecting. Please try again later.',
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }

    setTimeout(() => {
        document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
    }, 100);
}
```

## Deployment

### Option 1: Railway

1. Push code to GitHub
2. Go to https://railway.app/
3. Create new project from GitHub repo
4. Add environment variables
5. Deploy

### Option 2: Render

1. Push code to GitHub
2. Go to https://render.com/
3. Create new Web Service
4. Connect your repo
5. Add environment variables
6. Deploy

### Option 3: Vercel (Serverless)

Create `api/chat.js` in project root:

```javascript
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    const response = await cohere.chat({
      message: message,
      model: 'command',
      preamble: '...',
    });

    res.json({ reply: response.text });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get response' });
  }
};
```

## Security Notes

- Never commit `.env` file
- Use environment variables for all secrets
- Implement rate limiting in production
- Add input validation and sanitization
- Use HTTPS in production

## Troubleshooting

### "COHERE_API_KEY is not set"
- Make sure you created `.env` file
- Check that the API key is correct
- Restart the server after adding the key

### "Port already in use"
- Change PORT in `.env` file
- Or kill the process using the port

### CORS errors
- Update CLIENT_URL in `.env`
- Make sure frontend URL matches

## License

ISC
