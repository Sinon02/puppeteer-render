import requests
import os
import json
import re


class BracketParser(object):
    def __init__(self, open_brackets=['{'], close_brackets=['}']):
        self.open_brackets = open_brackets
        self.close_brackets = close_brackets
        self.brackets = open_brackets + close_brackets

        self.match_pairs = {'{': '}', '[': ']', '(': ')'}

    def check_match(self, open_bracket, close_bracket):
        if open_bracket not in self.match_pairs:
            return False
        return self.match_pairs[open_bracket] == close_bracket

    def check_brackets(self, seq, open_brackets=None, close_brackets=None):
        open_brackets = open_brackets if open_brackets else self.open_brackets
        close_brackets = close_brackets if close_brackets else self.close_brackets
        bracket_stack = []
        start_idx = -1
        for idx, token in enumerate(seq):
            if token in open_brackets:
                if idx == 0 or seq[idx - 1] != '\\':
                    bracket_stack.append(token)
                    if start_idx == -1:
                        start_idx = idx
                    continue
            if token in close_brackets:
                if len(bracket_stack) == 0:
                    return False, ''
                last_open_bracket = bracket_stack.pop()
                if self.check_match(last_open_bracket, token):
                    if len(bracket_stack) == 0:
                        return True, seq[start_idx:idx + 1]
                else:
                    return False, ''
        return False, ''

    def find_all_operators(self, operator, seq, inner=True):
        operator = operator.replace('\\', '\\\\')
        if inner:
            return [
                substr.start() - 1 for substr in re.finditer(operator, seq)
            ]
        else:
            return [substr.start() for substr in re.finditer(operator, seq)]

    def delete_tags(self, tag, seq, inner=False):
        all_occur = self.find_all_operators(tag, seq, inner=inner)
        all_occur = [0, *all_occur, len(seq)]
        copyed_seq = seq
        for idx in range(len(all_occur) - 1):
            res, subseq = self.check_brackets(
                seq[all_occur[idx]:all_occur[idx + 1]])
            if res:
                if inner and tag in subseq:
                    copyed_seq = copyed_seq.replace(subseq, '', 1)
                else:
                    copyed_seq = copyed_seq.replace(tag + subseq, '', 1)
        return copyed_seq

    def replace_inner_tags(self, old_tag, new_tag, seq):
        if isinstance(new_tag, str):
            new_tag = [new_tag]
        occurs = self.find_all_operators(old_tag, seq, inner=True)
        all_occur = [0]
        for occur in occurs:
            if occur not in all_occur:
                all_occur.append(occur)
        all_occur.append(len(seq))
        copyed_seq = []
        for idx in range(len(all_occur) - 1):
            if all_occur[idx] == -1:
                cur_seq = seq[:all_occur[idx + 1]]
                need_pad = True
            else:
                need_pad = False
                cur_seq = seq[all_occur[idx]:int(max(0, all_occur[idx + 1]))]

            res, subseq = self.check_brackets(cur_seq,
                                              open_brackets=['{', '('],
                                              close_brackets=['}', ')'])
            old_tag_exist = old_tag in cur_seq

            if need_pad:
                if res:
                    cur_seq = re.sub(
                        f'\\{subseq[0]}?' + old_tag.replace('\\', '\\\\') +
                        '\s*', '{' + '{'.join(new_tag).replace('\\', '\\\\'),
                        cur_seq)

                    edit_subseq = subseq + '}' * len(new_tag)
                    cur_seq = cur_seq.replace(subseq, edit_subseq)

            elif res and old_tag_exist:
                res, render_item = self.check_brackets(subseq[1:-1])
                edit_subseq = re.sub(
                    f'\\{subseq[0]}?' + old_tag.replace('\\', '\\\\') + '\s*',
                    f'{subseq[0]}' + '{'.join(new_tag).replace('\\', '\\\\') +
                    "{", subseq)

                if res:
                    striped_render_item = re.sub(r'^{', '', render_item)
                    if subseq[0] == '{':
                        striped_render_item = re.sub(r'}$', '',
                                                     striped_render_item)
                    edit_subseq = edit_subseq.replace(render_item,
                                                      striped_render_item)
                else:
                    if subseq[0] != '{':
                        edit_subseq = edit_subseq[:-1] + '}' + edit_subseq[-1]
                if subseq[0] == '{':
                    edit_subseq += '}' * len(new_tag)
                cur_seq = cur_seq.replace(subseq, edit_subseq)

            copyed_seq.append(cur_seq)
        return ''.join(copyed_seq)


