const express = require('express');
const { performance } = require('perf_hooks');
var ParseFormula = require('./preprocess_latex.js')
ParseFormula = ParseFormula.ParseFormula


const app = express();
app.use(express.json({limit:"10mb"}))


app.post('/check', async (req, res) => {
  // puppeteer.launch() => Chrome running locally (on the same hardware)
  let browser = null;
  var startTime = performance.now()

  try {
    let formulas = req.body.formulas
    let result = []
    for (let i = 0; i < formulas.length; i++) {
      let formula = formulas[i]
      formula = ParseFormula(formula);
      result.push(formula !== "");
    }
    var endTime = performance.now()
    res.json({ 'msg':`Check Successfully in ${(endTime - startTime) / 1000} seconds`, 'check_result': result})
  } catch (error) {
    if (!res.headersSent) {
      res.status(400).send(error.message);
    }
  }
});



app.listen(8088, () => console.log('Listening on PORT: 8088'));
