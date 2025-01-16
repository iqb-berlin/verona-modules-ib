/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '/../');

const prepare = () => {
  const distDir = `${projectPath}dist/`;
  if (fs.existsSync(`${distDir}`)) {
    fs.rmSync(`${distDir}`, { recursive: true, force: true });
  }
  fs.mkdirSync(`${distDir}`);
  fs.mkdirSync(`${distDir}/itcr`);
  fs.mkdirSync(`${distDir}/itcr/runtimes`);
  fs.mkdirSync(`${distDir}/itcr/units`);
};

const collectRunTimeVersions = () => {
  const distDir = `${projectPath}dist`;
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
        `${distDir}/itcr/runtimes/${file}/${subFile}`,
        { recursive: true }
      );
    });
    console.log(`* ${file}`);
  });
  return dependencies;
};

const collectUnits = () => {
  const distDir = `${projectPath}dist`;
  const unitsDirectoryPath = `${projectPath}units/`;
  const units = { };
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

    fs.cpSync(`${unitsDirectoryPath}/${itemDir}`, `${distDir}/itcr/units/${itemDir}`, { recursive: true });
    let unitDef = {};
    try {
      unitDef = {
        task: config.tasks[0].name,
        page: config.tasks[0].initialPage,
        scope: 'A',
        runtimeVersion: config.runtimeCompatibilityVersion,
        item: config.name
      };
    } catch (e) {
      console.log(`${itemDir}: task 0 not found.`);
      console.warn(e);
      return;
    }

    fs.writeFileSync(`${distDir}/${itemDir}.ib2verona.json`, JSON.stringify(unitDef));

    console.log(`* ${itemDir}`);
    units[itemDir] = config;
  });
  return units;
};

const createPlayers = dependencies => {
  const distDir = `${projectPath}dist`;
  const playerFile = fs.readFileSync(`${projectPath}/src/ib-runtime.template.html`, 'utf8');
  Object.entries(dependencies)
    .forEach(([ibVersion, deps]) => {
      const ibRuntimeJs = deps['.js']
        .map(jsFile => `<script src="${ibVersion}/${jsFile}"></script>`)
        .join('\n');
      const ibRuntimeCss = deps['.css']
        .map(cssFile => `<link href="${ibVersion}/${cssFile}" rel="stylesheet">`)
        .join('\n');
      const adjustedFile = playerFile
        .replaceAll('«««« ibVersion »»»»', ibVersion)
        .replace('«««« ibRuntime.js »»»»', ibRuntimeJs)
        .replace('«««« ibRuntime.css »»»»', ibRuntimeCss);
      const outputFileName = `${distDir}/itcr/runtimes/ib-runtime.${ibVersion}.html`;
      fs.writeFileSync(outputFileName, adjustedFile, 'utf8');
      console.log(`* ${outputFileName}`);
    });
};

const build = () => {
  console.log('[prepare dist directory]');
  prepare();
  console.log('[collect file names for IB runtime versions]');
  const dependencies = collectRunTimeVersions();
  console.log('[create index files]');
  createPlayers(dependencies);
  console.log('[collect units]');
  collectUnits();
  console.log('[done]');
  console.log('\n');
};

module.exports = {
  build
};
