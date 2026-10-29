"""C Study Local: local-only HTTP service and durable SQLite storage (stdlib only)."""
from __future__ import annotations
import argparse, datetime as dt, hashlib, io, json, mimetypes, os, re, secrets, shutil
import sqlite3, subprocess, sys, tempfile, threading, time, traceback, urllib.parse, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from contextlib import closing, contextmanager

APP=Path(__file__).resolve().parent
ROOT=APP.parent
COURSE=json.loads((APP/'course.json').read_text(encoding='utf-8'))
QUESTIONS={q['id']:q for l in COURSE['lessons'] for q in l['questions']}
QUESTIONS.update({q['id']:q for q in COURSE.get('extra_questions',[])})
LESSON_IDS={l['id'] for l in COURSE['lessons']}
TOKEN=secrets.token_urlsafe(32)
LOCK=threading.RLock()
BOOT_ID=uuid.uuid4().hex
UPDATE={'phase':'idle','clients':{}}

def now(): return dt.datetime.now().astimezone().isoformat(timespec='seconds')
def dumps(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def norm(v): return '\n'.join(x.rstrip() for x in str(v).replace('\r\n','\n').splitlines()).strip()
def schema(c):
    c.executescript('''PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,qid TEXT NOT NULL,answer TEXT NOT NULL,correct INTEGER,assisted INTEGER NOT NULL,mode TEXT NOT NULL,self_pass INTEGER,saved_at TEXT NOT NULL);
    INSERT OR IGNORE INTO meta VALUES('schema','1');''')
    c.commit()

class Store:
    def __init__(self,folder):
        self.folder=Path(folder); self.folder.mkdir(parents=True,exist_ok=True)
        self.db=self.folder/'learning.sqlite'; self.bdir=self.folder/'backups'; self.bdir.mkdir(exist_ok=True)
        self.settings_path=self.folder/'settings.json'
        self.settings={}; self.warning=''; self.secondary_warning=''; self.broken=False
        try: self.settings=json.loads(self.settings_path.read_text(encoding='utf-8'))
        except FileNotFoundError: pass
        except Exception: self.warning='备份位置设置损坏，请重新设置；学习数据未被改动。'
        try:
            with self.connect() as c:
                if c.execute('PRAGMA quick_check').fetchone()[0]!='ok': raise ValueError('数据库完整性检查失败')
                schema(c)
                if c.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0]!='1': raise ValueError('不支持的数据版本')
                previous=c.execute("SELECT value FROM meta WHERE key='content_version'").fetchone()
            if previous and previous[0]!=COURSE['version']: self.backup('before-upgrade')
            with self.connect() as c:
                c.execute("INSERT INTO meta VALUES('content_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(COURSE['version'],));c.commit()
            self.sync_secondary()
        except Exception as e:
            self.broken=True; self.warning='学习数据暂时无法读取。请在记录页从备份恢复，当前文件已保留。'+str(e)
    @contextmanager
    def connect(self):
        c=sqlite3.connect(self.db,timeout=20); c.row_factory=sqlite3.Row
        try:
            c.execute('PRAGMA synchronous=FULL')
            yield c
        finally: c.close()
    def state(self):
        with LOCK:
            if self.broken: return {'records':{},'attempts':[],'recovery':True}
            with self.connect() as c:
                return {'records':{r['key']:dict(value=json.loads(r['value']),updated=r['updated']) for r in c.execute('SELECT * FROM records')},'attempts':[dict(r,answer=json.loads(r['answer'])) for r in c.execute('SELECT * FROM attempts ORDER BY id')],'recovery':False}
    def ensure(self):
        if self.broken: raise ValueError('数据库处于恢复模式，请先从有效备份恢复。')
    def patch(self,key,patch):
        self.ensure()
        if not re.fullmatch(r'(profile|lesson:l\d{2}|draft:q\d{2}[abc]|paper:(paper[123]|diagnostic)|scope:\d{1,2}|checkin:\d{4}-\d{2}-\d{2})',key): raise ValueError('无效记录名称')
        if not isinstance(patch,dict) or len(dumps(patch))>200000: raise ValueError('记录格式或长度不正确')
        if key.startswith('checkin:'):
            dt.date.fromisoformat(key[8:])
            if set(patch)-{'message','message_updated'} or not isinstance(patch.get('message',''),str) or len(patch.get('message',''))>4000: raise ValueError('留言格式不正确')
        if key.startswith('lesson:') and key[7:] not in LESSON_IDS: raise ValueError('未知课程')
        with LOCK, self.connect() as c:
            row=c.execute('SELECT value FROM records WHERE key=?',(key,)).fetchone()
            value=json.loads(row[0]) if row else {}; value.update(patch)
            stamp=now()
            c.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated',(key,dumps(value),stamp)); c.commit()
        self.daily(); return {'value':value,'saved_at':stamp}
    def attempt(self,p):
        self.ensure(); qid=p.get('qid'); q=QUESTIONS.get(qid)
        if not q: raise ValueError('没有找到题目')
        event=p.get('event_id','')
        if not re.fullmatch(r'[a-zA-Z0-9-]{12,80}',event): raise ValueError('提交标识不正确')
        answer=p.get('answer','')
        if not isinstance(answer,str) or len(answer)>100000: raise ValueError('答案长度不正确')
        assisted=bool(p.get('assisted')); correct=None; self_pass=None
        if q['type']=='program': self_pass=int(bool(p.get('self_pass')))
        elif q['type']=='fill':
            a=re.sub(r'\s+','',answer); b=re.sub(r'\s+','',q['answer'])
            aliases={'q02b':['9.0','9.','(double)9','9.00']}
            correct=int(a in aliases.get(qid,[b]))
        else: correct=int(norm(answer)==norm(q['answer']))
        with LOCK, self.connect() as c:
            c.execute('INSERT OR IGNORE INTO attempts(event_id,qid,answer,correct,assisted,mode,self_pass,saved_at) VALUES(?,?,?,?,?,?,?,?)',(event,qid,dumps(answer),correct,int(assisted),str(p.get('mode','practice'))[:40],self_pass,now())); c.commit()
            r=dict(c.execute('SELECT * FROM attempts WHERE event_id=?',(event,)).fetchone()); r['answer']=json.loads(r['answer'])
        self.daily(); return r
    def backup(self,kind='manual'):
        self.ensure()
        with LOCK:
            name=f'daily-{dt.date.today().isoformat()}.sqlite' if kind=='daily' else f'{kind}-{dt.datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}.sqlite'
            dest=self.bdir/name
            if not dest.exists():
                temp=self.bdir/(name+'.tmp')
                try:
                    with self.connect() as src, closing(sqlite3.connect(temp)) as out: src.backup(out)
                    os.replace(temp,dest)
                finally:
                    if temp.exists(): temp.unlink()
            daily=sorted(self.bdir.glob('daily-*.sqlite'),reverse=True)
            for old in daily[30:]: old.unlink()
            self.warning=''; self.sync_secondary()
            return name
    def daily(self):
        try: self.backup('daily')
        except Exception as e: self.warning='主数据已保存，但自动备份失败：'+str(e)
    def sync_secondary(self):
        directory=self.settings.get('secondary','')
        if not directory: self.secondary_warning=''; return
        try:
            target=Path(directory)
            if not target.is_absolute() or not Path(target.anchor).exists(): raise OSError('备份磁盘未连接')
            target.mkdir(parents=True,exist_ok=True)
            for f in self.bdir.glob('*.sqlite'):
                other=target/f.name
                if not other.exists() or other.stat().st_size!=f.stat().st_size:
                    temp=target/(f.name+'.tmp'); shutil.copy2(f,temp); os.replace(temp,other)
            self.secondary_warning=''
        except Exception as e: self.secondary_warning='第二位置尚未更新：'+str(e)
    def set_secondary(self,directory):
        if directory:
            p=Path(directory).expanduser()
            if not p.is_absolute() or not Path(p.anchor).exists(): raise ValueError('请输入可用磁盘上的完整文件夹路径')
            if p.resolve()==self.bdir.resolve() or p.resolve()==self.folder.resolve(): raise ValueError('第二备份位置不能与主数据目录相同')
            if APP.resolve() in p.resolve().parents or p.resolve()==APP.resolve(): raise ValueError('请选择程序目录以外的位置')
            directory=str(p/'CStudy-backups') if p.name!='CStudy-backups' else str(p)
        self.settings['secondary']=directory
        temp=self.settings_path.with_suffix('.tmp'); temp.write_text(dumps(self.settings),encoding='utf-8'); os.replace(temp,self.settings_path)
        self.sync_secondary(); return self.meta()
    def list_backups(self):
        return [dict(name=f.name,size=f.stat().st_size,time=dt.datetime.fromtimestamp(f.stat().st_mtime).astimezone().isoformat(timespec='seconds')) for f in sorted(self.bdir.glob('*.sqlite'),key=lambda p:p.stat().st_mtime,reverse=True)]
    def meta(self):
        with LOCK:
            b=self.list_backups()
            return dict(data_path=str(self.db),backups=b,secondary=self.settings.get('secondary',''),warning=self.warning,secondary_warning=self.secondary_warning,free_bytes=shutil.disk_usage(self.folder).free,recovery=self.broken)
    def export(self):
        self.ensure(); s=self.state()
        return dict(format='cstudy-backup',schema=1,content_version=COURSE['version'],created_at=now(),records=s['records'],attempts=s['attempts'])
    def validate_export(self,p):
        if not isinstance(p,dict) or p.get('format')!='cstudy-backup' or p.get('schema')!=1: raise ValueError('不是受支持的C语言教材备份文件')
        records=p.get('records'); attempts=p.get('attempts')
        if not isinstance(records,dict) or not isinstance(attempts,list) or len(records)>5000 or len(attempts)>100000: raise ValueError('备份记录结构或数量不正确')
        for k,r in records.items():
            if not isinstance(k,str) or not re.fullmatch(r'(profile|lesson:l\d{2}|draft:q\d{2}[abc]|paper:(paper[123]|diagnostic)|scope:\d{1,2}|checkin:\d{4}-\d{2}-\d{2})',k) or not isinstance(r,dict) or not isinstance(r.get('value'),dict): raise ValueError('备份中的学习记录不正确')
        for k,r in records.items():
            if k.startswith('checkin:'):
                dt.date.fromisoformat(k[8:])
                v=r['value']
                if not isinstance(v.get('message',''),str) or len(v.get('message',''))>4000: raise ValueError('备份中的留言格式不正确')
                if v.get('signed_at') and v.get('date')!=k[8:]: raise ValueError('签到日期不匹配')
        seen=set()
        for r in attempts:
            if not isinstance(r,dict) or r.get('qid') not in QUESTIONS or not isinstance(r.get('answer'),str) or r.get('correct') not in (None,0,1) or r.get('self_pass') not in (None,0,1) or not re.fullmatch(r'[a-zA-Z0-9-]{12,80}',r.get('event_id','')): raise ValueError('备份中的答题记录不正确')
            if r['event_id'] in seen: raise ValueError('备份存在重复提交标识')
            seen.add(r['event_id'])
        return records,attempts
    def import_data(self,p):
        records,attempts=self.validate_export(p)
        with LOCK:
            fd,name=tempfile.mkstemp(prefix='restore-',suffix='.sqlite',dir=self.folder); os.close(fd); temp=Path(name)
            try:
                with closing(sqlite3.connect(temp)) as c:
                    schema(c)
                    for k,r in records.items(): c.execute('INSERT INTO records VALUES(?,?,?)',(k,dumps(r['value']),str(r.get('updated',now()))))
                    for r in attempts:
                        c.execute('INSERT INTO attempts(event_id,qid,answer,correct,assisted,mode,self_pass,saved_at) VALUES(?,?,?,?,?,?,?,?)',(r['event_id'],r['qid'],dumps(r['answer']),r['correct'],int(bool(r.get('assisted'))),str(r.get('mode','practice'))[:40],r.get('self_pass'),str(r.get('saved_at',now()))))
                    c.commit()
                    if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('恢复文件完整性检查失败')
                if self.broken:
                    if self.db.exists(): shutil.copy2(self.db,self.folder/f'learning-damaged-{dt.datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}.sqlite')
                else: self.backup('before-restore')
                os.replace(temp,self.db); self.broken=False; self.warning=''; self.backup('restored')
            finally:
                if temp.exists(): temp.unlink()
        return self.state()
    def restore_backup(self,name):
        if not isinstance(name,str) or not re.fullmatch(r'[a-zA-Z0-9_.-]+\.sqlite',name): raise ValueError('备份名称不正确')
        path=self.bdir/name
        if not path.is_file(): raise ValueError('该备份不存在')
        with LOCK, closing(sqlite3.connect(f'file:{path.as_posix()}?mode=ro',uri=True)) as c:
            c.row_factory=sqlite3.Row
            if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise ValueError('所选备份已损坏')
            if c.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0]!='1': raise ValueError('备份版本不受支持')
            p=dict(format='cstudy-backup',schema=1,records={r['key']:dict(value=json.loads(r['value']),updated=r['updated']) for r in c.execute('SELECT * FROM records')},attempts=[dict(r,answer=json.loads(r['answer'])) for r in c.execute('SELECT * FROM attempts ORDER BY id')])
        return self.import_data(p)

    def checkin(self):
        self.ensure(); date=dt.date.today().isoformat(); key='checkin:'+date
        with LOCK, self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT value FROM records WHERE key=?',(key,)).fetchone()
            value=json.loads(row[0]) if row else {}
            if not value.get('signed_at'):
                count=c.execute("SELECT count(*) FROM records WHERE key LIKE 'checkin:%' AND json_extract(value,'$.signed_at') != ''").fetchone()[0]+1
                cheers=['你给今天的学习留了一个位置。哪怕只想明白一个问题，也可以从这里接着走。','今天的收获已经收好。下次回来，不必从头找，你留下的思路还在这里。','愿意停下来记一笔，说明你在认真对待自己的学习。这一天，给自己一点肯定。','做题、读代码、改错误，都值得留下痕迹。今天这一格，属于你投入的注意力。','有些进步要过几天才看得见。今天记下的疑问，也可能是下一次想通的起点。','这份记录没有替你走路，但会记住你来过。今天学到的内容，可以慢慢消化。','今天这一笔已保存。带着一点新的理解离开，也是一种踏实的结束。']
                value.update(date=date,signed_at=now(),ordinal=count,cheer=cheers[(count-1)%len(cheers)],cheer_id=(count-1)%len(cheers))
                stamp=now();c.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated',(key,dumps(value),stamp));c.commit()
            else: c.rollback()
        self.daily();return {'key':key,'value':value,'saved_at':now()}

