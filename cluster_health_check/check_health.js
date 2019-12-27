/**
 * @description: seuoqiadb cluster health check script 
 * @author codejianhongxie
 * @modify list:
 *    2019-10-29 codejianhongxie Init 
 * */

/* host for sequoiadb */
if (typeof (HOST) != "string") {
    HOST = "localhost";
}
/* service name for coord */
if (typeof (SVCNAME) == "undefined") {
    SVCNAME = 11810;
}
/* username to login to sequoiadb */
if (typeof (SDBUSERNAME) != "string") {
    SDBUSERNAME = "";
}
/* password for login to sequoiadb */
if (typeof (SDBPASSWORD) != "string") {
    SDBPASSWORD = "";
}
/* operation type */
if (typeof (OP_TYPE) == "undefined") {
    OP_TYPE = "ALL";
}
/* sequoiadb version */
if (typeof (SDB_VERSION) == "undefined") {
    SDB_VERSION = "3.2.x";
}

/**
 * 
 * @param {*} msg log message 
 */
function logger(msg) {
    println(msg);
}

/**
 * check node status
 * @param {} nodeStatusArr 
 */
function checkNodeStatus(nodeStatusArr) {

    logger("check node status......");
    var groupHasPrimary = {};
    for (var i = 0; i < nodeStatusArr.length; i++) {
        var node = nodeStatusArr[i];
        if (node.hasOwnProperty("ErrNodes")) {
            hasErrorNode = true;
            var errorNodes = node["ErrNodes"];
            for (var j = 0; j < errorNodes.length; j++) {
                var errorNode = errorNodes[j];
                var groupName = errorNode["GroupName"];
                if (groupName != "SYSCoord" && !groupHasPrimary.hasOwnProperty(groupName)) {
                    groupHasPrimary[groupName] = undefined;
                }
                logger(JSON.stringify(errorNode));
            }
        } else {
            var groupName = node["GroupName"];
            var isPrimary = node["IsPrimary"];
            if (isPrimary) {
                if (groupHasPrimary.hasOwnProperty(groupName)) {
                    var primaryNode = groupHasPrimary[groupName];
                    if (primaryNode != undefined) {
                        logger("group [" + groupName + "] has more than one primary node, one is " + node["NodeName"] + ", another is " + primaryNode);
                    }
                }
                groupHasPrimary[groupName] = node["NodeName"];
            } else if (!groupHasPrimary.hasOwnProperty(groupName)) {
                groupHasPrimary[groupName] = undefined;
            }
        }
    }
    for (var group in groupHasPrimary) {
        if (groupHasPrimary[group] == undefined) {
            logger("group [" + group + "] has no primary node");
        }
    }
    logger("Done");
}

/**
 * check whether exists long transaction
 * @param {*} nodeStatusArr 
 */
function checkNodeLongTrans(nodeStatusArr) {
    logger("check long transaction......");
    var hasLongTransaction = false;
    for (var i = 0; i < nodeStatusArr.length; i++) {
        var node = nodeStatusArr[i];
        if (node.hasOwnProperty("ErrNodes")) {
            continue;
        }
        var nodeName = node["NodeName"];
        var beginLsn = node["TransInfo"]["BeginLSN"];
        var currentLsn = node["CurrentLSN"]["Offset"];
        if (beginLsn != -1 && ((currentLsn - beginLsn) * 1.0 / currentLsn) > 0.5) {
            hasLongTransaction = true;
            logger("node[" + nodeName + "] has long transaction, beginLsn:[" + beginLsn + "], currentLsn:[" + currentLsn + "]");
        }
    }
    logger("Done");
}

/**
 * check whether node lsn is the same.
 * @param {*} nodeStatusArr 
 */
function checkNodeLsn(nodeStatusArr) {
    logger("check node lsn......");
    var primaryNodeLSN = {};
    var standbyNodeLSN = new Array();
    for (var i = 0; i < nodeStatusArr.length; i++) {
        var node = nodeStatusArr[i];
        if (node.hasOwnProperty("ErrNodes")) {
            continue;
        }
        var groupName = node["GroupName"];
        if (groupName != "SYSCoord") {
            var nodeName = node["NodeName"];
            var isPrimary = node["IsPrimary"];

            var currentLsnOffset = node["CurrentLSN"]["Offset"];
            var currentLsnVersion = node["CurrentLSN"]["Version"];
            var nodeObj = {};
            nodeObj["NodeName"] = nodeName;
            nodeObj["GroupName"] = groupName;
            nodeObj["Offset"] = currentLsnOffset;
            nodeObj["Version"] = currentLsnVersion;
            if (isPrimary) {
                primaryNodeLSN[groupName] = nodeObj;
            } else {
                standbyNodeLSN.push(nodeObj);
            }
        }
    }
    for (var i = 0; i < standbyNodeLSN.length; i++) {
        var standbyNode = standbyNodeLSN[i];
        var groupName = standbyNode["GroupName"];
        if (primaryNodeLSN.hasOwnProperty(groupName)) {
            var primaryNode = primaryNodeLSN[groupName];
            var standbyNodeName = standbyNode["NodeName"];
            var primaryNodeName = primaryNode["NodeName"];
            var standbyNodeLsnOffset = standbyNode["Offset"];
            var standbyNodeLsnVersion = standbyNode["Version"];
            var primaryNodeLsnOffset = primaryNode["Offset"];
            var primaryNodeLsnVersion = primaryNode["Version"];
            if (primaryNodeLsnOffset != standbyNodeLsnOffset || primaryNodeLsnVersion != standbyNodeLsnVersion) {
                logger("group [" + groupName +
                    "], standby node[" + standbyNodeName + "] lsn[Offset:" + standbyNodeLsnOffset + ",Version:" + standbyNodeLsnVersion +
                    "], but primary node[" + primaryNodeName + "] lsn[Offset:" + primaryNodeLsnOffset + ",Version:" + primaryNodeLsnVersion + "]");
            }
        } else {
            logger("group [" + groupName + "] has no primary node");
        }
    }
    logger("Done");
}

