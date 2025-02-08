module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Whitelist', 'global_name', {
            type: Sequelize.STRING,
            allowNull: true
        });
        
        await queryInterface.addColumn('Whitelist', 'avatar', {
            type: Sequelize.STRING,
            allowNull: true
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Whitelist', 'global_name');
        await queryInterface.removeColumn('Whitelist', 'avatar');
    }
}; 