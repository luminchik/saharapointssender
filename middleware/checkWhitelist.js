const { Whitelist } = require('../models');

const checkWhitelist = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }

    try {
        const whitelistedUser = await Whitelist.findByPk(req.user.id);
        if (!whitelistedUser) {
            req.logout((err) => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.status(500).send('Server error');
                }
                return res.redirect('/login?error=unauthorized');
            });
            return;
        }
        next();
    } catch (error) {
        console.error('Whitelist check error:', error);
        res.status(500).send('Server error');
    }
};

module.exports = checkWhitelist; 