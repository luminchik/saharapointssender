document.addEventListener('DOMContentLoaded', function() {
    // Инициализация таблицы лидерборда с использованием DataTables
    const leaderboardTable = $('#leaderboardTable').DataTable({
        ajax: {
            url: '/api/leaderboard',
            dataSrc: function(json) {
                console.log('Received data:', json);
                if (!json || !json.leaderboard) {
                    console.error('Invalid data format received:', json);
                    return [];
                }
                return json.leaderboard;
            },
            error: function(xhr, error, thrown) {
                console.error('Error loading leaderboard data:', error);
                console.error('Server response:', xhr.responseText);
                $('#leaderboardTable tbody').html('<tr><td colspan="5" style="color: red;">Error loading data. Please try again later.</td></tr>');
            }
        },
        columns: [
            { data: 'rank', title: 'Rank' },
            { 
                data: 'username',
                title: 'User',
                render: function(data) {
                    return `<span class="username">${data}</span>`;
                }
            },
            { 
                data: 'totalOp',
                title: 'Total OP',
                render: function(data) {
                    return `<span class="op-amount">${data.toLocaleString()}</span>`;
                }
            },
            {
                data: 'averageOp',
                title: 'Avg OP/Event',
                render: function(data) {
                    return `<span class="average-op">${data.toLocaleString()}</span>`;
                }
            },
            {
                data: 'highestOp',
                title: 'Highest OP',
                render: function(data) {
                    return `<span class="highest-op">${data.toLocaleString()}</span>`;
                }
            }
        ],
        order: [[2, 'desc']],
        pageLength: 25,
        language: {
            loadingRecords: 'Loading data...',
            zeroRecords: 'No data available',
            emptyTable: 'No data available'
        },
        drawCallback: function(settings) {
            try {
                const globalStats = settings.json.globalStats;
                if (globalStats) {
                    updateGlobalStats(globalStats);
                } else {
                    console.warn('No global stats available:', settings.json);
                }
            } catch (error) {
                console.error('Error updating global stats:', error);
            }
        }
    });

    // Функция обновления глобальной статистики
    function updateGlobalStats(stats) {
        if (!stats) {
            console.warn('No stats provided to updateGlobalStats');
            return;
        }

        const statsHtml = `
            <div class="global-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Users:</span>
                    <span class="stat-value">${stats.totalUsers.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total OP Distributed:</span>
                    <span class="stat-value">${stats.totalOpDistributed.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average OP per User:</span>
                    <span class="stat-value">${stats.averageOpPerUser.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Most Active User:</span>
                    <span class="stat-value">${stats.mostActiveUser || 'N/A'}</span>
                </div>
            </div>
        `;
        
        const statsContainer = document.getElementById('globalStats');
        if (statsContainer) {
            statsContainer.innerHTML = statsHtml;
        }
    }

    // Загрузка данных пользователя для навбара
    fetch('/api/user')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(user => {
            if (user && user.id && user.avatar) {
                document.getElementById('userAvatar').src = 
                    `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
                document.getElementById('globalName').textContent = 
                    user.global_name || user.username;
            } else {
                console.warn('Incomplete user data received:', user);
            }
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            document.getElementById('globalName').textContent = 'User';
        });
}); 