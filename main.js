'use strict';

var obsidian = require('obsidian');

class ManuscriptCounter {
    constructor() {
        this.gyotoKinsoku = '\u3001\u3002\uFF09\u300D\u300F\u3011';
        this.gyomatsuKinsoku = '\uFF08\u300C\u300E\u3010';
    }

    countManuscriptCells(text, debugMode) {
        if (!text || text.trim() === '') {
            return {
                totalCells: 0,
                characters: 0,
                totalLines: 0,
                paragraphs: 0,
                manuscripts: 0,
                manuscriptPages: 0,
                manuscriptLines: 0,
                debugInfo: []
            };
        }

        var cleanText = this.removeMarkdownSyntax(text);
        var paragraphs = cleanText.split(/\n\n+/);
        
        var totalCells = 0;
        var totalChars = 0;
        var totalLines = 0;
        var allDebugInfo = [];
        var paragraphCount = 0;

        for (var i = 0; i < paragraphs.length; i++) {
            var paragraph = paragraphs[i];
            if (paragraph.trim() === '') continue;

            paragraphCount++;
            var result = this.countParagraphCells(paragraph, debugMode);
            totalCells += result.cells;
            totalChars += result.characters;
            totalLines += result.lines;
            
            if (debugMode && result.debugInfo) {
                allDebugInfo.push({
                    paragraphNum: paragraphCount,
                    lines: result.debugInfo,
                    lineCount: result.lines
                });
            }
        }

        // 段落間の空白行をカウント（段落数 - 1 = 空白行の数）
        var emptyLines = 0;
        if (paragraphCount > 1) {
            emptyLines = paragraphCount - 1;
            totalLines += emptyLines;
            totalCells += emptyLines * 20; // 空白行も20マスとしてカウント
        }

        var manuscriptPages = Math.floor(totalLines / 20);
        var manuscriptLines = totalLines % 20;

        return {
            totalCells: totalCells,
            characters: totalChars,
            totalLines: totalLines,
            paragraphs: paragraphCount,
            manuscripts: totalCells / 400,
            manuscriptPages: manuscriptPages,
            manuscriptLines: manuscriptLines,
            debugInfo: allDebugInfo,
            emptyParagraphs: emptyLines
        };
    }

