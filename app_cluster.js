const express = require('express');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const { Cluster } = require('puppeteer-cluster');
var ParseFormula = require('./preprocess_latex.js')
ParseFormula = ParseFormula.ParseFormula

const app = express();
app.use(express.json({ limit: "10mb" }))

var cluster;

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 10,
    monitor: true,
    timeout: 999999,
    puppeteerOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--window-size=${1280},${960}`],
    },
  });

  await cluster.task(async ({ page, data }) => {
    for (let i = 0; i < data.length; i++) {
      let pageData = data[i]
      await RenderFormula(page, pageData);
    }
    // await new Promise(resolve => {
    //   // call resolve() when you want to close the page
    // });
  });
  return cluster
})().then(value => {
  cluster = value
})

async function RenderFormula(page, data) {
  try {
    const formula = data.formula
    const savePath = data.savePath
    const mathJaxLoaded = await page.evaluate(() => {
      return !!(typeof MathJax !== 'undefined') // !! converts anything to boolean
    })
    if (!mathJaxLoaded) {
      await page.goto('file:///data/sinon/puppeteer-render/page.html');
      // console.log('MathJax Reloaded')
    }
    await page.evaluate((formula) => {
      window.renderComplete = false
      ChangeFormula(formula);
    }, formula)
    await page.waitForFunction(() => {
      return window.renderComplete
    });
    const math = await page.$("#math")
    await math.screenshot({ path: savePath });
  } catch (error) {
    return
  }
}

app.post('/render', async (req, res) => {
  // puppeteer.launch() => Chrome running locally (on the same hardware)
  let browser = null;
  var startTime = performance.now()

  try {
    let formulas = req.body.formulas
    let dir = req.body.dir
    let prefix = parseFloat(req.body.prefix)
    // let renderTasks = []
    let clusterData = []
    let normFormulas = []
    for (let i = 0; i < formulas.length; i++) {
      let formula = formulas[i];
      formula = ParseFormula(formula);
      normFormulas.push(formula);
      let savePath = dir + '//' + (prefix + i).toString() + '.png';
      let data = { "formula": formula, "savePath": savePath };
      clusterData.push(data)
      if ((i + 1) % 100 === 0) {
        cluster.queue(clusterData);
        clusterData = [];
      }
    }
    await cluster.idle();
    var endTime = performance.now()
    res.json({ "msg": `Render Successfully in ${(endTime - startTime) / 1000} seconds`, "formulas": normFormulas })
  } catch (error) {
    if (!res.headersSent) {
      res.status(400).send(error.message);
    }
  }
});



app.listen(8080, () => console.log('Listening on PORT: 8080'));
