param([ValidateSet('Open','Stop')][string]$Mode='Open',[switch]$NoBrowser,[switch]$Quiet)
$ErrorActionPreference='Stop'
$studyRoot=Split-Path -Parent $PSScriptRoot
$studyData=Join-Path $studyRoot 'user-data'
New-Item -ItemType Directory -Force -Path $studyData | Out-Null
$studyStateFile=Join-Path $studyData 'server.json'
$studyPython=Join-Path $studyRoot 'runtime\pythonw.exe'
$studyShell=New-Object -ComObject WScript.Shell
function Read-StudyServer {
    if(Test-Path -LiteralPath $studyStateFile){
        try{
            $info=Get-Content -LiteralPath $studyStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if($info.root -ne $studyRoot){return $null}
            $health=Invoke-RestMethod -Uri ('http://127.0.0.1:'+ $info.port +'/api/health') -TimeoutSec 2
            if($health.app -eq 'cstudy-local'){return $info}
        }catch{}
    }
    return $null
}
$sha=[System.Security.Cryptography.SHA256]::Create()
$studyHash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($studyRoot))).Replace('-','').Substring(0,20)
$studyMutex=New-Object System.Threading.Mutex($false,('Local\CStudyLocal-'+$studyHash))
$studyLocked=$false
try{
    $studyLocked=$studyMutex.WaitOne(20000)
    if(-not $studyLocked){throw '另一个启动操作正在进行，请稍后再试。'}
    $studyInfo=Read-StudyServer
    if($Mode -eq 'Stop'){
        if($studyInfo){
            $studyBase='http://127.0.0.1:'+ $studyInfo.port
            $studyBootstrap=Invoke-RestMethod -Uri ($studyBase+'/api/bootstrap') -TimeoutSec 5
            $null=Invoke-RestMethod -Uri ($studyBase+'/api/shutdown') -Method Post -Headers @{'X-Study-Token'=$studyBootstrap.token} -ContentType 'application/json' -Body '{}' -TimeoutSec 20
            for($studyWait=0;$studyWait -lt 50;$studyWait++){
                if(-not (Test-Path -LiteralPath $studyStateFile)){break}
                Start-Sleep -Milliseconds 100
            }
            if(-not $Quiet){$null=$studyShell.Popup('教材已停止。已保存的学习记录仍保留在本机。',3,'C · 学习手记',64)}
        }elseif(-not $Quiet){$null=$studyShell.Popup('教材当前没有运行。',2,'C · 学习手记',64)}
        return
    }
    if(-not $studyInfo){
        if(-not (Test-Path -LiteralPath $studyPython)){throw '没有找到随附运行环境，请保留runtime文件夹。'}
        $studyServer=Join-Path $PSScriptRoot 'server.py'
        $null=Start-Process -FilePath $studyPython -ArgumentList @(('"'+$studyServer+'"')) -WorkingDirectory $studyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studyData 'server.log') -RedirectStandardError (Join-Path $studyData 'server-error.log') -PassThru
        for($studyAttempt=0;$studyAttempt -lt 40;$studyAttempt++){
            Start-Sleep -Milliseconds 300
            $studyInfo=Read-StudyServer
            if($studyInfo){break}
        }
        if(-not $studyInfo){throw '教材启动未成功。请检查user-data中的server-error.log，或重新打开。学习记录未被删除。'}
    }
    if(-not $NoBrowser){Start-Process -FilePath ('http://127.0.0.1:'+ $studyInfo.port +'/')}
}catch{
    if($Quiet){throw}
    $null=$studyShell.Popup($_.Exception.Message,0,'C · 学习手记',48)
}finally{
    if($studyLocked){$studyMutex.ReleaseMutex()}
    $studyMutex.Dispose()
}

