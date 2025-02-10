const { Sequelize } = require('sequelize');
require('dotenv').config();

// Создаем подключение к продакшн базе данных
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

// Определяем модели
const Event = sequelize.define('Event', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    }
}, {
    tableName: 'Events'
});

const Distribution = sequelize.define('Distribution', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    eventId: {
        type: Sequelize.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'Distributions'
});

// Определяем связи
Event.hasMany(Distribution, { foreignKey: 'eventId', as: 'distributions', onDelete: 'CASCADE' });
Distribution.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

async function deleteAllEvents() {
    console.log('Starting deletion of all events...');
    console.log('Using database URL:', process.env.DATABASE_URL);
    
    const transaction = await sequelize.transaction();
    
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection established');

        // Get count of events before deletion
        const eventCount = await Event.count({ transaction });
        console.log(`Found ${eventCount} events to delete`);

        // Delete all distributions first
        const deletedDistributions = await Distribution.destroy({
            where: {},
            transaction
        });
        console.log(`Deleted ${deletedDistributions} distributions`);

        // Delete all events
        const deletedEvents = await Event.destroy({
            where: {},
            transaction
        });
        console.log(`Deleted ${deletedEvents} events`);

        // Reset the sequences
        await sequelize.query('ALTER SEQUENCE "Events_id_seq" RESTART WITH 1;', { transaction });
        await sequelize.query('ALTER SEQUENCE "Distributions_id_seq" RESTART WITH 1;', { transaction });
        console.log('Reset ID sequences to 1');

        // Commit the transaction
        await transaction.commit();
        console.log('Successfully deleted all events and their distributions');
        console.log('ID counters have been reset - new events will start from ID 1');
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();
        console.error('Failed to delete events:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the script
deleteAllEvents().catch(console.error); 