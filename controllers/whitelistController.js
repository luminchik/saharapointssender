const { Whitelist } = require('../models');
const { logActivity } = require('./logController');

// Add user to whitelist
const addToWhitelist = async (req, res) => {
    try {
        const { userId, username, global_name, avatar } = req.body;

        // Create or update whitelist entry
        const [whitelist, created] = await Whitelist.findOrCreate({
            where: { userId },
            defaults: {
                username,
                global_name,
                avatar,
                addedBy: req.user.id
            }
        });

        // If user already exists, update their information
        if (!created) {
            await whitelist.update({
                username,
                global_name,
                avatar,
                addedBy: req.user.id
            });
        }

        // Log whitelist addition
        await logActivity(
            'whitelist',
            req.user.username,
            'Added user to whitelist',
            `Added user ID: ${userId}, Username: ${username}`,
            req
        );

        res.json({ 
            success: true, 
            message: created ? 'User added to whitelist' : 'User information updated',
            whitelist 
        });
    } catch (error) {
        console.error('Whitelist add error:', error);
        res.status(500).json({ error: 'Failed to add user to whitelist' });
    }
};

// Remove user from whitelist
const removeFromWhitelist = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user in whitelist
        const whitelist = await Whitelist.findByPk(userId);
        if (!whitelist) {
            return res.status(404).json({ error: 'User not found in whitelist' });
        }

        // Remove user from whitelist
        await whitelist.destroy();

        // Log whitelist removal
        await logActivity(
            'whitelist',
            req.user.username,
            'Removed user from whitelist',
            `Removed user ID: ${userId}`,
            req
        );

        res.json({ 
            success: true, 
            message: 'User removed from whitelist' 
        });
    } catch (error) {
        console.error('Whitelist remove error:', error);
        res.status(500).json({ error: 'Failed to remove user from whitelist' });
    }
};

// Check if user is in whitelist
const checkWhitelist = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check user existence in whitelist
        const whitelist = await Whitelist.findByPk(userId);

        res.json({ 
            inWhitelist: !!whitelist,
            user: whitelist
        });
    } catch (error) {
        console.error('Whitelist check error:', error);
        res.status(500).json({ error: 'Failed to check whitelist status' });
    }
};

// Get all whitelisted users
const getWhitelistedUsers = async (req, res) => {
    try {
        // Fetch all whitelisted users
        const users = await Whitelist.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.json({ users });
    } catch (error) {
        console.error('Whitelist fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch whitelisted users' });
    }
};

module.exports = {
    addToWhitelist,
    removeFromWhitelist,
    checkWhitelist,
    getWhitelistedUsers
}; 