    countParagraphCells(paragraph, debugMode) {
        var CELLS_PER_LINE = 20;
        var currentLine = 0;
        var totalChars = 0;
        var lines = 1;
        var debugInfo = [];
        var currentLineText = '';

        var chars = Array.from(paragraph);

        for (var i = 0; i < chars.length; i++) {
            var char = chars[i];
            
            if (char === '\n') {
                // 0文字の改行は行数にカウントしない
                if (currentLine > 0) {
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '改行'
                        });
                        currentLineText = '';
                    }
                    lines++;
                    currentLine = 0;
                } else if (debugMode) {
                    // デバッグモードでは0文字の改行も記録するが、行数は増やさない
                    debugInfo.push({
                        lineNum: lines,
                        text: currentLineText,
                        charCount: 0,
                        reason: '空改行（カウントなし）'
                    });
                }
                continue;
            }

            var charWidth = this.getCharWidth(char);
            totalChars += charWidth === 1 ? 1 : 0.5;

            // 現在の文字を追加すると20文字ちょうどになる場合
            if (currentLine + charWidth === CELLS_PER_LINE) {
                // 次の文字が行頭禁則文字かチェック
                if (i + 1 < chars.length && this.gyotoKinsoku.indexOf(chars[i + 1]) !== -1) {
                    // 現在の文字と次の行頭禁則文字を両方とも現在の行に追加（21文字の行になる）
                    currentLine += charWidth;
                    currentLineText += char;
                    
                    // 次の文字（行頭禁則文字）も処理
                    i++;
                    var nextChar = chars[i];
                    var nextCharWidth = this.getCharWidth(nextChar);
                    totalChars += nextCharWidth === 1 ? 1 : 0.5;
                    currentLine += nextCharWidth;
                    currentLineText += nextChar;
                    
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '20字+行頭禁則: ' + nextChar
                        });
                        currentLineText = '';
                    }
                    
                    // 次の文字があるかチェックしてから改行
                    if (i + 1 < chars.length) {
                        lines++;
                        currentLine = 0;
                    }
                } else {
                    // 通常通り現在の行に追加（20文字で改行）
                    currentLine += charWidth;
                    currentLineText += char;
                    
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '20文字で改行'
                        });
                        currentLineText = '';
                    }
                    
                    // 次の文字があるかチェックしてから改行
                    if (i + 1 < chars.length) {
                        lines++;
                        currentLine = 0;
                    }
                }
            } else if (currentLine + charWidth > CELLS_PER_LINE) {
                // 20文字を超える場合
                var isGyotoKinsoku = this.gyotoKinsoku.indexOf(char) !== -1;
                var isGyomatsuKinsoku = this.gyomatsuKinsoku.indexOf(char) !== -1;
                
                if (isGyotoKinsoku) {
                    // 行頭禁則文字は現在の行に追加してから改行（21文字の行になる）
                    currentLine += charWidth;
                    currentLineText += char;
                    
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '行頭禁則: ' + char
                        });
                        currentLineText = '';
                    }
                    
                    // 次の文字があるかチェックしてから改行
                    if (i + 1 < chars.length) {
                        lines++;
                        currentLine = 0;
                    }
                } else if (isGyomatsuKinsoku) {
                    // 行末禁則文字は次の行に送る
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '行末禁則'
                        });
                        currentLineText = char;
                    }
                    lines++;
                    currentLine = charWidth;
                } else {
                    // 通常の文字は次の行に送る
                    if (debugMode) {
                        debugInfo.push({
                            lineNum: lines,
                            text: currentLineText,
                            charCount: currentLine,
                            reason: '20文字超過'
                        });
                        currentLineText = char;
                    }
                    lines++;
                    currentLine = charWidth;
                }
            } else {
                // 20文字未満の場合は通常通り追加
                currentLine += charWidth;
                currentLineText += char;
            }
        }

        // 最後の行が残っている場合のみデバッグ情報に追加
        if (debugMode && currentLineText && currentLine > 0) {
            debugInfo.push({
                lineNum: lines,
                text: currentLineText,
                charCount: currentLine,
                reason: '最終行'
            });
        }

        var totalCells = totalChars + lines;

        return {
            cells: Math.ceil(totalCells),
            characters: totalChars,
            lines: lines,
            debugInfo: debugMode ? debugInfo : null
        };
    }

    getCharWidth(char) {
        var code = char.charCodeAt(0);
        
        if ((code >= 0x20 && code <= 0x7E) || (code >= 0xFF61 && code <= 0xFF9F)) {
            return 0.5;
        }
        
        return 1;
    }

    removeMarkdownSyntax(text) {
        var cleaned = text;
        
        cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
        cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
        cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');
        cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
        cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
        cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, '');
        cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
        cleaned = cleaned.replace(/^>\s+/gm, '');
        cleaned = cleaned.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '');
        cleaned = cleaned.replace(/<[^>]+>/g, '');
        
        return cleaned;
    }
}

