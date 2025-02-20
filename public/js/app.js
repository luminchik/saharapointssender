document.addEventListener('DOMContentLoaded', function() {
    let table; // Global table variable

    // Check authentication function
    async function checkAuth() {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return false;
                }
                throw new Error('Network response was not ok');
            }
            const user = await response.json();
            return user;
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login';
            return false;
        }
    }

    // Initialize application
    async function initializeApp() {
        const user = await checkAuth();
        if (!user) return;

        // Add transition effect
        const mainContainer = document.querySelector('.main-container');
        mainContainer.classList.add('page-transition');
        setTimeout(() => mainContainer.classList.add('visible'), 100);

        // Initialize DataTable with server-side processing
        table = $('#eventsTable').DataTable({
            serverSide: false,
            processing: true,
            ordering: true,
            order: [[0, 'desc']], // Sort by ID descending
            columnDefs: [
                { orderable: false, targets: [1,2,3,4,5,6] } // Disable sorting for all columns except ID
            ],
            ajax: {
                url: '/api/events',
                type: 'GET',
                dataSrc: 'data',
                error: function(xhr, error, thrown) {
                    if (xhr.status === 401) {
                        window.location.href = '/login';
                    } else {
                        console.error('Error loading data:', error);
                        alert('Error loading data. Please try refreshing the page.');
                    }
                }
            },
            columns: [
                { 
                    data: 'id',
                    title: 'ID'
                },
                { 
                    data: 'eventDate',
                    title: 'Date',
                    render: function(data) {
                        return new Date(data).toLocaleDateString();
                    }
                },
                { 
                    data: 'title',
                    title: 'Title'
                },
                { 
                    data: 'requestor',
                    title: 'Requestor',
                    render: function(data, type, row, meta) {
                        if (type === 'display') {
                            return '<a href="#" class="requestor-link">' + data + '</a>';
                        }
                        return data;
                    }
                },
                {
                    data: 'createdAt',
                    title: 'Created',
                    render: function(data) {
                        return new Date(data).toLocaleDateString();
                    }
                },
                {
                    data: 'status',
                    title: 'Status',
                    render: function(data) {
                        const statusClasses = {
                            'Pending': 'pending',
                            'Completed': 'completed',
                            'Rejected': 'rejected'
                        };
                        return `<span class="status-badge ${statusClasses[data]}">${data}</span>`;
                    }
                },
                {
                    data: null,
                    title: 'Actions',
                    render: function(data) {
                        return `
                            <div class="action-buttons">
                                <button class="action-btn view-btn" data-id="${data.id}">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                    </svg>
                                </button>
                                <button class="action-btn edit-btn" data-id="${data.id}">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                    </svg>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            initComplete: function() {
                // Remove loading state
                document.querySelector('.table-container').classList.remove('table-loading');
                // Make table visible
                document.querySelector('#eventsTable').classList.add('initialized');
                
                this.api().columns().every(function(index) {
                    const column = this;
                    const header = $(column.header());
                    
                    if (index === 1) { // Date column filter
                        const button = $(
                            `<button class="column-filter-button">
                                <span>${header.text()}</span>
                                <svg viewBox="0 0 24 24">
                                    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
                                </svg>
                            </button>`
                        );
                        const popup = $(
                            `<div class="column-filter-popup">
                                <div class="filter-group">
                                    <label>From</label>
                                    <input type="date" class="date-filter" data-type="from">
                                </div>
                                <div class="filter-group">
                                    <label>To</label>
                                    <input type="date" class="date-filter" data-type="to">
                                </div>
                                <div class="filter-actions">
                                    <button class="clear-filter">Clear</button>
                                    <button class="apply-filter">Apply</button>
                                </div>
                            </div>`
                        );
                        header.html(button).append(popup);

                        // Add click handler for filter button
                        button.on('click', function(e) {
                            e.stopPropagation();
                            $('.column-filter-popup').not(popup).removeClass('active');
                            popup.toggleClass('active');
                            $('.column-filter-button').not(button).removeClass('active');
                            button.toggleClass('active');
                        });
                        
                        // Date filter handler
                        popup.find('.apply-filter').on('click', function() {
                            const from = popup.find('[data-type="from"]').val();
                            const to = popup.find('[data-type="to"]').val();
                            
                            $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
                                const date = new Date(data[1]).getTime();
                                const min = from ? new Date(from).getTime() : null;
                                const max = to ? new Date(to).getTime() : null;
                                
                                if (min && max) {
                                    return date >= min && date <= max;
                                } else if (min) {
                                    return date >= min;
                                } else if (max) {
                                    return date <= max;
                                }
                                return true;
                            });
                            
                            table.draw();
                            popup.removeClass('active');
                            button.toggleClass('active', !!(from || to));
                        });
                        
                        popup.find('.clear-filter').on('click', function() {
                            popup.find('input').val('');
                            $.fn.dataTable.ext.search.pop();
                            table.draw();
                            popup.removeClass('active');
                            button.removeClass('active');
                        });
                    } else if (index === 3) { // Requestor column filter
                        header.html('<span>' + header.text() + '</span> <button class="clear-requestor-filter" style="display:none; margin-left:5px;">Clear</button>');
                    }
                });
                
                // Close filter popups when clicking outside
                $(document).on('click', function(e) {
                    if (!$(e.target).closest('.column-filter-popup, .column-filter-button').length) {
                        $('.column-filter-popup').removeClass('active');
                        $('.column-filter-button').removeClass('active');
                    }
                });

                // Handle requestor link click
                $('#eventsTable').on('click', '.requestor-link', function(e) {
                    e.preventDefault();
                    const requestorName = $(this).text();
                    const table = $('#eventsTable').DataTable();
                    table.column(3).search('^' + requestorName + '$', true, false).draw();
                    $(table.column(3).header()).find('.clear-requestor-filter').show();
                });

                // Handle clear filter button click
                $('#eventsTable').on('click', '.clear-requestor-filter', function(e) {
                    e.stopPropagation();
                    const table = $('#eventsTable').DataTable();
                    table.column(3).search('').draw();
                    $(this).hide();
                });
            }
        });

        // Update user interface
        updateUserInterface(user);
    }

    // Update user interface function
    function updateUserInterface(user) {
        if (!user) return;
        
        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('globalName').textContent = user.global_name || user.username;
        
        // Save user data to localStorage
        localStorage.setItem('userData', JSON.stringify(user));
    }

    // Handle avatar click
    const userProfile = document.querySelector('.user-profile');
    document.addEventListener('click', (e) => {
        if (userProfile.contains(e.target)) {
            userProfile.classList.toggle('active');
        } else {
            userProfile.classList.remove('active');
        }
    });

    // Initialize application
    initializeApp().catch(error => {
        console.error('App initialization failed:', error);
        window.location.href = '/login';
    });

    // Show event details function
    function showEventDetails(eventData) {
        const modal = document.getElementById('viewModal');
        const detailsContainer = modal.querySelector('.event-details');
        
        // Create array of all usernames from distributions
        const allUsernames = eventData.distributions
            .map(dist => dist.nameList.split('\n'))
            .flat()
            .filter(name => name.trim());
        
        // Format distributions
        const distributionsHtml = eventData.distributions.map(dist => `
            <div class="distribution-item">
                <strong>Amount: ${dist.xpAmount} XP</strong>
                <pre>${dist.nameList}</pre>
            </div>
        `).join('');

        detailsContainer.innerHTML = `
            <div class="detail-group">
                <span class="detail-label">Event ID:</span>
                <span>#${eventData.id}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Event's Date:</span>
                <span>${new Date(eventData.eventDate).toLocaleString()}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Event's Title:</span>
                <span>${eventData.title}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Requestor:</span>
                <span>${eventData.requestor}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Status:</span>
                <span class="status-badge ${eventData.status.toLowerCase()}">${eventData.status}</span>
            </div>
            <div class="detail-group search-group">
                <span class="detail-label">Search Usernames:</span>
                <div class="search-container">
                    <input type="text" id="usernameSearch" placeholder="Enter username to search..." class="username-search">
                    <span class="search-result"></span>
                </div>
            </div>
            <div class="detail-group">
                <span class="detail-label">Distributions:</span>
                <div class="distributions-list">
                    ${distributionsHtml}
                </div>
            </div>
        `;

        // Add search functionality
        const searchInput = detailsContainer.querySelector('#usernameSearch');
        const searchResult = detailsContainer.querySelector('.search-result');
        
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            if (searchTerm === '') {
                searchResult.textContent = '';
                document.querySelectorAll('.distribution-item pre').forEach(pre => {
                    pre.innerHTML = pre.textContent;
                });
                return;
            }
            
            const matches = allUsernames.filter(username => 
                username.toLowerCase().includes(searchTerm)
            );
            
            // Update search result
            if (matches.length > 0) {
                searchResult.textContent = `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`;
                searchResult.className = 'search-result found';
            } else {
                searchResult.textContent = 'No matches found';
                searchResult.className = 'search-result not-found';
            }
            
            // Highlight found matches
            document.querySelectorAll('.distribution-item pre').forEach(pre => {
                let html = pre.textContent;
                matches.forEach(match => {
                    const regex = new RegExp(match, 'gi');
                    html = html.replace(regex, `<span class="highlight">${match}</span>`);
                });
                pre.innerHTML = html;
            });
        });
        
        modal.classList.add('active');
    }

    // Modal event handlers
    document.querySelector('.modal-close').addEventListener('click', () => {
        document.getElementById('viewModal').classList.remove('active');
    });

    document.getElementById('viewModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.target.classList.remove('active');
        }
    });

    // Handle view button click
    $('#eventsTable').on('click', '.view-btn', function() {
        const row = $(this).closest('tr');
        const rowData = table.row(row).data();
        if (!rowData) {
            console.error('No row data found for the clicked view button');
            return;
        }
        showEventDetails(rowData);
    });

    // Handle edit button click
    $('#eventsTable').on('click', '.edit-btn', function() {
        const id = $(this).data('id');
        window.location.href = `/edit-event/${id}`;
    });
});
