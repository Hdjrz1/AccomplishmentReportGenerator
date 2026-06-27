const fs = require('fs');
const path = require('path');
const { resolveOutputDir, resolveReportTemplate } = require('./config');
const {
    buildActsTitleTableFromTemplate,
    buildActsHeadingXml,
    buildActsBodyParagraphXml,
    buildActsBulletParagraphXml,
    buildActsNumberedParagraphXml,
    buildActsTableXml,
    buildActsSignatureBlockXml,
    buildActsDocumentXml,
    buildActsHeaderXml,
    writeDocxUpdatesWithFallback
} = require('./template/acts-docx');
const {
    buildDefaultDocumentXml,
    buildDefaultHeaderXml,
    buildDefaultFooterXml
} = require('./template/default-docx');

const DOC_NS = '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpsCustomData="http://www.wps.cn/officeDocument/2013/wpsCustomData" mc:Ignorable="w14 w15 wp14">';
const SECT_PR = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720" w:num="1"/><w:docGrid w:linePitch="360" w:charSpace="0"/></w:sectPr>';

// XML Escaping
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Paragraph XML Builder
function buildParagraphXml(text, bold = false, fontSize = 20, afterSpacing = 100, beforeSpacing = 0, color = '000000', lineSpacing = 240, align = 'left') {
    const bVal = bold ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>';
    const colorVal = color !== '000000' ? `<w:color w:val="${color}"/>` : '';
    return '<w:p>' +
             '<w:pPr>' +
               `<w:spacing w:before="${beforeSpacing}" w:after="${afterSpacing}" w:line="${lineSpacing}" w:lineRule="auto"/>` +
               `<w:jc w:val="${align}"/>` +
             '</w:pPr>' +
             '<w:r>' +
               '<w:rPr>' +
                 '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                 bVal +
                 colorVal +
                 `<w:sz w:val="${fontSize}"/>` +
                 `<w:szCs w:val="${fontSize}"/>` +
               '</w:rPr>' +
               `<w:t>${escapeXml(text)}</w:t>` +
             '</w:r>' +
           '</w:p>';
}

function buildMultilineParagraphsXml(text, fontSize = 20, firstBeforeSpacing = 100, lastAfterSpacing = 100) {
    const lines = String(text || '').split('\n');
    let xml = '';

    lines.forEach((line, index) => {
        const isLast = index === lines.length - 1;
        const beforeSpacing = index === 0 ? firstBeforeSpacing : 0;
        const afterSpacing = line.trim() === '' ? 40 : (isLast ? lastAfterSpacing : 60);
        xml += buildParagraphXml(line, false, fontSize, afterSpacing, beforeSpacing);
    });

    return xml;
}

// List Item XML Builder
function buildListItemXml(boldPart, normalPart, numId = 1, ilvl = 0) {
    return '<w:p>' +
             '<w:pPr>' +
               '<w:pStyle w:val="16"/>' +
               '<w:numPr>' +
                 `<w:ilvl w:val="${ilvl}"/>` +
                 `<w:numId w:val="${numId}"/>` +
               '</w:numPr>' +
               '<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>' +
             '</w:pPr>' +
             (boldPart !== '' ? 
               '<w:r>' +
                 '<w:rPr>' +
                   '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                   '<w:b/><w:bCs/>' +
                   '<w:sz w:val="20"/>' +
                   '<w:szCs w:val="20"/>' +
                 '</w:rPr>' +
                 `<w:t xml:space="preserve">${escapeXml(boldPart)}</w:t>` +
               '</w:r>' 
               : ''
             ) +
             '<w:r>' +
               '<w:rPr>' +
                 '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                 '<w:b w:val="0"/><w:bCs w:val="0"/>' +
                 '<w:sz w:val="20"/>' +
                 '<w:szCs w:val="20"/>' +
               '</w:rPr>' +
               `<w:t>${escapeXml(normalPart)}</w:t>` +
             '</w:r>' +
           '</w:p>';
}

