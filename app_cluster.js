const express = require('express');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');
const { Cluster } = require('puppeteer-cluster');



const app = express();
app.use(express.json())

var cluster;

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 10,
    monitor: false
  });

  await cluster.task(async ({ page, data }) => {
    await RenderFormula(page, data)
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
      await page.goto('file://C:/Users/Sinon/Desktop/puppeteer-render/page.html');
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
    for (let i = 0; i < formulas.length; i++) {
      let formula = formulas[i];
      let savePath = dir + '//' + (prefix + i).toString() + '.png';
      let data = { "formula": formula, "savePath": savePath };
      cluster.queue(data);
    }
    await cluster.idle();
    var endTime = performance.now()
    res.send(`Render Successfully in ${(endTime - startTime) / 1000} seconds`)
  } catch (error) {
    if (!res.headersSent) {
      res.status(400).send(error.message);
    }
  }
});



app.listen(8080, () => console.log('Listening on PORT: 8080'));
