#define ProductVersion "4.3.0"
#define PayloadPath SourcePath + "distribution"
[Setup]
AppId={{D1CD90A5-4D25-4816-9E25-50B2A8E5C430}
AppName=C学习手记
AppVersion={#ProductVersion}
AppPublisher=Zhxzj
AppPublisherURL=https://github.com/Zhxzj/c-study-notebook
AppSupportURL=https://github.com/Zhxzj/c-study-notebook/issues
AppUpdatesURL=https://github.com/Zhxzj/c-study-notebook/releases
DefaultDirName={localappdata}\Programs\CStudyNotebook
DefaultGroupName=C学习手记
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableProgramGroupPage=yes
CloseApplications=no
RestartApplications=no
Compression=lzma2/normal
SolidCompression=yes
OutputDir=outputs
OutputBaseFilename=C-Study-4.3.0-Windows-x64-Setup
WizardStyle=modern
UninstallDisplayName=C学习手记 {#ProductVersion}
UninstallDisplayIcon={app}\app\cstudy-glass-v3.ico
SetupLogging=yes
[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
[Tasks]
Name: "desktopicon"; Description: "在桌面创建快捷方式"; GroupDescription: "打开方式："; Flags: checkedonce
[Files]
Source: "{#PayloadPath}\*"; DestDir: "{tmp}\CStudyPayload"; Flags: recursesubdirs createallsubdirs deleteafterinstall ignoreversion
[Icons]
Name: "{group}\C学习手记"; Filename: "{app}\app\launch.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\app\cstudy-glass-v3.ico"
Name: "{autodesktop}\C学习手记"; Filename: "{app}\app\launch.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\app\cstudy-glass-v3.ico"; Tasks: desktopicon
[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\app\launch.vbs"""; Description: "打开C学习手记"; Flags: postinstall nowait skipifsilent
[UninstallDelete]
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\compiler"
Type: filesandordirs; Name: "{app}\formatter"
Type: filesandordirs; Name: "{app}\tools"
Type: filesandordirs; Name: "{app}\licenses"
Type: files; Name: "{app}\打开教材.cmd"
Type: files; Name: "{app}\停止教材.cmd"
Type: files; Name: "{app}\使用说明.txt"
Type: files; Name: "{app}\THIRD_PARTY.md"
Type: files; Name: "{app}\SOURCE_ACCESS.md"
Type: files; Name: "{app}\installation-result.json"
[Code]
function NextButtonClick(CurPageID: Integer): Boolean;
var Dir: String; I: Integer;
begin
  Result := True;
  if CurPageID = wpSelectDir then begin
    Dir := WizardDirValue;
    for I := 1 to Length(Dir) do
      if Ord(Dir[I]) > 127 then begin
        MsgBox('请选用不含中文或其他非 ASCII 字符的安装路径，例如 D:\CStudyNotebook。', mbError, MB_OK);
        Result := False;
        Exit;
      end;
  end;
end;
procedure CurStepChanged(CurStep: TSetupStep);
var ResultCode: Integer;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{tmp}\CStudyPayload\runtime\python.exe'),
      '-X utf8 "' + ExpandConstant('{tmp}\CStudyPayload\tools\install_manager.py') + '" --payload "' + ExpandConstant('{tmp}\CStudyPayload') + '" --root "' + ExpandConstant('{app}') + '"',
      ExpandConstant('{tmp}\CStudyPayload'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      RaiseException('无法启动随附安装工具。');
    if ResultCode <> 0 then
      RaiseException('安装未完成，学习数据保留。请查看安装日志，不要删除原user-data目录。');
  end;
end;
function InitializeUninstall(): Boolean;
var ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{app}\runtime\python.exe'),
    '-X utf8 "' + ExpandConstant('{app}\tools\install_manager.py') + '" --uninstall --root "' + ExpandConstant('{app}') + '"',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := Result and (ResultCode = 0);
  if not Result then MsgBox('页面可能还有未保存内容，已取消卸载。请先保存后重试。个人数据未删除。', mbError, MB_OK);
end;


