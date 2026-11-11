"""Bounded local C execution for the learner's own code. Not a security sandbox."""
from pathlib import Path
import os, subprocess, tempfile, time, shutil, ctypes, threading
from ctypes import wintypes as w
from contextlib import contextmanager

@contextmanager
def temporary_workspace():
    base=Path(tempfile.gettempdir()).resolve();folder=Path(tempfile.mkdtemp(prefix="cstudy-judge-")).resolve()
    if folder.parent!=base or not folder.name.startswith("cstudy-judge-"):raise ValueError("临时目录范围错误")
    try:yield str(folder)
    finally:
        for i in range(30):
            try:shutil.rmtree(folder);break
            except PermissionError:
                if i==29:raise
                time.sleep(.1)


GATE=threading.BoundedSemaphore(1)
class Job:
    def __init__(self,process,compile=False):
        self.handle=None
        if os.name!='nt':return
        k=ctypes.WinDLL('kernel32',use_last_error=True)
        class Basic(ctypes.Structure):
            _fields_=[('processTime',ctypes.c_int64),('jobTime',ctypes.c_int64),('flags',w.DWORD),('minWS',ctypes.c_size_t),('maxWS',ctypes.c_size_t),('processes',w.DWORD),('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
        class IO(ctypes.Structure):_fields_=[(x,ctypes.c_uint64) for x in ['readOps','writeOps','otherOps','readBytes','writeBytes','otherBytes']]
        class Info(ctypes.Structure):_fields_=[('basic',Basic),('io',IO),('processMemory',ctypes.c_size_t),('jobMemory',ctypes.c_size_t),('peakProcess',ctypes.c_size_t),('peakJob',ctypes.c_size_t)]
        k.CreateJobObjectW.argtypes=[ctypes.c_void_p,w.LPCWSTR];k.CreateJobObjectW.restype=w.HANDLE
        k.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD];k.SetInformationJobObject.restype=w.BOOL
        k.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];k.AssignProcessToJobObject.restype=w.BOOL
        k.CloseHandle.argtypes=[w.HANDLE];k.CloseHandle.restype=w.BOOL
        h=k.CreateJobObjectW(None,None)
        if not h:raise OSError('无法建立本机运行限制')
        info=Info();info.basic.flags=0x2000|0x8|0x100;info.basic.processes=8 if compile else 1;info.processMemory=(512 if compile else 256)*1024*1024
        if not k.SetInformationJobObject(h,9,ctypes.byref(info),ctypes.sizeof(info)) or not k.AssignProcessToJobObject(h,w.HANDLE(int(process._handle))):
            k.CloseHandle(h);raise OSError('无法应用运行限制，已停止程序')
        self.k=k;self.handle=h
    def close(self):
        if self.handle:self.k.CloseHandle(self.handle);self.handle=None

def execute(args,folder,env,stdin='',compile=False):
    folder=Path(folder);timeout=25 if compile else 2.5;limit=128*1024 if compile else 32*1024
    input_file=folder/'_stdin';input_file.write_bytes(stdin.encode('utf-8'))
    with input_file.open('rb') as src,(folder/'_stdout').open('wb') as out,(folder/'_stderr').open('wb') as err:
        p=subprocess.Popen(args,cwd=folder,env=env,stdin=src,stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),start_new_session=os.name!='nt')
        job=None;status='ok';start=time.monotonic()
        try:
            job=Job(p,compile)
            while p.poll() is None:
                if time.monotonic()-start>timeout:status='timeout';break
                if sum((folder/n).stat().st_size for n in ['_stdout','_stderr'])>limit:status='output_limit';break
                time.sleep(.025)
        finally:
            if job:job.close()
            if p.poll() is None:
                if os.name!='nt':
                    import signal
                    try:os.killpg(p.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                else:p.kill()
            p.wait(timeout=5)
    stdout=(folder/'_stdout').read_bytes()[:limit].decode('utf-8','replace');stderr=(folder/'_stderr').read_bytes()[:limit].decode('utf-8','replace')
    if status=='ok' and sum((folder/n).stat().st_size for n in ['_stdout','_stderr'])>limit:status='output_limit'
    return dict(status=status,returncode=p.returncode,stdout=stdout,stderr=stderr)

def normalized(s):return '\n'.join(line.rstrip() for line in s.replace('\r\n','\n').splitlines()).strip()
def judge(code,q,compiler):
    if not isinstance(code,str) or not code.strip() or len(code.encode('utf-8'))>100000:raise ValueError('请提交完整C代码，大小不超过100KB')
    if not compiler or not Path(compiler).is_file():raise ValueError('没有找到C编译器。请在环境设置中配置GCC；已有答案草稿会保留。')
    if not GATE.acquire(blocking=False):raise ValueError('本机已有一道题正在检查，请等它完成后再提交。')
    try:
        with temporary_workspace() as d:
            root=Path(d);build=root/'build';build.mkdir();source=build/'main.c';source.write_text(code,encoding='utf-8');exe=build/('answer.exe' if os.name=='nt' else 'answer')
            env=os.environ.copy();env['PATH']=str(Path(compiler).parent)+os.pathsep+env.get('PATH','')
            libraries=['-lws2_32'] if os.name=='nt' and q.get('judge_libraries')==['ws2_32'] else []
            result=execute([compiler,'-std=c11','-O0','-Wall','-Wextra','-Wpedantic',str(source),'-o',str(exe),'-lm']+libraries,build,env,compile=True)
            if result['status']!='ok' or result['returncode']!=0:return dict(passed=False,phase='compile',compile=result,tests=[])
            tests=[]
            for i,t in enumerate(q['judge_tests']):
                folder=root/str(i);folder.mkdir()
                for name,content in t.get('files',{}).items():
                    if Path(name).name!=name or name.startswith('_'):raise ValueError('测试文件配置无效')
                    (folder/name).write_bytes(content.encode('utf-8'))
                r=execute([str(exe)],folder,env,t.get('input',''));expected=t['output'];ok=r['status']=='ok' and r['returncode']==t.get('exit',0) and normalized(r['stdout'])==normalized(expected)
                tests.append(dict(index=i+1,passed=ok,input=t.get('input',''),expected=expected,actual=r['stdout'],status=r['status'],returncode=r['returncode'],diagnostic=r['stderr'],files=t.get('files',{})))
            return dict(passed=all(t['passed'] for t in tests),phase='run',compile=result,tests=tests)
    finally:GATE.release()
