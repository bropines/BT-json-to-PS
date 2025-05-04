// ui.js
// Отвечает за взаимодействие с HTML элементами панели

const { core } = require("photoshop"); // Нужен для showAlert
const fs = require("uxp").storage.localFileSystem; // Нужен для выбора файлов

// --- Переменные для хранения ссылок на UI элементы ---
// (Они будут установлены из main.js при инициализации)
let elements = {}; // { step1, btnSelectJson, ..., statusArea }

// --- Переменные состояния UI ---
let selectedJsonFile = null;
let selectedImageFolder = null;
let projectData = null; // Распарсенный JSON
let availablePagesInData = []; // Отфильтрованные страницы
let availableFonts = []; // Загруженные шрифты
let selectedPageNames = []; // Выбранные имена страниц
let pageFileTokens = {};    // Токены для выбранных страниц

// --- Утилиты UI ---
function updateStatusUI(message, append = false) {
    if (elements.statusArea) {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `${timestamp}: ${message}`;
        if (append) {
            const needsBreak = elements.statusArea.innerHTML.length > 0 && !elements.statusArea.innerHTML.endsWith('<br>');
            elements.statusArea.innerHTML += (needsBreak ? '<br>' : '') + formattedMessage;
            elements.statusArea.scrollTop = elements.statusArea.scrollHeight;
        } else {
            elements.statusArea.textContent = formattedMessage;
        }
    }
     console.log("(UI Log) " + message); // Дублируем в консоль для простоты
}

function showStepUI(stepToShowId) {
    document.querySelectorAll('.step').forEach(step => {
        if (step.id === stepToShowId) {
            step.classList.remove('hidden');
            step.classList.add('visible');
        } else {
            step.classList.remove('visible');
            step.classList.add('hidden');
        }
    });
    elements.statusContainer.style.display = (stepToShowId === 'step3') ? 'block' : 'none';
}

function validateStep1UI() {
    elements.btnNextToStep2.disabled = !(selectedJsonFile && selectedImageFolder);
}

function validateStep2UI() {
    console.log("UI: Running validateStep2UI...");
    let isAnyChecked = false;
    const checkboxes = elements.pageListContainer.querySelectorAll('sp-checkbox');
    checkboxes.forEach(chk => { if (chk.checked) { isAnyChecked = true; } });
    const shouldBeEnabled = availablePagesInData.length > 0 && isAnyChecked;
    elements.btnNextToStep3.disabled = !shouldBeEnabled;
    console.log(`UI: Validate Step 2 - AnyChecked: ${isAnyChecked}, AvailablePages: ${availablePagesInData.length}, ButtonDisabled: ${elements.btnNextToStep3.disabled}`);
}

// --- Обработчики событий UI (вызываются из main.js) ---
async function handleSelectJsonUI() {
    try {
        const entry = await fs.getFileForOpening({ types: ["json"] });
        if (entry) {
            selectedJsonFile = entry;
            elements.jsonPathLabel.textContent = `JSON: ${entry.name}`;
            projectData = null; availablePagesInData = []; pageFileTokens = {}; elements.pageListContainer.innerHTML = '';
            validateStep1UI();
            updateStatusUI("JSON файл выбран."); elements.statusArea.textContent = "Выберите папку с изображениями.";
            return selectedJsonFile; // Возвращаем для main.js
        }
    } catch (e) {
        updateStatusUI(`Ошибка выбора JSON: ${e.message}`);
        selectedJsonFile = null; projectData = null; availablePagesInData = []; pageFileTokens = {}; elements.pageListContainer.innerHTML = '';
        elements.jsonPathLabel.textContent = "Файл не выбран";
        validateStep1UI();
    }
    return null;
}

async function handleSelectImageDirUI() {
    try {
        const entry = await fs.getFolder();
        if (entry) {
            selectedImageFolder = entry;
            elements.imageDirLabel.textContent = `Папка: ${entry.name}`;
            availablePagesInData = []; pageFileTokens = {}; elements.pageListContainer.innerHTML = '';
            validateStep1UI();
            updateStatusUI("Папка с изображениями выбрана.");
            elements.statusArea.textContent = selectedJsonFile ? "Нажмите 'Далее'." : "Выберите JSON файл.";
            return selectedImageFolder; // Возвращаем для main.js
        }
    } catch (e) {
        updateStatusUI(`Ошибка выбора папки: ${e.message}`);
        selectedImageFolder = null; availablePagesInData = []; pageFileTokens = {}; elements.pageListContainer.innerHTML = '';
        elements.imageDirLabel.textContent = "Папка не выбрана";
        validateStep1UI();
    }
    return null;
}

