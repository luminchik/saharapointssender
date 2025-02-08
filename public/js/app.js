document.addEventListener('DOMContentLoaded', function() {
    let table; // Declare table variable in the outer scope

    // Функция проверки аутентификации
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

    // Инициализация приложения
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
            ordering: false,
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
            order: [[1, 'desc']],
            pageLength: 10,
            language: {
                processing: '<div class="skeleton-loading">Loading...</div>'
            },
            initComplete: function() {
                // Remove loading state
                document.querySelector('.table-container').classList.remove('table-loading');
                // Make table visible
                document.querySelector('#eventsTable').classList.add('initialized');
                
                this.api().columns().every(function(index) {
                    const column = this;
                    const header = $(column.header());
                    
                    if (index === 1 || index === 5) { // Date & Status columns keep standard filter popup
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
                                ${getFilterContent(index)}
                            </div>`
                        );
                        header.html(button).append(popup);
                        button.on('click', function(e) {
                            e.stopPropagation();
                            $('.column-filter-popup').not(popup).removeClass('active');
                            $('.column-filter-button').not(button).removeClass('active');
                            popup.toggleClass('active');
                            button.toggleClass('active');
                        });
                    } else if (index === 3) { // Requestor column: remove popup and add clear filter button
                        header.html('<span>' + header.text() + '</span> <button class="clear-requestor-filter" style="display:none; margin-left:5px;">Clear</button>');
                    }
                });
                
                // Close popups when clicking outside
                $(document).on('click', function(e) {
                    if (!$(e.target).closest('.column-filter-popup, .column-filter-button').length) {
                        $('.column-filter-popup').removeClass('active');
                        $('.column-filter-button').removeClass('active');
                    }
                });

                // Delegated event handler for clicking on a requestor link
                $('#eventsTable').on('click', '.requestor-link', function(e) {
                    e.preventDefault();
                    const requestorName = $(this).text();
                    const table = $('#eventsTable').DataTable();
                    // Use regex for exact match
                    table.column(3).search('^' + requestorName + '$', true, false).draw();
                    // Show clear filter button in header
                    $(table.column(3).header()).find('.clear-requestor-filter').show();
                });

                // Delegated event handler for the clear filter button in the requestor column header
                $('#eventsTable').on('click', '.clear-requestor-filter', function(e) {
                    e.stopPropagation();
                    const table = $('#eventsTable').DataTable();
                    table.column(3).search('').draw();
                    $(this).hide();
                });
            }
        });

        // Загрузка данных пользователя
        updateUserInterface(user);
    }

    // Функция обновления интерфейса пользователя
    function updateUserInterface(user) {
        if (!user) return;
        
        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('globalName').textContent = user.global_name || user.username;
        
        // Сохраняем данные пользователя в localStorage
        localStorage.setItem('userData', JSON.stringify(user));
    }

    // Обработчик клика по аватарке
    const userProfile = document.querySelector('.user-profile');
    document.addEventListener('click', (e) => {
        if (userProfile.contains(e.target)) {
            userProfile.classList.toggle('active');
        } else {
            userProfile.classList.remove('active');
        }
    });

    // Запускаем инициализацию приложения
    initializeApp().catch(error => {
        console.error('App initialization failed:', error);
        window.location.href = '/login';
    });

    // Function to get filter content based on column index
    function getFilterContent(index) {
        switch(index) {
            case 1: // Date
                return `
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
                `;
            case 3: // Requestor
                return `
                    <div class="filter-group">
                        <label>Search</label>
                        <input type="text" class="requestor-filter" placeholder="Enter requestor name">
                    </div>
                    <div class="filter-actions">
                        <button class="clear-filter">Clear</button>
                        <button class="apply-filter">Apply</button>
                    </div>
                `;
            case 5: // Status
                return `
                    <div class="filter-group">
                        <label>Status</label>
                        <div class="status-filter-buttons">
                            <button class="status-btn" data-value="">All</button>
                            <button class="status-btn pending" data-value="Pending">Pending</button>
                            <button class="status-btn completed" data-value="Completed">Completed</button>
                            <button class="status-btn rejected" data-value="Rejected">Rejected</button>
                        </div>
                    </div>
                    <div class="filter-actions">
                        <button class="clear-filter">Clear</button>
                        <button class="apply-filter">Apply</button>
                    </div>
                `;
        }
    }

    // Handle filter actions
    $(document).on('click', '.apply-filter', function() {
        const popup = $(this).closest('.column-filter-popup');
        const column = table.column(popup.parent('th').index());
        
        let value = '';
        if (popup.find('.date-filter').length) {
            const from = popup.find('[data-type="from"]').val();
            const to = popup.find('[data-type="to"]').val();
            if (from || to) {
                value = `${from}|${to}`;
            }
        } else if (popup.find('.status-filter').length) {
            value = popup.find('.status-filter').val();
        } else if (popup.find('.requestor-filter').length) {
            value = popup.find('.requestor-filter').val();
        }
        
        column.search(value).draw();
        popup.removeClass('active');
        popup.siblings('.column-filter-button').toggleClass('active', !!value);
    });

    $(document).on('click', '.clear-filter', function() {
        const popup = $(this).closest('.column-filter-popup');
        popup.find('input, select').val('');
        const column = table.column(popup.parent('th').index());
        column.search('').draw();
        popup.removeClass('active');
        popup.siblings('.column-filter-button').removeClass('active');
    });

    // Обработчик кнопки Create Event
    document.querySelector('.create-event-btn').addEventListener('click', () => {
        // Здесь будет логика создания события
    });

    // Функция для отображения деталей события
    function showEventDetails(eventData) {
        const modal = document.getElementById('viewModal');
        const detailsContainer = modal.querySelector('.event-details');
        
        // Создаем массив всех имен пользователей из распределений
        const allUsernames = eventData.distributions
            .map(dist => dist.nameList.split('\n'))
            .flat()
            .filter(name => name.trim());
        
        // Форматируем распределения
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

        // Добавляем функционал поиска
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
            
            // Обновляем результат поиска
            if (matches.length > 0) {
                searchResult.textContent = `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`;
                searchResult.className = 'search-result found';
            } else {
                searchResult.textContent = 'No matches found';
                searchResult.className = 'search-result not-found';
            }
            
            // Подсвечиваем найденные совпадения
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

    // Обработчики для модального окна
    document.querySelector('.modal-close').addEventListener('click', () => {
        document.getElementById('viewModal').classList.remove('active');
    });

    // Обработчик клика вне модального окна
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