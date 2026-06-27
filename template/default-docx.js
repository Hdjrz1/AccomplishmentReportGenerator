/**
 * Default v3 — Gitmore / CodePulse hybrid accomplishment report layout.
 * Word-compatible OOXML (explicit w:p/w:r, no undefined styles).
 */

const NAVY = '002060';
const NAVY_LIGHT = 'E8EEF7';
const ACCENT = '0078A8';
const TEXT_MUTED = '44546A';
const BORDER = 'BFBFBF';
const ROW_ALT = 'F8FAFC';
const CALLOUT_FILL = 'F4F7FB';
const WHITE = 'FFFFFF';
const STATUS_GREEN = '1E7D4E';

const FONT_BODY = 'Calibri';
const FONT_MONO = 'Consolas';

const ACCOMPLISHMENT_GROUPS = [
    { key: 'features', label: 'Features & Improvements' },
    { key: 'fixes', label: 'Bug Fixes' },
    { key: 'technical', label: 'Technical / Infrastructure' }
];

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

function runXml(text, options = {}) {
    const {
        bold = false,
        italic = false,
        size = 22,
        color = null,
        font = FONT_BODY
    } = options;
    return '<w:r><w:rPr>' +
        `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
        (bold ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/><w:bCs w:val="0"/>') +
        (italic ? '<w:i/>' : '') +
        (color ? `<w:color w:val="${color}"/>` : '') +
        `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
        '</w:rPr>' +
        `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function emptyRunXml() {
    return '<w:r><w:t xml:space="preserve"></w:t></w:r>';
}

function spacing(before = 0, after = 100, line = 276) {
    return `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`;
}

function paragraphXml(runs, pPrExtra = '') {
    const inner = Array.isArray(runs) ? runs.join('') : (runs || '');
    const content = inner || emptyRunXml();
    return `<w:p><w:pPr>${pPrExtra}</w:pPr>${content}</w:p>`;
}

function tableBorders(color = BORDER) {
    const edge = `w:val="single" w:color="${color}" w:sz="4" w:space="0"`;
    return '<w:tblBorders>' +
        `<w:top ${edge}/><w:left ${edge}/><w:bottom ${edge}/><w:right ${edge}/>` +
        `<w:insideH ${edge}/><w:insideV ${edge}/>` +
        '</w:tblBorders>';
}

function tableRowPrEx() {
    return `<w:tblPrEx>${tableBorders(BORDER)}</w:tblPrEx>`;
}

function tablePrXml(gridCols) {
    const grid = gridCols.map(w => `<w:gridCol w:w="${w}"/>`).join('');
    return '<w:tblPr>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        tableBorders(BORDER) +
        '<w:tblLayout w:type="autofit"/>' +
        '<w:tblCellMar>' +
        '<w:top w:w="0" w:type="dxa"/><w:left w:w="10" w:type="dxa"/>' +
        '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="10" w:type="dxa"/>' +
        '</w:tblCellMar>' +
        '</w:tblPr>' +
        `<w:tblGrid>${grid}</w:tblGrid>`;
}

const EXPORT_MAX_ROWS = 25;
const EXPORT_MAX_BULLETS = 6;
const EXPORT_MAX_CELL_CHARS = 240;

function truncateCellText(text, maxChars = EXPORT_MAX_CELL_CHARS) {
    const value = String(text || '');
    if (value.length <= maxChars) return value;
    return `${value.slice(0, maxChars - 1)}…`;
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
        if (overflowNote) result += (result ? '\n' : '') + overflowNote;
    } else {
        const shown = bullets.slice(0, EXPORT_MAX_BULLETS);
        result = `${shown.join('\n')}\n…and ${bullets.length - EXPORT_MAX_BULLETS} more`;
    }
    return truncateCellText(result);
}

function applyFileChangesSafetyLimits(fileChanges) {
    if (!Array.isArray(fileChanges) || fileChanges.length === 0) return fileChanges || [];

    let rows = fileChanges.map(change => ({
        file: truncateCellText(change.file),
        modifications: limitModificationsText(change.modifications)
    }));

    if (rows.length > EXPORT_MAX_ROWS) {
        const overflowCount = rows.length - (EXPORT_MAX_ROWS - 1);
        rows = rows.slice(0, EXPORT_MAX_ROWS - 1);
        rows.push({
            file: truncateCellText(`+ ${overflowCount} additional entries`),
            modifications: truncateCellText(`+ ${overflowCount} additional files modified across selected repositories.`)
        });
    }
    return rows;
}

function resolveReportMetrics(data) {
    const commitCount = Number(data.commit_count) || 0;
    const fileCount = Number(data.file_count) ||
        (Array.isArray(data.detailed_files) ? data.detailed_files.length : 0);
    const branchLines = String(data.branches_text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const repoCount = Number(data.repo_count) || branchLines.length;
    const reportStatus = String(data.report_status || 'On Track / For Review').trim();
    const generatedDate = String(data.generated_date || '').trim() ||
        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return { commitCount, fileCount, repoCount, reportStatus, generatedDate };
}

function buildBannerTableXml(projectTitle, reportDate) {
    const title = projectTitle || 'Project';
    const period = reportDate || '';
    let xml = `<w:tbl>${tablePrXml([9360])}`;
    xml += `<w:tr>${tableRowPrEx()}`;
    xml += `<w:tc><w:tcPr>` +
        '<w:tcW w:w="5000" w:type="pct"/>' +
        `<w:shd w:val="clear" w:color="auto" w:fill="${NAVY}"/>` +
        '<w:tcMar><w:top w:w="200" w:type="dxa"/><w:left w:w="240" w:type="dxa"/>' +
        '<w:bottom w:w="200" w:type="dxa"/><w:right w:w="240" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>';
    xml += paragraphXml(
        runXml('DAILY ACCOMPLISHMENT REPORT', { bold: true, size: 32, color: WHITE }),
        `${spacing(0, 60, 240)}<w:jc w:val="center"/>`
    );
    xml += paragraphXml(
        runXml(title, { bold: true, size: 24, color: WHITE }),
        `${spacing(0, period ? 40 : 0, 240)}<w:jc w:val="center"/>`
    );
    if (period) {
        xml += paragraphXml(
            runXml(period, { size: 20, color: 'B8D4E8' }),
            `${spacing(0, 0, 240)}<w:jc w:val="center"/>`
        );
    }
    xml += '</w:tc></w:tr></w:tbl>';
    return xml;
}

function buildStatusLineXml(status) {
    return paragraphXml(
        runXml('Overall Status: ', { bold: true, size: 22, color: NAVY }) +
        runXml(status, { bold: true, size: 22, color: STATUS_GREEN }),
        `${spacing(160, 120, 276)}<w:jc w:val="left"/>`
    );
}

function buildMetadataTableRow(label, value) {
    let xml = `<w:tr>${tableRowPrEx()}`;
    xml += '<w:tc><w:tcPr>' +
        '<w:tcW w:w="1500" w:type="pct"/>' +
        `<w:shd w:val="clear" w:color="auto" w:fill="${NAVY_LIGHT}"/>` +
        '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
        '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>' +
        paragraphXml(
            runXml(label, { bold: true, size: 20, color: NAVY }),
            `${spacing(40, 40, 240)}<w:jc w:val="left"/>`
        ) +
        '</w:tc>';
    xml += '<w:tc><w:tcPr>' +
        '<w:tcW w:w="3500" w:type="pct"/>' +
        '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
        '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>';
    const lines = String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
        xml += paragraphXml(emptyRunXml(), `${spacing(40, 40, 240)}<w:jc w:val="left"/>`);
    } else {
        lines.forEach(line => {
            xml += paragraphXml(
                runXml(line, { size: 20 }),
                `${spacing(40, 40, 240)}<w:jc w:val="left"/>`
            );
        });
    }
    xml += '</w:tc></w:tr>';
    return xml;
}

function buildMetadataMetricsTableXml(data, metrics) {
    const rows = [
        ['Developer Name', data.developer_name],
        ['Role / Department', data.job_title],
        ['Reporting Period', data.date_range_text],
        ['Project Title', data.project_title],
        ['Branch / Repository', data.branches_text],
        ['Report Generated', metrics.generatedDate],
        ['Commits Selected', String(metrics.commitCount)],
        ['Files Modified', String(metrics.fileCount)],
        ['Repositories', String(metrics.repoCount)]
    ];

    let xml = `<w:tbl>${tablePrXml([2798, 6528])}`;
    rows.forEach(row => {
        xml += buildMetadataTableRow(row[0], row[1]);
    });
    xml += '</w:tbl>';
    return xml;
}

function buildSectionHeadingXml(number, text) {
    return paragraphXml(
        runXml(`[${number}] `, { bold: true, size: 22, color: ACCENT }) +
        runXml(text, { bold: true, size: 24, color: NAVY }),
        `${spacing(280, 80, 240)}<w:jc w:val="left"/>` +
        `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="${ACCENT}"/></w:pBdr>`
    );
}

function buildExecutiveSummaryCalloutXml(text) {
    const body = buildBodyParagraphsXml(text, 0, 0, 22);
    let xml = '<w:tbl><w:tblPr>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        '<w:tblBorders>' +
        `<w:top w:val="single" w:color="${BORDER}" w:sz="4" w:space="0"/>` +
        `<w:left w:val="single" w:color="${ACCENT}" w:sz="16" w:space="0"/>` +
        `<w:bottom w:val="single" w:color="${BORDER}" w:sz="4" w:space="0"/>` +
        `<w:right w:val="single" w:color="${BORDER}" w:sz="4" w:space="0"/>` +
        '</w:tblBorders>' +
        '</w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid>';
    xml += `<w:tr>${tableRowPrEx()}<w:tc><w:tcPr>` +
        `<w:shd w:val="clear" w:color="auto" w:fill="${CALLOUT_FILL}"/>` +
        '<w:tcMar><w:top w:w="160" w:type="dxa"/><w:left w:w="200" w:type="dxa"/>' +
        '<w:bottom w:w="160" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>';
    xml += body;
    xml += '</w:tc></w:tr></w:tbl>';
    return xml;
}

function buildBodyParagraphsXml(text, firstBefore = 80, lastAfter = 120, size = 22) {
    const lines = String(text || '').split('\n');
    if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) {
        return paragraphXml(emptyRunXml(), `${spacing(firstBefore, lastAfter, 276)}<w:jc w:val="left"/>`);
    }

    let xml = '';
    lines.forEach((line, index) => {
        const isLast = index === lines.length - 1;
        xml += paragraphXml(
            line.trim() ? runXml(line, { size }) : emptyRunXml(),
            spacing(index === 0 ? firstBefore : 0, line.trim() === '' ? 40 : (isLast ? lastAfter : 60), 276) +
            '<w:jc w:val="left"/>'
        );
    });
    return xml;
}

function categorizeAccomplishment(text) {
    const lower = String(text || '').toLowerCase();
    if (/\bfix\b|\bbug\b|\bdebug\b|\bresolve\b|\bpatch\b|system fix/.test(lower)) {
        return 'fixes';
    }
    if (/deploy|workflow|infra|config|cleanup|repository|technical|database|backend|htaccess/.test(lower)) {
        return 'technical';
    }
    return 'features';
}

function groupAccomplishments(items) {
    const groups = { features: [], fixes: [], technical: [] };
    (items || []).forEach(item => {
        const trimmed = String(item || '').trim();
        if (!trimmed) return;
        groups[categorizeAccomplishment(trimmed)].push(trimmed);
    });
    return groups;
}

function buildListItemXml(boldPart, normalPart, numId = 1) {
    return '<w:p><w:pPr>' +
        '<w:pStyle w:val="16"/>' +
        `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` +
        spacing(40, 40, 276) +
        '<w:jc w:val="left"/>' +
        '</w:pPr>' +
        (boldPart ? runXml(boldPart, { bold: true, size: 22 }) : '') +
        runXml(normalPart || '', { size: 22 }) +
        '</w:p>';
}

function buildBulletItemsXml(items, numId = 1) {
    let xml = '';
    (items || []).forEach(item => {
        const trimmedItem = String(item || '').trim();
        if (!trimmedItem) return;
        const text = trimmedItem.replace(/^[•\-\*\s]+/, '');
        const colonIndex = text.indexOf(':');
        let boldPart = '';
        let normalPart = text;
        if (colonIndex > 0 && colonIndex < 80) {
            boldPart = `${text.substring(0, colonIndex + 1)} `;
            normalPart = text.substring(colonIndex + 1).trim();
        }
        xml += buildListItemXml(boldPart, normalPart, numId);
    });
    return xml;
}

function buildGroupedAccomplishmentsXml(items) {
    const groups = groupAccomplishments(items);
    let xml = '';
    ACCOMPLISHMENT_GROUPS.forEach(group => {
        const entries = groups[group.key];
        if (!entries.length) return;
        xml += paragraphXml(
            runXml(group.label, { bold: true, size: 22, color: NAVY }),
            `${spacing(80, 40, 276)}<w:jc w:val="left"/>`
        );
        xml += buildBulletItemsXml(entries);
    });
    if (!xml) {
        xml += buildBulletItemsXml(items);
    }
    return xml;
}

function buildGitActivityMetricsTableXml(metrics) {
    const rows = [
        ['Commits Selected', String(metrics.commitCount)],
        ['Files Modified', String(metrics.fileCount)],
        ['Repositories Covered', String(metrics.repoCount)]
    ];

    let xml = `<w:tbl>${tablePrXml([3200, 6160])}`;
    xml += `<w:tr>${tableRowPrEx()}`;
    ['Git Activity', 'Count'].forEach((header, idx) => {
        xml += `<w:tc><w:tcPr><w:tcW w:w="${idx === 0 ? 1750 : 3250}" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${NAVY}"/>` +
            '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            paragraphXml(
                runXml(header, { bold: true, size: 20, color: WHITE }),
                `${spacing(40, 40, 240)}<w:jc w:val="left"/>`
            ) +
            '</w:tc>';
    });
    xml += '</w:tr>';

    rows.forEach((row, rowIndex) => {
        const rowFill = rowIndex % 2 === 1 ? ROW_ALT : WHITE;
        xml += `<w:tr>${tableRowPrEx()}`;
        xml += `<w:tc><w:tcPr><w:tcW w:w="1750" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>` +
            '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            paragraphXml(runXml(row[0], { bold: true, size: 20, color: NAVY }), `${spacing(50, 50, 240)}<w:jc w:val="left"/>`) +
            '</w:tc>';
        xml += `<w:tc><w:tcPr><w:tcW w:w="3250" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>` +
            '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            paragraphXml(runXml(row[1], { size: 20 }), `${spacing(50, 50, 240)}<w:jc w:val="left"/>`) +
            '</w:tc></w:tr>';
    });

    xml += '</w:tbl>';
    return xml;
}

