const { logActivity } = require('./logController');

// В функции addToWhitelist добавляем логирование
const addToWhitelist = async (req, res) => {
    try {
        // ... существующий код добавления в вайтлист ...

        // Логируем добавление в вайтлист
        await logActivity(
            'whitelist',
            req.user.username,
            'Added user to whitelist',
            `Added user ID: ${userId}`,
            req
        );

        res.json({ message: 'User added to whitelist' });
    } catch (error) {
        console.error('Whitelist add error:', error);
        res.status(500).json({ error: 'Failed to add user to whitelist' });
    }
};

// В функции removeFromWhitelist добавляем логирование
const removeFromWhitelist = async (req, res) => {
    try {
        // ... существующий код удаления из вайтлиста ...

        // Логируем удаление из вайтлиста
        await logActivity(
            'whitelist',
            req.user.username,
            'Removed user from whitelist',
            `Removed user ID: ${userId}`,
            req
        );

        res.json({ message: 'User removed from whitelist' });
    } catch (error) {
        console.error('Whitelist remove error:', error);
        res.status(500).json({ error: 'Failed to remove user from whitelist' });
    }
}; 