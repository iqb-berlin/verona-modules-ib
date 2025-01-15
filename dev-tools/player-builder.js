/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '/../');
const runtimesDirectoryPath = `${projectPath}CBAItemBuilderSupportedRuntimes/`;
const distDir = `${projectPath}dist/`;

const veronaPlayerVersion = 0.1;

const prepare = () => {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  if (fs.existsSync(`${distDir}player`)) {
    fs.rmSync(`${distDir}player`, { recursive: true, force: true });
  }
  fs.mkdirSync(`${distDir}player`);
};

const getDependencies = () => {
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
    } catch (subErr) {
    }
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
  });
  return dependencies;
};

const createPlayers = dependencies => {
  const playerFile = fs.readFileSync(`${projectPath}/src/verona-player-ib_TEMPLATE-0.1.html`, 'utf8');
  Object.entries(dependencies)
    .forEach(([ibVersion, deps]) => {
      const ibRuntimeJs = deps['.js']
        .map(jsFileName => fs.readFileSync(`${runtimesDirectoryPath}/${ibVersion}/${jsFileName}`, 'utf8'))
        .join('\n');
      const ibRuntimeCss = deps['.css']
        .map(cssFileName => fs.readFileSync(`${runtimesDirectoryPath}/${ibVersion}/${cssFileName}`, 'utf8'))
        .join('\n');
      const adjustedPlayer = playerFile
        .replaceAll('«««« ibVersion »»»»', ibVersion)
        .replace('«««« ibRuntime.js »»»»', ibRuntimeJs)
        .replace('«««« ibRuntime.css »»»»', ibRuntimeCss);
      const outputFileName = `${distDir}player/verona-player-ib_${ibVersion}-${veronaPlayerVersion}.html`;
      fs.writeFileSync(outputFileName, adjustedPlayer, 'utf8');
      console.log(outputFileName);
    });
};

const build = () => {
  console.log('[prepare dist directory]');
  prepare();
  console.log('[collect file names for IB runtime versions]');
  const dependencies = getDependencies();
  console.log('[create player versions]');
  createPlayers(dependencies);
  console.log('[done]');
  console.log('\n');
};

module.exports = {
  build
};
