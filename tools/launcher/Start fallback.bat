@echo off
rem Compiles launcher\Launcher.cs in memory, for machines that block the exe.
set "KIT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -TypeDefinition ([IO.File]::ReadAllText($env:KIT + 'launcher\Launcher.cs')); [DefenseLauncher]::Main([string[]]@('--root', ($env:KIT + 'app')))"
pause
