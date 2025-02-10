const { Client, GatewayIntentBits } = require('discord.js');

// Initialize Discord client with extended intents
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
console.log('Logger initialization started...');
console.log('Environment check:');
console.log('- DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'Set' : 'Not set');
console.log('- LOG_CHANNEL_ID:', process.env.LOG_CHANNEL_ID ? 'Set' : 'Not set');

// Log queue
let logQueue = [];
let clientReady = false;
let initializationPromise = null;
let initializationAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Handle client errors
client.on('error', error => {
    console.error('Discord client error:', error);
    clientReady = false;
});

client.on('disconnect', () => {
    console.log('Discord client disconnected');
    clientReady = false;
});

client.on('reconnecting', () => {
    console.log('Discord client reconnecting...');
});

// Client initialization function
async function initializeClient() {
    if (initializationPromise) {
        console.log('Using existing initialization promise');
        return initializationPromise;
    }

    if (initializationAttempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for Discord client initialization`);
        return Promise.resolve();
    }

    console.log(`Initializing Discord client (attempt ${initializationAttempts + 1}/${MAX_RETRY_ATTEMPTS})...`);
    initializationAttempts++;
    
    initializationPromise = new Promise((resolve, reject) => {
        const token = process.env.DISCORD_TOKEN;
        
        if (!token) {
            console.warn('DISCORD_TOKEN is not set in environment variables. Discord logging will be disabled.');
            resolve();
            return;
        }

        if (!LOG_CHANNEL_ID) {
            console.warn('LOG_CHANNEL_ID is not set in environment variables. Discord logging will be disabled.');
            resolve();
            return;
        }

        client.once('ready', async () => {
            console.log('Discord client ready. Bot username:', client.user.tag);
            try {
                const channel = await client.channels.fetch(LOG_CHANNEL_ID);
                if (channel) {
                    console.log('Successfully connected to log channel:', channel.name);
                    clientReady = true;
                    processLogQueue();
                } else {
                    console.error('Could not find log channel with ID:', LOG_CHANNEL_ID);
                }
            } catch (error) {
                console.error('Error fetching log channel:', error);
            }
            resolve();
        });

        console.log('Attempting to login with token:', token.substring(0, 10) + '...');
        
        client.login(token).catch(error => {
            console.error('Failed to login to Discord:', error);
            clientReady = false;
            initializationPromise = null;
            resolve();
        });
    });

    return initializationPromise;
}

// Process log queue
async function processLogQueue() {
    if (!clientReady) {
        console.log('Client not ready, waiting...');
        return;
    }
    
    if (logQueue.length === 0) {
        console.log('Log queue is empty');
        return;
    }

    console.log(`Processing log queue. Items in queue: ${logQueue.length}`);

    while (logQueue.length > 0) {
        const logData = logQueue.shift();
        try {
            console.log('Attempting to send log:', logData);
            await sendLogToDiscord(logData);
            console.log('Log sent successfully');
        } catch (error) {
            console.error('Error processing log from queue:', error);
            logQueue.unshift(logData);
            break;
        }
    }
}

// Function to send log to Discord
async function sendLogToDiscord(data) {
    const { action, userId, username, details } = data;
    
    try {
        if (!client.isReady()) {
            throw new Error('Discord client not ready');
        }

        console.log('Fetching log channel:', LOG_CHANNEL_ID);
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        
        if (!channel) {
            throw new Error('Could not find log channel: ' + LOG_CHANNEL_ID);
        }

        console.log('Channel found:', channel.name);
        
        const embedColor = Logger.getColorForAction(action);
        const embed = {
            title: `🔔 ${action}`,
            color: embedColor,
            fields: [
                {
                    name: 'User',
                    value: username || userId,
                    inline: true
                },
                {
                    name: 'Action',
                    value: action,
                    inline: true
                },
                {
                    name: 'Details',
                    value: formatDetails(details)
                }
            ],
            timestamp: new Date()
        };

        console.log('Sending embed:', embed);
        
        await channel.send({ embeds: [embed] });
        console.log('Log sent to Discord successfully');
        return true;
    } catch (error) {
        console.error('Error sending log to Discord:', error);
        console.error('Error details:', {
            clientReady: client.isReady(),
            channelId: LOG_CHANNEL_ID,
            action,
            userId,
            username
        });
        throw error;
    }
}

const Logger = {
    // Send log to Discord
    log: async (data) => {
        const { action, userId, username, details } = data;
        
        if (!userId) {
            throw new Error('UserId is required');
        }

        // Always log to console
        console.log('Log entry:', { action, userId, username, details });
        
        try {
            // Only try to initialize Discord client if we have a token
            if (process.env.DISCORD_TOKEN) {
                if (!clientReady) {
                    await initializeClient();
                }

                // Only add to queue if client is ready
                if (clientReady) {
                    logQueue.push(data);
                    await processLogQueue();
                }
            }
        } catch (error) {
            console.error('Error in log function:', error);
            // Still add to queue in case Discord becomes available later
            if (process.env.DISCORD_TOKEN) {
                logQueue.push(data);
            }
        }
    },

    // Helper functions
    getColorForAction: (action) => {
        const colors = {
            // Authentication
            'LOGIN': 0x00ff00,          // Green
            'LOGOUT': 0xff9900,         // Orange
            
            // Events
            'CREATE_EVENT': 0x00ccff,   // Cyan
            'EDIT_EVENT': 0xffcc00,     // Yellow
            'DELETE_EVENT': 0xff0000,   // Red
            'VIEW_EVENT': 0x999999,     // Gray
            
            // Whitelist
            'WHITELIST_ADD': 0x7289da,  // Discord Blurple
            'WHITELIST_REMOVE': 0xff6b6b, // Red
            
            // Distributions
            'ADD_DISTRIBUTION': 0x2ecc71, // Green
            'REMOVE_DISTRIBUTION': 0xe74c3c, // Red
            'EDIT_DISTRIBUTION': 0xf1c40f, // Yellow
            
            // Statuses
            'STATUS_CHANGE': 0x9b59b6,   // Purple

            // OP Distribution
            'SEND_OP': 0x1abc9c,        // Cyan
            'SEND_OP_FAILED': 0xe74c3c  // Red
        };
        return colors[action] || 0x7289da;
    }
};

function formatDetails(details) {
    if (typeof details === 'string') {
        return details;
    }
    if (typeof details === 'object') {
        return Object.entries(details)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join('\n');
    }
    return 'No details provided';
}

// Initialize client on startup
initializeClient().catch(error => {
    console.error('Failed to initialize Discord client:', error);
});

module.exports = Logger; 