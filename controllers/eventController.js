const { logActivity } = require('./logController');

// В функции createEvent добавляем логирование
const createEvent = async (req, res) => {
    try {
        // ... существующий код создания события ...

        // Логируем создание события
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

// В функции updateEvent добавляем логирование
const updateEvent = async (req, res) => {
    try {
        // ... существующий код обновления события ...

        // Логируем обновление события
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

// В функции deleteEvent добавляем логирование
const deleteEvent = async (req, res) => {
    try {
        // ... существующий код удаления события ...

        // Логируем удаление события
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