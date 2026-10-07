#!/bin/sh
# Однократная настройка сервера под раздел «Проекты» (PDF).
# Запуск:  sh /opt/bms-app/deploy/setup-projects.sh
# Повторный запуск безопасен — уже сделанные шаги пропускаются.
set -e
P=/opt/supabase-project
CADDY=$P/volumes/proxy/caddy/Caddyfile

echo "1/4 Таблица и хранилище для PDF…"
docker exec -i supabase-db psql -q -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < /opt/bms-app/supabase/migration_08_projects.sql
echo "    готово"

echo "2/4 Лимит размера файла 500 МБ (по умолчанию 50 МБ)…"
if grep -q FILE_SIZE_LIMIT "$P/docker-compose.local.yml"; then
  echo "    уже настроено"
else
  printf '  storage:\n    environment:\n      FILE_SIZE_LIMIT: "524288000"\n' >> "$P/docker-compose.local.yml"
  echo "    готово"
fi

echo "3/4 Прямой маршрут к файлам в Caddy (без 30-секундного таймаута шлюза)…"
if grep -q storage_files "$CADDY"; then
  echo "    уже настроено"
else
  python3 - "$CADDY" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
block = '''
    # Файлы (PDF проектов) — напрямую в хранилище: большие файлы не упираются в таймаут шлюза.
    # Хранилище само CORS не отдаёт — добавляем здесь.
    @storage_files path /storage/v1/object/*
    handle @storage_files {
        header Access-Control-Allow-Origin "*"
        header Access-Control-Allow-Headers "*"
        header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        header Access-Control-Max-Age "86400"
        @preflight method OPTIONS
        respond @preflight 204
        uri strip_prefix /storage/v1
        reverse_proxy storage:5000 {
            flush_interval -1
        }
    }
'''
anchor = '{$PROXY_DOMAIN} {'
i = s.index(anchor) + len(anchor)
s = s[:i] + '\n' + block + s[i:]
open(p, 'w', encoding='utf-8').write(s)
PY
  echo "    готово"
fi

echo "4/4 Перезапуск хранилища и Caddy…"
cd "$P"
docker compose up -d storage >/dev/null 2>&1
docker restart supabase-caddy >/dev/null
sleep 6

echo
echo "Проверка:"
docker exec supabase-storage printenv FILE_SIZE_LIMIT | sed 's/^/  лимит файла, байт: /'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "https://bms.tw1.ru/storage/v1/object/projects/test.pdf" \
  -H "Origin: https://app.bms.tw1.ru" -H "Access-Control-Request-Method: POST")
echo "  доступ из приложения (ждём 204): $CODE"
docker exec supabase-db psql -tA -U postgres -d postgres -c "select '  бакет projects: ' || count(*) from storage.buckets where id='projects'"
echo
echo "Готово. Теперь обновите приложение: /opt/update-app.sh"
