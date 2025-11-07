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
            alert('Chat is currently offline. Please try again later.');
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
        this.isTyping = true;

        // Activate cooldown
        this.isCooldown = true;
        setTimeout(() => {
            this.isCooldown = false;
        }, this.cooldownTime);

        console.log('Sending to backend:', userMessage);

        // Scroll to bottom after user message
        setTimeout(() => {
            document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
        }, 100);

        try {
            // Call backend API
            console.log('Fetching from backend...');
            // Production: https://portfolio-kun.onrender.com/api/chat
            // Development: http://localhost:3000/api/chat
            const response = await fetch('https://portfolio-kun.onrender.com/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage }),
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
            console.error('Chat error:', error);
            this.isTyping = false;

            // Add error message
            this.chatMessages.push({
                text: 'Sorry, I\'m having trouble connecting to the server. Please make sure the backend is running on port 3000.',
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }

        // Scroll to bottom after bot response
        setTimeout(() => {
            document.querySelector('.chat-messages').scrollTop = document.querySelector('.chat-messages').scrollHeight;
        }, 100);
    },
    async checkChatHealth() {
        try {
            // Production: https://portfolio-kun.onrender.com/health
            // Development: http://localhost:3000/health
            const response = await fetch('https://portfolio-kun.onrender.com/health', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            this.isChatOnline = response.ok;
        } catch (error) {
            console.error('Chat backend is offline:', error);
            this.isChatOnline = false;
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

        // Check chat backend health
        this.checkChatHealth();

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
