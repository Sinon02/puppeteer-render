const express = require('express');
const path = require('path');
const { performance } = require('perf_hooks');
const { Cluster } = require('puppeteer-cluster');
var ParseFormula = require('./preprocess_latex.js')
ParseFormula = ParseFormula.ParseFormula

PROCESS_NUM = 20
const app = express();
app.use(express.json({ limit: "10mb" }))

var cluster;

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: PROCESS_NUM,
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
    const formula = data.formula
    const savePath = data.savePath
    const mathJaxLoaded = await page.evaluate(() => {
      return !!(typeof MathJax !== 'undefined') // !! converts anything to boolean
    })
    if (!mathJaxLoaded) {
      // 获取当前工作目录
      const cwd = process.cwd();
      // 构建相对路径
      const relativePath = path.join(cwd, './page.html');
      await page.goto('file://' + relativePath);
      // console.log('MathJax Reloaded')
    }
    await page.evaluate((formula) => {
      if (!(formula === null || formula.match(/^\s*$/) !== null)) {
        return ChangeFormula(formula);
      } else {
        return RandomBlank();
      }
    }, formula)
    await page.waitForFunction((msg) => {
      return msg.style.display === 'none' && msg.innerHTML === ''
    }, {},
      await page.$("#MathJax_Message"));
    // await page.waitForTimeout(100);
    // let height = Math.floor((Math.random() * (800 - 256) + 256) / 64) * 64;
    // let width = Math.floor((Math.random() * (1600 - 256) + 256) / 64) * 64;
    let height = 64
    let width = 64
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
    let image_names = req.body.image_names
    // let renderTasks = []
    let clusterData = []
    let normFormulas = []
    for (let i = 0; i < formulas.length; i++) {
      let formula = formulas[i];
      let image_name = image_names[i]
      // remove non-ascii
      formula = ParseFormula(formula);
      formula = formula.replace(/[^\x00-\x7F]/g, "");
      normFormulas.push(formula);
      let savePath = dir + '//' + image_name;
      let data = { "formula": formula, "savePath": savePath };
      clusterData.push(data)
      if ((i + 1) % (1000 / PROCESS_NUM) === 0) {
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
