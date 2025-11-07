# Portfolio Website

A modern, responsive portfolio website featuring an AI-powered chat assistant built with Alpine.js, Tailwind CSS, and Cohere AI.

## Features

- **Responsive Design**: Mobile-first approach with beautiful animations
- **Dark Mode**: System preference detection with manual toggle
- **AI Chat Assistant**: Chat with Ramen, the AI assistant powered by Cohere
- **Project Carousel**: Smooth sliding animations showcasing portfolio projects
- **Scroll Spy Navigation**: Auto-updating navigation based on scroll position
- **Offline Detection**: Graceful handling of backend server downtime

## Tech Stack

### Frontend (Client)
- HTML5, CSS3, JavaScript
- [Alpine.js](https://alpinejs.dev/) - Reactive state management
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [DOMPurify](https://github.com/cure53/DOMPurify) - XSS sanitization

### Backend (Server)
- [Node.js](https://nodejs.org/) + [Express.js](https://expressjs.com/)
- [Cohere AI](https://cohere.com/) - AI chat functionality
- Rate limiting and input validation
- CORS support

## Project Structure

```
portfolio-kun/
├── client/                 # Frontend files (GitHub Pages)
│   ├── assets/            # Images and PDFs
│   │   └── projects/      # Project screenshots
│   ├── css/               # Custom styles
│   ├── js/                # JavaScript files
│   │   ├── alpine-data.js # Alpine.js state and functions
│   │   └── app.js         # Particle animations
│   ├── partials/          # HTML partials
│   └── index.html         # Main HTML file
│
└── server/                # Backend server
    ├── server.js          # Express server with Cohere integration
    ├── .env.example       # Environment variables template
    └── package.json       # Server dependencies
```

## Setup Instructions

### Client (Frontend)

The client folder is hosted on GitHub Pages and runs independently. No setup required for viewing the portfolio.

### Server (Backend)

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Add your Cohere API key to `.env`:
   ```
   COHERE_API_KEY=your_api_key_here
   PORT=3000
   CLIENT_URL=http://localhost:5174
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## GitHub Pages Setup

This repository is configured to serve the `client` folder via GitHub Pages:

1. Go to repository Settings → Pages
2. Set Source to "Deploy from a branch"
3. Select branch: `main` (or `master`)
4. Set folder to `/client`
5. Click Save

Your portfolio will be available at: `https://[username].github.io/portfolio-kun/`

## Chat Feature

The AI chat assistant "Ramen" provides information about:
- Professional experience and skills
- Project details and technologies used
- Contact information
- Resume download

**Note**: The chat feature requires the backend server to be running. When the backend is offline, the chat interface displays an offline message and disables input.

## Security Features

- XSS protection with DOMPurify sanitization
- Input validation and sanitization on both client and server
- Rate limiting (10 requests per minute)
- Markdown pattern blocking
- CORS configuration
- Character limit enforcement (120 characters)

## Development

### Client Development
```bash
cd client
npm install
npm run dev
```

### Server Development
```bash
cd server
npm install
npm run dev
```

## License

Personal portfolio project by Gregory Kun

## Contact

- Email: kunerrrs@gmail.com
- Phone: (437) 838-9783
- LinkedIn: [gregory-kun-73809b172](https://www.linkedin.com/in/gregory-kun-73809b172/)
- GitHub: [kunerrs](https://github.com/kunerrs)
