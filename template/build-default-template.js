/**
 * Builds template/*.docx shells for report generation.
 * Run: node template/build-default-template.js
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { buildDefaultHeaderXml, buildDefaultFooterXml } = require('./default-docx');

const TEMPLATE_DIR = __dirname;
const DEFAULT_OUTPUT_PATH = path.join(TEMPLATE_DIR, 'default-template.docx');
const ACTS_OUTPUT_PATH = path.join(TEMPLATE_DIR, 'acts-template.docx');

const DOCUMENT_RELS_BASE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;

const DOCUMENT_RELS_HEADER_FOOTER = `
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;

function buildDocumentRels(includeHeaderFooter) {
  return `${DOCUMENT_RELS_BASE}${includeHeaderFooter ? DOCUMENT_RELS_HEADER_FOOTER : ''}
</Relationships>`;
}

function buildContentTypes(includeHeaderFooter) {
  const headerFooterOverrides = includeHeaderFooter
    ? `  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
${headerFooterOverrides}  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="16">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

function buildCoreXml(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${title}</dc:title>
  <dc:creator>Accomplishment Report Builder</dc:creator>
  <cp:lastModifiedBy>Accomplishment Report Builder</cp:lastModifiedBy>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Accomplishment Report Builder</Application>
</Properties>`;

function buildTemplateDocx(outputPath, shellText, coreTitle, includeHeaderFooter = false) {
  const zip = new AdmZip();
  const sectPr = includeHeaderFooter
    ? `<w:sectPr>
      <w:headerReference w:type="default" r:id="rId3"/>
      <w:footerReference w:type="default" r:id="rId4"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>
    </w:sectPr>`
    : `<w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>${shellText}</w:t></w:r></w:p>
    ${sectPr}
  </w:body>
</w:document>`;

  zip.addFile('[Content_Types].xml', Buffer.from(buildContentTypes(includeHeaderFooter), 'utf8'));
  zip.addFile('_rels/.rels', Buffer.from(ROOT_RELS, 'utf8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(buildDocumentRels(includeHeaderFooter), 'utf8'));
  zip.addFile('word/styles.xml', Buffer.from(STYLES_XML, 'utf8'));
  zip.addFile('word/numbering.xml', Buffer.from(NUMBERING_XML, 'utf8'));
  if (includeHeaderFooter) {
    zip.addFile('word/header1.xml', Buffer.from(buildDefaultHeaderXml('Sample Project', 'Sample Period'), 'utf8'));
    zip.addFile('word/footer1.xml', Buffer.from(buildDefaultFooterXml(), 'utf8'));
  }
  zip.addFile('docProps/core.xml', Buffer.from(buildCoreXml(coreTitle), 'utf8'));
  zip.addFile('docProps/app.xml', Buffer.from(APP_XML, 'utf8'));
  zip.writeZip(outputPath);
  return outputPath;
}

function buildDefaultTemplateDocx() {
  return buildTemplateDocx(
    DEFAULT_OUTPUT_PATH,
    'ARB default template shell — content is replaced on generate.',
    'ARB Default Accomplishment Report Template',
    true
  );
}

function buildActsTemplateDocx() {
  return buildTemplateDocx(
    ACTS_OUTPUT_PATH,
    'ARB ACTS Colleges template shell — content is replaced on generate.',
    'ARB ACTS Colleges Accomplishment Report Template',
    false
  );
}

function buildAllTemplates() {
  const results = [buildDefaultTemplateDocx()];
  if (!fs.existsSync(ACTS_OUTPUT_PATH)) {
    results.push(buildActsTemplateDocx());
  }
  return results;
}

if (require.main === module) {
  buildAllTemplates().forEach(out => console.log(`Created ${out}`));
}

module.exports = {
  buildDefaultTemplateDocx,
  buildActsTemplateDocx,
  buildAllTemplates,
  DEFAULT_OUTPUT_PATH,
  ACTS_OUTPUT_PATH
};
