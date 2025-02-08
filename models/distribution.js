const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Distribution extends Model {}

Distribution.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    eventId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Events',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    xpAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 100000
        }
    },
    nameList: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    remark: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'Distribution',
    tableName: 'Distributions',
    timestamps: true
});

module.exports = Distribution; 