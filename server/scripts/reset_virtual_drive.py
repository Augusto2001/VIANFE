"""Mark only proven virtual Drive IDs pending; preserve IDs and fiscal documents."""
import sqlite3,datetime,pathlib,sys,json
root=pathlib.Path('/home/opc/vianfe/server/storage/data')
c=sqlite3.connect(root/'fiscal_hub.db',timeout=30)
where="gdrive_file_id LIKE 'gdrive_sync_%' AND gdrive_synced != 0"
n=c.execute('SELECT count(*) FROM invoices WHERE '+where).fetchone()[0]
if '--apply' not in sys.argv:
 print(json.dumps({'would_mark_pending':n}));sys.exit(0)
p=root/('before_virtual_drive_reset_'+datetime.datetime.now().strftime('%Y%m%d%H%M%S')+'.sqlite')
b=sqlite3.connect(p);c.backup(b);b.close();p.chmod(0o600)
with c:
 cur=c.execute('UPDATE invoices SET gdrive_synced=0 WHERE '+where)
print(json.dumps({'marked_pending':cur.rowcount,'backup':str(p),'ids_and_documents_preserved':True}))
