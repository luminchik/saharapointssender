document.addEventListener('DOMContentLoaded', function() {
    const distributionList = document.getElementById('distributionList');
    const addDistributionBtn = document.getElementById('addDistribution');
    const form = document.getElementById('createEventForm');
    const requestorInput = document.getElementById('requestor');
    const dateInput = document.getElementById('eventDate');

    // Инициализация flatpickr для поля даты
    flatpickr(dateInput, {
        dateFormat: "Y-m-d",
        time_24hr: true,
        minDate: new Date().setDate(new Date().getDate() - 1) // вчерашний день
    });

    // Функция создания новой строки распределения
    function createDistributionEntry() {
        const entry = document.createElement('div');
        entry.className = 'distribution-entry';
        entry.innerHTML = `
            <input type="number" name="xpAmount[]" placeholder="Amount" required min="1" max="10000" step="1">
            <textarea name="nameList[]" placeholder="One Discord Username per line" required></textarea>
            <button type="button" class="remove-distribution">
                <svg viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;
        
        distributionList.appendChild(entry);

        // Добавляем обработчик для проверки числового значения
        const xpInput = entry.querySelector('input[type="number"]');
        xpInput.addEventListener('input', function() {
            let value = parseInt(this.value);
            if (value < 1) this.value = 1;
            if (value > 10000) this.value = 10000;
            this.value = Math.floor(value);
        });

        // Обработчик удаления строки
        entry.querySelector('.remove-distribution').addEventListener('click', function() {
            // Проверяем, сколько строк распределения осталось
            const remainingEntries = document.querySelectorAll('.distribution-entry').length;
            if (remainingEntries <= 1) {
                alert('You must have at least one distribution entry');
                return;
            }
            entry.remove();
        });

        return entry;
    }

    // Создаем первую строку при загрузке страницы
    createDistributionEntry();

    // Загрузка данных пользователя и установка requestor
    fetch('/api/user')
        .then(response => response.json())
        .then(user => {
            // Обновляем аватар с проверкой на null
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png'; // Fallback avatar
            
            document.getElementById('userAvatar').src = avatarUrl;
            
            // Устанавливаем имя пользователя с проверкой
            const displayName = user.global_name || user.username || 'Unknown User';
            document.getElementById('globalName').textContent = displayName;
            
            // Устанавливаем requestor с проверкой
            if (displayName && displayName !== 'Unknown User') {
                requestorInput.value = displayName;
            } else {
                console.error('Invalid user data received:', user);
                alert('Error: Could not load user data. Please refresh the page or contact support.');
            }
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            // Устанавливаем fallback значения
            document.getElementById('userAvatar').src = 'https://cdn.discordapp.com/embed/avatars/0.png';
            document.getElementById('globalName').textContent = 'Unknown User';
            alert('Error: Could not load user data. Please refresh the page or contact support.');
        });

    // Обработка клика по аватарке для показа/скрытия меню
    const userProfile = document.querySelector('.user-profile');
    document.addEventListener('click', (e) => {
        if (userProfile.contains(e.target)) {
            userProfile.classList.toggle('active');
        } else {
            userProfile.classList.remove('active');
        }
    });

    // Добавление новой строки распределения
    addDistributionBtn.addEventListener('click', createDistributionEntry);

    // Отправка формы
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const requestor = formData.get('requestor');

        // Проверяем requestor перед отправкой
        if (!requestor || requestor === 'Unknown User' || requestor.length < 2) {
            alert('Error: Invalid requestor. Please refresh the page and try again.');
            return;
        }

        const xpAmounts = formData.getAll('xpAmount[]');
        const nameLists = formData.getAll('nameList[]');

        // Проверяем и фильтруем пустые строки
        const validDistributions = [];
        for(let i = 0; i < xpAmounts.length; i++) {
            const nameList = nameLists[i].trim();
            const xpAmount = parseInt(xpAmounts[i]);
            
            if (nameList && !isNaN(xpAmount) && xpAmount > 0) {
                validDistributions.push({
                    xpAmount: xpAmount,
                    nameList: nameList,
                    remark: ''
                });
            }
        }

        // Проверяем наличие валидных распределений
        if (validDistributions.length === 0) {
            alert('Please add at least one valid distribution with amount and usernames');
            return;
        }

        const data = {
            eventDate: formData.get('eventDate'),
            eventTitle: formData.get('eventTitle'),
            requestor: requestor,
            region: formData.get('region') || 'Global',
            distributions: validDistributions
        };

        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create event');
            }

            const result = await response.json();
            console.log('Server response:', result);
            window.location.href = '/';
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'An error occurred while creating the event. Please try again.');
        }
    });
}); 