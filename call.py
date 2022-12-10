import requests
import os
import json

save_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'image_rendered')
if not os.path.exists(save_dir):
    os.makedirs(save_dir)

input_file = './im2latex_formulas.lst'
with open(input_file, encoding='ISO-8859-1', newline="\n") as fin:
    formulas = fin.readlines()
formulas = [formula for formula in formulas if len(formula.strip()) > 0]
headers = {'Content-Type': 'application/json'}

for i in range(0, len(formulas), 32):
    data = {'formulas': formulas[i:i + 32], 'dir': save_dir, 'prefix': i}
    resp = requests.post(
        url='http://localhost:8080/render',
        headers=headers,
        data=json.dumps(data))
    print(resp.status_code)
    print(resp.text)