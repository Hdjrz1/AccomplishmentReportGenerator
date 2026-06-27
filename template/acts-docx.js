const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const { readFileBufferSync, writeFileAtomicSync } = require('../file-io');

const ACTS_TABLE_BORDER = 'BFBFBF';
const ACTS_HEADER_FILL = '1F4E79';

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}


function readActsTemplateFrame(templatePath) {
    const zip = new AdmZip(templatePath);
    const documentXml = zip.readAsText('word/document.xml');
    const openMatch = documentXml.match(/<w:document[\s\S]*?>/);
    const sectMatch = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const titleTableMatch = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
    if (!openMatch || !sectMatch || !titleTableMatch) {
        throw new Error('ACTS template document.xml is missing required structure.');
    }
    return {
        documentOpen: openMatch[0],
        sectPr: sectMatch[0],
        titleTableTemplate: titleTableMatch[0]
    };
}

function replaceTableCellText(cellXml, text, options = {}) {
    const { centered = false, header = false } = options;
    const tcOpen = cellXml.match(/<w:tc[^>]*>/)[0];
    const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
    const tcPr = tcPrMatch ? tcPrMatch[0] : '<w:tcPr></w:tcPr>';
    const jc = centered ? '<w:jc w:val="center"/>' : '';
    const runOptions = header
        ? { bold: true, color: 'FFFFFF', size: 26 }
        : { size: 18 };
    return tcOpen + tcPr +
        '<w:p><w:pPr><w:spacing w:after="20"/>' + jc +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(text, runOptions) +
        '</w:p></w:tc>';
}

function replaceTableRowCells(rowXml, cellTexts, optionsList = []) {
    let cellIndex = 0;
    return rowXml.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cellXml) => {
        const text = cellTexts[cellIndex] ?? '';
        const options = optionsList[cellIndex] || {};
        cellIndex += 1;
        return replaceTableCellText(cellXml, text, options);
    });
}

function buildActsTitleTableFromTemplate(templatePath, data) {
    const frame = readActsTemplateFrame(templatePath);
    const rows = frame.titleTableTemplate.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length < 8) {
        throw new Error('ACTS template title table is missing expected rows.');
    }

    const projectTitle = data.project_title || 'Project';
    const tableRows = [
        replaceTableRowCells(rows[0], [`DAILY ACCOMPLISHMENT REPORT\n${projectTitle}`], [{ centered: true, header: true }]),
        replaceTableRowCells(rows[1], ['Date:', data.date_range_text || ''], [{ }, { }]),
        replaceTableRowCells(rows[2], ['Prepared by:', data.developer_name || ''], [{ }, { }]),
        replaceTableRowCells(rows[3], ['Environment:', data.acts_environment || 'Laragon (PHP 8.3, MySQL)'], [{ }, { }]),
        replaceTableRowCells(rows[4], ['Role / Department:', data.job_title || ''], [{ }, { }]),
        replaceTableRowCells(rows[5], ['System Phase:', data.acts_system_phase || `${projectTitle} development and integration`], [{ }, { }]),
        replaceTableRowCells(rows[6], ['Status:', data.acts_status || 'Completed / For Continued Validation'], [{ }, { }]),
        replaceTableRowCells(rows[7], ['Source Folder:', data.branches_text || ''], [{ }, { }])
    ];

    const tableOpen = frame.titleTableTemplate.match(/<w:tbl>[\s\S]*?<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] || '<w:tbl>';
    return tableOpen + tableRows.join('') + '</w:tbl>';
}

function buildActsRunsXml(text, options = {}) {
    const {
        bold = false,
        color = null,
        size = 18
    } = options;
    const lines = String(text || '').split('\n');
    let xml = '';
    lines.forEach((line, index) => {
        if (index > 0) {
            xml += '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="' + size + '"/></w:rPr><w:br/></w:r>';
        }
        xml += '<w:r><w:rPr>' +
            '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
            (bold ? '<w:b/>' : '') +
            (color ? `<w:color w:val="${color}"/>` : '') +
            `<w:sz w:val="${size}"/>` +
            '</w:rPr>' +
            `<w:t xml:space="preserve">${escapeXml(line)}</w:t>` +
            '</w:r>';
    });
    return xml;
}

function buildActsLabelParagraph(label) {
    return '<w:p><w:pPr><w:spacing w:after="20"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(label, { bold: true, size: 18 }) +
        '</w:p>';
}

function buildActsValueParagraph(value) {
    return '<w:p><w:pPr><w:spacing w:after="20"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(value, { size: 18 }) +
        '</w:p>';
}

function buildActsTitleBannerXml(projectTitle) {
    return '<w:p><w:pPr><w:spacing w:after="20"/><w:jc w:val="center"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
        '<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="26"/></w:rPr>' +
        '<w:t>DAILY ACCOMPLISHMENT REPORT</w:t></w:r>' +
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
        '<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="26"/></w:rPr><w:br/>' +
        `<w:t>${escapeXml(projectTitle)}</w:t></w:r></w:p>`;
}

