"""Local app-only updater. Snapshots and verifies user data; never replaces it."""
from pathlib import Path
import argparse,ast,datetime as dt,hashlib,json,os,shutil,sqlite3,subprocess,sys,time,urllib.request,urllib.error
def data_state(db):
    with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as con:
        if con.execute('pragma integrity_check').fetchone()[0]!='ok':raise RuntimeError('数据库完整性检查失败，停止更新')
        return {table:con.execute('select * from '+table+' order by 1').fetchall() for table in ['records','attempts']}
def digest(value):return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def request(base,path,payload=None,token=None,timeout=12):
    req=urllib.request.Request(base+path,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json',**({'X-Study-Token':token} if token else {})})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)
def confined(path,parent):
    p=path.resolve();q=parent.resolve()
    if p==q or q not in p.parents:raise RuntimeError('目标路径超出指定目录：'+str(p))
    return p
def start(root,port,frozen=False):
    python=root/'runtime/pythonw.exe'
    if not python.exists():raise RuntimeError('随附运行环境不存在')
    args=[str(python),str(root/'app/server.py'),'--port',str(port),'--no-port-fallback']
    if frozen:args.append('--update-start')
    with (root/'user-data/server.log').open('ab') as out,(root/'user-data/server-error.log').open('ab') as err:
        process=subprocess.Popen(args,cwd=root,stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    base=f'http://127.0.0.1:{port}'
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
        if process.poll() is not None:raise RuntimeError('新服务进程已退出，开始回退应用')
        try:
            b=request(base,'/api/bootstrap',timeout=.6)
            if b.get('token') and not b['meta'].get('recovery'):return b
        except Exception:pass
        time.sleep(.2)
    if process.poll() is None:process.terminate();process.wait(timeout=5)
    raise RuntimeError('新版本未能正常启动，请查看本机日志')
def stop(base,token):
    request(base,'/api/shutdown',{},token)
    deadline=time.monotonic()+8
    while time.monotonic()<deadline:
        try:request(base,'/api/health',timeout=.4)
        except Exception:return
        time.sleep(.1)
    raise RuntimeError('旧服务没有停止，未替换文件')
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',required=True);parser.add_argument('--root',default=str(Path(__file__).resolve().parents[1]));parser.add_argument('--allow-legacy',action='store_true',help='仅第一次从无更新握手协议的旧版升级时使用');parser.add_argument('--drain-timeout',type=float,default=45);args=parser.parse_args()
    root=Path(args.root).resolve();source=Path(args.source).resolve();app=confined(root/'app',root);data=confined(root/'user-data',root);db=data/'learning.sqlite'
    if source==app or app in source.parents:raise RuntimeError('更新源必须是独立的 app 文件夹')
    required=['index.html','app.js','style.css','server.py','course.json','data-contract.json']
    if not source.is_dir() or any(not (source/x).is_file() for x in required):raise RuntimeError('更新包不完整')
    for f in source.rglob('*'):
        if f.is_symlink() or f.name=='user-data' or f.suffix in ('.sqlite','.sqlite3','.db'):raise RuntimeError('更新包不能包含个人数据库或符号链接')
    new=json.loads((source/'course.json').read_text(encoding='utf-8'));old=json.loads((app/'course.json').read_text(encoding='utf-8'));contract=json.loads((source/'data-contract.json').read_text(encoding='utf-8'))
    if contract.get('schema')!=1:raise RuntimeError('数据结构变更需要单独迁移；本更新器不会重建数据库')
    lids=lambda c:{l['id'] for l in c['lessons']}
    qids=lambda c:{q['id'] for l in c['lessons'] for q in l['questions']}|{q['id'] for q in c.get('extra_questions',[])}|set(c.get('data_contract',{}).get('stable_question_ids',[]))
    if not lids(old)<=lids(new) or not qids(old)<=qids(new):raise RuntimeError('更新包删除或重命名了已有课程／题目编号，拒绝更新')
    existing=data_state(db);types={r[0].split(':')[0] for r in existing['records']}
    if not types<=set(contract.get('record_types',[])):raise RuntimeError('更新包不支持已经保存的记录类型')
    ast.parse((source/'server.py').read_text(encoding='utf-8'))
    state=json.loads((data/'server.json').read_text(encoding='utf-8'))
    if Path(state['root']).resolve()!=root:raise RuntimeError('运行服务不属于指定教材目录')
    port=int(state['port']);base=f'http://127.0.0.1:{port}';b=request(base,'/api/bootstrap');token=b['token']
    if b['meta'].get('recovery'):raise RuntimeError('数据处于恢复模式，先恢复数据再更新')
    lock=root/'update.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.close(fd)
    archive=None;swapped=False;stopped=False;legacy=False
    try:
        try:request(base,'/api/update/prepare',{},token)
        except urllib.error.HTTPError as error:
            if error.code!=404 or not args.allow_legacy:raise RuntimeError('旧版没有安全更新协议；首次升级需显式 --allow-legacy，并先确认打开页面的内容已保存') from error
            legacy=True
        if not legacy:
            beginning=time.monotonic()
            while True:
                progress=request(base,'/api/update-status')
                if time.monotonic()-beginning>=4 and all(x['ready'] and not x['pending'] for x in progress['clients']):break
                if time.monotonic()-beginning>args.drain_timeout:raise RuntimeError('仍有页面未完成保存，本次更新已取消')
                time.sleep(.25)
            request(base,'/api/update/freeze',{},token)
        stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f');archive=confined(root/'updates'/stamp,root);archive.mkdir(parents=True)
        candidate=confined(archive/'candidate',archive);shutil.copytree(source,candidate,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
        # Stop writers before taking the exact pre-update snapshot.
        stop(base,token);stopped=True
        before=data_state(db)
        with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as con,sqlite3.connect(archive/'learning-before.sqlite') as backup:con.backup(backup)
        previous=confined(archive/'previous-app',archive);os.replace(app,previous);os.replace(candidate,app);swapped=True
        boot=start(root,port,frozen=True)
        after=data_state(db)
        if digest(before)!=digest(after):raise RuntimeError('个人记录校验不一致，拒绝完成更新')
        request(base,'/api/update/cancel',{},boot['token'])
        request(base,'/api/backup',{},boot['token'])
        report=dict(ok=True,version=new['version'],records=len(after['records']),attempts=len(after['attempts']),data_digest=digest(after),snapshot=str(archive/'learning-before.sqlite'),previous_app=str(previous),updated_at=dt.datetime.now().astimezone().isoformat())
        (archive/'update-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        # Keep pre-policy snapshots; rotate only subsequent successful updates.
        policy_path=root/'updates-retention-v4.json'
        try:policy=json.loads(policy_path.read_text(encoding='utf-8'))
        except FileNotFoundError:policy={'protected':[f.name for f in (root/'updates').iterdir() if f.is_dir() and f!=archive],'managed':[]}
        if archive.name not in policy['managed']:policy['managed'].append(archive.name)
        for name in policy['managed'][:-3]:
            target=confined(root/'updates'/name,root/'updates')
            if name not in policy['protected'] and target.is_dir() and not any(f.is_symlink() for f in target.rglob('*')):
                shutil.rmtree(target)
        policy['managed']=policy['managed'][-3:]
        policy_path.write_text(json.dumps(policy,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False))
    except Exception:
        if swapped:
            try:
                current=request(base,'/api/bootstrap');stop(base,current['token'])
            except Exception:pass
            failed=confined(archive/'failed-app',archive)
            if app.exists():os.replace(app,failed)
            os.replace(confined(archive/'previous-app',archive),app)
            start(root,port)
            # Keep the current database and snapshot. Never overwrite new user data with an older copy.
        elif stopped:start(root,port)
        elif not legacy:
            try:request(base,'/api/update/cancel',{},token)
            except Exception:pass
        raise
    finally:
        lock.unlink(missing_ok=True)
if __name__=='__main__':main()
