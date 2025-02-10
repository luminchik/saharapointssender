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
    title: {
        type: Sequelize.STRING,
        allowNull: false
    },
    eventDate: {
        type: Sequelize.DATE,
        allowNull: false
    },
    requestor: {
        type: Sequelize.STRING,
        allowNull: false
    },
    status: {
        type: Sequelize.STRING,
        defaultValue: 'Pending'
    },
    region: {
        type: Sequelize.STRING,
        defaultValue: 'Global'
    }
}, {
    tableName: 'Events'
});

const Distribution = sequelize.define('Distribution', {
    eventId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    xpAmount: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    nameList: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    remark: {
        type: Sequelize.TEXT
    }
}, {
    tableName: 'Distributions'
});

// Определяем связи
Event.hasMany(Distribution, { foreignKey: 'eventId', as: 'distributions' });
Distribution.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

const requestors = [
    'Alice Smith',
    'Bob Johnson',
    'Charlie Brown',
    'Diana Wilson',
    'Edward Davis',
    'Frank Miller',
    'Grace Taylor',
    'Henry White',
    'Ivy Green',
    'Jack Black'
];

const eventTitles = [
    'Community Event',
    'Gaming Tournament',
    'Weekly Meeting',
    'Special Workshop',
    'Training Session',
    'Team Building',
    'Strategy Planning',
    'Project Review',
    'Tech Talk',
    'Social Gathering'
];

const statuses = ['Pending', 'Completed', 'Rejected'];

// Function to generate random date within last 6 months
function getRandomDate() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Function to generate random number between min and max
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to create a single event
async function createEvent(index) {
    const transaction = await sequelize.transaction();
    
    try {
        const eventDate = getRandomDate();
        const event = await Event.create({
            title: `${eventTitles[Math.floor(Math.random() * eventTitles.length)]} #${index}`,
            eventDate: eventDate,
            requestor: requestors[Math.floor(Math.random() * requestors.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            region: 'Global'
        }, { transaction });

        // Create 1-3 distributions for each event
        const numDistributions = getRandomNumber(1, 3);
        for (let i = 0; i < numDistributions; i++) {
            await Distribution.create({
                eventId: event.id,
                xpAmount: getRandomNumber(100, 1000),
                nameList: `User${i * 3 + 1}\nUser${i * 3 + 2}\nUser${i * 3 + 3}`,
                remark: `Test distribution ${i + 1}`
            }, { transaction });
        }

        await transaction.commit();
        console.log(`Created event #${index} with ${numDistributions} distributions`);
        return event;
    } catch (error) {
        await transaction.rollback();
        console.error(`Error creating event #${index}:`, error.message);
        return null;
    }
}

// Main function to create all events
async function createTestEvents() {
    console.log('Starting to create test events...');
    console.log('Using database URL:', process.env.DATABASE_URL);
    
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection established');
        
        for (let i = 1; i <= 100; i++) {
            await createEvent(i);
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.error('Failed to create test events:', error);
    } finally {
        await sequelize.close();
    }
    
    console.log('Finished creating test events');
}

// Run the script
createTestEvents().catch(console.error); 