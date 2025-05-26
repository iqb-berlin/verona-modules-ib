/* eslint-disable import/no-extraneous-dependencies,no-console */
// a simple script for developers to run the player with a specific unit and data
const { Options } = require('selenium-webdriver/firefox');
const { Builder } = require('selenium-webdriver');
const fs = require('fs');
const http = require('http');
let config = require('./config.json');

const path = fs.realpathSync(`${__dirname}/..`);

const paths = {
  player: `${path}/${config.player}`,
  unit: `${path}/${config.unit}`,
  unitData: `${path}/${config.data}`,
  playerConfig: `${path}/${config.playerConfig}`
};

const loadJSON = file => {
  delete require.cache[require.resolve(file)];
  // eslint-disable-next-line global-require,import/no-dynamic-require
  return require(file);
};

const loadConfig = () => {
  config = loadJSON('./config.json');
};

const buildPackage = () => {
  const unitId = config.unit.split('/').pop().replace('.voud.json', '');
  delete require.cache[require.resolve('../script/package-builder')];
  // eslint-disable-next-line global-require
  require('../script/package-builder').buildDev({ filterUnits: [unitId] });
};

const sendStartCommand = async driver => {
  const unitData = config.data ? JSON.parse(fs.readFileSync(paths.unitData, 'utf-8').toString()) : {};
  const playerConfig = config.playerConfig ? JSON.parse(fs.readFileSync(paths.playerConfig, 'utf-8').toString()) : {};
  const dataParts = Object.entries(unitData)
    .reduce((agg, entry) => {
      // eslint-disable-next-line no-param-reassign
      agg[entry[0]] = JSON.stringify(entry[1]);
      return agg;
    }, {});
  await driver.executeScript(`window.postMessage(${JSON.stringify({
    type: 'vopStartCommand',
    unitDefinition: fs.readFileSync(paths.unit, 'utf-8').toString(),
    sessionId: '1',
    playerConfig,
    unitState: {
      unitStateDataType: 'iqb-standard@1.0',
      dataParts
    }
  })})`);
};

const serve = () => {
  http.createServer((req, res) => {
    const parts = req.url.split('?', 2);
    const url = parts[0];
    const filePath = paths[url.replace(/^\//, '')] || `${path}/${url}`;
    console.log(`FETCH: ${filePath}`);
    fs.readFile(filePath, (err, data) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Content-Security-Policy', '');
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify(err));
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  })
    .listen(9999);
};

(async () => {
  buildPackage();
  // eslint-disable-next-line global-require
  config = require('./config.json');
  const options = new Options();
  options.addArguments('--devtools');
  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();
  serve();
  await driver.get(config.host ? `http://localhost:9999/${config.host}` : `file:${paths.player}`);
  if (!config.host) await sendStartCommand(driver);

  fs.watch(path, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.startsWith('.')) {
      loadConfig();
      // eslint-disable-next-line global-require
      buildPackage();
      await driver.navigate().refresh();
      if (!config.host) await sendStartCommand(driver);
    }
  });
})();