function buildFileAdjustmentsTableXml(fileChanges) {
    const safeFileChanges = applyFileChangesSafetyLimits(fileChanges);
    let xml = `<w:tbl>${tablePrXml([3200, 6160])}`;

    xml += `<w:tr>${tableRowPrEx()}`;
    ['File Affected', 'Modifications Made'].forEach((header, idx) => {
        xml += `<w:tc><w:tcPr><w:tcW w:w="${idx === 0 ? 1750 : 3250}" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${NAVY}"/>` +
            '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            paragraphXml(
                runXml(header, { bold: true, size: 20, color: WHITE }),
                `${spacing(40, 40, 240)}<w:jc w:val="left"/>`
            ) +
            '</w:tc>';
    });
    xml += '</w:tr>';

    safeFileChanges.forEach((change, rowIndex) => {
        const rowFill = rowIndex % 2 === 1 ? ROW_ALT : WHITE;
        xml += `<w:tr>${tableRowPrEx()}`;

        xml += `<w:tc><w:tcPr><w:tcW w:w="1750" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>` +
            '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            paragraphXml(
                runXml(change.file, { bold: true, size: 20, font: FONT_MONO }),
                `${spacing(50, 50, 240)}<w:jc w:val="left"/>`
            ) +
            '</w:tc>';

        xml += `<w:tc><w:tcPr><w:tcW w:w="3250" w:type="pct"/>` +
            `<w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>` +
            '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>' +
            '<w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>' +
            '</w:tcPr>' +
            '<w:p><w:pPr>' + spacing(50, 50, 276) + '<w:jc w:val="left"/></w:pPr>';

        const mods = Array.isArray(change.modifications)
            ? change.modifications
            : String(change.modifications || '').split('\n');
        let firstMod = true;
        let hasMod = false;
        mods.forEach(mod => {
            let mText = String(mod || '').trim();
            if (!mText) return;
            hasMod = true;
            if (!mText.startsWith('•') && !mText.startsWith('-')) mText = `• ${mText}`;
            else if (mText.startsWith('-')) mText = `•${mText.slice(1)}`;
            if (!firstMod) xml += '<w:r><w:br/></w:r>';
            xml += runXml(mText, { size: 20 });
            firstMod = false;
        });
        if (!hasMod) xml += emptyRunXml();
        xml += '</w:p></w:tc></w:tr>';
    });

    xml += '</w:tbl>';
    return xml;
}

