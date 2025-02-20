const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

// Create backup directory if it doesn't exist
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Function to create backup
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite3`);
    
    // Path to main database
    const dbPath = path.join(__dirname, '..', 'database.sqlite3');

    try {
        // Create database copy
        fs.copyFileSync(dbPath, backupPath);
        
        // Compress backup
        exec(`gzip "${backupPath}"`, (error) => {
            if (error) {
                console.error('Error compressing backup:', error);
                return;
            }
            console.log(`Backup created successfully: ${backupPath}.gz`);
            
            // Remove old backups (keep only last 7)
            cleanOldBackups();
        });
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

// Function to remove old backups
function cleanOldBackups() {
    const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.gz'))
        .map(file => ({
            name: file,
            path: path.join(backupDir, file),
            time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Keep only last 7 backups
    const filesToDelete = files.slice(7);
    filesToDelete.forEach(file => {
        try {
            fs.unlinkSync(file.path);
            console.log(`Deleted old backup: ${file.name}`);
        } catch (error) {
            console.error(`Error deleting backup ${file.name}:`, error);
        }
    });
}

// Start backup
createBackup(); 
