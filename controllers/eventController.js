const { Event } = require('../models');
const { logActivity } = require('./logController');

// Create event with logging
const createEvent = async (req, res) => {
    try {
        // Get data from request
        const { title, description, date, points, maxParticipants } = req.body;

        // Create event in database
        const event = await Event.create({
            title,
            description,
            date,
            points,
            maxParticipants,
            createdBy: req.user.id
        });

        // Log event creation
        await logActivity(
            'event',
            req.user.username,
            'Created new event',
            `Event ID: ${event.id}, Title: ${event.title}`,
            req
        );

        res.json(event);
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
};

// Update event with logging
const updateEvent = async (req, res) => {
    try {
        // Find event by ID
        const event = await Event.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Update event data
        await event.update(req.body);

        // Log event update
        await logActivity(
            'event',
            req.user.username,
            'Updated event',
            `Event ID: ${event.id}, Changes: ${JSON.stringify(req.body)}`,
            req
        );

        res.json(event);
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};

// Delete event with logging
const deleteEvent = async (req, res) => {
    try {
        // Find and delete event
        const event = await Event.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        await event.destroy();

        // Log event deletion
        await logActivity(
            'event',
            req.user.username,
            'Deleted event',
            `Event ID: ${req.params.id}`,
            req
        );

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
};

module.exports = {
    createEvent,
    updateEvent,
    deleteEvent
}; 
