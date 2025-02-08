const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const path = require('path');
const sequelize = require('./config/database');
const models = require('./models');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
require('dotenv').config();
const { Whitelist, Logger } = models;
const checkWhitelist = require('./middleware/checkWhitelist');
const Sequelize = require('sequelize');
const initializeDatabase = require('./scripts/init-db');

// Auth middleware definition
function requireAuth(req, res, next) {
    // Debug authentication state
    console.log('Auth check for:', req.path);
    console.log('Session:', req.session);
    console.log('Is Authenticated:', req.isAuthenticated());
    console.log('User:', req.user);

    if (!req.isAuthenticated()) {
        // For API requests
        if (req.xhr || req.path.startsWith('/api/')) {
            console.log('Unauthorized API request');
            return res.status(401).json({ 
                error: 'Not authenticated',
                redirect: '/login'
            });
        }
        // For page requests
        console.log('Redirecting to login');
        return res.redirect('/login');
    }

    // Check if user is in whitelist
    if (!req.user) {
        console.log('No user object found');
        return res.status(401).json({ error: 'User not found' });
    }

    next();
}

// Debug: Print all environment variables (excluding sensitive ones)
console.log('Environment Variables:');
for (const key in process.env) {
    if (!key.includes('SECRET') && !key.includes('TOKEN') && !key.includes('PASSWORD')) {
        console.log(`${key}: ${process.env[key] ? 'Set' : 'Not Set'}`);
    } else {
        console.log(`${key}: [HIDDEN]`);
    }
}

const app = express();

// Move session and passport middleware to be initialized early
const DISCORD_CONFIG = {
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || 'https://saharapointssender.onrender.com/auth/discord/callback',
    scope: ['identify'],
    proxy: true
};

// Session configuration with SQLite store
const sessionConfig = {
    store: new SequelizeStore({
        db: sequelize,
        tableName: 'Sessions',
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: 24 * 60 * 60 * 1000,
        extendDefaultFields: (defaults, session) => ({
            ...defaults,
            userId: session.userId,
            state: session.state
        })
    }),
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    rolling: true,
    name: 'sahara.sid',
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/'
    }
};

