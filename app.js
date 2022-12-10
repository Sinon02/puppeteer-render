const express = require('express');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');


const app = express();
app.use(express.json())

var browserWSEndpoint;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,   //有浏览器界面启动
    // slowMo: 100,       //放慢浏览器执行速度，方便测试观察
    args: [            //启动 Chrome 的参数，详见上文中的介绍
      '–no-sandbox',
      '--window-size=1280,960'
    ],
  });
  const page = await browser.pages().then(allPages => allPages[0]);
  await page.goto('file://C:/Users/Sinon/Desktop/puppeteer-render/page.html');
  // await page.close();
  // await browser.close();
  return browser.wsEndpoint();
})().then(value => {
  console.log(value)
  browserWSEndpoint = value
})

async function RenderFormula(page, formula, savePath) {
  try {
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
    browser = await puppeteer.connect({ browserWSEndpoint });
    const page = await browser.pages().then(allPages => allPages[0]);
    // await page.exposeFunction('takeScreenshot', (async () => {
    //   var math = await page.$("#math")
    //   await math.screenshot({ path: "./screenshot.png" });
    // }));

    for (let i = 0; i < formulas.length; i++) {
      let formula = formulas[i]
      let save_path = dir + '//' + (prefix + i).toString() + '.png'
      await RenderFormula(page, formula, save_path)
    }
    var endTime = performance.now()
    res.send(`Render Successfully in ${(endTime - startTime) / 1000} seconds`)
  } catch (error) {
    if (!res.headersSent) {
      res.status(400).send(error.message);
    }
  }
});



app.listen(8080, () => console.log('Listening on PORT: 8080'));
