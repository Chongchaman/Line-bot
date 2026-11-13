@echo off
title ngrok Tunnel for LINE Bot
color 0B
echo ============================================================
echo   Starting ngrok Tunnel (Port 3000)
echo ============================================================
echo Copy the HTTPS URL below and paste it into LINE Developers:
echo https://xxxx.ngrok-free.app/webhook
echo ============================================================
ngrok http 3000
pause
