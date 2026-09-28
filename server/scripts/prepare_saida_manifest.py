"""Read-only local fiscal inventory. Scope JSON contains [{cnpj, root}].
Produces private NDJSON XML payloads and a full audit outside the repository.
No synthetic invoices, no network requests, no edits to source documents.
"""
import concurrent.futures, hashlib, json, pathlib, re, subprocess, sys, zipfile
import xml.etree.ElementTree as ET

scope = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
MAX = 10 * 1024 * 1024
def inspect(company, source, raw):
    row = {'companyCnpj': company, 'source': source}
    try:
        if len(raw) > MAX: raise ValueError('XML maior que 10 MB')
        root = ET.fromstring(raw)
        for node in root.iter(): node.tag = node.tag.split('}')[-1]
        inf = next(root.iter('infNFe'), None)
        if inf is None:
            events = [e for e in root.iter('infEvento') if e.findtext('tpEvento') == '110111']
            if events:
                row.update(status='cancellation_event', keys=[e.findtext('chNFe') for e in events])
            else: row.update(status='other_layout', root=root.tag)
            return row
        row.update(key=inf.attrib.get('Id','').removeprefix('NFe'), number=inf.findtext('ide/nNF'),
                   issuer=inf.findtext('emit/CNPJ'), date=inf.findtext('ide/dhEmi') or inf.findtext('ide/dEmi'))
        if row['issuer'] != company: row['status'] = 'other_issuer'; return row
        if inf.findtext('ide/tpNF') != '1': row['status']='own_entry'; return row
        if not (row['date'] or '').startswith('2026-'): row['status']='other_year'; return row
        protocol = next(root.iter('infProt'), None)
        if protocol is None or protocol.findtext('cStat') != '100' or not protocol.findtext('nProt'):
            row['status']='authorization_unavailable'; return row
        if protocol.findtext('chNFe') != row['key'] or not re.fullmatch(r'\d{44}',row['key']) or not list(inf.iter('det')):
            raise ValueError('Chave/protocolo/itens inconsistentes')
        # Preserve source text rather than rebuilding an XML from parsed fields.
        encoding = re.search(br'encoding=["\x27]([^"\x27]+)', raw[:150])
        xml = raw.decode(encoding.group(1).decode() if encoding else 'utf-8-sig')
        row.update(status='candidate', xml=xml, sha256=hashlib.sha256(raw).hexdigest())
    except Exception as e: row.update(status='error', error=str(e))
    return row

def read_source(item):
    company, name = item; p = pathlib.Path(name)
    try:
        if p.suffix.lower()=='.zip':
            rows=[]
            with zipfile.ZipFile(p) as z:
                entries=[e for e in z.infolist() if not e.is_dir() and e.filename.lower().endswith('.xml')]
                if len(entries)>10000 or sum(e.file_size for e in entries)>200*1024*1024: raise ValueError('ZIP excede limites')
                for e in entries:
                    if e.file_size>MAX: rows.append({'companyCnpj':company,'source':name+'!'+e.filename,'status':'error','error':'XML maior que 10 MB'})
                    else: rows.append(inspect(company,name+'!'+e.filename,z.read(e)))
            return rows
        with p.open('rb') as f: return [inspect(company,name,f.read(MAX+1))]
    except Exception as e: return [{'companyCnpj':company,'source':name,'status':'error','error':str(e)}]

cache=out/'read-cache'; cache.mkdir(exist_ok=True)
def read_file(item):
    company,name=item
    stat=pathlib.Path(name).stat()
    key=hashlib.sha256((company+name+str(stat.st_size)+str(stat.st_mtime_ns)).encode()).hexdigest()
    file=cache/(key+'.json')
    if file.exists(): return json.loads(file.read_text(encoding='utf-8'))
    rows=read_source(item)
    if not any(row['status']=='error' for row in rows): file.write_text(json.dumps(rows),encoding='utf-8')
    return rows

items=[]
for c in scope:
    root=pathlib.Path(c['root'])
    for area in ['NF','NFe']:
        base=root/'SETOR FISCAL'/area/'2026'
        if not base.exists(): continue
        scan=subprocess.run(['rg','--files',str(base)],capture_output=True,text=True,encoding='utf-8')
        if scan.returncode not in (0,1): raise RuntimeError(scan.stderr)
        # Include mixed folders so emitted notes with non-standard names are not missed.
        for name in scan.stdout.splitlines():
            if pathlib.Path(name).suffix.lower() in ('.xml','.zip'): items.append((c['cnpj'],name))
    print(json.dumps({'company':c['cnpj'],'files':sum(1 for x in items if x[0]==c['cnpj'])}),flush=True)
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
    futures=[pool.submit(read_file,item) for item in items]
    for i,f in enumerate(concurrent.futures.as_completed(futures),1):
        rows.extend(f.result())
        if i%100==0: print(json.dumps({'read':i,'total':len(items)}),flush=True)
cancelled={key for row in rows if row['status']=='cancellation_event' for key in row['keys'] if key}
groups={}
for row in rows:
    if row['status']=='candidate': groups.setdefault(row['key'],[]).append(row)
manifest=[]
for key, group in groups.items():
    if key in cancelled:
        for row in group: row['status']='cancelled_review'
    elif len({r['xml'] for r in group})>1:
        for row in group: row['status']='conflicting_copies'
    else:
        manifest.append(group[0]); group[0]['status']='ready'
        for row in group[1:]: row['status']='duplicate'
with (out/'manifest.ndjson').open('w',encoding='utf-8',newline='\n') as f:
    for row in manifest: f.write(json.dumps({k:row[k] for k in ['companyCnpj','source','xml']},ensure_ascii=False)+'\n')
counts={}
with (out/'audit.ndjson').open('w',encoding='utf-8',newline='\n') as f:
    for row in rows:
        row.pop('xml',None); f.write(json.dumps(row,ensure_ascii=False)+'\n')
        k=row['companyCnpj']+':'+row['status']; counts[k]=counts.get(k,0)+1
(out/'summary.json').write_text(json.dumps(counts,indent=2),encoding='utf-8')
print(json.dumps({'complete':True,'counts':counts}),flush=True)
