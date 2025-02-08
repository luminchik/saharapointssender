const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

// Создаем директорию для бэкапов, если она не существует
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Функция для создания бэкапа
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite3`);
    
    // Путь к основной базе данных
    const dbPath = path.join(__dirname, '..', 'database.sqlite3');

    try {
        // Создаем копию базы данных
        fs.copyFileSync(dbPath, backupPath);
        
        // Сжимаем бэкап
        exec(`gzip "${backupPath}"`, (error) => {
            if (error) {
                console.error('Error compressing backup:', error);
                return;
            }
            console.log(`Backup created successfully: ${backupPath}.gz`);
            
            // Удаляем старые бэкапы (оставляем только последние 7)
            cleanOldBackups();
        });
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

// Функция для удаления старых бэкапов
function cleanOldBackups() {
    const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.gz'))
        .map(file => ({
            name: file,
            path: path.join(backupDir, file),
            time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Оставляем только последние 7 бэкапов
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

// Запускаем бэкап
createBackup(); 