class Handler(BaseHTTPRequestHandler):
    server_version='CStudyLocal/1.0'
    def log_message(self,fmt,*args):
        print(f'{now()} {self.address_string()} {fmt%args}',flush=True)
    def reply(self,value,status=200):
        data=dumps(value).encode('utf-8'); self.send_response(status); self.headers_common(); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def headers_common(self):
        self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        self.send_header('Referrer-Policy','no-referrer')
    def valid_host(self): return self.headers.get('Host','') in [f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}']
    def do_GET(self):
        try:
            if not self.valid_host(): self.reply({'error':'仅允许本机访问'},403); return
            path=urllib.parse.urlsplit(self.path).path
            if path=='/api/health': self.reply(dict(app='cstudy-local',version=COURSE['version'],port=self.server.server_port)); return
            if path=='/api/bootstrap': self.reply(dict(token=TOKEN,state=STORE.state(),meta=STORE.meta(),environment=ENV,boot_id=BOOT_ID,local_date=dt.date.today().isoformat())); return
            if path=='/api/update-status':
                active=[dict(client_id=k,pending=v.get('pending',True),ready=v.get('ready',False)) for k,v in UPDATE['clients'].items() if time.monotonic()-v['seen']<12]
                self.reply(dict(phase=UPDATE['phase'],boot_id=BOOT_ID,clients=active));return
            if path=='/api/backups': self.reply(STORE.meta()); return
            if path=='/api/export':
                data=json.dumps(STORE.export(),ensure_ascii=False,indent=2).encode('utf-8')
                self.send_response(200); self.headers_common(); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Disposition',f'attachment; filename="CStudy-backup-{dt.date.today()}.json"'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data); return
            names={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/course.json':'course.json','/favicon.svg':'favicon.svg'}
            filename=names.get(path)
            if not filename: self.reply({'error':'页面不存在'},404); return
            file=APP/filename
            data=file.read_bytes(); content=mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            if file.suffix in ('.html','.js','.css','.json','.svg'): content+='; charset=utf-8'
            self.send_response(200); self.headers_common(); self.send_header('Content-Type',content); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
        except (ValueError,sqlite3.Error) as e: self.reply({'error':str(e)},400)
        except (ConnectionError,BrokenPipeError): pass
        except Exception as e: traceback.print_exc(); self.reply({'error':'读取失败：'+str(e)},500)
    def do_POST(self):
        try:
            if not self.valid_host(): self.reply({'error':'仅允许本机访问'},403); return
            origin=self.headers.get('Origin')
            if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}'): self.reply({'error':'拒绝外部网页写入'},403); return
            if not secrets.compare_digest(self.headers.get('X-Study-Token',''),TOKEN): self.reply({'error':'请刷新页面后重试'},403); return
            length=int(self.headers.get('Content-Length','0'))
            if length<0 or length>16*1024*1024: self.reply({'error':'请求过大'},413); return
            p=json.loads(self.rfile.read(length) or b'{}'); route=urllib.parse.urlsplit(self.path).path
            if route.startswith('/api/update/'):
                with LOCK:
                    if route=='/api/update/ping':
                        client=str(p.get('client_id',''))
                        if not re.fullmatch(r'[a-zA-Z0-9-]{12,80}',client):raise ValueError('客户端标识不正确')
                        UPDATE['clients'][client]={'seen':time.monotonic(),'pending':bool(p.get('pending')),'ready':bool(p.get('ready'))}
                        UPDATE['clients']={k:v for k,v in UPDATE['clients'].items() if time.monotonic()-v['seen']<30}
                    elif route=='/api/update/prepare':UPDATE['phase']='preparing'
                    elif route=='/api/update/cancel':UPDATE['phase']='idle'
                    elif route=='/api/update/freeze':
                        active=[v for v in UPDATE['clients'].values() if time.monotonic()-v['seen']<12]
                        if any(not v.get('ready') or v.get('pending') for v in active):raise ValueError('仍有页面正在保存，请稍后重试')
                        UPDATE['phase']='frozen'
                    else:raise ValueError('没有这个更新操作')
                self.reply(dict(ok=True,result=dict(phase=UPDATE['phase'],boot_id=BOOT_ID)));return
            if UPDATE['phase']=='frozen' and route not in ('/api/backup','/api/shutdown'):
                self.reply({'error':'教材正在安全更新，页面将在更新完成后自动恢复。'},503);return
            if route in ('/api/import','/api/restore') and STORE.broken and p.get('pending'):
                pending=p['pending']
                if not isinstance(pending,list): raise ValueError('临时草稿格式不正确')
                target=STORE.folder/f'unsaved-before-restore-{dt.datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}.json'
                target.write_text(json.dumps(pending,ensure_ascii=False,indent=2),encoding='utf-8')
            if route=='/api/record': value=STORE.patch(p.get('key',''),p.get('patch',{}))
            elif route=='/api/checkin':value=STORE.checkin()
            elif route=='/api/attempt': value=STORE.attempt(p)
            elif route=='/api/backup': value={'name':STORE.backup(), 'meta':STORE.meta()}
            elif route=='/api/secondary': value=STORE.set_secondary(str(p.get('path','')).strip())
            elif route=='/api/import': value={'state':STORE.import_data(p.get('data')), 'meta':STORE.meta()}
            elif route=='/api/restore': value={'state':STORE.restore_backup(p.get('name')), 'meta':STORE.meta()}
            elif route=='/api/shutdown':
                if not STORE.broken: STORE.backup('closing')
                self.reply({'ok':True}); threading.Thread(target=self.server.shutdown,daemon=True).start(); return
            else: self.reply({'error':'没有这个操作'},404); return
            self.reply(dict(ok=True,result=value,saved_at=now(),warning=STORE.warning,secondary_warning=STORE.secondary_warning))
        except (ValueError,KeyError,TypeError,sqlite3.Error) as e: self.reply({'error':str(e)},400)
        except (ConnectionError,BrokenPipeError): pass
        except Exception as e: traceback.print_exc(); self.reply({'error':'操作失败：'+str(e)},500)

