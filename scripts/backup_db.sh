#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Vibe Workflow — Ежедневный бекап базы данных PostgreSQL
# ═══════════════════════════════════════════════════════════════════════════════
#
# Описание:
#   Скрипт создаёт резервную копию базы данных PostgreSQL в формате pg_dump
#   (custom + сжатый). Хранит последние N дней бекапов, удаляя старые.
#
# Установка cron (ежедневно в 3:00):
#   1. Скопируйте этот скрипт на сервер:
#      scp scripts/backup_db.sh user@server:/opt/vibeflow/scripts/backup_db.sh
#
#   2. Сделайте исполняемым:
#      chmod +x /opt/vibeflow/scripts/backup_db.sh
#
#   3. Добавьте в crontab:
#      crontab -e
#      0 3 * * * /opt/vibeflow/scripts/backup_db.sh >> /var/log/vibeflow-backup.log 2>&1
#
#   Или через файл в /etc/cron.d/:
#      echo "0 3 * * * root /opt/vibeflow/scripts/backup_db.sh >> /var/log/vibeflow-backup.log 2>&1" \
#        | sudo tee /etc/cron.d/vibeflow-backup
#      sudo chmod 644 /etc/cron.d/vibeflow-backup
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Конфигурация ─────────────────────────────────────────────────────────────

# Путь к проекту (корень, где лежит docker-compose.yml)
PROJECT_DIR="${VIBEFLOW_PROJECT_DIR:-/opt/vibeflow}"

# Директория для хранения бекапов
BACKUP_DIR="${VIBEFLOW_BACKUP_DIR:-${PROJECT_DIR}/data/backups}"

# Количество дней хранения бекапов (старые удаляются автоматически)
RETENTION_DAYS="${VIBEFLOW_BACKUP_RETENTION_DAYS:-10}"

# Параметры БД (читаются из .env или задаются здесь)
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_NAME="${POSTGRES_DB:-vibeflow}"
DB_CONTAINER="${VIBEFLOW_DB_CONTAINER:-}"

# Имя контейнера Docker с PostgreSQL (автоопределение)
if [ -z "$DB_CONTAINER" ]; then
    # Попробуем найти контейнер автоматически
    if docker ps --format '{{.Names}}' | grep -q "vibe-workflow-db-prod"; then
        DB_CONTAINER="vibe-workflow-db-prod"
    elif docker ps --format '{{.Names}}' | grep -q "vibe-workflow-db-dev"; then
        DB_CONTAINER="vibe-workflow-db-dev"
    else
        # Поиск по образу postgres
        DB_CONTAINER=$(docker ps --filter "ancestor=postgres:16-alpine" --format '{{.Names}}' | head -n1)
    fi
fi

# Логирование
LOG_PREFIX="[vibeflow-backup]"

# ── Функции ──────────────────────────────────────────────────────────────────

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} $1"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ${LOG_PREFIX} [ERROR] $1" >&2
}

# Загрузить переменные из .env файла проекта (если есть)
load_env() {
    local env_file="${PROJECT_DIR}/.env"
    if [ -f "$env_file" ]; then
        log "Загрузка переменных из ${env_file}..."
        # Безопасно экспортируем переменные (только если ещё не заданы)
        while IFS='=' read -r key value; do
            # Пропускаем комментарии и пустые строки
            [[ -z "$key" || "$key" =~ ^# ]] && continue
            # Убираем кавычки
            value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            # Экспортируем если не задана
            if [ -z "${!key:-}" ]; then
                export "$key=$value"
            fi
        done < "$env_file"

        # Обновляем переменные БД если были загружены
        DB_USER="${POSTGRES_USER:-$DB_USER}"
        DB_PASSWORD="${POSTGRES_PASSWORD:-$DB_PASSWORD}"
        DB_NAME="${POSTGRES_DB:-$DB_NAME}"
    fi
}

# ── Основной процесс ────────────────────────────────────────────────────────

main() {
    log "════════════════════════════════════════════════════════════"
    log "Начало бекапа базы данных Vibe Workflow"
    log "════════════════════════════════════════════════════════════"

    # Загрузить .env
    load_env

    # Проверить Docker
    if ! command -v docker &> /dev/null; then
        error "Docker не найден. Установите Docker."
        exit 1
    fi

    # Проверить контейнер
    if [ -z "$DB_CONTAINER" ]; then
        error "Контейнер PostgreSQL не найден. Проверьте что Docker Compose запущен."
        exit 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        error "Контейнер '${DB_CONTAINER}' не запущен."
        exit 1
    fi

    log "Контейнер БД: ${DB_CONTAINER}"
    log "База данных:  ${DB_NAME}"
    log "Пользователь: ${DB_USER}"

    # Создать директорию для бекапов
    mkdir -p "$BACKUP_DIR"

    # Сформировать имя файла
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    BACKUP_FILE="${BACKUP_DIR}/vibeflow_backup_${TIMESTAMP}.dump"
    BACKUP_FILE_SQL="${BACKUP_DIR}/vibeflow_backup_${TIMESTAMP}.sql"

    # ── Создание бекапа (custom format — сжатый, поддерживает pg_restore) ──
    log "Создание бекапа в формате custom (.dump)..."
    if docker exec -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc \
        > "${BACKUP_FILE}"; then

        DUMP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
        log "✅ Бекап .dump создан: ${BACKUP_FILE} (${DUMP_SIZE})"
    else
        error "❌ Ошибка при создании бекапа .dump"
        rm -f "${BACKUP_FILE}"
        exit 1
    fi

    # ── Создание бекапа (plain SQL — для удобства просмотра) ──
    log "Создание бекапа в формате SQL..."
    if docker exec -e PGPASSWORD="${DB_PASSWORD}" "${DB_CONTAINER}" \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists \
        > "${BACKUP_FILE_SQL}"; then

        SQL_SIZE=$(du -h "${BACKUP_FILE_SQL}" | cut -f1)
        log "✅ Бекап .sql создан: ${BACKUP_FILE_SQL} (${SQL_SIZE})"
    else
        error "⚠️  Ошибка при создании SQL бекапа (не критично)"
        rm -f "${BACKUP_FILE_SQL}"
    fi

    # ── Удаление старых бекапов ──
    log "Удаление бекапов старше ${RETENTION_DAYS} дней..."
    DELETED_COUNT=$(find "${BACKUP_DIR}" -name "vibeflow_backup_*" -type f -mtime +${RETENTION_DAYS} -print -delete | wc -l)
    if [ "$DELETED_COUNT" -gt 0 ]; then
        log "🗑  Удалено старых бекапов: ${DELETED_COUNT}"
    else
        log "Старых бекапов для удаления нет."
    fi

    # ── Статистика ──
    TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "vibeflow_backup_*" -type f | wc -l)
    TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

    log "────────────────────────────────────────────────────────────"
    log "📊 Итого бекапов: ${TOTAL_BACKUPS} | Общий размер: ${TOTAL_SIZE}"
    log "✅ Бекап завершён успешно!"
    log "════════════════════════════════════════════════════════════"
}

# Запуск
main "$@"
