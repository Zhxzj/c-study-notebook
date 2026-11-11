"""Installer helper. Application-only upgrades; never copies a user database."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,sqlite3,subprocess,sys,time,urllib.request

def request(base,path,payload=None,token=None):
    req=urllib.request.Request(base+path,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json',**({'X-Study-Token':token} if token else {})})
    with urllib.request.urlopen(req,timeout=10) as r:return json.load(r)

def active(root):
    try:
        info=json.loads((root/'user-data/server.json').read_text(encoding='utf-8'))
        if Path(info['root']).resolve()!=root:return None
        base='http://127.0.0.1:'+str(int(info['port']))
        health=request(base,'/api/bootstrap')
        return base if Path(health['meta']['data_path']).resolve()==(root/'user-data/learning.sqlite').resolve() else None
    except Exception:return None

def fingerprint(root):
    db=root/'user-data/learning.sqlite'
    if not db.exists():return None
    with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as c:
        if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('现有学习数据库未通过完整性检查，停止安装；原文件保留。')
        rows={name:c.execute('SELECT * FROM '+name+' ORDER BY 1').fetchall() for name in ('records','attempts')}
    return hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True).encode()).hexdigest()

def copy_files(src,dst):
    for f in src.rglob('*'):
        if not f.is_file():continue
        rel=f.relative_to(src)
        if f.is_symlink() or any(part in ('user-data','updates','.git','__pycache__') for part in rel.parts) or f.suffix in ('.sqlite','.db','.log','.pyc'):raise RuntimeError('发行源中出现不允许的文件')
        target=dst/rel
        if dst.resolve() not in target.resolve().parents:raise RuntimeError('安装路径超出指定目录')
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.is_file() and hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(f.read_bytes()).digest():continue
        temp=target.with_name(target.name+'.installing')
        shutil.copy2(f,temp);os.replace(temp,target)

def stop_for_uninstall(root):
    base=active(root)
    if not base:return
    token=request(base,'/api/bootstrap')['token']
    request(base,'/api/update/prepare',{},token)
    try:
        beginning=time.monotonic()
        while True:
            status=request(base,'/api/update-status')
            if time.monotonic()-beginning>=4 and all(x['ready'] and not x['pending'] for x in status['clients']):break
            if time.monotonic()-beginning>45:raise RuntimeError('仍有页面未保存，已取消卸载。请保存后重试。')
            time.sleep(.25)
        request(base,'/api/update/freeze',{},token)
        request(base,'/api/shutdown',{},token)
        for _ in range(80):
            if not active(root):return
            time.sleep(.1)
        raise RuntimeError('服务未能停止，已取消卸载。')
    except Exception:
        try:request(base,'/api/update/cancel',{},token)
        except Exception:pass
        raise

def install(payload,root):
    if payload==root or payload in root.parents or root in payload.parents:raise RuntimeError('安装源与目标目录必须彼此独立')
    root.mkdir(parents=True,exist_ok=True)
    before=fingerprint(root)
    existing=(root/'app/course.json').exists() and before is not None
    # Identical existing runtimes are not rewritten while the old server is running.
    for name in ('runtime','compiler','formatter','licenses'):
        copy_files(payload/name,root/name)
    if existing:
        if not active(root):
            r=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'app/launcher.ps1'),'-NoBrowser','-Quiet'],capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),timeout=40)
            if r.returncode:raise RuntimeError('旧版未能启动，已停止升级。学习数据保留，请先检查旧版启动情况。')
        # Use the existing updater until it has completed its own protected swap.
        r=subprocess.run([sys.executable,'-X','utf8',str(root/'tools/safe_update.py'),'--root',str(root),'--source',str(payload/'app')],capture_output=True,encoding='utf-8',creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),timeout=120)
        if r.returncode:raise RuntimeError('安全更新未完成，原数据保留。'+r.stderr[-800:])
        result=json.loads(r.stdout.strip().splitlines()[-1])
        if not result.get('ok'):raise RuntimeError('安全更新校验未通过')
    else:
        copy_files(payload/'app',root/'app')
        result={'ok':True,'fresh':before is None}
    copy_files(payload/'tools',root/'tools')
    for name in ('打开教材.cmd','停止教材.cmd','使用说明.txt','THIRD_PARTY.md','SOURCE_ACCESS.md'):
        if (payload/name).exists():shutil.copy2(payload/name,root/name)
    after=fingerprint(root)
    if before is not None and before!=after:raise RuntimeError('学习记录指纹不一致，请保留当前目录并查看更新快照。')
    result.update(data_preserved=before==after,data_digest=after,version=json.loads((root/'app/course.json').read_text(encoding='utf-8'))['version'])
    (root/'installation-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'ok':True,'version':result['version'],'data_preserved':result['data_preserved']},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--payload');p.add_argument('--uninstall',action='store_true');a=p.parse_args()
    try:
        root=Path(a.root).resolve()
        if a.uninstall:stop_for_uninstall(root)
        else:install(Path(a.payload).resolve(),root)
    except Exception as e:
        print(str(e),file=sys.stderr)
        try:
            if root.is_dir():(root/'install-error.txt').write_text(str(e),encoding='utf-8')
        except Exception:pass
        raise SystemExit(1)

