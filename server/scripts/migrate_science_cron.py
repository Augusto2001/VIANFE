"""One-time Oracle migration. Backup SQLite and root crontab; retire only legacy science."""
import datetime
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys

if sys.argv[1:] != ['--apply'] or os.geteuid() != 0:
    raise SystemExit('Use sudo python3 server/scripts/migrate_science_cron.py --apply')
root = pathlib.Path('/home/opc/vianfe')
legacy = '/app/server/storage/auto_ciencia_standalone.mjs'
cron = subprocess.check_output(['crontab', '-l'], text=True)
lines = cron.splitlines(keepends=True)
matches = [line for line in lines if not line.lstrip().startswith('#') and legacy in line]
if len(matches) != 1:
    raise SystemExit('Expected exactly one legacy cron entry; no changes made')
processes = subprocess.check_output(['docker', 'top', 'vianfe-api', '-eo', 'pid,args'], text=True)
if 'auto_ciencia_standalone.mjs' in processes:
    raise SystemExit('Legacy science is running; no changes made')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = pathlib.Path('/home/opc/vianfe-recovery-only') / ('science-migration-' + stamp)
backup.mkdir(mode=0o700, parents=True, exist_ok=False)
(backup / 'root.crontab').write_text(cron)
shutil.copy2(root / 'server/storage/auto_ciencia_standalone.mjs', backup / 'auto_ciencia_standalone.mjs')
source = sqlite3.connect('file:' + str(root / 'server/storage/data/fiscal_hub.db') + '?mode=ro', uri=True)
target = sqlite3.connect(str(backup / 'fiscal_hub.db'))
source.backup(target)
assert target.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
target.close()
source.close()
updated = ''.join(line for line in lines if line not in matches)
subprocess.run(['crontab', '-'], input=updated, text=True, check=True)
assert subprocess.check_output(['crontab', '-l'], text=True) == updated
receipt = {'backup': str(backup), 'removed_entries': len(matches), 'database_check': 'ok'}
(backup / 'receipt.json').write_text(json.dumps(receipt))
print(json.dumps(receipt))
