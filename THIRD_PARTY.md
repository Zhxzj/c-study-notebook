# 第三方组件

本发行将学习应用、编译器与排版工具作为独立程序放在不同目录。第三方许可在 licenses/、runtime/LICENSE.txt 和 formatter/ThirdPartyNotices.txt。

- Python 3.14.8，Python Software Foundation，许可见 runtime/LICENSE.txt。
- GCC 16.2.0，GNU GPLv3及适用的GCC Runtime Library Exception，源自WinLibs 16.2.0posix-14.0.0-ucrt-r2。保留C编译、汇编、链接所需组件。
- GNU Binutils 2.47.20260726，GNU GPLv3及组件各自许可。
- MinGW-w64 14.0.0 与 winpthreads，许可和例外见 licenses/MinGW-w64-COPYING.txt 及头文件注记。
- GNU Make 4.4.1，GNU GPLv3。
- GMP、MPFR、MPC、ISL、libiconv、zlib、Zstandard，为编译工具的运行依赖。具体版本列于 SOURCE_ACCESS.md，各组件保留原许可。
- clang-format 23.1.0，Apache-2.0 WITH LLVM-exception，保留LLVM及分发方第三方通知。

本包不包含VS Code编辑器及其C/C++扩展，仅包含可按自身许可再发行的clang-format工具。未修改这些第三方可执行文件的内容。