async function loadAndParseJson() {
    if (!selectedJsonFile) return null;
    try {
        const jsonContent = await selectedJsonFile.read();
        projectData = JSON.parse(jsonContent);
        if (!projectData?.pages || typeof projectData.pages !== 'object') {
            throw new Error("Неверная структура JSON: объект 'pages' не найден или некорректен.");
        }
        return projectData;
    } catch (e) {
        updateStatusUI(`Ошибка чтения/парсинга JSON: ${e.message}`);
        core.showAlert(`Ошибка чтения или парсинга JSON: ${e.message || e}`);
        projectData = null;
        return null;
    }
}

async function filterPagesByFolder() {
    if (!projectData || !selectedImageFolder) return [];
    try {
        const jsonPageKeys = Object.keys(projectData.pages);
        updateStatusUI(`Найдено страниц в JSON: ${jsonPageKeys.length}`, true);
        const folderEntries = await selectedImageFolder.getEntries();
        const folderFileNames = new Set(folderEntries.filter(entry => !entry.isFolder).map(entry => entry.name));
        updateStatusUI(`Найдено файлов в папке: ${folderFileNames.size}`, true);
        availablePagesInData = jsonPageKeys.filter(key => {
            const exists = folderFileNames.has(key);
            if (!exists) { updateStatusUI(` Предупреждение: Страница "${key}" из JSON не найдена в папке.`, true); }
            return exists;
        }).sort();
        updateStatusUI(`Страниц для импорта (есть в JSON и папке): ${availablePagesInData.length}`, true);
        return availablePagesInData;
    } catch (e) {
        updateStatusUI(`Ошибка фильтрации страниц: ${e.message}`);
        core.showAlert(`Ошибка получения файлов из папки: ${e.message}`);
        availablePagesInData = [];
        return [];
    }
}

function populatePageListUI() {
    elements.pageListContainer.innerHTML = '';
    if (availablePagesInData.length === 0) {
        elements.pageListContainer.innerHTML = '<sp-body>Нет страниц для импорта.</sp-body>';
        validateStep2UI(); return;
    }
    availablePagesInData.forEach(pageName => {
        const checkbox = document.createElement('sp-checkbox');
        checkbox.textContent = pageName; checkbox.value = pageName; checkbox.checked = true;
        checkbox.addEventListener('change', () => validateStep2UI()); // Валидация при изменении
        elements.pageListContainer.appendChild(checkbox);
    });
    validateStep2UI(); // Валидация после заполнения
}

function handleSelectAllPagesUI(select = true) {
    elements.pageListContainer.querySelectorAll('sp-checkbox').forEach(chk => {
        if (chk.checked !== select) { chk.checked = select; }
    });
    validateStep2UI();
}

async function prepareTokensForStep3() {
    updateStatusUI("Сбор выбранных страниц и создание токенов...", true);
    selectedPageNames = [];
    pageFileTokens = {};
    const checkboxes = elements.pageListContainer.querySelectorAll('sp-checkbox');
    const tokenPromises = [];

    checkboxes.forEach(chk => {
        if (chk.checked) {
            const pageName = chk.value;
            selectedPageNames.push(pageName);
            tokenPromises.push(
                selectedImageFolder.getEntry(pageName)
                .then(async (entry) => { if (entry && !entry.isFolder) { try { const token = await fs.createSessionToken(entry); pageFileTokens[pageName] = token; updateStatusUI(` Токен ${pageName} создан.`, true); } catch (tokenError) { updateStatusUI(` Ошибка токена ${pageName}: ${formatError(tokenError)}`, true); } } else { updateStatusUI(` Файл для токена "${pageName}" не найден/папка.`, true); } })
                .catch(e => { updateStatusUI(` Ошибка получения файла для токена "${pageName}": ${formatError(e)}`, true); })
            );
        }
    });

    await Promise.all(tokenPromises);
    const validTokenCount = Object.keys(pageFileTokens).length;
    updateStatusUI(`Найдено страниц: ${selectedPageNames.length}. Создано токенов: ${validTokenCount}`, true);
    selectedPageNames = selectedPageNames.filter(name => pageFileTokens[name]); // Оставляем только те, для которых есть токен

    if (selectedPageNames.length === 0) {
        core.showAlert("Не выбраны страницы или не удалось создать токены.");
        return false; // Сигнализируем об ошибке
    }
    return true; // Успех
}