/**
 *
 * get sequoiadb cluster node
 */
function getClusterNode() {

    var db = undefined;
    var listGroupsCursor = undefined;
    var clusterNodes = {};
    try {
        db = new Sdb(HOST, SVCNAME, SDBUSERNAME, SDBPASSWORD);
        listGroupsCursor = db.list(SDB_LIST_GROUPS);
        while (listGroupsCursor.next()) {
            var object = listGroupsCursor.current().toObj();
            var groupName = object["GroupName"];
            var groups = object["Group"];
            var nodeList = new Array();
            for (var i = 0; i < groups.length; i++) {
                var node = groups[i];
                var hostName = node["HostName"];
                var services = node["Service"];
                for (var j = 0; j < services.length; j++) {
                    var service = services[j];
                    var type = service["Type"];
                    if (type == 0) {
                        var port = service["Name"];
                        var nodeInfo = {};
                        nodeInfo["host"] = hostName;
                        nodeInfo["svcname"] = port;
                        nodeList.push(nodeInfo);
                        break;
                    }
                }
            }
            clusterNodes[groupName] = nodeList;
        }
    } catch (e) {
        logger("failed to get cluster node " + e + "(" + getLastErrMsg() + ")");
        throw e;
    } finally {
        if (listGroupsCursor != undefined) {
            listGroupsCursor.close();
        }
        if (db != undefined) {
            db.close();
        }
    }
    return clusterNodes;
}

function main() {
    var opTypeArr = new Array();
    if (OP_TYPE.toUpperCase().indexOf("ALL") != -1) {
        opTypeArr.push("STATUS");
        opTypeArr.push("LSN");
        opTypeArr.push("LONGTRANS");
    } else {
        opTypeArr = OP_TYPE.split(",");
    }

    logger("begin to check sequoiadb health");
    var clusterGroups = getClusterNode();
    //save node status to array
    var nodeStatusArr = new Array();
    var errorNodeArr = new Array();
    for (var clusterGroup in clusterGroups) {

        var nodeList = clusterGroups[clusterGroup];
        var groupName = clusterGroup;
        for (var i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];
            var host = node["host"];
            var svcName = node["svcname"];
            // 协调节点组
            if (groupName == "SYSCoord") {
                var db = undefined;
                try {
                    db = new Sdb(host, svcName, SDBUSERNAME, SDBPASSWORD);
                } catch (e) {
                    var errorNode = {};
                    errorNode["NodeName"] = host + ":" + svcName;
                    errorNode["GroupName"] = groupName;
                    errorNode["Flag"] = e;
                    errorNode["ErrInfo"] = getLastErrMsg();
                    errorNodeArr.push(errorNode);
                } finally {
                    if (db != undefined) {
                        db.close();
                    }
                }
            } else {
                var db = undefined;
                try {
                    db = new Sdb(host, svcName, SDBUSERNAME, SDBPASSWORD);
                    var nodeObj = db.snapshot(SDB_SNAP_DATABASE).next().toObj();
                    nodeStatusArr.push(nodeObj);
                } catch (e) {
                    var errorNode = {};
                    errorNode["NodeName"] = host + ":" + svcName;
                    errorNode["GroupName"] = groupName;
                    errorNode["Flag"] = e;
                    errorNode["ErrInfo"] = getLastErrMsg();
                    errorNodeArr.push(errorNode);
                } finally {
                    if (db != undefined) {
                        db.close();
                    }
                }
            }
        }
    }
    if (errorNodeArr.length > 0) {
        var errNodes={};
        errNodes["ErrNodes"] = errorNodeArr;
        nodeStatusArr.push(errNodes);
    }
    for (var i = 0; i < opTypeArr.length; i++) {
        if (opTypeArr[i].toUpperCase() == "STATUS") {
            checkNodeStatus(nodeStatusArr);
        } else if (opTypeArr[i].toUpperCase() == "LSN") {
            checkNodeLsn(nodeStatusArr);
        } else if (opTypeArr[i].toUpperCase() == "LONGTRANS") {
            checkNodeLongTrans(nodeStatusArr);
        }
    }
    logger("finish to check sequoiadb health");
}

main();
