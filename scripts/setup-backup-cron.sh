#!/bin/bash

# Получаем абсолютный путь к директории проекта
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Создаем временный файл для crontab
TEMP_CRON=$(mktemp)

# Экспортируем текущий crontab
crontab -l > "$TEMP_CRON" 2>/dev/null

# Добавляем задачу для ежедневного бэкапа в полночь
# Также добавляем еженедельный бэкап в воскресенье
echo "# Sahara AI - Database Backups" >> "$TEMP_CRON"
echo "0 0 * * * cd $PROJECT_DIR && npm run backup >> $PROJECT_DIR/logs/backup.log 2>&1" >> "$TEMP_CRON"
echo "0 0 * * 0 cd $PROJECT_DIR && npm run backup >> $PROJECT_DIR/logs/backup-weekly.log 2>&1" >> "$TEMP_CRON"

# Устанавливаем новый crontab
crontab "$TEMP_CRON"

# Удаляем временный файл
rm "$TEMP_CRON"

# Создаем директорию для логов, если она не существует
mkdir -p "$PROJECT_DIR/logs"

echo "Backup cron jobs have been set up successfully!"
echo "Daily backup at midnight"
echo "Weekly backup on Sunday at midnight"
echo "Logs will be written to: $PROJECT_DIR/logs/backup.log and backup-weekly.log" 