function buildActsMetadataBlockXml(data) {
    const fields = [
        ['Date:', data.date_range_text],
        ['Prepared by:', data.developer_name],
        ['Environment:', data.acts_environment || 'Laragon (PHP 8.3, MySQL)'],
        ['Role / Department:', data.job_title],
        ['System Phase:', data.acts_system_phase || `${data.project_title} development and integration`],
        ['Status:', data.acts_status || 'Completed / For Continued Validation'],
        ['Source Folder:', data.branches_text]
    ];
    return fields.map(([label, value]) => buildActsLabelParagraph(label) + buildActsValueParagraph(value)).join('');
}

function buildActsHeadingXml(text) {
    return '<w:p><w:pPr><w:pStyle w:val="Heading1"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(text, { size: 20 }) +
        '</w:p>';
}

function buildActsBodyParagraphXml(text) {
    const blocks = String(text || '').split('\n');
    return blocks.map(block => {
        if (!block.trim()) {
            return '<w:p><w:pPr><w:spacing w:after="20"/></w:pPr></w:p>';
        }
        return '<w:p><w:pPr><w:spacing w:after="20"/>' +
            '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
            '</w:pPr>' +
            buildActsRunsXml(block, { size: 19 }) +
            '</w:p>';
    }).join('');
}

function buildActsBulletParagraphXml(text) {
    return '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:spacing w:after="20"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(`• ${text}`, { size: 19 }) +
        '</w:p>';
}

function buildActsNumberedParagraphXml(index, text) {
    return '<w:p><w:pPr><w:spacing w:after="60"/>' +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(`${index}. ${text}`, { size: 19 }) +
        '</w:p>';
}

function buildActsTableShellXml(colWidths) {
    const gridCols = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
    return '<w:tbl><w:tblPr>' +
        '<w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/>' +
        '<w:tblBorders>' +
        `<w:top w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        `<w:left w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        `<w:right w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="${ACTS_TABLE_BORDER}"/>` +
        '</w:tblBorders>' +
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
        '</w:tblPr>' +
        `<w:tblGrid>${gridCols}</w:tblGrid>`;
}

