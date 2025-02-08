const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const models = require('../models');

async function initializeDatabase() {
    console.log('Starting database initialization...');
    console.log('Node ENV:', process.env.NODE_ENV);
    
    try {
        // Test database connection
        console.log('Testing database connection...');
        await sequelize.authenticate();
        console.log('Database connection OK!');

        // Sync all models with force: false to preserve data
        console.log('Syncing database models...');
        await sequelize.sync({ force: false, alter: true });
        console.log('Database sync complete!');

        // Проверяем существующие данные
        console.log('\nChecking existing data:');
        
        // Проверяем таблицу Whitelist
        const whitelistCount = await models.Whitelist.count();
        console.log('Whitelist entries:', whitelistCount);
        
        // Проверяем таблицу Events
        const eventCount = await models.Event.count();
        console.log('Event entries:', eventCount);
        
        // Проверяем таблицу Distributions
        const distributionCount = await models.Distribution.count();
        console.log('Distribution entries:', distributionCount);

        // Create initial whitelist entry if needed
        const adminId = process.env.ADMIN_DISCORD_ID || '939541836979122216';
        const [user, created] = await models.Whitelist.findOrCreate({
            where: { userId: adminId },
            defaults: {
                userId: adminId,
                username: 'Admin',
                addedBy: 'system',
                addedAt: new Date()
            }
        });

        if (created) {
            console.log('Created initial admin user in whitelist');
        } else {
            console.log('Admin user already exists in whitelist');
        }

        // Verify database is writable by testing each model
        console.log('\nTesting database write access for each model:');
        
        try {
            // Тест Whitelist
            const testWhitelist = await models.Whitelist.build();
            await testWhitelist.validate();
            console.log('Whitelist table is writable');
            
            // Тест Event
            const testEvent = await models.Event.build();
            await testEvent.validate();
            console.log('Event table is writable');
            
            // Тест Distribution
            const testDistribution = await models.Distribution.build();
            await testDistribution.validate();
            console.log('Distribution table is writable');
        } catch (error) {
            console.error('Database write test failed:', error);
        }

        // Проверяем, что все таблицы существуют
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('\nExisting tables in database:', tables);

        console.log('\nDatabase initialization complete!');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Run if this script is called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Database setup completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = initializeDatabase; 