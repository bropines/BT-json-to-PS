// photoshop.js
// Отвечает за все взаимодействия с Photoshop API

const { app, core, constants } = require("photoshop");
const fs = require("uxp").storage.localFileSystem; // Для восстановления токенов

// Вспомогательные функции, специфичные для Photoshop
function hexToSolidColor(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); const color = new app.SolidColor(); if (result) { try { color.rgb.red = parseInt(result[1], 16); color.rgb.green = parseInt(result[2], 16); color.rgb.blue = parseInt(result[3], 16); } catch (e) { console.error(`Invalid hex: ${hex}`); } } return color; }
function convertAlignmentValue(value) { switch (value) { case "center": return constants.Justification.CENTER; case "right": return constants.Justification.RIGHT; case "leftJustified": return constants.Justification.LEFTJUSTIFIED; case "centerJustified": return constants.Justification.CENTERJUSTIFIED; case "rightJustified": return constants.Justification.RIGHTJUSTIFIED; case "fullyJustified": return constants.Justification.FULLYJUSTIFIED; case "left": default: return constants.Justification.LEFT; } }

async function findOrCreateGroupPS(doc, groupName, logFn) { // Передаем функцию логгирования
    let groupLayer = null;
    try { groupLayer = doc.layerTree.find(layer => layer.name === groupName && layer.kind === constants.LayerKind.GROUP); }
    catch (e) { logFn(`  Поиск гр. "${groupName}": ${e.message}`, true); }
    if (!groupLayer) { logFn(`  Создание гр. "${groupName}"...`, true); groupLayer = await doc.createLayerGroup({ name: groupName }); logFn(`  Гр. "${groupName}" ID: ${groupLayer.id}.`, true); }
    else { logFn(`  Найдена гр. "${groupName}" ID: ${groupLayer.id}).`, true); }
    return groupLayer;
}

// Функция получения стиля с активного слоя
async function getActiveLayerStylePS(logFn) {
    return core.executeAsModal(async (executionContext) => {
        logFn("PS: Запрос стиля с активного слоя...", true);
        const activeDoc = app.activeDocument; if (!activeDoc) throw new Error("Нет активного документа.");
        const activeLayers = activeDoc.activeLayers; if (!activeLayers || activeLayers.length !== 1) throw new Error("Выберите ровно один текстовый слой.");
        const layer = activeLayers[0]; if (layer.kind !== constants.LayerKind.TEXT) throw new Error("Выбранный слой не текстовый.");
        const textItem = layer.textItem; const charStyle = textItem.characterStyle; const paraStyle = textItem.paragraphStyle;
        const fontPostScriptName = charStyle.font; const fontSize = charStyle.size; const color = charStyle.color; const justification = paraStyle.justification;
        logFn(`PS: Стиль получен - ${fontPostScriptName}, ${fontSize}pt, #${color.rgb.hexValue}, ${justification}`, true);
        return { fontPostScriptName, fontSize, colorHex: `#${color.rgb.hexValue}`, justification };
    }, { "commandName": "Get Text Layer Style" });
}

