document.addEventListener('DOMContentLoaded', function() {
    // Initialize DataTable for leaderboard
    const leaderboardTable = $('#leaderboardTable').DataTable({
        ajax: {
            url: '/api/leaderboard',
            dataSrc: function(json) {
                console.log('Raw server response:', json);
                
                // Проверяем наличие данных и обновляем глобальную статистику
                if (json && json.globalStats) {
                    console.log('Global stats found:', json.globalStats);
                    updateGlobalStats(json.globalStats);
                } else {
                    console.warn('No global stats in response');
                }

                // Проверяем и возвращаем данные лидерборда
                if (!json || !json.leaderboard) {
                    console.error('Invalid data format or no leaderboard data:', json);
                    return [];
                }

                return json.leaderboard;
            }
        },
        processing: true,
        serverSide: false,
        columns: [
            { 
                data: 'rank',
                title: 'Rank',
                render: function(data) {
                    return `<span class="rank">#${data}</span>`;
                }
            },
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
        dom: '<"top"lf>rt<"bottom"ip><"clear">',
        language: {
            search: "Search users:",
            lengthMenu: "Show _MENU_ users per page",
            info: "Showing _START_ to _END_ of _TOTAL_ users",
            infoEmpty: "No users found",
            infoFiltered: "(filtered from _MAX_ total users)",
            loadingRecords: 'Loading data...',
            zeroRecords: 'No users found',
            emptyTable: 'No data available'
        }
    });

    // Update global statistics
    function updateGlobalStats(stats) {
        console.log('Updating global stats:', stats);
        if (!stats) {
            console.warn('No stats provided to updateGlobalStats');
            return;
        }

        const statsContainer = document.getElementById('globalStats');
        if (!statsContainer) {
            console.error('Global stats container not found');
            return;
        }

        const statsHtml = `
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
        `;
        
        statsContainer.innerHTML = statsHtml;
        console.log('Global stats updated successfully');
    }

    // Load user data for navbar
    fetch('/api/user')
        .then(response => {
            if (!response.ok) {
                throw new Error('Unauthorized');
            }
            return response.json();
        })
        .then(user => {
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
            
            document.getElementById('userAvatar').src = avatarUrl;
            document.getElementById('globalName').textContent = user.global_name || user.username;
            
            localStorage.setItem('userData', JSON.stringify(user));
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            if (error.message === 'Unauthorized') {
                window.location.href = '/login';
            }
        });

    // Handle user profile dropdown
    const userProfile = document.querySelector('.user-profile');
    document.addEventListener('click', (e) => {
        if (userProfile.contains(e.target)) {
            userProfile.classList.toggle('active');
        } else {
            userProfile.classList.remove('active');
        }
    });
}); 