// Initialize the application
async function initializeApp() {
    try {
        // Ensure Sessions table exists with force sync
        await sequelize.query('DROP TABLE IF EXISTS Sessions;');
        await sequelize.sync({ force: false }).then(() => {
            console.log('Session store synchronized');
        }).catch(err => {
            console.error('Failed to sync session store:', err);
        });

        app.use(session(sessionConfig));
        app.use(passport.initialize());
        app.use(passport.session());

        // Increase timeout for the server
        app.timeout = 120000; // 2 minutes

        // Global error handlers
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
            if (err.code === 'ECONNRESET') {
                console.log('Connection reset by peer - continuing to serve');
            }
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Connection timeout middleware
        app.use((req, res, next) => {
            req.connection.setTimeout(120000); // 2 minutes
            res.setTimeout(120000, () => {
                console.log('Request timeout');
                res.status(408).send('Request timeout');
            });
            next();
        });

        // Increase payload limits
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Whitelist routes should be accessible without authentication
        app.use('/', require('./routes/whitelist'));

        // Bot API routes (no auth required, only API key)
        app.use('/api/bot', require('./routes/api'));

        // Protected API routes (require authentication)
        app.use('/api', requireAuth, require('./routes/protected'));

        // Configure Discord Strategy with improved error handling
        try {
            passport.use(new DiscordStrategy({
                clientID: DISCORD_CONFIG.clientID,
                clientSecret: DISCORD_CONFIG.clientSecret,
                callbackURL: DISCORD_CONFIG.callbackURL,
                scope: DISCORD_CONFIG.scope,
                proxy: DISCORD_CONFIG.proxy
            }, async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log('Discord auth callback for user:', profile.id);
                    console.log('Profile data:', {
                        id: profile.id,
                        username: profile.username,
                        global_name: profile.global_name,
                        avatar: profile.avatar
                    });
                    
                    // Check if user exists in whitelist before proceeding
                    let whitelistedUser = await Whitelist.findByPk(profile.id);
                    if (!whitelistedUser) {
                        console.log('User not in whitelist:', profile.id);
                        return done(null, false, { message: 'User not whitelisted' });
                    }

                    // Update user data in whitelist
                    await whitelistedUser.update({
                        username: profile.username,
                        global_name: profile.global_name,
                        avatar: profile.avatar
                    });

                    // Store the user data
                    const userData = {
                        id: profile.id,
                        username: profile.username,
                        global_name: profile.global_name,
                        avatar: profile.avatar,
                        accessToken
                    };

                    console.log('Storing user data:', userData);
                    return done(null, userData);
                } catch (error) {
                    console.error('Error in Discord strategy callback:', error);
                    return done(error, null);
                }
            }));

            // Serialize user data
            passport.serializeUser((user, done) => {
                console.log('Serializing user:', user);
                done(null, user);
            });

            // Deserialize with improved error handling
            passport.deserializeUser(async (user, done) => {
                console.log('Deserializing user:', user);
                try {
                    const whitelistedUser = await Whitelist.findByPk(user.id);
                    if (!whitelistedUser) {
                        console.log('User not found in whitelist during deserialization:', user.id);
                        return done(null, false);
                    }
                    
                    return done(null, {
                        id: user.id,
                        username: user.username,
                        global_name: user.global_name,
                        avatar: user.avatar,
                        accessToken: user.accessToken
                    });
                } catch (error) {
                    console.error('Error deserializing user:', error);
                    return done(error, null);
                }
            });
        } catch (error) {
            console.error('Error configuring Discord strategy:', error);
            throw error; // Let the serverless function fail if Discord strategy cannot be configured
        }

        // Debug middleware
        app.use((req, res, next) => {
            console.log('Request path:', req.path);
            console.log('Session ID:', req.sessionID);
            console.log('Session:', req.session);
            console.log('Is Authenticated:', req.isAuthenticated());
            console.log('User:', req.user);
            next();
        });

        // Helper function to safely resolve file paths
        const resolvePath = (...paths) => {
            try {
                return path.join(process.cwd(), ...paths);
            } catch (error) {
                console.error('Error resolving path:', error);
                return path.join(__dirname, ...paths);
            }
        };

        // Routes for static pages
        app.get('/', (req, res) => {
            res.sendFile(resolvePath('public', 'index.html'));
        });

        app.get('/create', requireAuth, async (req, res) => {
            try {
                if (!req.isAuthenticated()) {
                    return res.redirect('/login');
                }
                res.sendFile(resolvePath('public', 'create-event.html'));
            } catch (error) {
                console.error('Error serving create page:', error);
                res.status(500).sendFile(resolvePath('public', 'error.html'));
            }
        });

        app.get('/edit-event/:id', requireAuth, async (req, res) => {
            try {
                if (!req.isAuthenticated()) {
                    return res.redirect('/login');
                }
                res.sendFile(resolvePath('public', 'edit-event.html'));
            } catch (error) {
                console.error('Error serving edit page:', error);
                res.status(500).sendFile(resolvePath('public', 'error.html'));
            }
        });

        app.get('/leaderboard', requireAuth, async (req, res) => {
            try {
                if (!req.isAuthenticated()) {
                    return res.redirect('/login');
                }
                res.sendFile(resolvePath('public', 'leaderboard.html'));
            } catch (error) {
                console.error('Error serving leaderboard page:', error);
                res.status(500).sendFile(resolvePath('public', 'error.html'));
            }
        });

        app.get('/login', (req, res) => {
            try {
                if (req.isAuthenticated()) {
                    return res.redirect('/');
                }
                res.sendFile(resolvePath('public', 'login.html'));
            } catch (error) {
                console.error('Error serving login page:', error);
                res.status(500).sendFile(resolvePath('public', 'error.html'));
            }
        });

        // Serve static files with proper path resolution
        app.use(express.static(resolvePath('public')));
        app.use('/js', express.static(resolvePath('public/js')));
        app.use('/css', express.static(resolvePath('public/css')));

        // API Routes
        app.get('/api/user', requireAuth, (req, res) => {
            try {
                if (!req.user) {
                    console.log('No user found in request');
                    return res.status(401).json({ error: 'User not authenticated' });
                }
                res.json({
                    id: req.user.id,
                    username: req.user.username,
                    global_name: req.user.global_name || req.user.username,
                    avatar: req.user.avatar
                });
            } catch (err) {
                console.error('Error in /api/user route:', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Discord OAuth routes
        app.get('/auth/discord', async (req, res, next) => {
            try {
                // Generate and store state with timestamp
                const state = Math.random().toString(36).substring(7);
                req.session.state = state;
                req.session.stateTimestamp = Date.now();
                
                // Force session save
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session state:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });
                
                // Debug state generation
                console.log('Generated state:', state);
                console.log('Session after state set:', req.session);
                console.log('Session ID:', req.sessionID);
                
                // Set cookie explicitly
                res.cookie('sahara.sid', req.sessionID, {
                    maxAge: 24 * 60 * 60 * 1000,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/'
                });
                
                passport.authenticate('discord', {
                    state,
                    scope: ['identify']
                })(req, res, next);
            } catch (error) {
                console.error('Error in /auth/discord route:', error);
                res.redirect('/login?error=auth_error');
            }
        });

        app.get('/auth/discord/callback',
            async (req, res, next) => {
                // Debug state validation
                console.log('Callback State Check:');
                console.log('Query state:', req.query.state);
                console.log('Session:', req.session);
                console.log('Session ID:', req.sessionID);
                console.log('Session state:', req.session?.state);
                console.log('State timestamp:', req.session?.stateTimestamp);
                
                if (!req.session) {
                    console.error('No session found');
                    return res.redirect('/login?error=no_session');
                }
                
                if (!req.session.state) {
                    console.error('No state in session');
                    console.error('Available session data:', req.session);
                    return res.redirect('/login?error=session_expired');
                }
                
                if (!req.query.state) {
                    console.error('No state in query');
                    return res.redirect('/login?error=missing_state');
                }
                
                // Check if state is expired (more than 5 minutes old)
                const stateAge = Date.now() - (req.session.stateTimestamp || 0);
                if (stateAge > 5 * 60 * 1000) {
                    console.error('State expired');
                    return res.redirect('/login?error=state_expired');
                }
                
                if (req.query.state !== req.session.state) {
                    console.error('State mismatch');
                    console.error('Expected:', req.session.state);
                    console.error('Received:', req.query.state);
                    return res.redirect('/login?error=invalid_state');
                }
                
                next();
            },
            passport.authenticate('discord', {
                failureRedirect: '/login?error=auth_failed',
                failureMessage: true
            }),
            async (req, res) => {
                try {
                    if (!req.user) {
                        console.error('No user data after authentication');
                        return res.redirect('/login?error=no_user_data');
                    }

                    const whitelistedUser = await Whitelist.findByPk(req.user.id);
                    if (whitelistedUser) {
                        // Clear state after successful authentication
                        delete req.session.state;
                        delete req.session.stateTimestamp;
                        
                        // Store user ID in session
                        req.session.userId = req.user.id;
                        
                        // Log successful login
                        console.log('Attempting to log successful login...');
                        try {
                            await Logger.log({
                                action: 'LOGIN',
                                userId: req.user.id,
                                username: req.user.username || req.user.global_name,
                                details: {
                                    method: 'Discord OAuth',
                                    timestamp: new Date().toISOString(),
                                    ip: req.ip,
                                    userAgent: req.get('User-Agent')
                                }
                            });
                            console.log('Login logged successfully');
                        } catch (logError) {
                            console.error('Error logging login:', logError);
                        }
                        
                        // Ensure session is saved before redirect
                        await new Promise((resolve, reject) => {
                            req.session.save((err) => {
                                if (err) {
                                    console.error('Error saving session:', err);
                                    reject(err);
                                    return;
                                }
                                resolve();
                            });
                        });
                        
                        res.redirect('/');
                    } else {
                        req.logout((err) => {
                            if (err) {
                                console.error('Logout error:', err);
                                return res.status(500).send('Server error');
                            }
                            res.redirect('/login?error=unauthorized');
                        });
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                    res.redirect('/login?error=server_error');
                }
            }
        );

        // Logout route with improved error handling
        app.get('/auth/logout', async (req, res) => {
            try {
                await new Promise((resolve, reject) => {
                    req.logout((err) => {
                        if (err) {
                            console.error('Logout error:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });

                await new Promise((resolve, reject) => {
                    req.session.destroy((err) => {
                        if (err) {
                            console.error('Session destruction error:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });

                res.redirect('/login');
            } catch (error) {
                console.error('Error during logout:', error);
                res.status(500).json({ error: 'Logout failed' });
            }
        });

        // Error handling middleware
        app.use((req, res, next) => {
            res.status(404).sendFile(resolvePath('public', 'error.html'));
        });

        app.use((err, req, res, next) => {
            console.error('Server error:', err);
            if (req.xhr || req.path.startsWith('/api/')) {
                res.status(err.status || 500).json({
                    error: 'Internal server error',
                    message: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            } else {
                res.status(err.status || 500).sendFile(resolvePath('public', 'error.html'));
            }
        });

        // Set server timeout
        const server = app.listen(process.env.PORT || 3000, async () => {
            try {
                console.log('Initializing database...');
                await initializeDatabase();
                console.log(`Server is running on port ${process.env.PORT || 3000}`);
            } catch (error) {
                console.error('Failed to initialize database:', error);
                process.exit(1);
            }
        });
        server.timeout = 120000; // 2 minutes

        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.log('Address in use, retrying...');
                setTimeout(() => {
                    server.close();
                    server.listen(process.env.PORT || 3000);
                }, 1000);
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing HTTP server');
            server.close(() => {
                console.log('HTTP server closed');
                sequelize.close().then(() => {
                    console.log('Database connection closed');
                    process.exit(0);
                });
            });
        });
    } catch (error) {
        console.error('Error initializing application:', error);
        process.exit(1);
    }
}

// Start the application
initializeApp().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
}); 