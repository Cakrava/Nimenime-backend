@echo off
setlocal enabledelayedexpansion

REM Tentukan root project = lokasi file bat dijalankan
set "ROOT=%~dp0"

echo Membuat struktur folder dan file...

REM Buat folder utama src dan subfoldernya
mkdir "%ROOT%src" 2>nul
mkdir "%ROOT%src\config" 2>nul
mkdir "%ROOT%src\controllers" 2>nul
mkdir "%ROOT%src\middleware" 2>nul
mkdir "%ROOT%src\models" 2>nul
mkdir "%ROOT%src\routes" 2>nul
mkdir "%ROOT%src\services" 2>nul
mkdir "%ROOT%src\utils" 2>nul

REM Buat file di src/
type nul > "%ROOT%src\app.js"

REM config
type nul > "%ROOT%src\config\db.js"
type nul > "%ROOT%src\config\index.js"

REM controllers
type nul > "%ROOT%src\controllers\authController.js"
type nul > "%ROOT%src\controllers\animeController.js"
type nul > "%ROOT%src\controllers\userController.js"
type nul > "%ROOT%src\controllers\systemController.js"

REM middleware
type nul > "%ROOT%src\middleware\authMiddleware.js"
type nul > "%ROOT%src\middleware\errorMiddleware.js"
type nul > "%ROOT%src\middleware\validationMiddleware.js"

REM models
type nul > "%ROOT%src\models\Anime.js"
type nul > "%ROOT%src\models\User.js"
type nul > "%ROOT%src\models\StreamLink.js"
type nul > "%ROOT%src\models\ScrapedLink.js"
type nul > "%ROOT%src\models\ScraperState.js"
type nul > "%ROOT%src\models\SystemState.js"
type nul > "%ROOT%src\models\JobTicket.js"
type nul > "%ROOT%src\models\Review.js"
type nul > "%ROOT%src\models\BrokenLinkReport.js"

REM routes
type nul > "%ROOT%src\routes\authRoutes.js"
type nul > "%ROOT%src\routes\animeRoutes.js"
type nul > "%ROOT%src\routes\userRoutes.js"
type nul > "%ROOT%src\routes\systemRoutes.js"
type nul > "%ROOT%src\routes\jobRoutes.js"

REM services
type nul > "%ROOT%src\services\jikanPollingService.js"
type nul > "%ROOT%src\services\scraperService.js"
type nul > "%ROOT%src\services\enrichmentService.js"
type nul > "%ROOT%src\services\schedulerService.js"
type nul > "%ROOT%src\services\reviewService.js"

REM utils
type nul > "%ROOT%src\utils\xpCalculator.js"

REM File di root project
type nul > "%ROOT%.env"
type nul > "%ROOT%package.json"
type nul > "%ROOT%index.html"
type nul > "%ROOT%server.js"

echo.
echo Struktur berhasil dibuat di: %ROOT%
pause
