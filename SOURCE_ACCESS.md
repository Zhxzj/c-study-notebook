# 第三方源码与构建资料入口

编译器二进制与本学习应用分离。下载、修改或重新构建第三方组件，请使用以下项目提供的源码与构建说明；不必安装本学习应用才能取得它们。此文件随安装版、便携版与发行页面一起提供。

- 随包工具链的原始发行与校验文件：https://github.com/brechtsanders/winlibs_mingw/releases/tag/16.2.0posix-14.0.0-ucrt-r2
- WinLibs项目和构建资料：https://winlibs.com/ ，https://github.com/brechtsanders/winlibs_recipes
- GCC 16.2.0源码：https://ftp.gnu.org/gnu/gcc/gcc-16.2.0/
- GCC构建安装文档：https://gcc.gnu.org/install/
- GNU Binutils源码、快照及源码仓库：https://sourceware.org/pub/binutils/ ，https://sourceware.org/git/binutils-gdb.git
- GNU Make 4.4.1源码：https://ftp.gnu.org/gnu/make/make-4.4.1.tar.gz
- MinGW-w64 14.0.0（包括winpthreads）源码：https://github.com/mingw-w64/mingw-w64/tree/v14.0.0
- LLVM/clang-format 23.1.0完整源码与构建说明：https://github.com/llvm/llvm-project/tree/llvmorg-23.1.0 ，https://clang.llvm.org/docs/ClangFormat.html
- Python 3.14.8源码及官方构建说明：https://www.python.org/downloads/release/python-3148/ ，https://devguide.python.org/getting-started/setup-building/
- GMP：https://gmplib.org/download/ ，MPFR：https://www.mpfr.org/ ，MPC：https://www.multiprecision.org/
- ISL：https://libisl.sourceforge.io/ ，libiconv：https://www.gnu.org/software/libiconv/ ，zlib：https://zlib.net/ ，Zstandard：https://github.com/facebook/zstd

从实际随包DLL查询的版本：

- libmpfr-6.dll：4.2.2
- libmpc-3.dll：1.4.1
- libisl-23.dll：isl-0.28-GMP

- zlib1.dll：1.3.2
- libzstd.dll：1.5.7
- libgmp-10.dll：6.3.0
- libiconv-2.dll：0x113

WinLibs依赖相应的Windows/UCRT目标环境；本应用的打包脚本只筛选文件和复制依赖，不修改编译器源码。源码入口与第三方许可同时保留在GitHub项目中。
