const axios = require('axios');

async function testUpdateStatus() {
    console.log('Starting API test...');
    
    const url = 'http://localhost:3000/api/bot/events/1';
    const data = {
        status: 'Completed',
        editor: 'Bot',
        changes: 'Status updated to Completed'
    };
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': '13f0868c-0a20-4b17-a3f5-bac5c6dee4d0',
        'Accept': 'application/json'
    };

    console.log('Request URL:', url);
    console.log('Request headers:', headers);
    console.log('Request data:', data);

    try {
        // Сначала проверим, доступен ли сервер
        try {
            await axios.get('http://localhost:3000/');
            console.log('Server is accessible');
        } catch (error) {
            console.error('Server is not accessible. Make sure it is running on port 3000');
            return;
        }

        // Делаем основной запрос
        const response = await axios.put(url, data, { headers });
        
        console.log('\nResponse received:');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data:', response.data);
    } catch (error) {
        console.error('\nError occurred:');
        console.error('Message:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received');
            console.error('Request details:', error.request);
        }
    }
}

testUpdateStatus(); 