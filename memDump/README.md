# 介绍
节点内存信息 dump 工具是用于将 SequoiaDB 节点的内存信息进行格式化输出，用于问题的分析与诊断。

# 使用说明

注意：在使用本工具之前，需要节点开启内存dump功能。

- 查看脚本说明

```bash
sh ./memDump.sh --help
Usage:  Options
-h, --help display this help text and exit.
-p, --port=<port> mem dump specified sequoiadb node, separated by commas(,).
-a, --all memory dump all local sequoiadb node.
```

- dump 指定服务端口为 11830,11840 的节点

```bash
sh ./memDump.sh -p "11830,11840"
```

- dump 当前机器的所有数据库节点

```bash
sh ./memDump.sh -a
```