def preprocess(bp, line):
    gt_line = line
    gt_line = gt_line.replace('\r', ' ').strip()
    # Remove \label first
    gt_line = bp.delete_tags(r'\label', gt_line)
    gt_line = bp.delete_tags(r'\label', gt_line, True)
    gt_line = gt_line.lstrip('%')
    gt_line = gt_line.split('%')[0]
    gt_line = gt_line.split(r'\label')[0]
    gt_line = re.sub(r'\$', r" ", gt_line)
    gt_line = re.sub(r'\\fbox', r"", gt_line)
    gt_line = re.sub(
        r'((\\hskip)|(\\mkern)|(\\kern)|(\\raise))[0-9\.\-\s]*(true)*\s*((cm)|(em)|(pt)|(ex)|(mm)|(in)|(mu))',
        '', gt_line)
    # gt_line = bp.replace_inner_tags(r'\rm\bf', [r'\mathrm', r'\textbf'], gt_line)
    # gt_line = bp.replace_inner_tags(r'\bf\rm', r'\mathrm', gt_line)
    gt_line = bp.replace_inner_tags(r'\rm', r'\mathrm', gt_line)
    # gt_line = bp.replace_inner_tags(r'\it', r'\textit', gt_line)
    # gt_line = bp.replace_inner_tags(r'\bf', r'\textbf', gt_line)
    # gt_line = re.sub(r'(hbox|mbox)', r'mathrm', gt_line)
    # gt_line = re.sub(r'\\~', r"", gt_line)
    gt_line = re.sub(r'(textup)', r'mathrm', gt_line)
    gt_line = gt_line.replace(r'\hspace*', r'\hspace')
    gt_line = gt_line.replace(r'\footnotesize', r'\scriptsize')
    gt_line = re.sub(r'\\relax', r"", gt_line)
    gt_line = re.sub(r'\\protect', r"", gt_line)
    gt_line = re.sub(r'\\smallskip', r"", gt_line)
    gt_line = re.sub(r'\\sp', r"^", gt_line)
    gt_line = re.sub(r'\\sb', r"_", gt_line)
    gt_line = re.sub(r'\\ddag(?!\w)', r'\\ddagger', gt_line)
    gt_line = re.sub(r'\\dag(?!\w)', r"\\dagger", gt_line)
    gt_line = re.sub(r'\\boldmath', r"\\mathbf", gt_line)
    gt_line = re.sub(
        r'(?<!\\)\\([A-Za-z\+\-\*\/])(?=\\|\s|_|\^|\(|\)|\{|\}|\+|\-|\/|\*|=|\||[0-9]|\,)',
        r' \g<1> ', gt_line)
    gt_line = re.sub(r'\\hline\s*\\hline', r'\\hline', gt_line)
    gt_line = re.sub(r'((?<!\\)\\\(|\\\))', r"", gt_line)
    gt_line = re.sub(r'(\\\[|\\\])', r"", gt_line)
    gt_line = re.sub(r'\\null', r"", gt_line)
    gt_line = re.sub(r'\\mathaccent', r"", gt_line)
    gt_line = re.sub(r'\\hfill', r"", gt_line)
    gt_line = re.sub(r'\\>', ' ', gt_line)

    render_line = gt_line
    render_line = re.sub(r'<', r'\\lt ', render_line)
    render_line = re.sub(r'>', r'\\gt ', render_line)
    render_line = render_line.replace(r'\slash', '/')

    gt_line = gt_line.strip()
    render_line = render_line.strip()
    return gt_line, render_line


if __name__ == "__main__":
    save_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'image_rendered')
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    input_file = './im2latex_formulas.lst'
    output_file = './im2latex_formulas.norm.lst'
    with open(input_file, encoding='ISO-8859-1', newline="\n") as fin:
        formulas = fin.readlines()
        print(len(formulas))
    formulas = [formula for formula in formulas if len(formula.strip()) > 0]
    headers = {'Content-Type': 'application/json'}
    bp = BracketParser()
    with open(output_file, 'w', encoding='utf-8') as f:
        for i in range(0, len(formulas), 1000):
            formulas_to_render = [
                preprocess(bp, formula)[1] for formula in formulas[i:i + 1000]
            ]
            data = {
                'formulas': formulas_to_render,
                'dir': save_dir,
                'prefix': i
            }
            resp = requests.post(url='http://localhost:8080/render',
                                 headers=headers,
                                 data=json.dumps(data))
            try:
                data = resp.json()
                print(data['msg'])
                f.write('\n'.join(data['formulas']) + '\n')
            except Exception:
                continue
