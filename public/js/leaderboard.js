document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing leaderboard...');
    
    // Initialize DataTable for leaderboard
    const leaderboardTable = $('#leaderboardTable').DataTable({
        ajax: {
            url: '/api/leaderboard',
            dataSrc: function(json) {
                console.log('Received data from server:', json);
                
                if (json && json.globalStats) {
                    console.log('Updating global stats...');
                    updateGlobalStats(json.globalStats);
                }

                if (!json || !json.leaderboard) {
                    console.error('No leaderboard data found');
                    return [];
                }

                console.log(`Processing ${json.leaderboard.length} entries...`);
                return json.leaderboard;
            },
            error: function(xhr, error, thrown) {
                console.error('Error loading data:', error);
                console.error('Server response:', xhr.responseText);
            }
        },
        processing: true,
        serverSide: false,
        responsive: true,
        columns: [
            { 
                data: 'rank',
                render: function(data) {
                    return `<span class="rank">#${data}</span>`;
                }
            },
            { 
                data: 'username',
                render: function(data) {
                    return `<span class="username">${data}</span>`;
                }
            },
            { 
                data: 'totalOp',
                render: function(data) {
                    return `<span class="op-amount">${data.toLocaleString()}</span>`;
                }
            },
            {
                data: 'averageOp',
                render: function(data) {
                    return `<span class="average-op">${data.toLocaleString()}</span>`;
                }
            },
            {
                data: 'highestOp',
                render: function(data) {
                    return `<span class="highest-op">${data.toLocaleString()}</span>`;
                }
            }
        ],
        order: [[0, 'asc']],
        pageLength: 25,
        language: {
            search: "Search users:",
            lengthMenu: "Show _MENU_ users per page",
            info: "Showing _START_ to _END_ of _TOTAL_ users",
            infoEmpty: "No users found",
            infoFiltered: "(filtered from _MAX_ total users)",
            loadingRecords: 'Loading data...',
            zeroRecords: 'No users found',
            emptyTable: 'No data available'
        },
        initComplete: function() {
            console.log('Table initialization complete');
        }
    });

    // Update global statistics
    function updateGlobalStats(stats) {
        if (!stats) {
            console.warn('No stats provided');
            return;
        }

        const statsContainer = document.getElementById('globalStats');
        if (!statsContainer) {
            console.error('Stats container not found');
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
        console.log('Global stats updated');
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