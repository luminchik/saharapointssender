const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Event extends Model {}

Event.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 100]
        }
    },
    eventDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    requestor: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 50]
        }
    },
    region: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Global'
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Pending',
        validate: {
            isIn: [['Pending', 'Completed', 'Rejected']]
        }
    },
    lastEditor: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastChange: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'Event',
    tableName: 'Events',
    timestamps: true
});

module.exports = Event; 