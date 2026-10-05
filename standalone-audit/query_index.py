"""Private, rebuildable SQLite read index over the authoritative Audit JSON store."""
import json,sqlite3,sys,os,math
from pathlib import Path
os.umask(0o077)
args=json.load(sys.stdin);root=Path(args['dataDir']);source=root/'audit-entries.json'
db=sqlite3.connect(root/'audit-query.sqlite',timeout=30)
db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA busy_timeout=30000')
db.executescript('''
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS entries (project TEXT,company TEXT,year TEXT,id TEXT,department TEXT,status TEXT,priority TEXT,issue INTEGER,captured TEXT,search TEXT,evidence INTEGER,open_actions INTEGER,payload TEXT,PRIMARY KEY(project,id));
CREATE INDEX IF NOT EXISTS company_year_order ON entries(project,company,year,issue,captured DESC,id);
CREATE INDEX IF NOT EXISTS company_order ON entries(project,company,issue,captured DESC,id);
CREATE INDEX IF NOT EXISTS company_year_department ON entries(project,company,year,department,issue,captured DESC,id);
CREATE INDEX IF NOT EXISTS company_year_status ON entries(project,company,year,status,issue,captured DESC,id);
''')
def revision():
    s=source.stat();return f"v1:{s.st_ino}:{s.st_size}:{s.st_mtime_ns}:{args['fallbackCompany']}"
rev=revision();previous=db.execute("SELECT value FROM metadata WHERE key='revision'").fetchone()
if not previous or previous[0]!=rev:
    # Recheck after acquiring the rebuild lock; a parallel reader may already have rebuilt it.
    db.execute('BEGIN IMMEDIATE');previous=db.execute("SELECT value FROM metadata WHERE key='revision'").fetchone();rev=revision()
    if not previous or previous[0]!=rev:
        with source.open() as f:rows=json.load(f)
        db.execute('DELETE FROM entries')
        def indexed(e):
            r=e.get('sourceReport') or {};text=' '.join(str(e.get(k) or '') for k in ['finding','department','location','reference','impact','recommendation'])+' '+str(r.get('managementResponse') or '')
            return (e['projectId'],e.get('entity') or args['fallbackCompany'],str(e.get('auditYear') or '2025'),e['id'],e.get('department') or 'Unassigned',e.get('status') or 'Open',e.get('priority') or 'High',r.get('issue') or 10000,e.get('capturedAt') or '',text.lower(),int(bool(r or e.get('photoUrl') or e.get('photoDataUrl') or e.get('observationImages'))),sum(a.get('status')!='Closed' for a in e.get('actions',[])),json.dumps(e,separators=(',',':'),ensure_ascii=False))
        db.executemany('INSERT INTO entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',(indexed(e) for e in rows))
        db.execute("INSERT OR REPLACE INTO metadata VALUES ('revision',?)",(rev,))
    db.commit()
db.execute('BEGIN')
q=args['query'];base=[args['projectId'],args['company']];where='project=? AND company=?';params=base.copy()
for param,col in [('auditYear','year'),('department','department'),('status','status')]:
    if q.get(param):where+=' AND '+col+'=?';params.append(str(q[param]))
if q.get('q'):where+=' AND instr(search,?)>0';params.append(str(q['q']).lower())
def integer(key,default,maximum):
    try:return min(maximum,max(1,int(q.get(key,default))))
    except (TypeError,ValueError):return default
size=integer('pageSize',10,100);page=integer('page',1,2147483647)
summary=db.execute('SELECT count(*),coalesce(sum(priority IN (\'High\',\'Critical\')),0),coalesce(sum(evidence),0),coalesce(sum(open_actions),0) FROM entries WHERE '+where,params).fetchone();total=summary[0];page=min(page,max(1,math.ceil(total/size)))
departments=[[r[0],dict(zip(['total','high','medium','low','open'],r[1:]))] for r in db.execute("SELECT department,count(*),sum(priority IN ('High','Critical')),sum(priority='Medium'),sum(priority='Low'),sum(status!='Closed') FROM entries WHERE "+where+' GROUP BY department ORDER BY department',params)]
years=dict(db.execute('SELECT year,count(*) FROM entries WHERE project=? AND company=? GROUP BY year',base))
items=[json.loads(row[0]) for row in db.execute('SELECT payload FROM entries WHERE '+where+' ORDER BY issue,captured DESC,id LIMIT ? OFFSET ?',params+[size,(page-1)*size])]
result={'backend':'json','queryEngine':'sqlite','page':page,'pageSize':size,'total':total,'company':args['company'],'items':items,'yearCounts':years,'summary':{'total':total,'high':summary[1],'evidence':summary[2],'openActions':summary[3],'departments':departments}}
if args.get('explain'):result['queryPlan']=[list(r) for r in db.execute('EXPLAIN QUERY PLAN SELECT payload FROM entries WHERE '+where+' ORDER BY issue,captured DESC,id LIMIT ? OFFSET ?',params+[size,(page-1)*size])]
print(json.dumps(result,separators=(',',':'),ensure_ascii=False));db.close()
