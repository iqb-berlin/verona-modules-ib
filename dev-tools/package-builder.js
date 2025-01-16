/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '/../');
const runtimesDirectoryPath = `${projectPath}CBAItemBuilderSupportedRuntimes/`;
const runtimesDirectoryPath = `${projectPath}units/`;
const distDir = `${projectPath}dist/`;

const prepare = () => {
  if (fs.existsSync(`${distDir}`)) {
    fs.rmSync(`${distDir}`, { recursive: true, force: true });
  }
  fs.mkdirSync(`${distDir}`);
};

const collectRunTimeVersions = () => {
  const dependencies = { };
  let runtimesDirContent = [];

  try {
    runtimesDirContent = fs.readdirSync(runtimesDirectoryPath);
  } catch (err) {
    console.err('Error reading the directory:', err);
    process.exit(1);
  }

  runtimesDirContent.forEach(file => {
    if (file.startsWith('.')) return;
    let subFiles = [];
    try {
      subFiles = fs.readdirSync(`${runtimesDirectoryPath}/${file}`);
    } catch (subErr) { /* empty */ }
    const stats = fs.statSync(`${runtimesDirectoryPath}/${file}`);
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

    fs.mkdirSync(`${distDir}/${file}`);
    subFiles
      .forEach(subFile => {
        fs.copyFileSync(`${runtimesDirectoryPath}/${file}/${subFile}`, `${distDir}/${file}/${subFile}`);
      });
  });
  return dependencies;
};

const collectUnits = () => {
  const units = { };
  let unitsDirContent = [];

  try {
    unitsDirContent = fs.readdirSync(runtimesDirectoryPath);
  } catch (err) {
    console.err('Error reading the directory:', err);
    process.exit(1);
  }

  unitsDirContent.forEach(itemDir => {
    if (itemDir.startsWith('.')) return;
    // TODO unzip ?
    const stats = fs.statSync(`${runtimesDirectoryPath}/${itemDir}`);
    if (!stats.isDirectory()) return;
    if (!fs.existsSync(`${runtimesDirectoryPath}/${itemDir}/config.json`)) {
      console.log(`${itemDir}: config.json not found.`);
      return;
    }
    let config = {};
    try {
      config = fs.readFileSync(`${runtimesDirectoryPath}/${itemDir}/config.json`).toJSON();
    } catch (e) {
      console.log(`${itemDir}: config.json could not be parsed.`);
      console.warn(e);
      return;
    }
    fs.cpSync(`${runtimesDirectoryPath}/${itemDir}`, `${distDir}/${itemDir}`, { recursive: true });
    const untitDef = {
      task: config.tasks[0].name,
      page: config.tasks[0].initialPage,
      scope: 'A',
      runtimeVersion: config.runtimeCompatibilityVersion,
      name: config.name
    };
    fs.writeFileSync(`${runtimesDirectoryPath}/${itemDir}.ib2verona.json`, JSON.stringify(untitDef));
    units[itemDir] = config;
  });
  return units;
};

const createPlayers = dependencies => {
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
      const outputFileName = `${distDir}ib-runtime.${ibVersion}.html`;
      fs.writeFileSync(outputFileName, adjustedFile, 'utf8');
      console.log(outputFileName);
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
  const units = collectUnits();
  console.log('[done]');
  console.log('\n');
};

module.exports = {
  build
};
