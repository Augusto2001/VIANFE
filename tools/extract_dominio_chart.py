"""Extract the explicit Código/T/Classificação/Nome/Grau Domínio report.
Requires pdfplumber. Never opens the application DB. Rejects ambiguous rows.
Usage: python tools/extract_dominio_chart.py INPUT.pdf OUTPUT.csv
"""
import csv, hashlib, json, re, sys
from pathlib import Path
import pdfplumber

source, output = map(Path, sys.argv[1:3])
rows=[]; companies=set(); per_page=[]
with pdfplumber.open(source) as pdf:
    for number,page in enumerate(pdf.pages,1):
        text=page.extract_text() or ''
        assert 'PLANO DE CONTAS' in text and 'Classificação' in text, f'Unknown layout: page {number}'
        company=re.search(r'C\.N\.P\.J\.:\s*([\d./-]+)',text)
        assert company, f'Missing CNPJ on page {number}'
        companies.add(company[1]); count=0
        for line in text.splitlines():
            if not re.match(r'^\d+\s+\S',line): continue
            match=re.fullmatch(r'(?:1\s+)?(\d+)\s+(?:(S)\s+)?(\d+(?:\.\d+)*)\s+(.+?)\s+(\d+)',line)
            assert match, f'Unrecognized account row on page {number}'
            code,synthetic,classification,name,grade=match.groups()
            assert len(classification.split('.'))==int(grade), f'Grade mismatch on page {number}, code {code}'
            assert '\ufffd' not in name and len(name)>1, f'Unreadable name on page {number}'
            # Natureza is not printed in this report: do not infer it.
            rows.append([code,classification,name,'S' if synthetic else 'A',''])
            count+=1
        assert count, f'No accounts on page {number}'
        per_page.append(count)
assert len(companies)==1, 'Mixed companies'
assert len({r[0] for r in rows})==len(rows), 'Duplicate codes'
duplicates={r[1]:[x for x in rows if x[1]==r[1]] for r in rows if sum(x[1]==r[1] for x in rows)>1}
if duplicates and '--allow-source-duplicate-classifications' not in sys.argv:
    print(json.dumps({'duplicate_classifications_in_source':duplicates},ensure_ascii=True))
    raise ValueError('Review duplicate classifications in PDF before accepting extraction')
output.parent.mkdir(parents=True,exist_ok=True)
with output.open('w',encoding='utf-8-sig',newline='') as stream:
    writer=csv.writer(stream,delimiter=';')
    writer.writerow(['Código','Classificação','Nome','Tipo','Natureza'])
    writer.writerows(rows)
manifest={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'csv_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'cnpj':next(iter(companies)),'accounts':len(rows),'per_page':per_page,'natureza':'not in source; left empty','duplicate_classifications':duplicates}
output.with_suffix('.audit.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=True))
