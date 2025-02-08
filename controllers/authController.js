const { logActivity } = require('./logController');

// В функции login добавляем логирование
const login = async (req, res) => {
    try {
        // ... существующий код авторизации ...

        // Логируем успешный вход
        await logActivity(
            'login',
            user.username,
            'User logged in',
            `IP: ${req.ip}`,
            req
        );

        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// В функции logout добавляем логирование
const logout = async (req, res) => {
    try {
        // ... существующий код выхода ...

        // Логируем выход
        await logActivity(
            'login',
            req.user.username,
            'User logged out',
            '',
            req
        );

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
}; 