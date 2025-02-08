document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorMessage = document.getElementById('error-message');

    const errorMessages = {
        'rate_limit': 'Too many login attempts. Please wait a few seconds and try again.',
        'auth_failed': 'Authentication failed. Please try again.',
        'unauthorized': 'Your Discord account is not whitelisted.',
        'server_error': 'Server error occurred. Please try again later.',
        'invalid_state': 'Session validation failed. Please try logging in again.',
        'session_expired': 'Your session has expired. Please try logging in again.',
        'missing_state': 'Authentication error. Please try logging in again.'
    };

    if (error && errorMessages[error]) {
        errorMessage.textContent = errorMessages[error];
        errorMessage.classList.add('visible');
        
        // Log error for debugging
        console.error('Login error:', error);
        console.error('Full URL:', window.location.href);
    }
}); 