// main.js
// Точка входа, инициализация, связывание UI и Photoshop логики

const { app, core } = require("photoshop");
// Импортируем модули
const ui = require("./ui.js");
const ps = require("./photoshop.js"); // Функции для работы с Photoshop

// --- Инициализация ---
document.addEventListener("DOMContentLoaded", () => {
    // Получаем ссылки на все элементы UI и сохраняем в ui.elements
    ui.elements.step1 = document.getElementById("step1");
    ui.elements.btnSelectJson = document.getElementById("btnSelectJson");
    ui.elements.jsonPathLabel = document.getElementById("jsonPathLabel");
    ui.elements.btnSelectImageDir = document.getElementById("btnSelectImageDir");
    ui.elements.imageDirLabel = document.getElementById("imageDirLabel");
    ui.elements.btnNextToStep2 = document.getElementById("btnNextToStep2");

    ui.elements.step2 = document.getElementById("step2");
    ui.elements.pageListContainer = document.getElementById("pageListContainer");
    ui.elements.btnSelectAllPages = document.getElementById("btnSelectAllPages");
    ui.elements.btnDeselectAllPages = document.getElementById("btnDeselectAllPages");
    ui.elements.btnBackToStep1 = document.getElementById("btnBackToStep1");
    ui.elements.btnNextToStep3 = document.getElementById("btnNextToStep3");

    ui.elements.step3 = document.getElementById("step3");
    ui.elements.chkImportOriginal = document.getElementById("chkImportOriginal");
    ui.elements.chkImportTranslation = document.getElementById("chkImportTranslation");
    ui.elements.chkUseJsonFormatting = document.getElementById("chkUseJsonFormatting");
    ui.elements.chkOverrideFontSize = document.getElementById("chkOverrideFontSize");
    ui.elements.btnGetStyle = document.getElementById("btnGetStyle");
    ui.elements.fontPicker = document.getElementById("fontPicker");
    ui.elements.fontSizeInput = document.getElementById("fontSizeInput");
    ui.elements.fontColorInput = document.getElementById("fontColorInput");
    ui.elements.alignmentPicker = document.getElementById("alignmentPicker");
    ui.elements.btnBackToStep2 = document.getElementById("btnBackToStep2");
    ui.elements.btnStartImport = document.getElementById("btnStartImport");

    ui.elements.statusContainer = document.getElementById("statusContainer");
    ui.elements.statusArea = document.getElementById("statusArea");

    // Проверка наличия всех элементов
    for (const key in ui.elements) {
        if (!ui.elements[key]) {
            console.error(`ОШИБКА ИНИЦИАЛИЗАЦИИ: Элемент UI '${key}' не найден!`);
            alert(`Критическая ошибка: Элемент UI '${key}' не найден.`);
            return; // Прерываем инициализацию
        }
    }

    // --- Назначение обработчиков ---

    // Шаг 1
    ui.elements.btnSelectJson.addEventListener("click", ui.handleSelectJsonUI);
    ui.elements.btnSelectImageDir.addEventListener("click", ui.handleSelectImageDirUI);
    ui.elements.btnNextToStep2.addEventListener("click", async () => {
        const data = await ui.loadAndParseJson();
        if (!data) return; // Ошибка парсинга обработана внутри
        const pages = await ui.filterPagesByFolder();
        if (pages.length === 0) {
             ui.populatePageListUI(); // Показать сообщение об отсутствии страниц
        } else {
             ui.populatePageListUI();
             ui.showStepUI('step2');
        }
    });

    // Шаг 2
    ui.elements.btnSelectAllPages.addEventListener("click", () => ui.handleSelectAllPagesUI(true));
    ui.elements.btnDeselectAllPages.addEventListener("click", () => ui.handleSelectAllPagesUI(false));
    ui.elements.btnBackToStep1.addEventListener("click", () => ui.showStepUI('step1'));
    ui.elements.btnNextToStep3.addEventListener("click", async () => {
        const success = await ui.prepareTokensForStep3();
        if (success) {
            ui.showStepUI('step3');
            // Передаем итератор шрифтов в UI модуль для загрузки
            ui.loadFontsUI(app.fonts); // Загружаем шрифты при переходе
        }
    });

    // Шаг 3
    ui.elements.btnGetStyle.addEventListener("click", async () => {
        try {
            // Вызываем функцию из photoshop.js, передавая функцию логгирования из ui.js
            const styleInfo = await ps.getActiveLayerStylePS(ui.updateStatusUI);
            // Обновляем UI с помощью функции из ui.js
            ui.setUIFromStyle(styleInfo);
        } catch (e) {
            ui.updateStatusUI(`Ошибка получения стиля: ${formatError(e)}`, true);
            core.showAlert(`Ошибка получения стиля: ${e.message}`);
        }
    });
    ui.elements.btnBackToStep2.addEventListener("click", () => ui.showStepUI('step2'));
    ui.elements.btnStartImport.addEventListener("click", async () => {
        const settings = ui.getUISettings(); // Получаем все настройки из UI
        ui.setImportButtonState(false); // Блокируем кнопки
        try {
            await ps.importTextLayersPS({ // Вызываем функцию из photoshop.js
                selectedPageNames: ui.selectedPageNames, // Используем данные, сохраненные в ui.js
                pageFileTokens: ui.pageFileTokens,
                projectData: ui.projectData,
                ...settings // Добавляем остальные настройки
            }, ui.updateStatusUI); // Передаем функцию логгирования
             ui.updateStatusUI("Импорт завершен!", true);
        } catch(e) {
             ui.updateStatusUI(`Критическая ошибка импорта: ${formatError(e)}`, true);
             core.showAlert(`Импорт прерван: ${e.message || e}`);
        } finally {
            ui.setImportButtonState(true); // Разблокируем кнопки
            ui.updateStatusUI("Кнопки разблокированы.", true);
        }
    });

    // Начальное состояние
    ui.showStepUI('step1');
    ui.validateStep1UI();
    ui.updateStatusUI("Плагин инициализирован.");
});