// Metadata Table Builder
function buildMetadataTableXml(devName, reportDate, projTitle, branchRepo) {
    const rows = [
        ['Developer Name', devName],
        ['Date of Report', reportDate],
        ['Project Title', projTitle],
        ['Branch / Repository', branchRepo]
    ];
    
    let xml = '<w:tbl>' +
             '<w:tblPr>' +
               '<w:tblStyle w:val="9"/>' +
               '<w:tblW w:w="5000" w:type="pct"/>' +
               '<w:tblInd w:w="0" w:type="dxa"/>' +
               '<w:tblBorders>' +
                 '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
               '</w:tblBorders>' +
               '<w:tblLayout w:type="autofit"/>' +
               '<w:tblCellMar>' +
                 '<w:top w:w="0" w:type="dxa"/>' +
                 '<w:left w:w="10" w:type="dxa"/>' +
                 '<w:bottom w:w="0" w:type="dxa"/>' +
                 '<w:right w:w="10" w:type="dxa"/>' +
               '</w:tblCellMar>' +
             '</w:tblPr>' +
             '<w:tblGrid>' +
               '<w:gridCol w:w="2798"/>' +
               '<w:gridCol w:w="6528"/>' +
             '</w:tblGrid>';
             
    rows.forEach(row => {
        xml += '<w:tr>' +
                  '<w:tblPrEx>' +
                    '<w:tblBorders>' +
                      '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                    '</w:tblBorders>' +
                    '<w:tblCellMar>' +
                      '<w:top w:w="0" w:type="dxa"/><w:left w:w="10" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="10" w:type="dxa"/>' +
                    '</w:tblCellMar>' +
                  '</w:tblPrEx>';
                  
        // Col 1 (Header Style)
        xml += '<w:tc>' +
                  '<w:tcPr>' +
                    '<w:tcW w:w="1500" w:type="pct"/>' +
                    '<w:shd w:val="clear" w:color="auto" w:fill="C7DAF1" w:themeFill="text2" w:themeFillTint="32"/>' +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>' +
                  '<w:p>' +
                    '<w:pPr>' +
                      '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' +
                      '<w:jc w:val="left"/>' +
                    '</w:pPr>' +
                    '<w:r>' +
                      '<w:rPr>' +
                        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                        '<w:b/><w:bCs/>' +
                        '<w:color w:val="002060"/>' +
                        '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                      '</w:rPr>' +
                      `<w:t>${escapeXml(row[0])}</w:t>` +
                    '</w:r>' +
                  '</w:p>' +
                '</w:tc>';
                
        // Col 2 (Value Style)
        xml += '<w:tc>' +
                  '<w:tcPr>' +
                    '<w:tcW w:w="3500" w:type="pct"/>' +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>';
                  
        const lines = row[1].split('\n');
        lines.forEach(line => {
            xml += '<w:p>' +
                      '<w:pPr>' +
                        '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' +
                        '<w:jc w:val="left"/>' +
                      '</w:pPr>' +
                      '<w:r>' +
                        '<w:rPr>' +
                          '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                          '<w:b w:val="0"/><w:bCs w:val="0"/>' +
                          '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                        '</w:rPr>' +
                        `<w:t>${escapeXml(line.trim())}</w:t>` +
                      '</w:r>' +
                    '</w:p>';
        });
        
        xml += '</w:tc></w:tr>';
    });
    
    xml += '</w:tbl>';
    return xml;
}

// File Adjustments Table Builder
const EXPORT_MAX_ROWS = 25;
const EXPORT_MAX_BULLETS = 3;
const EXPORT_MAX_CELL_CHARS = 200;

function truncateCellText(text, maxChars = EXPORT_MAX_CELL_CHARS) {
    const value = String(text || '');
    if (value.length <= maxChars) return value;
    return value.slice(0, maxChars - 1) + '…';
}

