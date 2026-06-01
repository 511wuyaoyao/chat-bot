@echo off
start "NapCatQQ" cmd /k "cd /d %~dp0NapCat.Shell.Windows.OneKey\NapCat.44498.Shell && napcat.bat"
start "QQ-Bot" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 /nobreak >nul
start http://127.0.0.1:6099/webui?token=a849ee4b1775
