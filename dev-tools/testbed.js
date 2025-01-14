/* eslint-disable import/no-extraneous-dependencies */
// a simple script for developers to run the player with a specific unit and data
const { Options } = require('selenium-webdriver/firefox');
const { Builder } = require('selenium-webdriver');
const fs = require('fs');
const http = require('http');
const config = require('./config.json');

const path = fs.realpathSync(`${__dirname}/..`);

const paths = {
  player: `${path}/${config.player}`,
  unit: `${path}/${config.unit}`,
  unitData: `${path}/${config.data}`,
  playerConfig: `${path}/${config.playerConfig}`
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
    const filePath = paths[req.url.replace(/^\//, '')] || `${path}/${req.url}`;
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
  const options = new Options();
  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();
  serve();
  await driver.get(config.host ? `http://localhost:9999/${config.host}` : `file:${paths.player}`);
  if (!config.host) await sendStartCommand(driver);

  fs.watch(path, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.startsWith('.')) {
      await driver.navigate().refresh();
      if (!config.host) await sendStartCommand(driver);
    }
  });
})();
