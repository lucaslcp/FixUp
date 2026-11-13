@echo off
rem Servi - inicia o servidor local e abre o app no navegador.
title Servi - servidor local
start "" "http://localhost:5173/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Port 5173
