document.addEventListener('DOMContentLoaded', function() {
    const distributionList = document.getElementById('distributionList');
    const addDistributionBtn = document.getElementById('addDistribution');
    const form = document.getElementById('editEventForm');
    const requestorInput = document.getElementById('requestor');
    const eventId = window.location.pathname.split('/').pop();

    // Function to create a new distribution entry
    function createDistributionEntry(xpAmount = '', nameList = '') {
        const entry = document.createElement('div');
        entry.className = 'distribution-entry';
        entry.innerHTML = `
            <input type="number" name="xpAmount[]" placeholder="Amount" required min="1" max="10000" step="1" value="${xpAmount}">
            <textarea name="nameList[]" placeholder="One Discord Username per line" required>${nameList || ''}</textarea>
            <button type="button" class="remove-distribution">
                <svg viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;
        
        distributionList.appendChild(entry);

        // Add handler for numeric value validation
        const xpInput = entry.querySelector('input[type="number"]');
        xpInput.addEventListener('input', function() {
            let value = parseInt(this.value);
            if (value < 1) this.value = 1;
            if (value > 10000) this.value = 10000;
            this.value = Math.floor(value);
        });

        // Handler for entry removal
        entry.querySelector('.remove-distribution').addEventListener('click', function() {
            entry.remove();
        });

        return entry;
    }

    // Load event data
    fetch(`/api/events/${eventId}`)
        .then(response => response.json())
        .then(event => {
            console.log('Loaded Event:', event);
            document.getElementById('eventDate').value = event.eventDate.split('T')[0];
            document.getElementById('eventTitle').value = event.title;
            
            // Clear existing distributions
            distributionList.innerHTML = '';
            
            // Load distributions
            if (event.distributions && event.distributions.length > 0) {
                event.distributions.forEach(dist => {
                    console.log('Distribution:', dist);
                    createDistributionEntry(dist.xpAmount, dist.nameList);
                });
            } else {
                // If no distributions, create empty entry
                createDistributionEntry();
            }
        })
        .catch(error => {
            console.error('Error loading event:', error);
            alert('Failed to load event data');
        });

    // Load user data
    fetch('/api/user')
        .then(response => response.json())
        .then(user => {
            document.getElementById('userAvatar').src = 
                `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
            document.getElementById('globalName').textContent = 
                user.global_name || user.username;
            requestorInput.value = user.global_name || user.username;
        });

    // Handle avatar click for menu show/hide
    const userProfile = document.querySelector('.user-profile');
    document.addEventListener('click', (e) => {
        if (userProfile.contains(e.target)) {
            userProfile.classList.toggle('active');
        } else {
            userProfile.classList.remove('active');
        }
    });

    // Add new distribution entry
    addDistributionBtn.addEventListener('click', () => createDistributionEntry());

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {
            eventDate: formData.get('eventDate'),
            eventTitle: formData.get('eventTitle'),
            requestor: formData.get('requestor'),
            region: 'Global', // Add region as it's required
            distributions: []
        };

        // Collect distribution data
        const xpAmounts = formData.getAll('xpAmount[]');
        const nameLists = formData.getAll('nameList[]');

        for(let i = 0; i < xpAmounts.length; i++) {
            data.distributions.push({
                xpAmount: parseInt(xpAmounts[i]),
                nameList: nameLists[i],
                remark: ''
            });
        }

        try {
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update event');
            }

            window.location.href = '/';
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });
}); 