function limitModificationsText(modifications) {
    const raw = Array.isArray(modifications) ? modifications.join('\n') : String(modifications || '');
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    const bullets = [];
    let overflowNote = null;

    lines.forEach(line => {
        if (/^\(\+\d+\s+more/i.test(line)) {
            overflowNote = line;
            return;
        }
        if (line.startsWith('•') || line.startsWith('-')) {
            bullets.push(line.startsWith('-') ? `•${line.slice(1)}` : line);
        } else if (!line.startsWith('+')) {
            bullets.push(`• ${line}`);
        }
    });

    let result;
    if (bullets.length <= EXPORT_MAX_BULLETS) {
        result = bullets.join('\n');
        if (overflowNote) {
            result += (result ? '\n' : '') + overflowNote;
        }
    } else {
        const shown = bullets.slice(0, EXPORT_MAX_BULLETS);
        const more = bullets.length - EXPORT_MAX_BULLETS;
        result = `${shown.join('\n')}\n…and ${more} more`;
    }

    return truncateCellText(result);
}

function applyFileChangesSafetyLimits(fileChanges) {
    if (!Array.isArray(fileChanges) || fileChanges.length === 0) {
        return fileChanges || [];
    }

    let rows = fileChanges.map(change => ({
        file: truncateCellText(change.file),
        modifications: limitModificationsText(change.modifications)
    }));

    if (rows.length > EXPORT_MAX_ROWS) {
        const overflowCount = rows.length - (EXPORT_MAX_ROWS - 1);
        rows = rows.slice(0, EXPORT_MAX_ROWS - 1);
        rows.push({
            file: truncateCellText(`+ ${overflowCount} additional entries`),
            modifications: truncateCellText(`+ ${overflowCount} additional files modified across views, assets, and config.`)
        });
    }

    return rows;
}

function buildFileAdjustmentsTableXml(fileChanges) {
    const safeFileChanges = applyFileChangesSafetyLimits(fileChanges);
    let xml = '<w:tbl>' +
             '<w:tblPr>' +
               '<w:tblStyle w:val="9"/>' +
               '<w:tblW w:w="5000" w:type="pct"/>' +
               '<w:tblInd w:w="0" w:type="dxa"/>' +
               '<w:tblBorders>' +
                 '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
               '</w:tblBorders>' +
               '<w:tblLayout w:type="autofit"/>' +
               '<w:tblCellMar>' +
                 '<w:top w:w="0" w:type="dxa"/>' +
                 '<w:left w:w="10" w:type="dxa"/>' +
                 '<w:bottom w:w="0" w:type="dxa"/>' +
                 '<w:right w:w="10" w:type="dxa"/>' +
               '</w:tblCellMar>' +
             '</w:tblPr>' +
             '<w:tblGrid>' +
               '<w:gridCol w:w="3500"/>' +
               '<w:gridCol w:w="5826"/>' +
             '</w:tblGrid>';
             
    // Header Row
    xml += '<w:tr>' +
              '<w:tblPrEx>' +
                '<w:tblBorders>' +
                  '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                '</w:tblBorders>' +
                '<w:tblCellMar>' +
                  '<w:top w:w="0" w:type="dxa"/><w:left w:w="10" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="10" w:type="dxa"/>' +
                '</w:tblCellMar>' +
              '</w:tblPrEx>';
              
    const headers = [
        ['File Affected', 1750],
        ['Modifications Made', 3250]
    ];
    
    headers.forEach(header => {
        xml += '<w:tc>' +
                  '<w:tcPr>' +
                    `<w:tcW w:w="${header[1]}" w:type="pct"/>` +
                    '<w:shd w:val="clear" w:color="auto" w:fill="002060"/>' +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>' +
                  '<w:p>' +
                    '<w:pPr>' +
                      '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' +
                      '<w:jc w:val="left"/>' +
                    '</w:pPr>' +
                    '<w:r>' +
                      '<w:rPr>' +
                        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                        '<w:b/><w:bCs/>' +
                        '<w:color w:val="FFFFFF"/>' +
                        '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                      '</w:rPr>' +
                      `<w:t>${escapeXml(header[0])}</w:t>` +
                    '</w:r>' +
                  '</w:p>' +
                '</w:tc>';
    });
    xml += '</w:tr>';
    
    // Data Rows
    safeFileChanges.forEach(change => {
        xml += '<w:tr>' +
                  '<w:tblPrEx>' +
                    '<w:tblBorders>' +
                      '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                      '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                    '</w:tblBorders>' +
                    '<w:tblCellMar>' +
                      '<w:top w:w="0" w:type="dxa"/><w:left w:w="10" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="10" w:type="dxa"/>' +
                    '</w:tblCellMar>' +
                  '</w:tblPrEx>';
                  
        // Col 1: File Affected (bold)
        xml += '<w:tc>' +
                  '<w:tcPr>' +
                    '<w:tcW w:w="1750" w:type="pct"/>' +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>' +
                  '<w:p>' +
                    '<w:pPr>' +
                      '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' +
                      '<w:jc w:val="left"/>' +
                    '</w:pPr>' +
                    '<w:r>' +
                      '<w:rPr>' +
                        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                        '<w:b/><w:bCs/>' +
                        '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                      '</w:rPr>' +
                      `<w:t>${escapeXml(change.file)}</w:t>` +
                    '</w:r>' +
                  '</w:p>' +
                '</w:tc>';
                
        // Col 2: Modifications Made (bullet list inside cell)
        xml += '<w:tc>' +
                  '<w:tcPr>' +
                    '<w:tcW w:w="3250" w:type="pct"/>' +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>' +
                  '<w:p>' +
                    '<w:pPr>' +
                      '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' +
                      '<w:jc w:val="left"/>' +
                    '</w:pPr>';
                    
        const mods = Array.isArray(change.modifications) ? change.modifications : change.modifications.split('\n');
        let firstMod = true;
        mods.forEach(mod => {
            let mText = mod.trim();
            if (mText === '') return;
            if (!mText.startsWith('•') && !mText.startsWith('-')) {
                mText = '• ' + mText;
            } else if (mText.startsWith('-')) {
                mText = '•' + mText.substring(1);
            }
            
            if (!firstMod) {
                xml += '<w:r><w:br/></w:r>';
            }
            xml += '<w:r>' +
                      '<w:rPr>' +
                        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                        '<w:b w:val="0"/><w:bCs w:val="0"/>' +
                        '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                      '</w:rPr>' +
                      `<w:t>${escapeXml(mText)}</w:t>` +
                    '</w:r>';
            firstMod = false;
        });
        
        xml += '</w:p></w:tc></w:tr>';
    });
    
    xml += '</w:tbl>';
    return xml;
}

function buildSectionHeadingXml(text) {
    return buildParagraphXml(text, true, 24, 100, 240);
}

function buildBulletItemsXml(items, numId = 1) {
    let xml = '';
    (items || []).forEach(item => {
        const trimmedItem = String(item || '').trim();
        if (trimmedItem === '') return;
        const text = trimmedItem.replace(/^[•\-\*\s]+/, '');
        const colonIndex = text.indexOf(':');
        let boldPart = '';
        let normalPart = text;
        if (colonIndex > 0 && colonIndex < 80) {
            boldPart = text.substring(0, colonIndex + 1) + ' ';
            normalPart = text.substring(colonIndex + 1).trim();
        }
        xml += buildListItemXml(boldPart, normalPart, numId, 0);
    });
    return xml;
}

function buildTableShellXml(colWidths) {
    const gridCols = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
    return '<w:tbl>' +
             '<w:tblPr>' +
               '<w:tblStyle w:val="9"/>' +
               '<w:tblW w:w="5000" w:type="pct"/>' +
               '<w:tblInd w:w="0" w:type="dxa"/>' +
               '<w:tblBorders>' +
                 '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                 '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
               '</w:tblBorders>' +
               '<w:tblLayout w:type="autofit"/>' +
               '<w:tblCellMar>' +
                 '<w:top w:w="0" w:type="dxa"/>' +
                 '<w:left w:w="10" w:type="dxa"/>' +
                 '<w:bottom w:w="0" w:type="dxa"/>' +
                 '<w:right w:w="10" w:type="dxa"/>' +
               '</w:tblCellMar>' +
             '</w:tblPr>' +
             `<w:tblGrid>${gridCols}</w:tblGrid>`;
}

function buildTableRowShellXml() {
    return '<w:tr>' +
              '<w:tblPrEx>' +
                '<w:tblBorders>' +
                  '<w:top w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:left w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:bottom w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:right w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:insideH w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                  '<w:insideV w:val="single" w:color="auto" w:sz="4" w:space="0"/>' +
                '</w:tblBorders>' +
                '<w:tblCellMar>' +
                  '<w:top w:w="0" w:type="dxa"/><w:left w:w="10" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="10" w:type="dxa"/>' +
                '</w:tblCellMar>' +
              '</w:tblPrEx>';
}

function buildTableCellXml(text, options = {}) {
    const {
        bold = false,
        header = false,
        widthPct = 2000
    } = options;
    const fill = header ? '<w:shd w:val="clear" w:color="auto" w:fill="002060"/>' : '';
    const color = header ? '<w:color w:val="FFFFFF"/>' : '';
    const bTag = (bold || header) ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>';
    const lines = String(text || '').split('\n');

    let cell = '<w:tc>' +
                  '<w:tcPr>' +
                    `<w:tcW w:w="${widthPct}" w:type="pct"/>` +
                    fill +
                    '<w:tcMar>' +
                      '<w:top w:w="120" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="150" w:type="dxa"/>' +
                    '</w:tcMar>' +
                  '</w:tcPr>';

    lines.forEach(line => {
        cell += '<w:p>' +
                  '<w:pPr>' +
                    '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' +
                    '<w:jc w:val="left"/>' +
                  '</w:pPr>' +
                  '<w:r>' +
                    '<w:rPr>' +
                      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
                      bTag +
                      color +
                      '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
                    '</w:rPr>' +
                    `<w:t>${escapeXml(line.trim())}</w:t>` +
                  '</w:r>' +
                '</w:p>';
    });

    cell += '</w:tc>';
    return cell;
}

function buildGenericTableXml(headers, rows, colWidths) {
    let xml = buildTableShellXml(colWidths);
    xml += buildTableRowShellXml();
    headers.forEach((header, index) => {
        xml += buildTableCellXml(header, { header: true, widthPct: colWidths[index] || 2000 });
    });
    xml += '</w:tr>';

    rows.forEach(row => {
        xml += buildTableRowShellXml();
        row.forEach((cell, index) => {
            xml += buildTableCellXml(cell, { widthPct: colWidths[index] || 2000, bold: index === 0 });
        });
        xml += '</w:tr>';
    });

    xml += '</w:tbl>';
    return xml;
}

function cleanBulletText(item) {
    return String(item || '').trim().replace(/^[•\-\*\d.]+\s*/, '');
}

function deriveActsObjectives(data) {
    const items = Array.isArray(data.key_accomplishments) ? data.key_accomplishments : [];
    const rows = items.slice(0, 12).map((item, index) => {
        const text = cleanBulletText(item);
        const objective = text.includes(':') ? text.split(':')[0].trim() : text;
        return [String(index + 1), objective, index === items.length - 1 && items.length > 8 ? 'For Validation' : 'Completed'];
    });

    if (rows.length === 0) {
        rows.push(['1', 'Complete assigned development tasks for the reporting period.', 'Completed']);
    }
    return rows;
}

function deriveCriticalFixes(data) {
    const items = Array.isArray(data.impact_verification) ? data.impact_verification : [];
    const rows = items.slice(0, 10).map(item => {
        const text = cleanBulletText(item);
        const parts = text.split(':');
        const issue = parts[0] || text;
        const resolution = parts.slice(1).join(':').trim() || 'Addressed through selected commits and file updates.';
        return [issue, resolution, 'Improved system readiness and traceability.'];
    });
    if (rows.length === 0) {
        rows.push(['Workflow validation', 'Reviewed selected commits and file updates.', 'Improved reporting traceability.']);
    }
    return rows;
}

function deriveTechnicalOutcomes(data) {
    const fileCount = Array.isArray(data.detailed_files) ? data.detailed_files.length : 0;
    const repoCount = String(data.branches_text || '').split('\n').filter(Boolean).length;
    return [
        ['Modified project area', data.project_title || 'Selected repositories'],
        ['Repositories in scope', String(repoCount || 1)],
        ['Files adjusted', String(fileCount)],
        ['Reporting period', data.date_range_text || ''],
        ['Operational benefit', 'Improved traceability, documentation, and deployment readiness.']
    ];
}

function deriveTestingValidation(data) {
    const status = String(data.verification_status || 'For validation');
    return [
        ['Build and staging verification', status, 'Confirm changes run correctly in the target environment.'],
        ['Data alignment review', 'For validation', 'Compare portal output against official or development records.'],
        ['Frontend integration', 'For validation', 'Check dashboard rendering across common screen sizes.'],
        ['Security and access control', 'For validation', 'Confirm authenticated users only access permitted records.']
    ];
}

function deriveDeliverables(data) {
    const files = Array.isArray(data.detailed_files) ? data.detailed_files : [];
    const rows = files.slice(0, 15).map(file => {
        const area = String(file.file || '').split(/[\\/]/).slice(0, -1).pop() || 'Application';
        return [area, String(file.file || ''), 'Updated'];
    });
    if (rows.length === 0) {
        rows.push(['Application', 'No deliverable files listed', 'Pending']);
    }
    return rows;
}

function deriveFollowUp(data) {
    const lines = [
        'Continue end-to-end testing using real institutional or staging records.',
        'Validate results against official SIS, ACS, and security/access-control sources where applicable.',
        'Review environment variables, database credentials, and deployment configuration before production release.',
        'Conduct responsive UI testing across desktop, laptop, tablet, and mobile screen sizes.'
    ];
    if (data.verification_status) {
        lines.unshift(String(data.verification_status));
    }
    return lines;
}

function buildActsReportBody(data, templatePath) {
    let xml = '';
    xml += buildActsTitleTableFromTemplate(templatePath, data);

    xml += buildActsHeadingXml('Executive Summary');
    xml += buildActsBodyParagraphXml(data.executive_summary);

    xml += buildActsHeadingXml('Objectives');
    xml += buildActsTableXml(['#', 'Objective', 'Status'], deriveActsObjectives(data), [1200, 6200, 2480]);

    xml += buildActsHeadingXml('Key Accomplishments & Features Completed');
    (data.key_accomplishments || []).forEach((item, index) => {
        const text = cleanBulletText(item);
        if (!text) return;
        xml += buildActsNumberedParagraphXml(index + 1, text);
    });

    xml += buildActsHeadingXml('Detailed Module Breakdown');
    const moduleRows = (data.detailed_files || []).slice(0, 20).map(file => {
        const filePath = String(file.file || '');
        const area = filePath.split(/[\\/]/).slice(0, -1).pop() || 'Application';
        const mods = Array.isArray(file.modifications)
            ? file.modifications.join('; ')
            : String(file.modifications || '');
        return [area, filePath, mods.slice(0, 180)];
    });
    if (moduleRows.length === 0) {
        moduleRows.push(['Application', 'No files listed', 'No module changes recorded.']);
    }
    xml += buildActsTableXml(['Area', 'Files / Modules', 'Purpose'], moduleRows, [2200, 3600, 4080]);

    xml += buildActsHeadingXml('Critical Fixes and Improvements Delivered');
    xml += buildActsTableXml(
        ['Issue / Need', 'Resolution Delivered', 'Result'],
        deriveCriticalFixes(data),
        [2800, 3600, 3480]
    );

    xml += buildActsHeadingXml('Technical Outcomes');
    xml += buildActsTableXml(['Metric / Output', 'Result'], deriveTechnicalOutcomes(data), [3600, 6280]);

    xml += buildActsHeadingXml('Testing and Validation Performed / Required');
    xml += buildActsTableXml(
        ['Check', 'Status', 'Notes'],
        deriveTestingValidation(data),
        [2800, 1800, 5280]
    );

    xml += buildActsHeadingXml('Deliverables');
    xml += buildActsTableXml(
        ['Deliverable Area', 'Completed Files / Modules', 'Status'],
        deriveDeliverables(data),
        [2400, 5200, 2280]
    );

    xml += buildActsHeadingXml('Impact');
    (data.impact_verification || []).forEach(item => {
        const text = cleanBulletText(item);
        if (!text) return;
        xml += buildActsBulletParagraphXml(text);
    });

    xml += buildActsHeadingXml('Follow-up / Remaining Work');
    deriveFollowUp(data).forEach(line => {
        xml += buildActsBulletParagraphXml(line);
    });

    const summary = String(data.executive_summary || '').split('\n').filter(Boolean).slice(0, 3).join(' ');
    xml += buildActsHeadingXml('Summary Statement');
    xml += buildActsBodyParagraphXml(summary || data.verification_status);

    xml += buildActsSignatureBlockXml(data.developer_name, data.job_title);
    return xml;
}

function buildReportDocumentXml(data, templatePath = null) {
    const templateId = data.template_id === 'acts' ? 'acts' : 'default';
    if (templateId === 'acts' && templatePath) {
        return buildActsDocumentXml(templatePath, buildActsReportBody(data, templatePath));
    }
    return buildDefaultDocumentXml(data);
}

// Main generation function
function main() {
    try {
        const payloadPath = process.argv[2];
        if (!payloadPath) {
            throw new Error('Payload path argument missing');
        }
        
        // Read JSON payload
        const data = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
        const reportsDir = resolveOutputDir(data.output_dir);
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const templateId = data.template_id === 'acts' ? 'acts' : 'default';
        const templatePath = resolveReportTemplate(templateId);
        const templateFile = {
            id: templateId,
            name: path.basename(templatePath),
            path: templatePath
        };
        
        // 2. Prepare Output Path
        const safeDate = data.date_range_text.replace(/[\\/:*?"<>|]/g, '-');
        const outputFileName = `Accomplishment Report - ${safeDate}.docx`;
        const outputPath = path.join(reportsDir, outputFileName);
        
        // 3. Generate document.xml and write the report from the template package
        const xml = buildReportDocumentXml(data, templateFile.path);
        const docxUpdates = { documentXml: xml };

        if (templateId === 'acts') {
            const headerXml = buildActsHeaderXml(
                templateFile.path,
                data.project_title || 'Project',
                data.date_range_text || ''
            );
            if (headerXml) {
                docxUpdates.headerXml = headerXml;
            }
        } else {
            docxUpdates.headerXml = buildDefaultHeaderXml(data.project_title, data.date_range_text);
            docxUpdates.footerXml = buildDefaultFooterXml(data.project_title);
        }

        const savedOutputPath = writeDocxUpdatesWithFallback(outputPath, docxUpdates, templateFile.path);
        const savedFileName = path.basename(savedOutputPath);
        
        // Print success JSON response
        console.log(JSON.stringify({
            success: true,
            message: 'Report compiled successfully with Node.js!',
            file_name: savedFileName,
            file_path: savedOutputPath,
            template_used: templateFile.name,
            template_id: templateFile.id,
            alternate_name_used: savedOutputPath !== outputPath
        }));
        
    } catch (err) {
        console.log(JSON.stringify({
            success: false,
            error: err.message
        }));
        process.exit(1);
    }
}

main();
