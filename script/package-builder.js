/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const ZipAFolder = require('zip-a-folder');
const convert = require('xml-js');
const version = require('../package.json').version;

const projectPath = path.join(__dirname, '/../');
const distDir = `${projectPath}dist`;
const tmpDir = `${projectPath}tmp`;

const getPackageId = () => {
  const charset = 'abcdefghijklmnopqrstuvwxyz';
  const code = Array
    .from({ length: 12 })
    // eslint-disable-next-line no-unused-vars
    .map(_ => charset[Math.floor(Math.random() * charset.length)]).join('');
  return `IBV_${code}`;
};

const prepare = () => {
  console.log('[prepare dist directory]');

  if (fs.existsSync(`${distDir}`)) {
    fs.rmSync(`${distDir}`, { recursive: true, force: true });
  }
  fs.mkdirSync(`${distDir}`);

  console.log('[prepare tmp directory]');
  if (fs.existsSync(`${tmpDir}`)) {
    fs.rmSync(`${tmpDir}`, { recursive: true, force: true });
  }
  fs.mkdirSync(`${tmpDir}`);
  fs.mkdirSync(`${tmpDir}/package`);
  fs.mkdirSync(`${tmpDir}/package/runtimes`);
  fs.mkdirSync(`${tmpDir}/package/units`);
};

const collectRunTimeVersions = () => {
  console.log('[collect file names for IB runtime versions]');
  const runtimesSrcPath = `${projectPath}CBAItemBuilderSupportedRuntimes`;
  const dependencies = { };
  let runtimesDirContent = [];

  try {
    runtimesDirContent = fs.readdirSync(runtimesSrcPath);
  } catch (err) {
    console.err('Error reading the directory:', err);
    process.exit(1);
  }

  runtimesDirContent.forEach(file => {
    if (file.startsWith('.')) return;
    let subFiles = [];
    try {
      subFiles = fs.readdirSync(`${runtimesSrcPath}/${file}`);
    } catch (subErr) { /* empty */ }
    const stats = fs.statSync(`${runtimesSrcPath}/${file}`);
    if (!stats.isDirectory()) return;
    dependencies[file] = subFiles
      .reduce((agg, subFile) => {
        if (!agg[path.extname(subFile)]) {
          // eslint-disable-next-line no-param-reassign
          agg[path.extname(subFile)] = [];
        }
        agg[path.extname(subFile)].push(subFile);
        return agg;
      }, {});

    subFiles.forEach(subFile => {
      fs.cpSync(
        `${runtimesSrcPath}/${file}/${subFile}`,
        `${tmpDir}/package/runtimes/${file}/${subFile}`,
        { recursive: true }
      );
    });
    console.log(`* ${file}`);
  });
  return dependencies;
};

const readUnitMetaDataIfExists = itemDir => {
  const unitsDirectoryPath = `${projectPath}units/`;
  if (!fs.existsSync(`${unitsDirectoryPath}/${itemDir}/metadata.xml`)) {
    return { error: `${itemDir}: config.json not found.` };
  }
  try {
    const metadataXML = fs.readFileSync(`${unitsDirectoryPath}/${itemDir}/metadata.xml`, 'utf8');
    const metadataSource = convert.xml2js(metadataXML, { compact: true }).dc;
    const metadata = {};
    Object.entries(metadataSource)
      .forEach(([key, value]) => {
        if (!key.startsWith('dc:')) return;
        // eslint-disable-next-line no-underscore-dangle
        metadata[key.substring(3)] = Array.isArray(value) ? value.map(i => i._text).join(', ') : value._text;
      });
    return metadata;
  } catch (error) {
    return { error: error.message };
  }
};

const collectUnits = packageId => {
  console.log('[collect units]');
  const unitsDirectoryPath = `${projectPath}units/`;
  const units = [];
  let unitsDirContent = [];

  try {
    unitsDirContent = fs.readdirSync(unitsDirectoryPath);
  } catch (err) {
    console.err('Error reading the directory:', err);
    process.exit(1);
  }

  unitsDirContent.forEach(itemDir => {
    if (itemDir.startsWith('.')) return;
    // TODO unzip ?
    const stats = fs.statSync(`${unitsDirectoryPath}/${itemDir}`);
    if (!stats.isDirectory()) return;
    if (!fs.existsSync(`${unitsDirectoryPath}/${itemDir}/config.json`)) {
      console.log(`${itemDir}: config.json not found.`);
      return;
    }
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(`${unitsDirectoryPath}/${itemDir}/config.json`, 'utf8'));
    } catch (e) {
      console.log(`${itemDir}: config.json could not be read.`);
      console.warn(e);
      return;
    }

    fs.cpSync(`${unitsDirectoryPath}/${itemDir}`, `${tmpDir}/package/units/${itemDir}`, { recursive: true });
    let unitDef = {};
    try {
      unitDef = {
        task: config.tasks[0].name,
        page: config.tasks[0].initialPage,
        scope: 'A',
        runtimeVersion: config.runtimeCompatibilityVersion,
        item: config.name,
        package: packageId
      };
    } catch (e) {
      console.log(`${itemDir}: task 0 not found.`);
      console.warn(e);
      return;
    }

    fs.writeFileSync(`${distDir}/${itemDir}.voud.json`, JSON.stringify(unitDef));

    const metadata = readUnitMetaDataIfExists(itemDir);

    console.log(`* ${itemDir}`);

    units.push({
      id: itemDir,
      metadata,
      config,
      unitDef
    });
  });
  return units;
};

