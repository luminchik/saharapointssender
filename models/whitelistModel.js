const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Whitelist extends Model {}

Whitelist.init({
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    global_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addedBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    addedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Whitelist',
    tableName: 'Whitelist',
    timestamps: true
});

module.exports = Whitelist; 