var JapaneseManuscriptCounterPlugin = (function (Plugin) {
    function JapaneseManuscriptCounterPlugin() {
        Plugin.apply(this, arguments);
    }

    if (Plugin) JapaneseManuscriptCounterPlugin.__proto__ = Plugin;
    JapaneseManuscriptCounterPlugin.prototype = Object.create(Plugin && Plugin.prototype);
    JapaneseManuscriptCounterPlugin.prototype.constructor = JapaneseManuscriptCounterPlugin;

    JapaneseManuscriptCounterPlugin.prototype.onload = function() {
        var self = this;
        console.log('Japanese Manuscript Counter plugin loaded');

        this.counter = new ManuscriptCounter();
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText('');

        this.addCommand({
            id: 'show-count-details',
            name: 'カウント詳細を表示（デバッグ）',
            editorCallback: function(editor) {
                self.showCountDetails(editor);
            }
        });

        this.registerEvent(
            this.app.workspace.on('editor-change', function(editor) {
                self.updateCount(editor);
            })
        );

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', function() {
                self.updateCurrentCount();
            })
        );

        this.registerInterval(
            window.setInterval(function() {
                self.updateCurrentCount();
            }, 300)
        );

        this.updateCurrentCount();
    };

    JapaneseManuscriptCounterPlugin.prototype.showCountDetails = function(editor) {
        var text = editor.getValue();
        var result = this.counter.countManuscriptCells(text, true);
        
        var modalContent = '=== カウント詳細 ===\n\n';
        modalContent += '総文字数: ' + result.characters + '\n';
        modalContent += '総行数: ' + result.totalLines + '\n';
        modalContent += '総マス数: ' + result.totalCells + '\n';
        modalContent += '段落数: ' + result.paragraphs + '\n';
        modalContent += '空行数: ' + result.emptyParagraphs + '\n';
        modalContent += '原稿用紙: ' + this.formatManuscriptCount(result) + '\n\n';
        modalContent += '=== 各行の詳細 ===\n\n';
        
        if (result.debugInfo && result.debugInfo.length > 0) {
            for (var i = 0; i < result.debugInfo.length; i++) {
                var para = result.debugInfo[i];
                modalContent += '【段落 ' + para.paragraphNum + '】（' + para.lineCount + '行）\n';
                
                for (var j = 0; j < para.lines.length; j++) {
                    var line = para.lines[j];
                    modalContent += '行' + line.lineNum + ' (' + line.charCount + '文字): ' + line.text + '\n';
                    modalContent += '  → ' + line.reason + '\n';
                }
                modalContent += '\n';
            }
        }
        
        var modal = new obsidian.Modal(this.app);
        modal.titleEl.setText('原稿用紙カウント詳細');
        modal.contentEl.style.whiteSpace = 'pre-wrap';
        modal.contentEl.style.fontFamily = 'monospace';
        modal.contentEl.style.fontSize = '12px';
        modal.contentEl.setText(modalContent);
        modal.open();
    };

    JapaneseManuscriptCounterPlugin.prototype.updateCurrentCount = function() {
        // すべてのファイルでカウンターを表示
        this.statusBarItem.show();
        var view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (view) {
            var editor = view.editor;
            this.updateCount(editor);
        } else {
            this.statusBarItem.setText('');
        }
    };

    JapaneseManuscriptCounterPlugin.prototype.formatManuscriptCount = function(result) {
        if (result.manuscriptPages === 0) {
            return result.manuscriptLines + '行';
        } else if (result.manuscriptLines === 0) {
            return result.manuscriptPages + '枚';
        } else {
            return result.manuscriptPages + '枚と' + result.manuscriptLines + '行';
        }
    };

    JapaneseManuscriptCounterPlugin.prototype.updateCount = function(editor) {
        // すべてのファイルでカウントを実行
        var fullText = editor.getValue();
        var selectedText = editor.getSelection();
        
        var fullResult = this.counter.countManuscriptCells(fullText, false);
        
        var displayText;
        var tooltipText;
        
        if (selectedText && selectedText.length > 0) {
            var selectionResult = this.counter.countManuscriptCells(selectedText, false);
            var selManuscript = this.formatManuscriptCount(selectionResult);
            var fullManuscript = this.formatManuscriptCount(fullResult);
            
            displayText = '選択: ' + selectionResult.characters + '文字 (' + selManuscript + ') | 全体: ' + fullResult.characters + '文字 (' + fullManuscript + ')';
            
            tooltipText = '[選択範囲]\n' +
                '文字数: ' + selectionResult.characters + '\n' +
                'マス数: ' + selectionResult.totalCells + '\n' +
                '段落数: ' + selectionResult.paragraphs + '\n' +
                '行数: ' + selectionResult.totalLines + '\n' +
                '原稿用紙: ' + selManuscript + '\n\n' +
                '[全体]\n' +
                '文字数: ' + fullResult.characters + '\n' +
                'マス数: ' + fullResult.totalCells + '\n' +
                '段落数: ' + fullResult.paragraphs + '\n' +
                '行数: ' + fullResult.totalLines + '\n' +
                '原稿用紙: ' + fullManuscript;
        } else {
            var manuscript = this.formatManuscriptCount(fullResult);
            displayText = fullResult.characters + '文字 (' + manuscript + ')';
            
            tooltipText = '文字数: ' + fullResult.characters + '\n' +
                'マス数: ' + fullResult.totalCells + '\n' +
                '段落数: ' + fullResult.paragraphs + '\n' +
                '行数: ' + fullResult.totalLines + '\n' +
                '原稿用紙: ' + manuscript;
        }
        
        this.statusBarItem.setText(displayText);
        this.statusBarItem.setAttr('title', tooltipText);
    };

    JapaneseManuscriptCounterPlugin.prototype.onunload = function() {
        console.log('Japanese Manuscript Counter plugin unloaded');
    };

    return JapaneseManuscriptCounterPlugin;
}(obsidian.Plugin));

module.exports = JapaneseManuscriptCounterPlugin;
