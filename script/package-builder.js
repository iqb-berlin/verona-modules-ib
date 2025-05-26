/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const ZipAFolder = require('zip-a-folder');
const convert = require('xml-js');
const extract = require('extract-zip');
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

const collectRunTimeVersions = units => {
  console.log('[collect file names for IB runtime versions]');
  const runtimesSrcPath = `${projectPath}CBAItemBuilderSupportedRuntimes`;
  const dependencies = { };

  const neededRuntimes = units
    .reduce((agg, unit) => {
      if (!agg.includes(unit.unitDef.runtimeVersion)) agg.push(unit.unitDef.runtimeVersion);
      return agg;
    }, []);

  neededRuntimes.forEach(runtimeVersion => {
    let subFiles = [];
    try {
      subFiles = fs.readdirSync(`${runtimesSrcPath}/${runtimeVersion}`);
    } catch (subErr) { /* empty */ }
    dependencies[runtimeVersion] = subFiles
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
        `${runtimesSrcPath}/${runtimeVersion}/${subFile}`,
        `${tmpDir}/package/runtimes/${runtimeVersion}/${subFile}`,
        { recursive: true }
      );
    });
    console.log(`* ${runtimeVersion}`);
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

const collectUnits = async (packageId, filterUnits) => {
  console.log('[collect units]');
  const unitsPath = `${projectPath}units`;
  const units = [];
  let unitsDirContent = [];

  try {
    unitsDirContent = fs.readdirSync(unitsPath);
  } catch (err) {
    console.error('Error reading the directory:', err);
    process.exit(1);
  }

  // use traditional loop because of await inside
  // eslint-disable-next-line no-restricted-syntax
  for (const fileOrDir of unitsDirContent) {
    // eslint-disable-next-line no-continue
    if (path.extname(fileOrDir).toLocaleLowerCase() !== '.zip') continue;
    const itemName = path.basename(fileOrDir, '.zip');
    // eslint-disable-next-line no-continue
    if (filterUnits && !filterUnits.includes(itemName)) continue;

    if (!fs.existsSync(`${unitsPath}/${itemName}`)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await extract(`${unitsPath}/${fileOrDir}`, { dir: `${unitsPath}/${itemName}` });
        console.log(`* ${itemName}: zip extracted`);
      } catch (err) {
        console.log(`* ${itemName}: could not extract zip`);
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    if (!fs.existsSync(`${unitsPath}/${itemName}/config.json`)) {
      console.log(`* ${itemName}: config.json not found.`);
      // eslint-disable-next-line no-continue
      continue;
    }
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(`${unitsPath}/${itemName}/config.json`, 'utf8'));
    } catch (e) {
      console.log(`${itemName}: config.json could not be read.`);
      console.warn(e);
      // eslint-disable-next-line no-continue
      continue;
    }

    fs.cpSync(`${unitsPath}/${itemName}`, `${tmpDir}/package/units/${itemName}`, { recursive: true });
    let unitDef = {};
    try {
      unitDef = {
        task: config.tasks[0].name,
        page: config.tasks[0].initialPage,
        scope: 'A',
        runtimeVersion: config.runtimeCompatibilityVersion,
        item: config.name,
        package: packageId,
        folder: itemName
      };
    } catch (e) {
      console.log(`* ${itemName}: task 0 not found.`);
      console.warn(e);
      // eslint-disable-next-line no-continue
      continue;
    }

    fs.writeFileSync(`${distDir}/${itemName}.voud.json`, JSON.stringify(unitDef));

    const metadata = readUnitMetaDataIfExists(itemName);

    console.log(`* ${itemName}`);

    units.push({
      id: itemName,
      metadata,
      config,
      unitDef
    });
  }

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

const unitId = unit => unit.id.replace(/[^a-zA-Z0-9]/g, '_').replace(/(^\d)/, 'x$1');

const createUnitXML = (packageId, unit) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Unit
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/iqb-berlin/testcenter/15.4.0/definitions/vo_Unit.xsd"
>
  <Metadata>
    <Id>${unitId(unit)}</Id>
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

  <!-- you can (and should!) remove this when seriously using this booklet, it's just for debugging -->
  <States>
    <State id="dummy-to-track-vars">
      <Option id="dummy">
        ${units.map(unit => unit.config.variables.map(variable => `<If><Value of="${variable.name}" from="${unitId(unit)}" /><Is equal="--" /></If>`).join('\n\t\t\t\t')).join('\n\t\t\t')}
      </Option>
      <Option id="dummy2" />
    </State>
  </States>

  <Units>
    ${units.map((unit, i) => `<Unit id='${unitId(unit)}' label='${unit.metadata.Title || unit.id}' labelshort='${i}' />`).join('\n\t\t')}
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

const build = async () => {
  const packageId = process.argv[2] || getPackageId();
  prepare();
  const units = await collectUnits(packageId);
  createXmlFiles(packageId, units);
  const dependencies = collectRunTimeVersions(units);
  createIndexFiles(dependencies);
  addPlayer();
  zipPackage(packageId);
};

const buildDev = async options => {
  prepare();
  const units = await collectUnits('package', (options?.filterUnits || []));
  const dependencies = collectRunTimeVersions(units);
  createIndexFiles(dependencies);
};

module.exports = {
  build,
  buildDev
};
