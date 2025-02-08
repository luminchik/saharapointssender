const axios = require('axios');

const userId = '939541836979122216'; // Discord ID
const secret = 'Kj8mP9$vL2@nX5&cF4^hR7*qW3!';

async function addToWhitelist() {
    console.log('Starting whitelist addition process...');
    console.log('User ID:', userId);
    
    try {
        // Проверяем входные данные
        if (!userId || !secret) {
            throw new Error('Missing required parameters (userId or secret)');
        }

        const encodedSecret = encodeURIComponent(secret);
        const url = `http://localhost:3000/whitelist/${userId}/${encodedSecret}`;
        
        console.log('\nRequest details:');
        console.log('URL:', url);
        console.log('Secret (encoded):', encodedSecret);

        console.log('\nSending request...');
        const response = await axios.get(url);
        
        console.log('\nResponse received:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\nOperation successful!');
            if (response.data.created) {
                console.log('✅ User was successfully added to whitelist');
            } else {
                console.log('ℹ️ User was already in whitelist');
            }
        } else {
            console.log('\n⚠️ Operation completed but returned unsuccessful status');
        }
    } catch (error) {
        console.error('\n❌ Error occurred:');
        
        if (error.response) {
            // Ответ сервера с ошибкой
            console.error('Server responded with error:');
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            // Запрос был сделан, но ответ не получен
            console.error('No response received from server');
            console.error('Request details:', error.request);
        } else {
            // Ошибка при подготовке запроса
            console.error('Error setting up request:', error.message);
        }
        
        console.error('\nFull error details:');
        console.error('Message:', error.message);
        console.error('Name:', error.name);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

// Добавляем обработку необработанных ошибок
process.on('unhandledRejection', (error) => {
    console.error('\n⚠️ Unhandled Promise Rejection:');
    console.error(error);
});

console.log('='.repeat(50));
console.log('Whitelist Addition Test Script');
console.log('='.repeat(50));

addToWhitelist(); 