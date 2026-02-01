const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const TelegramBot = require('node-telegram-bot-api');

// ============================================
// TELEGRAM BOT CONFIGURATION
// ============================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = process.env.CHAT_ID || 'YOUR_CHAT_ID_HERE';
let bot = null;

// ============================================
// LOADING ANIMATION SYSTEM
// ============================================
class LoadingAnimation {
    constructor(totalSteps = 100, barLength = 30) {
        this.totalSteps = totalSteps;
        this.barLength = barLength;
        this.currentStep = 0;
        this.speed = 50; // ms per step
        this.isActive = false;
        this.text = '';
        this.prefix = '';
    }

    setText(text) {
        this.text = text;
        return this;
    }

    setPrefix(prefix) {
        this.prefix = prefix;
        return this;
    }

    generateBar(percentage) {
        const filledLength = Math.floor((percentage / 100) * this.barLength);
        const emptyLength = this.barLength - filledLength;
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        return `[${filledBar}${emptyBar}]`;
    }

    async start() {
        this.isActive = true;
        this.currentStep = 0;

        while (this.isActive && this.currentStep <= this.totalSteps) {
            const percentage = Math.min(100, (this.currentStep / this.totalSteps) * 100);
            const bar = this.generateBar(percentage);
            
            process.stdout.write(`\r${this.prefix} ${bar} ${percentage.toFixed(1)}% ${this.text}`);
            
            if (this.currentStep === this.totalSteps) {
                process.stdout.write(`\n`);
                break;
            }
            
            this.currentStep += 1;
            await this.delay(this.speed);
        }
    }

    update(step) {
        this.currentStep = Math.min(step, this.totalSteps);
    }

    complete() {
        this.currentStep = this.totalSteps;
        const bar = this.generateBar(100);
        process.stdout.write(`\r${this.prefix} ${bar} 100.0% ${this.text} ✅\n`);
        this.isActive = false;
    }

    error() {
        this.isActive = false;
        const bar = this.generateBar(this.currentStep);
        process.stdout.write(`\r${this.prefix} ${bar} ${((this.currentStep/this.totalSteps)*100).toFixed(1)}% ${this.text} ❌\n`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// DGXEON HOZOO MD THEME
// ============================================
class DGXEONTheme {
    static log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m', // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m', // Red
            system: '\x1b[35m', // Magenta
            highlight: '\x1b[1m\x1b[36m' // Bold Cyan
        };
        
        const reset = '\x1b[0m';
        const timestamp = new Date().toLocaleTimeString();
        
        let prefix = '';
        switch(type) {
            case 'success':
                prefix = '🟢';
                break;
            case 'warning':
                prefix = '🟡';
                break;
            case 'error':
                prefix = '🔴';
                break;
            case 'system':
                prefix = '🟣';
                break;
            default:
                prefix = '🔵';
        }
        
        console.log(`${colors[type]}${prefix} DGXEONHOZOOMD [${timestamp}] ${message}${reset}`);
    }

    static drawMenu() {
        console.clear();
        console.log('\x1b[1m\x1b[36m');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    DGXEON HOZOO MD SYSTEM                    ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║  🚀 TIKTOK MASS REPORT BOT v2.0 - TELEGRAM INTEGRATION      ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║                                                              ║');
        console.log('║  \x1b[33m/menu\x1b[36m       - Tampilkan menu ini                         ║');
        console.log('║  \x1b[33m/report @username\x1b[36m - Report akun TikTok                    ║');
        console.log('║  \x1b[33m/batch\x1b[36m       - Report multiple accounts dari file        ║');
        console.log('║  \x1b[33m/stats\x1b[36m        - Lihat statistik reports                  ║');
        console.log('║  \x1b[33m/logs\x1b[36m         - Tampilkan log terbaru                    ║');
        console.log('║  \x1b[33m/help\x1b[36m         - Bantuan penggunaan                       ║');
        console.log('║  \x1b[33m/status\x1b[36m       - Cek status sistem                        ║');
        console.log('║                                                              ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║  \x1b[32m⚡ SYSTEM: ONLINE | BOT: ACTIVE | API: READY\x1b[36m              ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');
        console.log('');
    }

    static drawProgress(title, current, total) {
        const width = 50;
        const percentage = Math.min(100, (current / total) * 100);
        const filled = Math.floor((percentage / 100) * width);
        const empty = width - filled;
        
        console.log('\x1b[1m\x1b[36m');
        console.log('┌──────────────────────────────────────────────────────────────┐');
        console.log(`│ ${title.padEnd(60)} │`);
        console.log('├──────────────────────────────────────────────────────────────┤');
        console.log(`│ [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}% │`);
        console.log('└──────────────────────────────────────────────────────────────┘\x1b[0m');
    }
}

// ============================================
// TIKTOK REPORT BOT (UPDATED)
// ============================================
class TikTokReportBot {
    constructor() {
        this.baseURL = 'https://www.tiktok.com';
        this.reportEndpoint = '/legal/report/feedback';
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Mobile/15E148 Safari/604.1';
        this.session = axios.create({
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            }
        });
        this.cookies = [];
        this.csrfToken = '';
        this.webId = '';
        this.region = '';
        this.appId = '';
        this.uploadConfig = null;
        this.reportCount = 0;
    }