// --- Основная функция импорта (теперь внутри этого модуля) ---
async function importTextLayersPS(importParams, logFn) {
    // logFn - функция для вывода статуса (например, updateStatusUI из ui.js)
    const { selectedPageNames, importOriginal, importTranslation, useJsonFormatting, overrideFontSize, uiFontSettings, projectData, pageFileTokens } = importParams;

    return core.executeAsModal(async (executionContext, descriptor) => {
        // Используем descriptor для получения данных, переданных во внутренний executeAsModal, если он есть
        // Но в данном случае мы получаем их напрямую из importParams, переданных в функцию importTextLayersPS
        logFn("PS: Вход в модальный режим...", true);
        let suspension = null; let isHistorySuspended = false; let currentDoc = null;
        try {
            let processedPageCount = 0;
            for (const imageFileName of selectedPageNames) {
                // ... (прогресс, отмена)
                 const progressValue = processedPageCount / selectedPageNames.length; executionContext.reportProgress({ value: progressValue, commandName: `Обработка ${imageFileName}` }); if (executionContext.isCancelled) { logFn("PS: Отменено.", true); break; } logFn(`PS: Обработка ${imageFileName}...`, true);

                // --- Восстановление и открытие файла ---
                let imageFileEntry = null; const token = pageFileTokens[imageFileName]; if (!token) { logFn(` PS: Предупреждение: Токен ${imageFileName} не найден. Пропуск.`, true); processedPageCount++; continue; }
                try { logFn(` PS: Восстановление ${imageFileName}...`, true); imageFileEntry = await fs.getEntryForSessionToken(token); if (!imageFileEntry) { throw new Error("null entry"); } logFn(` PS: Файл ${imageFileName} восстановлен.`, true); }
                catch (getEntryError) { logFn(` PS: Ошибка восстановления ${imageFileName}: ${formatError(getEntryError)}. Пропуск.`, true); processedPageCount++; continue; }

                isHistorySuspended = false; suspension = null; currentDoc = null;
                try { if (app.documents.length > 0 && app.activeDocument?.name === imageFileName) { currentDoc = app.activeDocument; logFn(` PS: Документ ${imageFileName} уже открыт (ID: ${currentDoc.id}).`, true); } else { logFn(` PS: Открытие ${imageFileName}...`, true); currentDoc = await app.open(imageFileEntry); if (!currentDoc) { logFn(` PS: Ошибка открытия ${imageFileName}. Пропуск.`, true); processedPageCount++; continue; } logFn(` PS: Открыт ${imageFileName} (ID: ${currentDoc.id}).`, true); }
                     logFn(` PS: Приостановка истории ${currentDoc.id}...`, true); suspension = await executionContext.hostControl.suspendHistory({ documentID: currentDoc.id, name: `JSON Import: ${imageFileName}` }); isHistorySuspended = true; logFn(" PS: История приостановлена.", true);
                } catch (e) { logFn(` PS: КРИТ. ОШИБКА открытия/получения ${imageFileName}: ${formatError(e)}. Пропуск.`, true); processedPageCount++; continue; }

                // --- Модификации документа ---
                try {
                    // ... (создание групп)
                    const originalGroupName = "Originals"; const translationGroupName = "Translations"; let originalGroup = null; let translationGroup = null;
                    let canImportOriginal = importOriginal; // Локальные флаги на случай ошибки создания группы
                    let canImportTranslation = importTranslation;
                    if (importOriginal) { try { originalGroup = await findOrCreateGroupPS(currentDoc, originalGroupName, logFn); } catch(e) { logFn(` PS: Ошибка группы ${originalGroupName}: ${formatError(e)}`, true); canImportOriginal = false; } }
                    if (importTranslation) { try { translationGroup = await findOrCreateGroupPS(currentDoc, translationGroupName, logFn); } catch(e) { logFn(` PS: Ошибка группы ${translationGroupName}: ${formatError(e)}`, true); canImportTranslation = false; } }
                    if (!canImportOriginal && !canImportTranslation) { logFn(` PS: Нет активных групп для ${imageFileName}. Пропуск блоков.`, true); }
                    else {
                        const textBlocks = projectData.pages[imageFileName]; if (!Array.isArray(textBlocks)) { logFn(` PS: Предупреждение: Некорректные блоки ${imageFileName}.`, true); }
                        else {
                            logFn(` PS: Найдено блоков: ${textBlocks.length}`, true);
                            for (let i = 0; i < textBlocks.length; i++) {
                                // ... (проверка отмены, получение блока, данных, границ)
                                if (executionContext.isCancelled) break; const block = textBlocks[i]; const blockNumber = i + 1; logFn(`  PS: Блок ${blockNumber}...`, true); try { if (!block || typeof block !== 'object') { logFn(`   PS: Пропуск невал. блока ${blockNumber}.`, true); continue; } const blockData = { original: { needed: canImportOriginal, content: block.text?.join("\n") || "", layerName: `Original ${blockNumber}`, targetGroup: originalGroup }, translation: { needed: canImportTranslation, content: block.translation || "", layerName: `Translation ${blockNumber}`, targetGroup: translationGroup } }; let x, y, width, height; if (block._bounding_rect?.length === 4 && block._bounding_rect[2] > 0 && block._bounding_rect[3] > 0) { [x, y, width, height] = block._bounding_rect; } else if (block.xyxy?.length === 4 && (block.xyxy[2] - block.xyxy[0]) > 0 && (block.xyxy[3] - block.xyxy[1]) > 0) { x = block.xyxy[0]; y = block.xyxy[1]; width = block.xyxy[2] - block.xyxy[0]; height = block.xyxy[3] - block.xyxy[1]; } else { logFn(`   PS: Нет границ ${blockNumber}. Пропуск.`, true); continue; } logFn(`   PS: Границы (${width}x${height}) JSON Pos: x=${x}, y=${y}`, true);

                                // --- Определение форматирования ---
                                let formatSettings = {}; let finalFontSize; let finalAlignment = constants.Justification.LEFT;
                                if (useJsonFormatting && block.fontformat) { logFn(`   PS: Формат JSON`, true); formatSettings.family = block.fontformat.font_family || uiFontSettings.family; finalFontSize = (overrideFontSize) ? uiFontSettings.size : (block.fontformat.font_size > 0 ? block.fontformat.font_size : uiFontSettings.size); if (block.fontformat.frgb?.length === 3) { formatSettings.color = new app.SolidColor(); try { formatSettings.color.rgb.red = Math.max(0, Math.min(255, Math.round(block.fontformat.frgb[0]))); formatSettings.color.rgb.green = Math.max(0, Math.min(255, Math.round(block.fontformat.frgb[1]))); formatSettings.color.rgb.blue = Math.max(0, Math.min(255, Math.round(block.fontformat.frgb[2]))); } catch(e){ formatSettings.color = hexToSolidColor(uiFontSettings.colorHex);} } else { formatSettings.color = hexToSolidColor(uiFontSettings.colorHex); } if (block.fontformat.alignment !== undefined) { switch (block.fontformat.alignment) { case 1: finalAlignment = constants.Justification.CENTER; break; case 2: finalAlignment = constants.Justification.RIGHT; break; case 3: finalAlignment = constants.Justification.LEFTJUSTIFIED; break; case 4: finalAlignment = constants.Justification.CENTERJUSTIFIED; break; case 5: finalAlignment = constants.Justification.FULLYJUSTIFIED; break; case 6: finalAlignment = constants.Justification.RIGHTJUSTIFIED; break; default: finalAlignment = constants.Justification.LEFT;} } else { finalAlignment = convertAlignmentValue(uiFontSettings.alignmentValue); } }
                                else { logFn(`   PS: Формат UI`, true); formatSettings.family = uiFontSettings.family; finalFontSize = uiFontSettings.size; formatSettings.color = hexToSolidColor(uiFontSettings.colorHex); finalAlignment = convertAlignmentValue(uiFontSettings.alignmentValue); }
                                formatSettings.size = finalFontSize; formatSettings.alignment = finalAlignment;
                                logFn(`    PS: Шрифт: ${formatSettings.family}, ${formatSettings.size}pt, Цвет: #${formatSettings.color.rgb.hexValue}, Выравнивание: ${Object.keys(constants.Justification).find(key => constants.Justification[key] === formatSettings.alignment)}`, true);

                                // --- Создание и настройка слоев ---
                                for (const type in blockData) {
                                    const data = blockData[type]; if (data.needed && data.content.trim() && data.targetGroup) {
                                        logFn(`    PS: Слой: ${data.layerName}...`, true); let newLayer = null;
                                        try {
                                            const createOptions = { name: data.layerName }; newLayer = await currentDoc.createTextLayer(createOptions); logFn(`     PS: Слой ${newLayer.id}. Настройка...`, true); let textItem = newLayer.textItem; let initialBounds = newLayer.bounds;
                                            try {
                                                 // --- Порядок установки ---
                                                 await textItem.convertToParagraphText(); logFn(`     PS: -> Параграф`, true);
                                                 textItem.width = width; textItem.height = height; logFn(`     PS: -> W=${width}, H=${height}`, true);
                                                 logFn(`     PS: -> Стили...`, true); textItem.characterStyle.font = formatSettings.family; textItem.characterStyle.size = formatSettings.size; textItem.characterStyle.color = formatSettings.color; textItem.paragraphStyle.justification = formatSettings.alignment; logFn(`     PS: -> Стили ОК`, true);
                                                 const finalInitialBounds = newLayer.bounds; const deltaX = x - finalInitialBounds.left; const deltaY = y - finalInitialBounds.top; logFn(`     PS: -> Смещение: dX=${deltaX.toFixed(1)}, dY=${deltaY.toFixed(1)}`, true);
                                                 if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) { await newLayer.translate(deltaX, deltaY); logFn(`     PS: -> Перемещен`, true); } else { logFn(`     PS: -> На месте`, true); }
                                                 logFn(`     PS: -> Контент...`, true); textItem.contents = data.content; logFn(`     PS: -> Контент OK`, true);
                                                 // --- Конец порядка ---
                                            } catch (textSetupError){ logFn(`     PS: ОШИБКА TextItem/Translate (${newLayer.id}): ${formatError(textSetupError)}`, true); if (newLayer) await newLayer.delete(); continue; }
                                            logFn(`    PS: Перемещение ${newLayer.id} в ${data.targetGroup.name}...`, true); await newLayer.move(data.targetGroup, constants.ElementPlacement.PLACEINSIDE); logFn(`     PS: Слой ${newLayer.id} в группе.`, true);
                                        } catch (layerCreateError) { logFn(`    PS: ОШИБКА слоя ${data.layerName}: ${formatError(layerCreateError)}`, true); }
                                    } else if (data.needed && !data.content.trim()) { logFn(`    PS: Пропуск ${data.layerName} (нет контента).`, true); } else if (data.needed && !data.targetGroup) { logFn(`    PS: Пропуск ${data.layerName} (нет группы).`, true); }
                                } // Конец for (type)
                                } catch (blockProcessError) { logFn(`  PS: ОШИБКА блока ${blockNumber}: ${formatError(blockProcessError)}.`, true); }
                            } // Конец for (block)
                        } // Конец else (textBlocks не массив)
                    } // Конец else (есть группы)
                    if (executionContext.isCancelled) break;
                } catch (docModError) { logFn(` PS: Ошибка модификации ${imageFileName}: ${formatError(docModError)}`, true); }
                finally { if (isHistorySuspended && suspension) { logFn(` PS: Завершение истории ${currentDoc?.id}...`, true); try { await executionContext.hostControl.resumeHistory(suspension, !executionContext.isCancelled); logFn(" PS: История ОК.", true); } catch (resumeError) { logFn(` PS: Ошибка завершения истории ${currentDoc?.id}: ${formatError(resumeError)}`, true); } finally { isHistorySuspended = false; suspension = null; } } }
                processedPageCount++;
            } // Конец for (imageFileName)
            logFn("PS: Обработка всех страниц завершена.", true);
        } catch(modalError) { logFn(` PS: ОШИБКА executeAsModal: ${formatError(modalError)}`, true); if (isHistorySuspended && suspension) { try { logFn(" PS: Отмена истории...", true); await executionContext.hostControl.resumeHistory(suspension, false); logFn(" PS: Отменена.", true); } catch (resumeError) { logFn(` PS: Ошибка отмены: ${formatError(resumeError)}`, true); } } throw modalError; }
        finally { logFn("PS: Выход из модального режима.", true); }
    }, {
        "commandName": "Importing Text Layers", "interactive": false,
        "descriptor": { /* Передаем все нужные данные */ selectedPageNames, importOriginal, importTranslation, useJsonFormatting, overrideFontSize, uiFontSettings, projectData, pageFileTokens }
    });
    // executeAsModal завершился
}

module.exports = {
    getActiveLayerStylePS,
    importTextLayersPS
};