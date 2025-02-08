const { Client, GatewayIntentBits } = require('discord.js');

// Инициализация Discord клиента с расширенными интентами
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
console.log('Logger initialized with channel ID:', LOG_CHANNEL_ID);

// Очередь логов
let logQueue = [];
let clientReady = false;
let initializationPromise = null;
let initializationAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Функция инициализации клиента
async function initializeClient() {
    if (initializationPromise) {
        return initializationPromise;
    }

    if (initializationAttempts >= MAX_RETRY_ATTEMPTS) {
        console.warn('Max retry attempts reached for Discord client initialization');
        return Promise.resolve(); // Allow the application to continue without Discord logging
    }

    console.log('Initializing Discord client for logging...');
    initializationAttempts++;
    
    initializationPromise = new Promise((resolve, reject) => {
        const token = process.env.DISCORD_TOKEN;
        
        // Validate token
        if (!token) {
            console.warn('DISCORD_TOKEN is not set in environment variables. Discord logging will be disabled.');
            resolve(); // Allow the application to continue without Discord logging
            return;
        }

        // Set up event handlers before login
        client.once('ready', () => {
            console.log('Bot is ready for logging. Bot username:', client.user.tag);
            clientReady = true;
            processLogQueue();
            resolve();
        });

        client.on('error', (error) => {
            console.error('Discord client error:', error);
            clientReady = false;
            // Don't reject here, just log the error
        });

        console.log('Attempting to login with token:', token.substring(0, 10) + '...');
        
        client.login(token).catch(error => {
            console.error('Failed to login to Discord:', error);
            clientReady = false;
            initializationPromise = null; // Allow retry on next attempt
            resolve(); // Allow the application to continue without Discord logging
        });
    });

    return initializationPromise;
}

// Обработка очереди логов
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

// Функция отправки лога в Discord
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

// Обработка ошибок клиента
client.on('error', error => {
    console.error('Discord client error:', error);
    clientReady = false;
});

const Logger = {
    // Отправка лога в Discord
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

    // Вспомогательные функции
    getColorForAction: (action) => {
        const colors = {
            // Аутентификация
            'LOGIN': 0x00ff00,          // Зеленый
            'LOGOUT': 0xff9900,         // Оранжевый
            
            // События
            'CREATE_EVENT': 0x00ccff,   // Голубой
            'EDIT_EVENT': 0xffcc00,     // Желтый
            'DELETE_EVENT': 0xff0000,   // Красный
            'VIEW_EVENT': 0x999999,     // Серый
            
            // Вайтлист
            'WHITELIST_ADD': 0x7289da,  // Discord Blurple
            'WHITELIST_REMOVE': 0xff6b6b, // Красный
            
            // Распределения
            'ADD_DISTRIBUTION': 0x2ecc71, // Зеленый
            'REMOVE_DISTRIBUTION': 0xe74c3c, // Красный
            'EDIT_DISTRIBUTION': 0xf1c40f, // Желтый
            
            // Статусы
            'STATUS_CHANGE': 0x9b59b6,   // Фиолетовый

            // OP Distribution
            'SEND_OP': 0x1abc9c,        // Бирюзовый
            'SEND_OP_FAILED': 0xe74c3c  // Красный
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

// Инициализируем клиент при запуске
initializeClient().catch(error => {
    console.error('Failed to initialize Discord client:', error);
});

module.exports = Logger; 