function buildSignatureBlockXml(devName, jobTitle, generatedDate) {
    let xml = paragraphXml(emptyRunXml(), `${spacing(320, 80, 240)}<w:jc w:val="left"/>`);
    xml += '<w:tbl><w:tblPr>' +
        '<w:tblW w:w="5000" w:type="pct"/>' +
        tableBorders(BORDER) +
        '</w:tblPr><w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="4680"/></w:tblGrid>';
    xml += `<w:tr>${tableRowPrEx()}`;

    xml += '<w:tc><w:tcPr>' +
        '<w:tcMar><w:top w:w="160" w:type="dxa"/><w:left w:w="180" w:type="dxa"/>' +
        '<w:bottom w:w="160" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>';
    xml += paragraphXml(runXml('Prepared By', { bold: true, size: 20, color: NAVY }), `${spacing(0, 80, 240)}<w:jc w:val="left"/>`);
    xml += paragraphXml(runXml(devName || '', { bold: true, size: 24 }), `${spacing(0, 40, 240)}<w:jc w:val="left"/>`);
    xml += paragraphXml(runXml(jobTitle || '', { size: 20, color: TEXT_MUTED }), `${spacing(0, 0, 240)}<w:jc w:val="left"/>`);
    xml += '</w:tc>';

    xml += '<w:tc><w:tcPr>' +
        '<w:tcMar><w:top w:w="160" w:type="dxa"/><w:left w:w="180" w:type="dxa"/>' +
        '<w:bottom w:w="160" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tcMar>' +
        '</w:tcPr>';
    xml += paragraphXml(runXml('Date Submitted', { bold: true, size: 20, color: NAVY }), `${spacing(0, 80, 240)}<w:jc w:val="left"/>`);
    xml += paragraphXml(runXml(generatedDate || '', { size: 22 }), `${spacing(0, 40, 240)}<w:jc w:val="left"/>`);
    xml += paragraphXml(
        runXml('Submitted for technical review.', { size: 18, color: TEXT_MUTED, italic: true }),
        `${spacing(0, 0, 240)}<w:jc w:val="left"/>`
    );
    xml += '</w:tc></w:tr></w:tbl>';
    return xml;
}

