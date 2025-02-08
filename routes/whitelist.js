const express = require('express');
const router = express.Router();
const { Whitelist } = require('../models');

// Middleware для проверки секретного ключа
const checkWhitelistSecret = (req, res, next) => {
    try {
        const { secret } = req.params;
        if (!secret) {
            console.error('No secret provided');
            return res.status(401).json({ 
                error: 'Missing secret',
                message: 'Secret key is required'
            });
        }

        // Декодируем секретный ключ из URL
        const decodedSecret = decodeURIComponent(secret);
        console.log('Checking whitelist secret...');
        
        if (decodedSecret !== process.env.WHITELIST_SECRET) {
            console.error('Invalid secret provided');
            return res.status(401).json({ 
                error: 'Invalid secret',
                message: 'The provided secret key is invalid'
            });
        }

        console.log('Secret validated successfully');
        next();
    } catch (error) {
        console.error('Error in secret check:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: 'An error occurred while validating the secret key'
        });
    }
};

// Добавление пользователя в вайтлист
router.get('/whitelist/:userId/:secret', checkWhitelistSecret, async (req, res) => {
    console.log('Processing whitelist addition request...');
    try {
        const { userId } = req.params;
        
        if (!userId) {
            console.error('No userId provided');
            return res.status(400).json({ 
                error: 'Missing userId',
                message: 'User ID is required'
            });
        }

        console.log('Checking if user exists in whitelist:', userId);
        const [whitelist, created] = await Whitelist.findOrCreate({
            where: { userId: userId },
            defaults: {
                userId: userId,
                addedBy: 'system',
                username: null,
                global_name: null,
                avatar: null
            }
        });

        // Если пользователь уже существует, обновляем его данные
        if (!created && req.body.username) {
            await whitelist.update({
                username: req.body.username,
                global_name: req.body.global_name,
                avatar: req.body.avatar
            });
        }

        const result = { 
            success: true, 
            created,
            message: created ? 'User successfully added to whitelist' : 'User was already in whitelist',
            userId,
            user: {
                username: whitelist.username,
                global_name: whitelist.global_name,
                avatar: whitelist.avatar
            }
        };

        console.log('Whitelist operation completed:', result);
        res.json(result);
    } catch (error) {
        console.error('Error in whitelist addition:', error);
        res.status(500).json({ 
            error: 'Database error',
            message: 'Failed to add user to whitelist',
            details: error.message
        });
    }
});

// Удаление пользователя из вайтлиста
router.delete('/whitelist/:userId/:secret', checkWhitelistSecret, async (req, res) => {
    try {
        const { userId } = req.params;
        const deleted = await Whitelist.destroy({
            where: { userId: userId }
        });

        res.json({ success: true, deleted: deleted > 0 });
    } catch (error) {
        console.error('Error removing user from whitelist:', error);
        res.status(500).json({ error: error.message });
    }
});

// Проверка пользователя в вайтлисте
router.get('/whitelist-check/:userId/:secret', checkWhitelistSecret, async (req, res) => {
    try {
        const { userId } = req.params;
        const entry = await Whitelist.findOne({
            where: { userId: userId }
        });
        
        res.json({ inWhitelist: !!entry });
    } catch (error) {
        console.error('Error checking whitelist:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получение списка пользователей в вайтлисте
router.get('/whitelist-list/:secret', checkWhitelistSecret, async (req, res) => {
    try {
        const users = await Whitelist.findAll();
        res.json({ users: users.map(u => u.userId) });
    } catch (error) {
        console.error('Error getting whitelist:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 