async function loadFontsUI(appFonts) { // Передаем app.fonts снаружи
    try {
        if (availableFonts.length > 0) return;
        updateStatusUI("Загрузка списка шрифтов...");
        availableFonts = [];
        for (const font of appFonts) { availableFonts.push(font); } // Используем переданный итератор

        elements.fontPicker.innerHTML = '';
        availableFonts.sort((a, b) => a.name.localeCompare(b.name));
        availableFonts.forEach(font => {
            const menuItem = document.createElement('sp-menu-item');
            menuItem.value = font.postScriptName; menuItem.textContent = font.name;
            if (font.postScriptName === "MyriadPro-Regular") { menuItem.selected = true; elements.fontPicker.value = "MyriadPro-Regular"; }
            elements.fontPicker.appendChild(menuItem);
        });
        if (!elements.fontPicker.value && availableFonts.length > 0) { elements.fontPicker.children[0].selected = true; elements.fontPicker.value = availableFonts[0].postScriptName; }
        updateStatusUI(`Загружено ${availableFonts.length} шрифтов.`);
    } catch (e) {
        updateStatusUI(`Ошибка загрузки шрифтов: ${formatError(e)}`);
        const menuItem = document.createElement('sp-menu-item'); menuItem.value = "MyriadPro-Regular"; menuItem.textContent = "Myriad Pro Regular (Default)"; menuItem.selected = true; elements.fontPicker.appendChild(menuItem); elements.fontPicker.value = "MyriadPro-Regular";
    }
}

function getUISettings() {
    return {
        importOriginal: elements.chkImportOriginal.checked,
        importTranslation: elements.chkImportTranslation.checked,
        useJsonFormatting: elements.chkUseJsonFormatting.checked,
        overrideFontSize: elements.chkOverrideFontSize.checked,
        uiFontSettings: {
            family: elements.fontPicker.value || "MyriadPro-Regular",
            size: parseFloat(elements.fontSizeInput.value) || 12,
            colorHex: elements.fontColorInput.value || "#000000",
            alignmentValue: elements.alignmentPicker.value || "left"
        }
    };
}

function setUIFromStyle(styleInfo) {
     if (styleInfo) {
        console.log("UI: Извлеченный стиль:", styleInfo);
        updateStatusUI(`Стиль извлечен: ${styleInfo.fontPostScriptName}, ${styleInfo.fontSize}pt, ${styleInfo.colorHex}`, true);

         const fontExists = availableFonts.some(f => f.postScriptName === styleInfo.fontPostScriptName);
         if (fontExists) {
             elements.fontPicker.value = styleInfo.fontPostScriptName;
             const items = elements.fontPicker.querySelectorAll('sp-menu-item');
             items.forEach(item => item.selected = (item.value === styleInfo.fontPostScriptName));
         } else { updateStatusUI(` Предупреждение: Шрифт "${styleInfo.fontPostScriptName}" не найден.`, true); }

        elements.fontSizeInput.value = styleInfo.fontSize;
        elements.fontColorInput.value = styleInfo.colorHex;

        let alignmentValue = "left";
        Object.entries(constants.Justification).forEach(([key, value]) => { if (value === styleInfo.justification) { switch(value) { /* ... как раньше ... */ case constants.Justification.CENTER: alignmentValue = "center"; break; case constants.Justification.RIGHT: alignmentValue = "right"; break; case constants.Justification.LEFTJUSTIFIED: alignmentValue = "leftJustified"; break; case constants.Justification.CENTERJUSTIFIED: alignmentValue = "centerJustified"; break; case constants.Justification.RIGHTJUSTIFIED: alignmentValue = "rightJustified"; break; case constants.Justification.FULLYJUSTIFIED: alignmentValue = "fullyJustified"; break; default: alignmentValue = "left"; } } });
        elements.alignmentPicker.value = alignmentValue;
        const alignmentItems = elements.alignmentPicker.querySelectorAll('sp-menu-item');
        alignmentItems.forEach(item => item.selected = (item.value === alignmentValue));

        updateStatusUI("Настройки UI обновлены.", true);
    } else { updateStatusUI("Не удалось получить информацию о стиле.", true); }
}

function setImportButtonState(enabled) {
    elements.btnStartImport.disabled = !enabled;
    elements.btnBackToStep2.disabled = !enabled; // Блокируем и "Назад" во время импорта
}


// --- Экспортируем функции и переменные, нужные main.js ---
module.exports = {
    elements, // Экспортируем объект для заполнения ссылками
    updateStatusUI,
    showStepUI,
    validateStep1UI,
    validateStep2UI,
    handleSelectJsonUI,
    handleSelectImageDirUI,
    loadAndParseJson,
    filterPagesByFolder,
    populatePageListUI,
    handleSelectAllPagesUI,
    prepareTokensForStep3,
    loadFontsUI,
    getUISettings,
    setUIFromStyle,
    setImportButtonState,
    // Экспортируем состояния, чтобы main мог их читать
    get selectedPageNames() { return selectedPageNames; },
    get pageFileTokens() { return pageFileTokens; },
    get projectData() { return projectData; },
};