const createIndexFiles = dependencies => {
  console.log('[create index files]');
  const indexFile = fs.readFileSync(`${projectPath}/src/ib-runtime.template.html`, 'utf8');
  Object.entries(dependencies)
    .forEach(([ibVersion, deps]) => {
      const ibRuntimeJs = deps['.js']
        .map(jsFile => `<script src="${ibVersion}/${jsFile}"></script>`)
        .join('\n');
      const ibRuntimeCss = deps['.css']
        .map(cssFile => `<link href="${ibVersion}/${cssFile}" rel="stylesheet">`)
        .join('\n');
      const adjustedFile = indexFile
        .replaceAll('«««« ibVersion »»»»', ibVersion)
        .replace('«««« ibRuntime.js »»»»', ibRuntimeJs)
        .replace('«««« ibRuntime.css »»»»', ibRuntimeCss);
      const outputFileName = `${tmpDir}/package/runtimes/ib-runtime.${ibVersion}.html`;
      fs.writeFileSync(outputFileName, adjustedFile, 'utf8');
      console.log(`* ${outputFileName}`);
    });
};

const addPlayer = () => {
  const majorMinor = version.split('.').slice(0, 2).join('.');
  fs.cpSync(`${projectPath}/src/verona-player-ib-${majorMinor}.html`, `${distDir}/verona-player-ib-${majorMinor}.html`);
};

const zipPackage = packageId => {
  console.log('[zip package]');
  ZipAFolder.zip(`${tmpDir}/package`, `${distDir}/${packageId}.itcr.zip`);
};

const createUnitXML = (packageId, unit) => {
  console.log(unit.unitDef);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Unit
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/iqb-berlin/testcenter/15.4.0/definitions/vo_Unit.xsd"
>
  <Metadata>
    <Id>${unit.id}</Id>
    <Label>${unit.metadata.Title || unit.id}</Label>
    <Description>
      ${unit.metadata.Description}
      ---
      Creator(s): ${unit.metadata.Creator}
      Contributor(s): ${unit.metadata.Contributor}
      ---
      Subject: ${unit.metadata.Subject}
      Date: ${unit.metadata.Date}
      Source: ${unit.metadata.Source}
      ---
      Rights: ${unit.metadata.Rights}
    </Description>
  </Metadata>

  <DefinitionRef
    player="verona-player-ib-${version}.html"
    editor="IB2Verona PackageBuilder v${version} - DIPF ItemBuilder ${unit.unitDef.runtimeVersion}"
    lastChange="${(new Date(Date.now())).toISOString()}"
  >${unit.id}.voud.json</DefinitionRef>
  
  <Dependencies>
    <File>${packageId}.itcr.zip</File>
  </Dependencies>
</Unit>`;
  fs.writeFileSync(`${distDir}/${unit.id}.unit.xml`, xml);
};

const createBookletXML = (packageId, units) => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Booklet
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/iqb-berlin/testcenter/15.4.0/definitions/vo_Booklet.xsd"
>
  <Metadata>
    <Id>${packageId}</Id>
    <Label>CIB2Verona PackageBuilder v${version} | Booklet</Label>
    <Description></Description>
  </Metadata>

  <Units>
    ${units.map(unit => `<Unit id='${unit.id}' label='${unit.metadata.Title || unit.id}' labelshort='${unit.metadata.Title || unit.id}' />`).join('\n\t\t')}
  </Units>
</Booklet>`;
  fs.writeFileSync(`${distDir}/${packageId}.booklet.xml`, xml);
};

const createTesttakersXML = packageId => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Testtakers
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/iqb-berlin/testcenter/15.4.0/definitions/vo_Testtakers.xsd"
>
  <Metadata>
    <Description>Skeleton Testtakers-File as basis to work with</Description>
  </Metadata>

  <Group id="sample_group_${packageId}" label="IB Items Sample Group">
    <Login mode="run-hot-restart" name="${packageId}"><Booklet>${packageId}</Booklet></Login>
    <Login mode="run-hot-return" name="${packageId}-return"><Booklet>${packageId}</Booklet></Login>
    <Login mode="run-review" name="${packageId}-review"><Booklet>${packageId}</Booklet></Login>
    <Login mode="monitor-group" name="${packageId}-monitor" />
  </Group>
</Testtakers>`;
  fs.writeFileSync(`${distDir}/${packageId}.testtakers.xml`, xml);
};

const createXmlFiles = (packageId, units) => {
  console.log('[unit xml files]');
  units
    .forEach(unit => {
      createUnitXML(packageId, unit);
    });
  createBookletXML(packageId, units);
  createTesttakersXML(packageId);
};

const build = () => {
  const packageId = getPackageId();
  prepare();
  const dependencies = collectRunTimeVersions(); // TODO only those which are needed
  createIndexFiles(dependencies);
  const units = collectUnits(packageId);
  createXmlFiles(packageId, units);
  addPlayer();
  zipPackage(packageId);
};

module.exports = {
  build
};
