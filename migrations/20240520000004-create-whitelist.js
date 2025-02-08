module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Whitelists', {
            userId: {
                type: Sequelize.STRING,
                primaryKey: true,
                allowNull: false
            },
            addedBy: {
                type: Sequelize.STRING,
                allowNull: false
            },
            addedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('Whitelists');
    }
}; 