def environment():
    gcc=shutil.which('gcc') or (r'D:\develop\mingw64\bin\gcc.exe' if Path(r'D:\develop\mingw64\bin\gcc.exe').exists() else '')
    code=shutil.which('code') or (r'D:\VSCode-win32-x64-1.129.1\Code.exe' if Path(r'D:\VSCode-win32-x64-1.129.1\Code.exe').exists() else '')
    version=''
    if gcc:
        try: version=subprocess.run([gcc,'--version'],capture_output=True,text=True,timeout=5,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)).stdout.splitlines()[0]
        except Exception: pass
    return {'compiler':gcc,'compiler_version':version,'vscode':code,'python':sys.version.split()[0]}

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8871); parser.add_argument('--data-dir',default=str(ROOT/'user-data')); parser.add_argument('--no-port-fallback',action='store_true'); parser.add_argument('--update-start',action='store_true'); args=parser.parse_args()
    if args.update_start: UPDATE['phase']='frozen'
    STORE=Store(args.data_dir); ENV=environment()
    server=None
    for port in [args.port] if args.no_port_fallback else range(args.port,args.port+10):
        try: server=ThreadingHTTPServer(('127.0.0.1',port),Handler); break
        except OSError: continue
    if not server: raise SystemExit('没有可用的本机端口')
    runtime=STORE.folder/'server.json'; runtime.write_text(dumps(dict(port=server.server_port,pid=os.getpid(),root=str(ROOT),started=now())),encoding='utf-8')
    print(f'Local: http://127.0.0.1:{server.server_port}',flush=True)
    maintenance_stop=threading.Event()
    def maintain():
        while not maintenance_stop.wait(30):
            with LOCK: STORE.sync_secondary()
    threading.Thread(target=maintain,daemon=True).start()
    try: server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt: pass
    finally:
        maintenance_stop.set()
        server.server_close()
        try:
            if json.loads(runtime.read_text(encoding='utf-8')).get('pid')==os.getpid(): runtime.unlink(missing_ok=True)
        except Exception: pass
