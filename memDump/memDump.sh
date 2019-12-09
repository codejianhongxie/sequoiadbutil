#!/bin/bash

function usage() {
    echo -e "Usage:  Options"
    echo -e "-h, --help display this help text and exit."
    echo -e "-p, --port=<port> mem dump specified sequoiadb node, separated by commas(,)."
    echo -e "-a, --all memory dump all local sequoiadb node."
}

if [ "$#" -lt 1 ]; then
    usage
    exit 0
fi

sequoiadbPorts=""

while [ "$#" -ge 1 ];
do
    key="$1"
    case "$key" in
        -h|--help)
            usage
            exit 0
            ;;
        -p|--port)
            if [ -z "${sequoiadbPorts}" ]; then
                sequoiadbPorts="$2"
            fi
            shift
            shift    
            ;;
        -a|--all)
            sequoiadbPorts=`sdblist -l | grep -e "sequoiadb" | awk '{print $2}' | sed ':a;N;$!ba;s/\n/,/g'`
            shift
            ;;
    esac
done

if [ -z "${sequoiadbPorts}" ]; then
    echo "Error! please specified sequoiadb port"
    usage
    exit -1
else 
    sequoiadbPortsArr=(`echo "${sequoiadbPorts//,/ }"`)
fi

for sequoiadbPort in ${sequoiadbPortsArr[@]}
do
    sequoiadbPid=`sdblist -l | grep "${sequoiadbPort}" | awk '{print $4}'`
    echo "memory dump ${sequoiadbPort}(${sequoiadbPid})"
    kill -23 ${sequoiadbPid}
done