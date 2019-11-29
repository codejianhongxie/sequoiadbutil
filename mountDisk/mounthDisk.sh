#!/bin/bash

function usage() {
    echo -e "Usage:  Options"
    echo -e "-t, --type=<type> filesystem type; when unspecified, ext4 is used"
    echo -e "-h, --help display this help text and exit"
    echo -e "-d, --disks=<disk> disk to format, separated by commas(,), such as: /dev/sdb,/dev/sdc"
    echo -e "-p, --prepath=<path> disk to mount path prefix， default: \"/sdbdata/data\""
}

fileSystemType="ext4"
mountPathPre="/sdbdata/data"
disks=""

while [ "$#" -ge 1 ];
do
    key="$1"
    case "$key" in
        -h|--help)
            usage
            exit 0
            ;;
        -t|--type)
            fileSystemType="$2"
            shift
            shift
            ;;
        -d|--disks)
            disks="$2"
            shift
            shift
            ;;
        -p|--prepath)
            mountPathPre="$2"
            shift
            shift
            ;;
    esac
done

if [ -z "${disks}" ]; then
   echo "Error! please specified disk"
   usage
# unspecified disk
   #diskArr=(`fdisk -l | grep "Disk /" | cut -f1 -d: | awk '{print $2}' | sed ':a;N;$!ba;s/\n/ /g'`)
else
   diskArr=(`echo "${disks//,/ }"`)
fi

diskIndex=1
for disk in ${diskArr[*]}
do
    # check whether disk is already mount
    diskMountInfo=`df | grep "${disk}" | awk '{print $NF}'`
    if [ ! -z "${diskMountInfo}" ]; then
        echo "${disk} is already format and mount to ${diskMountInfo}"
        continue
    fi
    echo "format ${disk}"
    diskInfo=(`fdisk ${disk} -l | grep "Disk ${disk}" | cut -f2 -d: | awk '{print $1,$2}' | cut -f1 -d\,`)
    diskSize=`echo ${diskInfo[0]} | awk -F. '{print $1}'`
    sizeUnit=${diskInfo[1]}
    if [ "${sizeUnit}" == "GB" -a ${diskSize} -ge 2048 ]; then
        parted -s $disk mklabel gpt
        parted -s $disk mkpart primary 0 100
        parted -s $disk print
        if [ "${fileSystemType}" == "xfs" ]; then
            mkfs.xfs -f ${disk}
        elif [ "${fileSystemType}" == "ext4" ]; then
            echo -e "y\n" | mkfs.ext4 ${disk}
        elif [ "${fileSystemType}" == "ext3" ]; then
            echo -e "y\n" | mkfs.ext3 ${disk}
        elif [ "${fileSystemType}" == "ext2" ]; then
            echo -e "y\n" | mkfs.ext2 ${disk}
        else
            echo "unable support this filesystem type: ${fileSystemType}"
            exit 1
        fi
    elif [ "${sizeUnit}" == "GB" -a ${diskSize} -lt 2048 ]; then
        echo -e "n\np\n1\n\n\nw" | fdisk ${disk} 
    else
        echo "${disk} size is less than 10 GB, don't format"
        continue
    fi
    # format disk
    if [ "${fileSystemType}" == "xfs" ]; then
        mkfs.xfs -f ${disk}
    elif [ "${fileSystemType}" == "ext4" ]; then
        echo -e "y\n" | mkfs.ext4 ${disk}
    elif [ "${fileSystemType}" == "ext3" ]; then
        echo -e "y\n" | mkfs.ext3 ${disk}
    elif [ "${fileSystemType}" == "ext2" ]; then
        echo -e "y\n" | mkfs.ext2 ${disk}
    else
        echo "unable support this filesystem type: ${fileSystemType}"
        exit 1
    fi
    
    if [ ${diskIndex} -lt 10 ]; then
        mountPath="${mountPathPre}0$diskIndex"
    else
        mountPath="${mountPathPre}${diskIndex}"
    fi
    
    if grep -qs "${mountPath}" /proc/mounts; then
        echo "${mountPath} is already mount, umount it"
        umount $mountPath
    fi
    echo "mount ${disk} to ${mountPath}"
    mount ${disk} ${mountPath}
    diskFstabConf="${disk}     ${mountPath}     ${fileSystemType}    defaults          1 2"
    diskFstabCount=`cat /etc/fstab | grep "${diskFstabConf}" | wc -l`
    if [ "${diskFstabCount}" -lt 1 ]; then
        echo -e "${diskFstabConf}" >> /etc/fstab
    fi
    diskIndex=`expr $diskIndex + 1`
done 