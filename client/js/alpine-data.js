// Use the local backend during local development, the deployed backend otherwise
const LOCAL_API_URL = 'http://localhost:3000';
// Requests go through the Cloudflare Worker proxy (see worker/) instead of
// onrender.com: ad-blocker filter lists block that shared domain outright.
const DEPLOYED_API_URL = 'https://portfolio-kun-chat.kunerrs.workers.dev';

// A reply can be slow (cold start plus the model call), but it must never leave
// the typing indicator spinning forever.
const CHAT_TIMEOUT_MS = 45000;

let apiBaseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? LOCAL_API_URL
    : DEPLOYED_API_URL;

// Alpine.js data configuration
window.portfolioData = {
    activeSection: 'about',
    mobileMenuOpen: false,
    chatOpen: false,
    experienceTab: 'professional',
    darkMode: false,
    currentProject: 0,
    isProjectActive: true,
    isSliding: false,
    chatMessages: [],
    chatInput: '',
    isTyping: false,
    isCooldown: false,
    isChatOnline: true,
    isChatWaking: false,
    healthCheckInFlight: false,
    healthCheckedOnce: false,
    cooldownTime: 3000, // 3 seconds cooldown between messages
    maxChatLength: 120,
    imageModalOpen: false,
    modalImageSrc: '',
    get chatCharCount() {
        return this.chatInput.length;
    },
    get chatCharsRemaining() {
        return this.maxChatLength - this.chatInput.length;
    },
    get isCharLimitReached() {
        return this.chatInput.length >= this.maxChatLength;
    },
    projects: [
        {
            title: 'Aqqire',
            description: 'Real estate web application complete with CMS and marketing campaign functionality.',
            tags: ['Vue.js', 'FeathersJS', 'MongoDB'],
            tagColor: 'blue',
            image: 'assets/projects/aqq-1.png',
            demo: 'https://aqqire.com',
            github: '#'
        },
        {
            title: 'Aqqire',
            description: 'Real estate web application complete with CMS and marketing campaign functionality.',
            tags: ['Vue.js', 'FeathersJS', 'MongoDB'],
            tagColor: 'blue',
            image: 'assets/projects/aqq-2.png',
            demo: 'https://aqqire.com',
            github: '#'
        },
        {
            title: 'Calibration Awareness',
            description: 'Information site about calibration (engineering) with blogs and educational resources.',
            tags: ['WordPress', 'Elementor'],
            tagColor: 'purple',
            image: 'assets/projects/calibration-awareness-1.png',
            demo: 'https://calibrationawareness.com',
            github: '#'
        },
        {
            title: 'Calibration Awareness',
            description: 'Information site about calibration (engineering) with blogs and educational resources.',
            tags: ['WordPress', 'Elementor'],
            tagColor: 'purple',
            image: 'assets/projects/calibration-awareness-2.png',
            demo: 'https://calibrationawareness.com',
            github: '#'
        },
        {
            title: 'CouchSkins',
            description: 'E-commerce platform for custom furniture skins and designs.',
            tags: ['Shopify', 'Liquid', 'JavaScript'],
            tagColor: 'green',
            image: 'assets/projects/couchskins-1.png',
            demo: 'https://couchskins.com',
            github: '#'
        },
        {
            title: 'Professional Pest Control Operator',
            description: 'Pest Control Management System with invoicing and billing functionality.',
            tags: ['CodeIgniter', 'Bootstrap', 'MySQL'],
            tagColor: 'blue',
            image: 'assets/projects/propco-1.png',
            demo: 'https://apps.propco.services/propco/login',
            github: '#'
        },
        {
            title: 'Professional Pest Control Operator',
            description: 'Pest Control Management System with invoicing and billing functionality.',
            tags: ['CodeIgniter', 'Bootstrap', 'MySQL'],
            tagColor: 'blue',
            image: 'assets/projects/propco-2.png',
            demo: 'https://apps.propco.services/propco/login',
            github: '#'
        }
    ],
    async sendMessage() {
        console.log('sendMessage called!', this.chatInput);

        // Check if chat is online
        if (!this.isChatOnline) {
            alert(this.isChatWaking
                ? 'The chat server is waking up. Please try again in a moment.'
                : 'Chat is currently offline. Please try again later.');
            return;
        }

        // Check cooldown
        if (this.isCooldown) {
            alert('Please wait a few seconds before sending another message.');
            return;
        }

        if (this.chatInput.trim() === '') {
            console.log('Empty input, returning');
            return;
        }
        if (this.chatInput.length > this.maxChatLength) {
            alert(`Message is too long! Maximum ${this.maxChatLength} characters allowed.`);
            return;
        }

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
            if (pattern.test(this.chatInput)) {
                alert('Markdown formatting is not allowed. Please use plain text only.');
                return;
            }
        }

        // Sanitize input to prevent XSS attacks
        const sanitizedInput = DOMPurify.sanitize(this.chatInput, {
            ALLOWED_TAGS: [], // Strip all HTML tags
            KEEP_CONTENT: true // Keep text content
        });

        console.log('Adding user message to chat');
        // Add user message to chat
        this.chatMessages.push({
            text: sanitizedInput,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        const userMessage = sanitizedInput;
        this.chatInput = '';

        // Scroll to bottom after user message
        setTimeout(() => {
            document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
        }, 100);

        await this.requestReply(userMessage);
    },
    // Re-send the question behind a failed reply without retyping it.
    async retryMessage(message) {
        if (!message || !message.retryText || this.isTyping || this.isCooldown) return;

        if (!this.isChatOnline) {
            alert(this.isChatWaking
                ? 'The chat server is waking up. Please try again in a moment.'
                : 'Chat is currently offline. Please try again later.');
            return;
        }

        // Drop the failure bubble so the reply replaces it instead of piling up.
        const index = this.chatMessages.indexOf(message);
        if (index !== -1) this.chatMessages.splice(index, 1);

        await this.requestReply(message.retryText);
    },
    async requestReply(userMessage) {
        this.isTyping = true;

        // Activate cooldown
        this.isCooldown = true;
        setTimeout(() => {
            this.isCooldown = false;
        }, this.cooldownTime);

        console.log('Sending to backend:', userMessage);

        const chatController = new AbortController();
        const chatTimer = setTimeout(() => chatController.abort(), CHAT_TIMEOUT_MS);

        try {
            // Call backend API
            console.log('Fetching from backend...');
            const response = await fetch(`${apiBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage }),
                signal: chatController.signal,
            });

            console.log('Response received:', response.status);
            const data = await response.json();
            console.log('Data:', data);

            this.isTyping = false;

            // Check if rate limited
            if (response.status === 429) {
                this.chatMessages.push({
                    text: data.error || 'Too many messages sent. Please wait a moment before trying again.',
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                return;
            }

            // 503 means the chat host is waking up or throttling us, so offer a
            // retry instead of a generic failure.
            if (response.status === 503) {
                this.chatMessages.push({
                    text: data.error || 'Ramen is waking up right now. Please try again in a moment.',
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    failed: true,
                    retryText: userMessage
                });
                this.checkChatHealth({ timeoutMs: 15000, intervalMs: 3000 });
                return;
            }

            // Sanitize bot response to prevent XSS attacks
            const sanitizedReply = DOMPurify.sanitize(data.reply || 'Sorry, I couldn\'t process that.', {
                ALLOWED_TAGS: [], // Strip all HTML tags
                KEEP_CONTENT: true // Keep text content
            });

            // Add bot response
            this.chatMessages.push({
                text: sanitizedReply,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

        } catch (error) {
            const timedOut = error.name === 'AbortError';
            console.error('Chat error:', error);
            this.isTyping = false;

            // The request never completed, so refresh the online state for the UI.
            this.checkChatHealth({ timeoutMs: 15000, intervalMs: 3000 });

            // Add error message, flagged so the UI can offer a retry.
            this.chatMessages.push({
                text: timedOut
                    ? 'That answer took too long, so I stopped waiting. Please try again.'
                    : 'Sorry, I\'m having trouble connecting to the server. Please try again in a moment.',
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                failed: true,
                retryText: userMessage
            });
        } finally {
            clearTimeout(chatTimer);
        }

        // Scroll to bottom after bot response
        setTimeout(() => {
            document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
        }, 100);
    },
    formatMessage(text) {
        // Messages are plain text: escape them, then turn bare URLs into links.
        const escaped = String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const html = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, (url) => {
            // Keep trailing punctuation outside the link.
            const trailing = (url.match(/[.,;:!?]+$/) || [''])[0];
            const href = trailing ? url.slice(0, -trailing.length) : url;

            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 break-all">${href}</a>${trailing}`;
        });

        // Only the anchors generated above may survive sanitising.
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['a'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
            });
        }

        return html;
    },
    async checkChatHealth({ timeoutMs = 60000, intervalMs = 4000, showWaking = true } = {}) {
        // Never run two checks at once (init, chat open, interval and retries
        // all funnel through here).
        if (this.healthCheckInFlight) return this.isChatOnline;
        this.healthCheckInFlight = true;
        this.healthCheckedOnce = true;

        // The free backend sleeps when idle and can take up to a minute to wake,
        // so keep polling instead of marking chat offline on the first failure.
        const deadline = Date.now() + timeoutMs;
        let attempt = 0;
        let lastFailure = null;

        try {
            // Hard stop at the deadline: each attempt is bounded below, so this
            // loop can never hang and leave the UI on "Waking up the server...".
            while (Date.now() < deadline) {
                attempt += 1;

                // A cold-starting host can hold a request open for minutes, so
                // abort each attempt instead of waiting for the browser to give up.
                const controller = new AbortController();
                const requestBudget = Math.max(1000, Math.min(10000, deadline - Date.now()));
                const requestTimer = setTimeout(() => controller.abort(), requestBudget);

                try {
                    // No custom headers here: that keeps this a simple request,
                    // so the health check needs no CORS preflight.
                    const response = await fetch(`${apiBaseUrl}/health`, {
                        method: 'GET',
                        cache: 'no-store',
                        signal: controller.signal,
                    });

                    if (response.ok) {
                        this.isChatOnline = true;
                        this.isChatWaking = false;
                        return true;
                    }

                    // A 429 comes from the CDN in front of the backend, not the
                    // backend itself, so the host is up and only throttling probes.
                    // Retrying every few seconds just extends the block.
                    if (response.status === 429) {
                        console.warn('Chat backend health check was rate limited; backing off.');
                        this.isChatOnline = true;
                        this.isChatWaking = false;
                        return true;
                    }

                    lastFailure = `returned ${response.status}`;
                } catch (error) {
                    lastFailure = error.name === 'AbortError' ? 'request timed out' : error.message;
                } finally {
                    clearTimeout(requestTimer);
                }

                // In local dev the backend may be stopped or on another port, so
                // fall back to the deployed API instead of reporting chat offline.
                if (apiBaseUrl === LOCAL_API_URL) {
                    apiBaseUrl = DEPLOYED_API_URL;
                    console.warn(`Local backend unavailable, falling back to ${apiBaseUrl}`);
                    continue;
                }

                if (Date.now() >= deadline) break;

                // Still retrying, so the server is most likely cold-starting:
                // show "waking up" rather than warning that chat is offline.
                // Passive background retries stay quiet: they advertise a wake-up
                // they cannot make, which leaves a dead backend looking like it is
                // booting forever instead of being offline.
                this.isChatOnline = false;
                if (showWaking) this.isChatWaking = true;

                // Back off instead of retrying on a fixed cadence: every failed
                // probe counts against the free host's rate limit, which only
                // makes the wake-up slower.
                const backoff = Math.min(intervalMs * 2 ** (attempt - 1), 20000);
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.min(backoff, Math.max(0, deadline - Date.now())))
                );
            }

            // One summary instead of a warning per attempt: the retries are
            // expected while a sleeping backend wakes.
            console.warn(
                `Chat backend still offline after ${attempt} attempts (last: ${lastFailure || 'unknown'})`
            );
            this.isChatOnline = false;
            this.isChatWaking = false;
            return false;
        } finally {
            this.healthCheckInFlight = false;
            // Whatever happened, never leave the chat advertising a wake-up
            // that is no longer being attempted.
            if (!this.isChatOnline) this.isChatWaking = false;
        }
    },
    init() {
        // Check if user has a saved preference, otherwise use system preference
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode !== null) {
            this.darkMode = savedDarkMode === 'true';
        } else {
            // Use system preference
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        if (this.darkMode) {
            document.documentElement.classList.add('dark');
        }

        // Probe the backend when the chat is opened, not on page load. The free
        // host wakes on any request, and a cold start makes the first probes
        // fail: doing that for every visitor's page load turned a sleeping
        // instance into a burst of failed health checks.
        if (typeof this.$watch === 'function') {
            this.$watch('chatOpen', (isOpen) => {
                if (isOpen && (!this.isChatOnline || !this.healthCheckedOnce)) {
                    this.checkChatHealth();
                }
            });
        }

        // Keep retrying in the background while offline, so a backend that sleeps
        // or drops mid-session brings the chat back without a page reload.
        setInterval(() => {
            if (!this.isChatOnline) {
                this.checkChatHealth({ timeoutMs: 20000, intervalMs: 5000, showWaking: false });
            }
        }, 30000);

        // Scroll spy - update active section based on scroll position
        window.addEventListener('scroll', () => {
            const sections = ['about', 'projects', 'experience', 'skills', 'education', 'contact'];
            const scrollPosition = window.scrollY + 100; // Offset for navbar

            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const offsetTop = element.offsetTop;
                    const offsetBottom = offsetTop + element.offsetHeight;

                    if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
                        this.activeSection = section;
                        break;
                    }
                }
            }
        });
    },
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        if (this.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },
    scrollToSection(section) {
        this.activeSection = section;
        document.getElementById(section).scrollIntoView({ behavior: 'smooth' });
        this.mobileMenuOpen = false;
    },
    nextProject() {
        if (this.isSliding) return; // Prevent multiple clicks
        this.isSliding = true;

        // 1. Fade out current project
        this.isProjectActive = false;

        // 2. After fade out, change project
        setTimeout(() => {
            this.currentProject = (this.currentProject + 1) % this.projects.length;

            // 3. Fade in new project
            setTimeout(() => {
                this.isProjectActive = true;
                this.isSliding = false;
            }, 50);
        }, 600); // Match CSS transition duration
    },
    prevProject() {
        if (this.isSliding) return; // Prevent multiple clicks
        this.isSliding = true;

        // 1. Fade out current project
        this.isProjectActive = false;

        // 2. After fade out, change project
        setTimeout(() => {
            this.currentProject = (this.currentProject - 1 + this.projects.length) % this.projects.length;

            // 3. Fade in new project
            setTimeout(() => {
                this.isProjectActive = true;
                this.isSliding = false;
            }, 50);
        }, 600); // Match CSS transition duration
    },
    getProjectIndex(offset) {
        return (this.currentProject + offset + this.projects.length) % this.projects.length;
    },
    openImageModal(imageSrc) {
        this.modalImageSrc = imageSrc;
        this.imageModalOpen = true;
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    },
    closeImageModal() {
        this.imageModalOpen = false;
        this.modalImageSrc = '';
        // Re-enable body scroll
        document.body.style.overflow = '';
    }
};