function buildDefaultReportBody(data) {
    const metrics = resolveReportMetrics(data);
    let xml = '';

    xml += buildBannerTableXml(data.project_title, data.date_range_text);
    xml += buildStatusLineXml(metrics.reportStatus);
    xml += buildMetadataMetricsTableXml(data, metrics);
    xml += paragraphXml(emptyRunXml(), `${spacing(120, 40, 240)}<w:jc w:val="left"/>`);

    xml += buildSectionHeadingXml(1, 'Executive Summary');
    xml += buildExecutiveSummaryCalloutXml(data.executive_summary);

    xml += buildSectionHeadingXml(2, 'Key Accomplishments & Technical Enhancements');
    xml += buildGroupedAccomplishmentsXml(data.key_accomplishments);

    xml += buildSectionHeadingXml(3, 'Detailed File & Commit Activity');
    xml += paragraphXml(
        runXml('Git activity summary for the selected reporting period.', { size: 20, color: TEXT_MUTED, italic: true }),
        `${spacing(80, 80, 276)}<w:jc w:val="left"/>`
    );
    xml += buildGitActivityMetricsTableXml(metrics);
    xml += paragraphXml(emptyRunXml(), `${spacing(120, 80, 240)}<w:jc w:val="left"/>`);
    xml += buildFileAdjustmentsTableXml(data.detailed_files);

    xml += buildSectionHeadingXml(4, 'Impact and Verification');
    xml += buildBulletItemsXml(data.impact_verification);

    xml += buildSectionHeadingXml(5, 'Verification Status');
    xml += buildBodyParagraphsXml(data.verification_status, 80, 160);
    xml += buildSignatureBlockXml(data.developer_name, data.job_title, metrics.generatedDate);

    return xml;
}