function buildActsTableCellXml(text, options = {}) {
    const { header = false, width = 4940, span = 1 } = options;
    const fill = header ? `<w:shd w:val="clear" w:color="auto" w:fill="${ACTS_HEADER_FILL}"/>` : '';
    const color = header ? 'FFFFFF' : null;
    const bold = header;
    return '<w:tc><w:tcPr>' +
        `<w:tcW w:w="${width}" w:type="dxa"/>` +
        (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
        fill +
        '<w:vAlign w:val="center"/>' +
        '</w:tcPr>' +
        '<w:p><w:pPr><w:spacing w:after="20"/>' +
        (header ? '<w:jc w:val="center"/>' : '') +
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>' +
        '</w:pPr>' +
        buildActsRunsXml(text, { bold, color, size: header ? 18 : 19 }) +
        '</w:p></w:tc>';
}

function buildActsTableXml(headers, rows, colWidths) {
    let xml = buildActsTableShellXml(colWidths);
    xml += '<w:tr><w:trPr><w:jc w:val="center"/></w:trPr>';
    headers.forEach((header, index) => {
        xml += buildActsTableCellXml(header, { header: true, width: colWidths[index] || 4940 });
    });
    xml += '</w:tr>';
    rows.forEach(row => {
        xml += '<w:tr><w:trPr><w:jc w:val="center"/></w:trPr>';
        row.forEach((cell, index) => {
            xml += buildActsTableCellXml(cell, { width: colWidths[index] || 4940 });
        });
        xml += '</w:tr>';
    });
    xml += '</w:tbl>';
    return xml;
}

function buildActsSignatureBlockXml(devName, jobTitle) {
    return buildActsLabelParagraph('Prepared by:') +
        '<w:p><w:pPr><w:spacing w:after="100"/><w:jc w:val="right"/></w:pPr>' +
        buildActsRunsXml(devName, { bold: true, size: 19 }) +
        '</w:p>' +
        '<w:p><w:pPr><w:spacing w:after="100"/><w:jc w:val="right"/></w:pPr>' +
        buildActsRunsXml(jobTitle, { size: 19 }) +
        '</w:p>';
}

function updateActsHeaderXml(headerXml, projectTitle, dateRangeText) {
    const banner = `${projectTitle} | Accomplishment Report`;
    let updated = headerXml.replace(
        /ACTS Colleges Student Portal \| Accomplishment Report/g,
        escapeXml(banner)
    );
    if (!updated.includes(escapeXml(banner)) && updated.includes('<w:t>')) {
        updated = updated.replace(
            /<w:t>[^<]*\| Accomplishment Report<\/w:t>/,
            `<w:t>${escapeXml(banner)}</w:t>`
        );
    }
    return updated;
}

function buildActsDocumentXml(templatePath, bodyXml) {
    const frame = readActsTemplateFrame(templatePath);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        frame.documentOpen +
        '<w:body>' + bodyXml + frame.sectPr + '</w:body></w:document>';
}

function updateZipEntry(zip, entryName, content) {
    const buffer = Buffer.from(content, 'utf8');
    if (zip.getEntry(entryName)) {
        zip.updateFile(entryName, buffer);
    } else {
        zip.addFile(entryName, buffer);
    }
}

const HEADER_REL = '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>';
const FOOTER_REL = '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>';
const HEADER_CONTENT_TYPE = '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>';
const FOOTER_CONTENT_TYPE = '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>';

function ensureDocumentRelationships(zip, needsHeader, needsFooter) {
    const relsPath = 'word/_rels/document.xml.rels';
    const entry = zip.getEntry(relsPath);
    if (!entry) return;

    let xml = zip.readAsText(entry);
    const additions = [];
    if (needsHeader && !/Target="header1\.xml"/.test(xml)) {
        additions.push(HEADER_REL);
    }
    if (needsFooter && !/Target="footer1\.xml"/.test(xml)) {
        additions.push(FOOTER_REL);
    }
    if (!additions.length) return;

    xml = xml.replace('</Relationships>', `${additions.join('')}</Relationships>`);
    updateZipEntry(zip, relsPath, xml);
}

function ensureContentTypeOverrides(zip, needsHeader, needsFooter) {
    const entry = zip.getEntry('[Content_Types].xml');
    if (!entry) return;

    let xml = zip.readAsText(entry);
    if (needsHeader && !xml.includes('/word/header1.xml')) {
        xml = xml.replace('</Types>', `  ${HEADER_CONTENT_TYPE}\n</Types>`);
    }
    if (needsFooter && !xml.includes('/word/footer1.xml')) {
        xml = xml.replace('</Types>', `  ${FOOTER_CONTENT_TYPE}\n</Types>`);
    }
    updateZipEntry(zip, '[Content_Types].xml', xml);
}

function ensurePackageParts(zip, { header = false, footer = false } = {}) {
    if (!header && !footer) return;
    ensureContentTypeOverrides(zip, header, footer);
    ensureDocumentRelationships(zip, header, footer);
}

function writeDocxUpdates(outputPath, updates, templatePath) {
    const sourcePath = templatePath || outputPath;
    const zip = new AdmZip(readFileBufferSync(sourcePath));
    if (updates.documentXml) {
        updateZipEntry(zip, 'word/document.xml', updates.documentXml);
    }
    const needsHeader = Boolean(updates.headerXml);
    const needsFooter = Boolean(updates.footerXml);
    if (needsHeader) {
        updateZipEntry(zip, 'word/header1.xml', updates.headerXml);
    }
    if (needsFooter) {
        updateZipEntry(zip, 'word/footer1.xml', updates.footerXml);
    }
    if (needsHeader || needsFooter) {
        ensurePackageParts(zip, { header: needsHeader, footer: needsFooter });
    }
    writeFileAtomicSync(outputPath, (tmpPath) => zip.writeZip(tmpPath));
}

function isLockedFileError(err) {
    return Boolean(err && /locked/i.test(String(err.message || '')));
}

function writeDocxUpdatesWithFallback(outputPath, updates, templatePath) {
    try {
        writeDocxUpdates(outputPath, updates, templatePath);
        return outputPath;
    } catch (err) {
        if (!isLockedFileError(err)) {
            throw err;
        }

        const dir = path.dirname(outputPath);
        const ext = path.extname(outputPath);
        const base = path.basename(outputPath, ext);

        for (let i = 2; i <= 99; i++) {
            const altPath = path.join(dir, `${base} (${i})${ext}`);
            if (fs.existsSync(altPath)) {
                continue;
            }
            try {
                writeDocxUpdates(altPath, updates, templatePath);
                return altPath;
            } catch (altErr) {
                if (!isLockedFileError(altErr)) {
                    throw altErr;
                }
            }
        }

        throw err;
    }
}

function buildActsHeaderXml(templatePath, projectTitle, dateRangeText) {
    const zip = new AdmZip(templatePath);
    const headerEntry = zip.getEntry('word/header1.xml');
    if (!headerEntry) return null;
    const headerXml = zip.readAsText(headerEntry);
    return updateActsHeaderXml(headerXml, projectTitle, dateRangeText);
}

module.exports = {
    readActsTemplateFrame,
    buildActsTitleTableFromTemplate,
    buildActsTitleBannerXml,
    buildActsMetadataBlockXml,
    buildActsHeadingXml,
    buildActsBodyParagraphXml,
    buildActsBulletParagraphXml,
    buildActsNumberedParagraphXml,
    buildActsTableXml,
    buildActsSignatureBlockXml,
    buildActsDocumentXml,
    buildActsHeaderXml,
    writeDocxUpdates,
    writeDocxUpdatesWithFallback,
    updateActsHeaderXml
};
