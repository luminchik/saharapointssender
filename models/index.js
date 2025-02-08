const Sequelize = require('sequelize');
const path = require('path');
const sequelize = require('../config/database');

// Import models with explicit file extensions
const Event = require('./event.js');
const Distribution = require('./distribution.js');
const Whitelist = require('./whitelistModel.js');

// Define model associations
Event.hasMany(Distribution, {
    foreignKey: 'eventId',
    as: 'distributions',
    onDelete: 'CASCADE'
});

Distribution.belongsTo(Event, {
    foreignKey: 'eventId',
    as: 'event'
});

module.exports = {
    Event,
    Distribution,
    Whitelist,
    sequelize,
    Sequelize
}; 