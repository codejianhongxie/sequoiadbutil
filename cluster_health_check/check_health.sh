#!/bin/bash

CURRENT_PATH=`pwd`
INSTALL_PATH=`cat /etc/default/sequoiadb | grep INSTALL_DIR | cut -f2 -d=`
SEQUOIADB_BIN_PATH="${INSTALL_PATH}/bin/"
SDB_SHELL="${SEQUOIADB_BIN_PATH}/sdb"
SEQUOIADB_VERSION=`${SEQUOIADB_BIN_PATH}/sequoiadb --version | grep version | cut -f2 -d: | sed 's/[[:space:]]//g' | sed 's/.$/x/g'`
HOST="localhost"
PORT=11810
USERNAME=""
PASSWORD=""
OPERATION_TYPE="all"

function usage() {
    echo -e "Usage:  Options"
    echo -e "-h [--host] <arg> hostname, default: localhost"
    echo -e "-P [--port] <arg> port, default:11810"
    echo -e "-u [--user] <arg> user for login"
    echo -e "-p [--password] <arg> Password to use when connecting to sequoiadb. If password is not given it's asked from the tty."
    echo -e "-t [--type] <arg> operation type, multiple types be separated by ',', default:all (all,status,lsn,longtrans)
                  status: check cluster node status,
                  lsn: check different lsn between primary node and standby node,
                  longtrans: check cluster whether has uncommited long transaction"
}

while [ "$#" -ge 1 ];
    do
        key="$1"
        case "$key" in
            --help)
                usage
                exit 0
                ;;
            -h|--host)
                HOST="$2"
                shift
                shift
                ;;
            -P|--port)
                PORT="$2"
                shift
                shift
                ;;
            -u|--user)
                USERNAME="$2"
                shift
                shift
                ;;
            -p|--password)
                PASSWORD="$2"
                shift
                shift
                ;;
            -t|--type)
                OPERATION_TYPE="$2"
                shift
                shift
                ;;
        esac
    done

exec ${SDB_SHELL} -e "var SDB_VERSION=\"${SEQUOIADB_VERSION}\"; var OP_TYPE=\"${OPERATION_TYPE}\"; var HOST=\"${HOST}\"; var SVCNAME=${PORT}; var SDBUSERNAME=\"${USERNAME}\"; var SDBPASSWORD=\"${PASSWORD}\"; " -f "${CURRENT_PATH}/check_health.js"