    async sendTelegramUpdate(message, chatId = CHAT_ID) {
        if (!bot || !TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            return false;
        }
        
        try {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML'
            });
            return true;
        } catch (error) {
            DGXEONTheme.log(`Telegram send failed: ${error.message}`, 'warning');
            return false;
        }
    }

    async sendTelegramProgress(step, total, message, chatId = CHAT_ID) {
        if (!bot) return false;
        
        const percentage = Math.min(100, (step / total) * 100);
        const barLength = 20;
        const filled = Math.floor((percentage / 100) * barLength);
        const empty = barLength - filled;
        const bar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
        
        const progressMessage = 
            `<b>DGXEON HOZOO MD</b>\n` +
            `⚡ <code>${message}</code>\n` +
            `${bar} ${percentage.toFixed(1)}%\n` +
            `📊 Step ${step}/${total}`;
        
        try {
            // For progress updates, we might want to edit previous message
            // For simplicity, just send new message
            await bot.sendMessage(chatId, progressMessage, {
                parse_mode: 'HTML'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async generateTempEmail() {
        const loading = new LoadingAnimation(50, 20);
        loading.setText('Generating temporary email...');
        loading.setPrefix('📧');
        loading.start();

        try {
            const response = await axios.get('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
            if (response.data && response.data.length > 0) {
                const email = response.data[0];
                const [login, domain] = email.split('@');
                
                loading.update(30);
                
                // Get messages to verify email exists
                const verifyResponse = await axios.get(`https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`);
                
                loading.complete();
                
                await this.sendTelegramUpdate(
                    `<b>📧 EMAIL GENERATED</b>\n` +
                    `<code>${email}</code>\n` +
                    `✅ Ready for report submission`
                );
                
                return {
                    email: email,
                    login: login,
                    domain: domain,
                    messages: verifyResponse.data || []
                };
            }
        } catch (error) {
            loading.error();
            DGXEONTheme.log(`Error generating temp email: ${error.message}`, 'warning');
        }
        
        // Fallback email
        const random = Math.random().toString(36).substring(7);
        const fallbackEmail = `tiktok_report_${random}@1secmail.org`;
        
        loading.complete();
        
        return {
            email: fallbackEmail,
            login: `tiktok_report_${random}`,
            domain: '1secmail.org',
            messages: []
        };
    }

    async extractCSRFToken(html) {
        try {
            const dom = new JSDOM(html);
            const scripts = dom.window.document.querySelectorAll('script');
            
            for (let script of scripts) {
                if (script.textContent.includes('__remixContext')) {
                    const match = script.textContent.match(/"webId"\s*:\s*"([^"]+)"/);
                    if (match) {
                        this.webId = match[1];
                    }
                    
                    const regionMatch = script.textContent.match(/"vRegion"\s*:\s*"([^"]+)"/);
                    if (regionMatch) {
                        this.region = regionMatch[1];
                    }
                    
                    const appIdMatch = script.textContent.match(/"appid"\s*:\s*(\d+)/);
                    if (appIdMatch) {
                        this.appId = appIdMatch[1];
                    }
                    
                    // Extract upload config
                    const uploadMatch = script.textContent.match(/"uploadConfig"\s*:\s*({[^}]+})/);
                    if (uploadMatch) {
                        try {
                            this.uploadConfig = JSON.parse(uploadMatch[1]);
                        } catch (e) {}
                    }
                }
                
                // Look for CSRF in script tags with json data
                if (script.textContent.includes('csrf') || script.textContent.includes('CSRF')) {
                    const csrfMatch = script.textContent.match(/"csrf"?\s*[:=]\s*["']([^"']+)["']/i);
                    if (csrfMatch) {
                        this.csrfToken = csrfMatch[1];
                    }
                }
            }
            
            // Also check meta tags
            const metaTags = dom.window.document.querySelectorAll('meta[name="csrf-token"]');
            if (metaTags.length > 0) {
                this.csrfToken = metaTags[0].getAttribute('content') || '';
            }
            
            // Extract from cookies if available
            if (this.cookies.length > 0) {
                for (let cookie of this.cookies) {
                    if (cookie.includes('csrf')) {
                        const match = cookie.match(/csrf[^=]*=([^;]+)/);
                        if (match) {
                            this.csrfToken = match[1];
                        }
                    }
                }
            }
            
            DGXEONTheme.log(`Tokens extracted - WebID: ${this.webId}, Region: ${this.region}, AppID: ${this.appId}`, 'success');
            
        } catch (error) {
            DGXEONTheme.log(`Error extracting CSRF: ${error.message}`, 'error');
        }
    }

    async getInitialPage() {
        const loading = new LoadingAnimation(100, 25);
        loading.setText('Initializing TikTok session...');
        loading.setPrefix('🌐');
        loading.start();

        try {
            const response = await this.session.get(this.baseURL + this.reportEndpoint, {
                maxRedirects: 5
            });
            
            loading.update(50);
            
            // Save cookies
            if (response.headers['set-cookie']) {
                this.cookies = response.headers['set-cookie'];
            }
            
            loading.update(75);
            
            // Extract CSRF and other tokens
            await this.extractCSRFToken(response.data);
            
            loading.complete();
            
            await this.sendTelegramUpdate(
                `<b>🌐 SESSION INITIALIZED</b>\n` +
                `✅ TikTok session ready\n` +
                `📊 Region: <code>${this.region}</code>\n` +
                `🆔 WebID: <code>${this.webId.substring(0, 15)}...</code>`
            );
            
            return response.data;
        } catch (error) {
            loading.error();
            DGXEONTheme.log(`Error fetching initial page: ${error.message}`, 'error');
            throw error;
        }
    }

    async uploadFile(filePath, fileType = 'image') {
        if (!this.uploadConfig) {
            DGXEONTheme.log('No upload config found, skipping file upload', 'warning');
            return null;
        }
        
        const loading = new LoadingAnimation(100, 20);
        loading.setText(`Uploading ${fileType} evidence...`);
        loading.setPrefix('📎');
        loading.start();

        try {
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const fileExt = path.extname(filePath).toLowerCase();
            
            let uploadUrl, formDataConfig;
            
            if (fileType === 'video' && this.uploadConfig.videoHost) {
                uploadUrl = `${this.uploadConfig.videoHost}/upload`;
                formDataConfig = {
                    spaceName: this.uploadConfig.videoConfig?.spaceName || 'tt-csp-video'
                };
            } else if (fileType === 'image' && this.uploadConfig.imageHost) {
                uploadUrl = `${this.uploadConfig.imageHost}/upload`;
                formDataConfig = {
                    serviceId: this.uploadConfig.imageConfig?.serviceId || '9lt9rdbhvr'
                };
            } else {
                loading.error();
                DGXEONTheme.log(`Unsupported file type: ${fileType}`, 'warning');
                return null;
            }
            
            loading.update(30);
            
            const form = new FormData();
            form.append('file', fileBuffer, {
                filename: fileName,
                contentType: this.getContentType(fileExt)
            });
            
            // Add additional params
            if (formDataConfig) {
                Object.entries(formDataConfig).forEach(([key, value]) => {
                    form.append(key, value);
                });
            }
            
            loading.update(60);
            
            const response = await axios.post(uploadUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': this.userAgent,
                    'Origin': 'https://www.tiktok.com',
                    'Referer': 'https://www.tiktok.com/'
                }
            });
            
            loading.complete();
            
            if (response.data && response.data.data) {
                return response.data.data;
            }
            
            return response.data;
            
        } catch (error) {
            loading.error();
            DGXEONTheme.log(`Error uploading file: ${error.message}`, 'error');
            return null;
        }
    }

    getContentType(extension) {
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.webm': 'video/webm'
        };
        
        return contentTypes[extension] || 'application/octet-stream';
    }

    async submitReport(reportData) {
        const loading = new LoadingAnimation(150, 30);
        loading.setText('Submitting report to TikTok...');
        loading.setPrefix('🚀');
        loading.start();

        try {
            // First get the page to get fresh tokens
            loading.update(10);
            await this.getInitialPage();
            
            loading.update(30);
            
            // Prepare headers with cookies
            const headers = {
                'User-Agent': this.userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Content-Type': 'application/json',
                'Origin': 'https://www.tiktok.com',
                'Referer': this.baseURL + this.reportEndpoint,
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'X-Requested-With': 'XMLHttpRequest'
            };
            
            // Add CSRF token if available
            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }
            
            // Add cookies
            if (this.cookies.length > 0) {
                const cookieString = this.cookies
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                headers['Cookie'] = cookieString;
            }
            
            loading.update(50);
            
            // Construct the report payload
            const payload = {
                topic: 'Report a potential violation',
                subtopic: 'scam_fraud',
                reported_username: reportData.username.replace('@', ''),
                reported_url: `${this.baseURL}/@${reportData.username.replace('@', '')}`,
                description: reportData.message,
                contact_email: reportData.email,
                attachments: [],
                additional_info: JSON.stringify({
                    account_type: 'scam',
                    violation_type: ['fraud', 'impersonation', 'financial_scam'],
                    evidence_type: 'user_report',
                    reporter_anonymous: true,
                    source: 'web_form',
                    region: this.region || 'us-ttp',
                    web_id: this.webId || '0',
                    app_id: this.appId || 1233
                }),
                captcha_response: '',
                agree_to_terms: true,
                _csrf: this.csrfToken,
                _region: this.region,
                _webId: this.webId
            };
            
            // Add attachments if any
            if (reportData.attachments && reportData.attachments.length > 0) {
                for (let i = 0; i < reportData.attachments.length; i++) {
                    loading.update(60 + (i * 10));
                    const attachment = reportData.attachments[i];
                    const uploadedFile = await this.uploadFile(attachment.path, attachment.type);
                    if (uploadedFile) {
                        payload.attachments.push({
                            url: uploadedFile.url || uploadedFile.download_url,
                            type: attachment.type,
                            name: path.basename(attachment.path)
                        });
                    }
                }
            }
            
            loading.update(80);
            
            // Submit the report
            const submitURL = `${this.baseURL}/api/report/submit`;
            
            DGXEONTheme.log(`Submitting report for @${reportData.username.replace('@', '')}`, 'info');
            
            const response = await this.session.post(submitURL, payload, {
                headers: headers,
                timeout: 30000
            });
            
            loading.update(100);
            
            const result = {
                success: response.status === 200,
                status: response.status,
                data: response.data,
                report_id: response.data?.report_id || `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                submitted_at: new Date().toISOString(),
                target_account: reportData.username,
                email_used: reportData.email
            };
            
            this.reportCount++;
            
            // Send Telegram notification
            await this.sendTelegramUpdate(
                `<b>✅ REPORT SUBMITTED SUCCESSFULLY</b>\n` +
                `🎯 Target: <code>${reportData.username}</code>\n` +
                `🆔 Report ID: <code>${result.report_id}</code>\n` +
                `📧 Email: <code>${reportData.email}</code>\n` +
                `📊 Status: ${response.status}\n` +
                `⏰ Time: ${new Date().toLocaleTimeString()}`
            );
            
            loading.complete();
            
            return result;
            
        } catch (error) {
            loading.error();
            DGXEONTheme.log(`Error submitting report: ${error.message}`, 'error');
            
            // Send error to Telegram
            await this.sendTelegramUpdate(
                `<b>❌ REPORT FAILED</b>\n` +
                `🎯 Target: <code>${reportData.username}</code>\n` +
                `📛 Error: <code>${error.message.substring(0, 100)}</code>\n` +
                `⏰ Time: ${new Date().toLocaleTimeString()}`
            );
            
            // Fallback: Try direct form submission
            try {
                DGXEONTheme.log('Attempting fallback submission...', 'warning');
                return await this.submitDirectForm(reportData);
            } catch (fallbackError) {
                throw new Error(`Both API and form submission failed: ${fallbackError.message}`);
            }
        }
    }

    async submitDirectForm(reportData) {
        // Alternative method using form simulation
        try {
            const formData = new FormData();
            
            formData.append('topic', 'Report a potential violation');
            formData.append('username', reportData.username.replace('@', ''));
            formData.append('description', reportData.message);
            formData.append('email', reportData.email);
            formData.append('violation_type', 'scam_fraud');
            formData.append('source', 'web_report_form');
            
            const response = await this.session.post(
                `${this.baseURL}/legal/report/submit-requests`,
                formData,
                {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Origin': 'https://www.tiktok.com',
                        'Referer': `${this.baseURL}${this.reportEndpoint}`,
                        ...formData.getHeaders()
                    }
                }
            );
            
            return {
                success: response.status === 200 || response.status === 302,
                status: response.status,
                method: 'direct_form',
                submitted_at: new Date().toISOString()
            };
            
        } catch (error) {
            throw error;
        }
    }

    async generateEvidenceScreenshot(username) {
        // This would typically use Puppeteer or similar to generate screenshot
        // For now, return mock data
        return {
            path: `/tmp/evidence_${username}_${Date.now()}.png`,
            type: 'image',
            description: `Screenshot evidence for @${username} scam account`
        };
    }

    getStats() {
        return {
            total_reports: this.reportCount,
            session_started: new Date().toISOString(),
            web_id: this.webId,
            region: this.region
        };
    }
}

// ============================================
// TELEGRAM BOT HANDLER
// ============================================
class TelegramBotHandler {
    constructor() {
        this.tiktokBot = new TikTokReportBot();
        this.userSessions = new Map();
        this.commands = {
            '/start': this.handleStart.bind(this),
            '/menu': this.handleMenu.bind(this),
            '/report': this.handleReport.bind(this),
            '/batch': this.handleBatch.bind(this),
            '/stats': this.handleStats.bind(this),
            '/logs': this.handleLogs.bind(this),
            '/help': this.handleHelp.bind(this),
            '/status': this.handleStatus.bind(this)
        };
    }

    async initialize() {
        if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
            DGXEONTheme.log('Telegram token not set. Bot disabled.', 'warning');
            return false;
        }

        try {
            bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
            
            bot.on('message', async (msg) => {
                const chatId = msg.chat.id;
                const text = msg.text || '';
                
                // Check if user is authorized
                if (CHAT_ID && chatId.toString() !== CHAT_ID.toString()) {
                    await bot.sendMessage(chatId, '❌ Unauthorized access.');
                    return;
                }
                
                // Handle commands
                for (const [command, handler] of Object.entries(this.commands)) {
                    if (text.startsWith(command)) {
                        const args = text.substring(command.length).trim();
                        await handler(chatId, args, msg);
                        return;
                    }
                }
                
                // Handle session continuation (e.g., waiting for username)
                if (this.userSessions.has(chatId)) {
                    const session = this.userSessions.get(chatId);
                    if (session.waitingFor === 'username') {
                        await this.handleReport(chatId, text, msg);
                        this.userSessions.delete(chatId);
                    }
                } else {
                    await bot.sendMessage(chatId, 'Unknown command. Type /menu to see available commands.');
                }
            });
            
            DGXEONTheme.log('Telegram Bot initialized successfully!', 'success');
            
            // Send startup message
            if (CHAT_ID) {
                await bot.sendMessage(CHAT_ID,
                    `<b>🤖 DGXEON HOZOO MD SYSTEM ONLINE</b>\n` +
                    `⚡ TikTok Report Bot v2.0\n` +
                    `✅ Bot initialized successfully\n` +
                    `🕐 ${new Date().toLocaleString()}\n\n` +
                    `Type <code>/menu</code> to begin`,
                    { parse_mode: 'HTML' }
                );
            }
            
            return true;
        } catch (error) {
            DGXEONTheme.log(`Failed to initialize Telegram bot: ${error.message}`, 'error');
            return false;
        }
    }

    async handleStart(chatId) {
        await bot.sendMessage(chatId,
            `<b>👋 Welcome to DGXEON HOZOO MD System</b>\n` +
            `Advanced TikTok Mass Report Bot with Telegram Integration\n\n` +
            `⚡ <b>Features:</b>\n` +
            `• Automated TikTok reporting\n` +
            `• Temporary email generation\n` +
            `• Real-time progress tracking\n` +
            `• Batch processing\n` +
            `• Evidence attachment\n\n` +
            `Type <code>/menu</code> to see all commands`,
            { parse_mode: 'HTML' }
        );
    }

    async handleMenu(chatId) {
        await bot.sendMessage(chatId,
            `<b>📱 DGXEON HOZOO MD MENU</b>\n\n` +
            `<b>🚀 Core Commands:</b>\n` +
            `<code>/report @username</code> - Report TikTok account\n` +
            `<code>/batch</code> - Batch report from file\n\n` +
            `<b>📊 Information:</b>\n` +
            `<code>/stats</code> - View report statistics\n` +
            `<code>/logs</code> - View recent logs\n` +
            `<code>/status</code> - System status\n` +
            `<code>/help</code> - Help guide\n\n` +
            `<b>⚡ Quick Start:</b>\n` +
            `Send <code>/report @scammer123</code> to begin`,
            { parse_mode: 'HTML' }
        );
    }

    async handleReport(chatId, args, msg) {
        let username = args;
        
        if (!username) {
            // Ask for username
            this.userSessions.set(chatId, { waitingFor: 'username' });
            await bot.sendMessage(chatId,
                `<b>🎯 REPORT ACCOUNT</b>\n` +
                `Please send the TikTok username (with @):\n` +
                `Example: <code>@scammer123</code>`,
                { parse_mode: 'HTML' }
            );
            return;
        }
        
        // Validate username
        if (!username.startsWith('@')) {
            username = '@' + username;
        }
        
        await bot.sendMessage(chatId,
            `<b>🚀 STARTING REPORT</b>\n` +
            `Target: <code>${username}</code>\n` +
            `Process starting... ⚡`,
            { parse_mode: 'HTML' }
        );
        
        // Start the report process
        try {
            const result = await runMassReport({
                targetUsername: username.replace('@', ''),
                scamType: 'scam_fraud',
                customMessage: 'Reported via DGXEON HOZOO MD Telegram Bot',
                generateEvidence: false
            }, chatId);
            
            await bot.sendMessage(chatId,
                `<b>✅ REPORT COMPLETED</b>\n` +
                `🎯 Target: <code>${username}</code>\n` +
                `🆔 Report ID: <code>${result.report_id}</code>\n` +
                `📧 Email: <code>${result.email_used}</code>\n` +
                `📊 Status: ${result.status}\n` +
                `⏰ Time: ${result.submitted_at}`,
                { parse_mode: 'HTML' }
            );
            
        } catch (error) {
            await bot.sendMessage(chatId,
                `<b>❌ REPORT FAILED</b>\n` +
                `Target: <code>${username}</code>\n` +
                `Error: <code>${error.message.substring(0, 100)}</code>`,
                { parse_mode: 'HTML' }
            );
        }
    }

    async handleBatch(chatId) {
        await bot.sendMessage(chatId,
            `<b>📁 BATCH REPORTING</b>\n\n` +
            `Batch reporting requires a text file with usernames.\n` +
            `Format: One username per line\n\n` +
            `Example file content:\n` +
            `<code>@scammer1\n@scammer2\n@fake_account</code>\n\n` +
            `Send the file to begin batch processing.`,
            { parse_mode: 'HTML' }
        );
    }

    async handleStats(chatId) {
        const stats = this.tiktokBot.getStats();
        await bot.sendMessage(chatId,
            `<b>📊 SYSTEM STATISTICS</b>\n\n` +
            `📈 Total Reports: <b>${stats.total_reports}</b>\n` +
            `🌐 Region: <code>${stats.region || 'Not set'}</code>\n` +
            `🆔 Web ID: <code>${stats.web_id ? stats.web_id.substring(0, 15) + '...' : 'Not set'}</code>\n` +
            `🕐 Session: ${new Date(stats.session_started).toLocaleTimeString()}\n\n` +
            `⚡ System: <b>OPERATIONAL</b>`,
            { parse_mode: 'HTML' }
        );
    }

    async handleLogs(chatId) {
        try {
            if (fs.existsSync('tiktok_reports_log.json')) {
                const logs = JSON.parse(fs.readFileSync('tiktok_reports_log.json', 'utf8'));
                const recentLogs = logs.slice(-5).reverse();
                
                let logMessage = `<b>📋 RECENT REPORTS (Last 5)</b>\n\n`;
                
                recentLogs.forEach((log, index) => {
                    logMessage += 
                        `<b>${index + 1}. @${log.target_account.replace('@', '')}</b>\n` +
                        `ID: <code>${log.report_id}</code>\n` +
                        `Status: ${log.status === 'submitted' ? '✅' : '❌'}\n` +
                        `Time: ${new Date(log.timestamp).toLocaleTimeString()}\n\n`;
                });
                
                await bot.sendMessage(chatId, logMessage, { parse_mode: 'HTML' });
            } else {
                await bot.sendMessage(chatId, 'No logs found yet.');
            }
        } catch (error) {
            await bot.sendMessage(chatId, `Error reading logs: ${error.message}`);
        }
    }

    async handleHelp(chatId) {
        await bot.sendMessage(chatId,
            `<b>❓ HELP GUIDE</b>\n\n` +
            `<b>Quick Start:</b>\n` +
            `1. Type <code>/menu</code>\n` +
            `2. Use <code>/report @username</code>\n` +
            `3. Bot will handle everything automatically\n\n` +
            `<b>Features:</b>\n` +
            `• Auto email generation (1secmail)\n` +
            `• CSRF token handling\n` +
            `• Multiple fallback methods\n` +
            `• Real-time Telegram updates\n` +
            `• Progress tracking\n\n` +
            `<b>Note:</b>\n` +
            `• Use responsibly\n` +
            `• Only report violating accounts\n` +
            `• System may be rate-limited`,
            { parse_mode: 'HTML' }
        );
    }

    async handleStatus(chatId) {
        const status = await this.tiktokBot.getInitialPage().catch(() => null);
        
        await bot.sendMessage(chatId,
            `<b>📡 SYSTEM STATUS</b>\n\n` +
            `🤖 Telegram Bot: <b>${bot ? '✅ ONLINE' : '❌ OFFLINE'}</b>\n` +
            `🌐 TikTok API: <b>${status ? '✅ CONNECTED' : '❌ DISCONNECTED'}</b>\n` +
            `📊 Reports Today: <b>${this.tiktokBot.reportCount}</b>\n` +
            `🕐 Server Time: ${new Date().toLocaleTimeString()}\n\n` +
            `<b>DGXEON HOZOO MD 🟢 OPERATIONAL</b>`,
            { parse_mode: 'HTML' }
        );
    }
}

// ============================================
// UPDATED MAIN FUNCTIONS WITH TELEGRAM INTEGRATION
// ============================================
async function runMassReport(config, telegramChatId = null) {
    DGXEONTheme.drawMenu();
    
    const bot = new TikTokReportBot();
    
    // Send start notification to Telegram
    if (telegramChatId && TELEGRAM_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
        await bot.sendTelegramUpdate(
            `<b>🚀 STARTING REPORT PROCESS</b>\n` +
            `🎯 Target: <code>${config.targetUsername}</code>\n` +
            `📌 Type: ${config.scamType}\n` +
            `⏰ Started: ${new Date().toLocaleTimeString()}`,
            telegramChatId
        );
    }
    
    try {
        // 1. Initialize session
        DGXEONTheme.drawProgress('Initializing TikTok session', 1, 5);
        await bot.getInitialPage();
        
        // 2. Generate temp email
        DGXEONTheme.drawProgress('Generating temporary email', 2, 5);
        const emailData = await bot.generateTempEmail();
        
        // 3. Prepare report data
        DGXEONTheme.drawProgress('Preparing report data', 3, 5);
        
        const reportData = {
            username: config.targetUsername.startsWith('@') ? config.targetUsername : `@${config.targetUsername}`,
            message: `🚨 URGENT REPORT: This account "${config.targetUsername}" is involved in ${config.scamType} activities. ${config.customMessage || ''}

Evidence:
- Account promotes fake investment schemes
- Engages in phishing attempts
- Uses fake celebrity endorsements
- Solicits money through fraudulent means
- Violates TikTok Community Guidelines Section 4 (Fraud and Deception)

This account needs immediate suspension to protect other users from financial harm and scams.`,
            email: emailData.email,
            scamType: config.scamType || 'financial scam',
            attachments: []
        };
        
        if (config.customMessage) {
            reportData.message += `\n\nAdditional details: ${config.customMessage}`;
        }
        
        // 4. Generate evidence (optional)
        if (config.generateEvidence) {
            DGXEONTheme.drawProgress('Generating evidence', 4, 5);
            const evidence = await bot.generateEvidenceScreenshot(config.targetUsername);
            reportData.attachments.push(evidence);
        }
        
        // 5. Submit report
        DGXEONTheme.drawProgress('Submitting report to TikTok', 5, 5);
        const result = await bot.submitReport(reportData);
        
        // 6. Save report log
        const logEntry = {
            timestamp: new Date().toISOString(),
            report_id: result.report_id,
            target_account: reportData.username,
            email: reportData.email,
            status: result.success ? 'submitted' : 'failed',
            details: result
        };
        
        const logFile = 'tiktok_reports_log.json';
        let logs = [];
        
        if (fs.existsSync(logFile)) {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
        
        logs.push(logEntry);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        
        // Final display
        console.log('\x1b[1m\x1b[36m');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                      REPORT COMPLETED                        ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  🎯 Target: ${reportData.username.padEnd(50)} ║`);
        console.log(`║  🆔 Report ID: ${result.report_id.padEnd(45)} ║`);
        console.log(`║  📧 Email: ${result.email_used.padEnd(48)} ║`);
        console.log(`║  📊 Status: ${result.status === 200 ? 'SUCCESS' : 'PARTIAL'.padEnd(47)} ║`);
        console.log(`║  ⏰ Time: ${result.submitted_at.padEnd(49)} ║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');
        
        return result;
        
    } catch (error) {
        DGXEONTheme.log(`Error during mass report: ${error.message}`, 'error');
        
        // Send error to Telegram
        if (telegramChatId) {
            await bot.sendTelegramUpdate(
                `<b>❌ REPORT PROCESS FAILED</b>\n` +
                `🎯 Target: <code>${config.targetUsername}</code>\n` +
                `📛 Error: <code>${error.message.substring(0, 100)}</code>\n` +
                `⏰ Time: ${new Date().toLocaleTimeString()}`,
                telegramChatId
            );
        }
        
        throw error;
    }
}

async function runBatchReports(targets, config) {
    console.log(`🎯 Starting batch report for ${targets.length} targets`);
    
    const results = [];
    
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        DGXEONTheme.drawProgress(`Reporting ${target}`, i + 1, targets.length);
        
        try {
            const reportConfig = {
                targetUsername: target,
                scamType: config.scamType || 'scam',
                customMessage: config.customMessage || '',
                generateEvidence: config.generateEvidence || false
            };
            
            const result = await runMassReport(reportConfig);
            results.push({
                target: target,
                success: true,
                report_id: result.report_id
            });
            
            // Delay between reports
            if (i < targets.length - 1) {
                const delay = config.delayBetweenReports || 5000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
        } catch (error) {
            results.push({
                target: target,
                success: false,
                error: error.message
            });
            
            DGXEONTheme.log(`Failed to report ${target}: ${error.message}`, 'error');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    // Generate summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\x1b[1m\x1b[36m');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    BATCH REPORT SUMMARY                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Total: ${targets.length.toString().padEnd(10)} ✅ Success: ${successful.length.toString().padEnd(8)} ❌ Failed: ${failed.length.toString().padEnd(8)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');
    
    return results;
}

// ============================================
// MAIN APPLICATION
// ============================================
async function main() {
    DGXEONTheme.drawMenu();
    
    // Initialize Telegram bot
    const telegramHandler = new TelegramBotHandler();
    const telegramReady = await telegramHandler.initialize();
    
    if (telegramReady) {
        DGXEONTheme.log('Telegram Bot is running! Send /menu to your bot.', 'success');
    }
    
    // Also keep CLI functionality
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        const command = args[0];
        const config = {
            scamType: 'financial scam',
            generateEvidence: false,
            delayBetweenReports: 5000
        };
        
        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--type' && args[i + 1]) {
                config.scamType = args[i + 1];
                i++;
            } else if (args[i] === '--message' && args[i + 1]) {
                config.customMessage = args[i + 1];
                i++;
            } else if (args[i] === '--evidence') {
                config.generateEvidence = true;
            } else if (args[i] === '--delay' && args[i + 1]) {
                config.delayBetweenReports = parseInt(args[i + 1]);
                i++;
            }
        }
        
        switch (command) {
            case 'single':
                if (args[1] && !args[1].startsWith('--')) {
                    const username = args[1];
                    await runMassReport({
                        targetUsername: username,
                        ...config
                    });
                }
                break;
                
            case 'batch':
                if (args[1] && !args[1].startsWith('--')) {
                    const filePath = args[1];
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const targets = content
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line && !line.startsWith('#'));
                        
                        if (targets.length > 0) {
                            await runBatchReports(targets, config);
                        }
                    }
                }
                break;
        }
    } else {
        console.log('\x1b[33mSystem running in background. Telegram bot is active.\x1b[0m');
        console.log('\x1b[36mPress Ctrl+C to exit.\x1b[0m');
        
        // Keep process alive
        process.on('SIGINT', () => {
            DGXEONTheme.log('Shutting down DGXEON HOZOO MD System...', 'system');
            if (bot) {
                bot.stopPolling();
            }
            process.exit(0);
        });
    }
}

// ============================================
// PACKAGE.JSON UPDATE
// ============================================
/*
Add to package.json dependencies:
{
  "node-telegram-bot-api": "^0.61.0",
  "chalk": "^4.1.2"
}
*/

// ============================================
// ENVIRONMENT SETUP GUIDE
// ============================================
/*
1. Create .env file:
TELEGRAM_TOKEN=your_bot_token_here
CHAT_ID=your_chat_id_here

2. Install dependencies:
npm install node-telegram-bot-api chalk

3. Create Telegram Bot:
- Message @BotFather on Telegram
- Send /newbot
- Follow instructions
- Get the token

4. Get your Chat ID:
- Message @userinfobot on Telegram
- It will reply with your chat ID

5. Run the bot:
node tiktok_bot_telegram.js

6. Send /menu to your bot on Telegram
*/

if (require.main === module) {
    main().catch(error => {
        DGXEONTheme.log(`Fatal error: ${error.message}`, 'error');
        process.exit(1);
    });
}

module.exports = {
    TikTokReportBot,
    TelegramBotHandler,
    runMassReport,
    runBatchReports,
    LoadingAnimation,
    DGXEONTheme
};
