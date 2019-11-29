# 介绍
磁盘自动格式化工具主要用于自动格式化当前机器的磁盘，并挂载到对应的目录中，节约挂载磁盘手工操作的时间。

# 使用说明

磁盘的挂载目录默认为 "/sdbdata/data"+ index, index 表示待挂载磁盘列表的序号，若 index 小于10，则在index 之前补0。如：待挂载的磁盘列表为"/dev/sdb,/dev/sdc"，那么 "/dev/sdb" 对应的挂载目录为 "/sdbdata/data01"，"/dev/sdc" 对应的挂载目录为 "/sdbdata/data02"。

- 查看脚本说明

```bash
sh ./mountDisk.sh --help
Usage:  Options
-t, --type=<type> filesystem type; when unspecified, ext4 is used
-h, --help display this help text and exit
-d, --disks=<disk> disk to format, separated by commas(,), such as: /dev/sdb,/dev/sdc
-p, --prepath=<path> disk to mount path prefix， default: "/sdbdata/data"
```

- 指定挂载数据盘"/dev/sdb"，数据盘格式为"ext4"，指定挂载目录前缀为"/sdbdata/data"

```bash
sh ./mountDisk.sh -t ext4 -d "/dev/sdb" -p "/sdbdata/data"
```