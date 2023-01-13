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
    monitor: false,
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
    let formula = data.formula
    // remove non-ascii
    formula = formula.replace(/[^\x00-\x7F]/g, "");
    const savePath = data.savePath
    const mathJaxLoaded = await page.evaluate(() => {
      return !!(typeof MathJax !== 'undefined') // !! converts anything to boolean
    })
    if (!mathJaxLoaded) {
      await page.goto('file:///data/sinon/im2latex-pytorch/data/im2latex-official/puppeteer-render/page.html');
      // await page.goto('file:///C:/Users/Sinon/Desktop/puppeteer-render/page.html');
      // console.log('MathJax Reloaded')
    }
    await page.evaluate((formula) => {
      window.renderComplete = false
      if (!(formula === null || formula.match(/^\s*$/) !== null)) {
        ChangeFormula(formula);
      } else {
        RandomBlank();
      }
    }, formula)
    await page.waitForFunction(() => {
      return window.renderComplete
    });
    await page.waitForTimeout(500);
    let height = Math.floor((Math.random() * (800 - 256) + 256) / 64) * 64;
    let width = Math.floor((Math.random() * (1600 - 256) + 256) / 64) * 64;
    if (!(formula === null || formula.match(/^\s*$/) !== null)) {
      const math = await page.$("#math")
      try {
        await math.screenshot({ path: savePath });
      } catch (error) {
        page.setViewport({ 'width': width, 'height': height });
        await page.screenshot({ path: savePath });
      }
    } else {
      page.setViewport({ 'width': width, 'height': height });
      await page.screenshot({ path: savePath });
    }
  } catch (error) {
    console.log(error)
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
    if (clusterData.length > 0) {
      cluster.queue(clusterData);
      clusterData = [];
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