const DEFAULT_SECT_PR = '<w:sectPr>' +
    '<w:headerReference w:type="default" r:id="rId3"/>' +
    '<w:footerReference w:type="default" r:id="rId4"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>' +
    '<w:cols w:space="720" w:num="1"/>' +
    '<w:docGrid w:linePitch="360" w:charSpace="0"/>' +
    '</w:sectPr>';

function buildDefaultDocumentXml(data) {
    const body = buildDefaultReportBody(data);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<w:body>${body}${DEFAULT_SECT_PR}</w:body></w:document>`;
}

function buildDefaultHeaderXml(projectTitle, dateRangeText) {
    const title = projectTitle || 'Project';
    const period = dateRangeText || '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        paragraphXml(
            runXml(title, { bold: true, size: 18, color: NAVY }) +
            runXml('   ·   Accomplishment Report   ·   ', { size: 16, color: TEXT_MUTED }) +
            runXml(period, { size: 16, color: ACCENT }),
            `${spacing(0, 0, 240)}<w:jc w:val="center"/>` +
            `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="${BORDER}"/></w:pBdr>`
        ) +
        '</w:hdr>';
}

function pageNumberFieldXml() {
    return '<w:r><w:fldSimple w:instr=" PAGE ">' +
        `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="${TEXT_MUTED}"/></w:rPr>` +
        '<w:t>1</w:t></w:r></w:fldSimple></w:r>';
}

function buildDefaultFooterXml(projectTitle) {
    const title = projectTitle || 'Accomplishment Report';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        paragraphXml(
            runXml(title, { size: 16, color: TEXT_MUTED }) +
            runXml('   ·   Page ', { size: 16, color: TEXT_MUTED }) +
            pageNumberFieldXml(),
            `${spacing(0, 0, 240)}<w:jc w:val="center"/>` +
            `<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${BORDER}"/></w:pBdr>`
        ) +
        '</w:ftr>';
}

module.exports = {
    buildDefaultReportBody,
    buildDefaultDocumentXml,
    buildDefaultHeaderXml,
    buildDefaultFooterXml,
    DEFAULT_SECT_PR
};
