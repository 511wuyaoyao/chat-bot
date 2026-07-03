@echo off
wsl -d Ubuntu-22.04 -- bash -lc "sudo systemctl start docker; docker start napcat"
start "QQ-Bot" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 /nobreak >nul
start http://127.0.0.1:6099/webui?token=a1b7ed8548fb
