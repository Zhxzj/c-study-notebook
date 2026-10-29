# C · 学习手记 3.0.1

Windows 便携版：在 Releases 下载 C-Study-3.0.1-portable.zip，右键全部解压到可写目录，再双击“打开教材.cmd”。无需安装 Python 或 Node。首次打开会创建空白个人档案并打开浏览器。停止服务请双击“停止教材.cmd”。请勿直接在压缩包内运行。

程序未进行代码签名，Windows 可能显示安全提示；请核对下载来源和 SHA256。网页学习开箱即用，网站不能编译 C；实际编译所需的 VS Code 与编译器配置见课程。

个人数据保存在解压目录 user-data，备份也在该目录，可在网页设置第二位置备份。请定期将整个 user-data 复制到另一磁盘。不要将个人数据上传到 GitHub。

升级：先解压新版到另一目录，保留原目录。使用原目录 runtime/python.exe 运行 tools/safe_update.py --root "原目录" --source "新版目录/app"。此更新器执行保存握手、SQLite 快照、完整记录校验和失败回退。请勿直接覆盖运行中的 app。便携版没有系统卸载程序；停止服务后移除 app、tools、runtime 和启动脚本，保留 user-data 即保留记录。

源码内容版本为 3.0.1；发行修复了空白安装首次启动时创建数据目录的问题。随附 Python 运行时许可位于 runtime/LICENSE.txt。课程包括 32 课主线与两条共 24 课拓展路线。

本次发行暂为预发布便携版，正式安装 EXE 尚未提供。自动生成的 Source code 压缩包面向开发者，新手请下载 portable.zip。
