# C 学习手记 4.3.0

Windows 10/11 64 位用户可双击安装包，安装后从桌面快捷方式打开。安装包自带 Python、GCC 和代码整理工具。便携版解压后双击“打开教材.cmd”。[下载发行版](https://github.com/Zhxzj/c-study-notebook/releases/tag/v4.3.0)

升级时选择原安装目录。学习数据保存在该目录的 user-data 文件夹，升级和卸载会保留。迁移电脑时可在学习记录页导出和导入。

56 课涵盖 C 语言教材主线和拓展。4.3.0 补充中文注释、954 个推演步骤、独立阅读题和日常编程题。

构建安装包时，将应用、启动脚本、工具及第三方运行环境放入 distribution 目录，再用 Inno Setup 7 编译 installer.iss。第三方版本及来源见 SOURCE_ACCESS.md。

随包 GCC 要求安装或解压目录使用英文字母、数字和空格。安装包未签名，可通过发行页的 SHA256.txt 核对下载文件。
