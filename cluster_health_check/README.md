# 介绍
集群健康检查脚本主要检查以下内容：
- 集群的节点是否存活并对外提供服务
- 集群的主备节点间LSN值是否一致
- 集群是否存在未提交的长事务

# 使用说明
- 采用默认配置，执行脚本

```bash
sh ./check_health.sh
```

- 查看脚本说明

```bash
sh ./check_health.sh --help
Usage:  Options
-h [--host] <arg> hostname, default: localhost
-P [--port] <arg> port, default:11810
-u [--user] <arg> user for login
-p [--password] <arg> Password to use when connecting to sequoiadb. If password is not given it's asked from the tty.
-t [--type] <arg> operation type, multiple types be separated by ',', default:all (all,status,lsn,longtrans)
```
# 限制
由于SequoiaDB 官方的 Sdb Shell目前不支持已定义超时时间，故当集群存在僵死节点（连接上，但没有任何响应结果）时，该脚本需要等待超时才会返回结果。根据笔者的测试情况，默认超时时间为300s左右。
