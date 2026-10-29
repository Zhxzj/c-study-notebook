Option Explicit
Dim shell, fso, mode, script, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
mode = "Open"
If WScript.Arguments.Count > 0 Then mode = WScript.Arguments(0)
If mode <> "Open" And mode <> "Stop" Then WScript.Quit 1
script = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "launcher.ps1")
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File """ & script & """ -Mode " & mode
shell.Run command, 0, False
