const express = require('express');
const router = express.Router();
const { Event, Distribution } = require('../models');
const Logger = require('../utils/logger');

// Protected routes (require authentication)
router.get('/events', async (req, res) => {
    try {
        const events = await Event.findAll({
            include: [{
                model: Distribution,
                as: 'distributions',
                attributes: ['xpAmount', 'nameList', 'remark']
            }],
            order: [['eventDate', 'DESC']]
        });

        // Форматируем данные для DataTables
        const formattedEvents = events.map(event => ({
            id: event.id,
            eventDate: event.eventDate,
            title: event.title,
            requestor: event.requestor,
            createdAt: event.createdAt,
            status: event.status,
            distributions: event.distributions
        }));

        res.json({
            draw: parseInt(req.query.draw) || 1,
            recordsTotal: formattedEvents.length,
            recordsFiltered: formattedEvents.length,
            data: formattedEvents
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ 
            error: 'Failed to fetch events',
            details: error.message,
            draw: parseInt(req.query.draw) || 1,
            recordsTotal: 0,
            recordsFiltered: 0,
            data: []
        });
    }
});

// Создание нового события
router.post('/events', async (req, res) => {
    try {
        const { eventDate, eventTitle, requestor, region, distributions } = req.body;

        const event = await Event.create({
            title: eventTitle,
            eventDate,
            requestor,
            region: region || 'Global',
            status: 'Pending'
        });

        if (distributions && distributions.length > 0) {
            await Promise.all(distributions.map(dist => 
                Distribution.create({
                    eventId: event.id,
                    xpAmount: dist.xpAmount,
                    nameList: dist.nameList,
                    remark: dist.remark || ''
                })
            ));
        }

        // Улучшенное логирование
        console.log('Attempting to log event creation...');
        await Logger.log({
            action: 'CREATE_EVENT',
            userId: req.user.id,
            username: req.user.username || req.user.global_name,
            details: {
                eventId: event.id,
                title: eventTitle,
                distributions: distributions.length,
                requestor: requestor,
                date: eventDate
            }
        });
        console.log('Event creation logged successfully');

        res.json(event);
    } catch (error) {
        console.error('Error in event creation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получение одного события
router.get('/events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id, {
            include: [{
                model: Distribution,
                as: 'distributions'
            }]
        });

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обновление события
router.put('/events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const oldTitle = event.title;
        const oldStatus = event.status;
        
        await event.update({
            title: req.body.eventTitle,
            eventDate: req.body.eventDate,
            requestor: req.body.requestor,
            region: req.body.region || 'Global'
        });

        // Обновляем распределения
        await Distribution.destroy({ where: { eventId: event.id } });
        
        if (req.body.distributions && req.body.distributions.length > 0) {
            await Promise.all(req.body.distributions.map(dist =>
                Distribution.create({
                    eventId: event.id,
                    xpAmount: dist.xpAmount,
                    nameList: dist.nameList,
                    remark: dist.remark || ''
                })
            ));
        }

        // Улучшенное логирование
        console.log('Attempting to log event update...');
        await Logger.log({
            action: 'EDIT_EVENT',
            userId: req.user.id,
            username: req.user.username || req.user.global_name,
            details: {
                eventId: event.id,
                oldTitle,
                newTitle: req.body.eventTitle,
                oldStatus,
                newStatus: event.status,
                distributions: req.body.distributions.length,
                editor: req.user.username || req.user.global_name
            }
        });
        console.log('Event update logged successfully');

        const updatedEvent = await Event.findByPk(event.id, {
            include: [{
                model: Distribution,
                as: 'distributions'
            }]
        });

        res.json(updatedEvent);
    } catch (error) {
        console.error('Error in event update:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получение лидерборда
router.get('/leaderboard', async (req, res) => {
    console.log('Fetching leaderboard data...');
    try {
        // Получаем все записи распределений вместе с информацией о событиях
        const distributions = await Distribution.findAll({
            include: [{
                model: Event,
                as: 'event',
                attributes: ['title', 'eventDate', 'requestor', 'status'],
                where: {
                    status: 'Completed' // Учитываем только завершенные события
                }
            }],
            attributes: ['xpAmount', 'nameList']
        });

        console.log(`Found ${distributions.length} completed distributions`);

        // Агрегируем данные в объект leaderboard
        const leaderboard = {};
        let totalProcessedNames = 0;
        
        distributions.forEach(dist => {
            if (!dist.nameList) {
                console.log('Found distribution with empty nameList, skipping...');
                return;
            }

            const xp = dist.xpAmount;
            const names = dist.nameList.split(/\r?\n/).map(n => n.trim()).filter(n => n);
            totalProcessedNames += names.length;

            names.forEach(name => {
                if (!leaderboard[name]) {
                    leaderboard[name] = {
                        totalOp: 0,
                        eventsParticipated: 0,
                        highestOp: 0
                    };
                }
                
                leaderboard[name].totalOp += xp;
                leaderboard[name].eventsParticipated += 1;
                leaderboard[name].highestOp = Math.max(leaderboard[name].highestOp, xp);
            });
        });

        console.log(`Processed ${totalProcessedNames} total names`);
        console.log(`Generated leaderboard for ${Object.keys(leaderboard).length} unique users`);

        // Преобразуем объект leaderboard в массив
        let leaderboardArray = Object.entries(leaderboard).map(([username, stats]) => ({
            username,
            totalOp: stats.totalOp,
            highestOp: stats.highestOp,
            averageOp: Math.round(stats.totalOp / stats.eventsParticipated)
        }));

        // Сортируем по общему количеству OP
        leaderboardArray.sort((a, b) => b.totalOp - a.totalOp);
        
        // Добавляем ранги
        leaderboardArray = leaderboardArray.map((entry, index) => ({ 
            rank: index + 1,
            ...entry
        }));

        // Добавляем общую статистику
        const globalStats = {
            totalUsers: leaderboardArray.length,
            totalOpDistributed: leaderboardArray.reduce((sum, user) => sum + user.totalOp, 0),
            averageOpPerUser: Math.round(leaderboardArray.reduce((sum, user) => sum + user.totalOp, 0) / leaderboardArray.length) || 0,
            mostActiveUser: leaderboardArray[0]?.username || 'N/A'
        };

        console.log('Leaderboard data prepared successfully');
        console.log('Global stats:', globalStats);

        res.json({
            leaderboard: leaderboardArray,
            globalStats
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch leaderboard data',
            details: error.message,
            leaderboard: [],
            globalStats: {
                totalUsers: 0,
                totalOpDistributed: 0,
                averageOpPerUser: 0,
                mostActiveUser: 'N/A'
            }
        });
    }
});

module.exports = router; 