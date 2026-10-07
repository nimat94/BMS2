#!/bin/sh
# Однократная настройка сервера: вход по телефону (без SMS) и сброс пароля администратором.
# Запуск:  sh /opt/bms-app/deploy/setup-phone-login.sh
# Повторный запуск безопасен.
set -e
P=/opt/supabase-project

echo "1/3 Регистрация по телефону без SMS…"
for KEY in ENABLE_PHONE_SIGNUP ENABLE_PHONE_AUTOCONFIRM; do
  if grep -q "^$KEY=" "$P/.env"; then
    sed -i "s|^$KEY=.*|$KEY=true|" "$P/.env"
  else
    echo "$KEY=true" >> "$P/.env"
  fi
done
grep -E '^ENABLE_PHONE_(SIGNUP|AUTOCONFIRM)=' "$P/.env" | sed 's/^/    /'

echo "2/3 Профиль с телефоном и сброс пароля администратором…"
docker exec -i supabase-db psql -q -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < /opt/bms-app/supabase/migration_09_phone_login.sql
echo "    готово"

echo "3/3 Перезапуск сервиса авторизации…"
cd "$P" && docker compose up -d auth >/dev/null 2>&1
sleep 4
echo "    настройки внутри: phone=$(docker exec supabase-auth printenv GOTRUE_EXTERNAL_PHONE_ENABLED) autoconfirm=$(docker exec supabase-auth printenv GOTRUE_SMS_AUTOCONFIRM)"
echo
echo "Готово. Если ещё не обновляли приложение: /opt/update-app.sh"
