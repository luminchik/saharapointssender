const express = require('express');
const router = express.Router();
const { Event, Distribution, Log } = require('../models');
const Logger = require('../utils/logger');

// Middleware для проверки API ключа бота
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    console.log('Checking API key:', apiKey ? 'Present' : 'Missing');
    
    if (!apiKey || apiKey !== process.env.ENGAGE_API_TOKEN) {
        console.log('API key validation failed');
        return res.status(401).json({ 
            error: 'Invalid API key',
            message: 'Please provide a valid API key'
        });
    }
    console.log('API key validation successful');
    next();
};

// Bot routes (no auth required, only API key)
router.get('/events/:id', checkApiKey, async (req, res) => {
    try {
        console.log(`Fetching event ${req.params.id} for bot`);
        const event = await Event.findByPk(req.params.id, {
            include: [{
                model: Distribution,
                as: 'distributions'
            }]
        });
        
        if (!event) {
            console.log(`Event ${req.params.id} not found`);
            return res.status(404).json({ error: 'Event not found' });
        }

        console.log('Event found:', event.id);
        res.json(event);
    } catch (error) {
        console.error('Error fetching event for bot:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/events/:id', checkApiKey, async (req, res) => {
    console.log('\n=== Status Update Request ===');
    console.log('Received status update request for event:', req.params.id);
    console.log('Request body:', req.body);
    
    try {
        const { id } = req.params;
        const { status, editor, changes } = req.body;
        
        if (!status) {
            console.log('Status field is missing');
            return res.status(400).json({ error: 'Status field is required' });
        }
        
        const validStatuses = ['Pending', 'Completed', 'Rejected'];
        if (!validStatuses.includes(status)) {
            console.log('Invalid status value:', status);
            return res.status(400).json({ 
                error: 'Invalid status',
                validValues: validStatuses
            });
        }
        
        const event = await Event.findByPk(id);
        if (!event) {
            console.log('Event not found:', id);
            return res.status(404).json({ error: 'Event not found' });
        }

        const oldStatus = event.status;
        await event.update({
            status,
            lastEditor: editor || 'Bot',
            lastChange: changes || `Status updated to ${status}`
        });

        console.log('Status updated successfully');
        res.json({ 
            success: true,
            event: {
                id: event.id,
                status: status,
                lastEditor: editor || 'Bot',
                lastChange: changes || `Status updated to ${status}`
            }
        });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Эндпоинт для логирования от бота
router.post('/log', checkApiKey, async (req, res) => {
    try {
        const { action, userId, username, details } = req.body;
        
        await Logger.log({
            action,
            userId,
            username,
            details
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error logging bot action:', error);
        res.status(500).json({ error: error.message });
    }
});

// New route to list all events for bot commands
router.get('/events', checkApiKey, async (req, res) => {
    try {
        const events = await Event.findAll({
            include: [{
                model: Distribution,
                as: 'distributions'
            }]
        });
        // Respond with events in a 'data' field
        res.json({ data: events });
    } catch (error) {
        console.error('Error fetching events for bot:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 