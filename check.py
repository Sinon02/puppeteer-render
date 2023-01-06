import PIL
from PIL import Image
import numpy as np
import math
from glob import glob
import os


def crop_image(img, output_file):
    old_im = Image.open(img)
    img_data = np.asarray(old_im)  # height, width
    nnz_inds = np.where(img_data != 255)
    if len(nnz_inds[0]) == 0:
        with open(output_file, 'a', encoding='utf-8') as f:
            f.write(os.path.basename(img) + '\n')
        return True
    return False


output_file = './parsing_error.txt'
image_paths = glob(
    r'C:\Users\Sinon\Desktop\image_rendered\image_rendered\*.png')
counter = 0
if os.path.exists(output_file):
    os.remove(output_file)

for image_path in image_paths:
    res = crop_image(image_path, output_file)
    counter += res * 1
print(counter)
