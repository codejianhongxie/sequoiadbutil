/**
 * @description: seuoqiadb cluster health check script 
 * @author codejianhongxie
 * @modify list:
 *    2019-10-29 codejianhongxie Init 
 * */

/* host for sequoiadb */
if (typeof(HOST) != "string") {
    HOST = "localhost";
}
/* service name for coord */
if (typeof(SVCNAME) == "undefined") {
    SVCNAME = 11810;
}
 /* username to login to sequoiadb */
if (typeof(SDBUSERNAME) != "string") {
    SDBUSERNAME = "";
}
/* password for login to sequoiadb */
if (typeof(SDBPASSWORD) != "string") {
    SDBPASSWORD = "";
}
/* operation type */
if (typeof(OP_TYPE) == "undefined") {
    OP_TYPE = "ALL";
}
/* sequoiadb version */
if (typeof(SDB_VERSION) == "undefined") {
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
    var hasErrorNode = false;
    // before 3.0 version, coord node need to be checked separately
    if (SDB_VERSION < "3.0") {
        var tmpDb = undefined;
        var cursor = undefined;
        try {
            tmpDb = new Sdb(HOST, SVCNAME, SDBUSERNAME, SDBPASSWORD);
            cursor = tmpDb.list(SDB_LIST_GROUPS, {"GroupName" : "SYSCoord"});
            while(cursor.next()) {
                var object = cursor.current().toObj();
                var groups = object["Group"];
                for( var i = 0; i < groups.length; i++) {
                    var node = groups[i];
                    var hostName = node["HostName"];
                    var port = 11810;
                    var services = node["Service"];
                    for(var j = 0; j < services.length; j++) {
                        var service = services[j];
                        var type = service["Type"];
                        if (type == 0) {
                            port = service["Name"];
                            break;
                        }
                    }
                    var coord = undefined;
                    try {
                        coord = new Sdb(hostName, port, SDBUSERNAME, SDBPASSWORD);
                    } catch(e) {
                        hasErrorNode = true;
                        var errorNode = {};
                        errorNode["NodeName"] = hostName + ":" + port;
                        errorNode["GroupName"] = "SYSCoord";
                        errorNode["Flag"] = e;
                        errorNode["ErrInfo"] = getLastErrMsg();
                        logger(JSON.stringify(errorNode));
                    } finally {
                        if (coord != undefined) {
                            coord.close();
                        }
                    }
                } 
            }
        } finally {
            if (tmpDb != undefined) {
                tmpDb.close();
            }
            if (cursor != undefined) {
                cursor.close();
            }
        }
        
    }
    for (var i = 0; i < nodeStatusArr.length; i++) {
        var node = nodeStatusArr[i];
        if (node.hasOwnProperty("ErrNodes")) {
            hasErrorNode = true;
            var errorNodes = node["ErrNodes"];
            for(var j = 0; j < errorNodes.length; j++) {
                var errorNode = errorNodes[j];
                logger(JSON.stringify(errorNode));
            }
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
    for ( var i = 0; i< standbyNodeLSN.length; i++) {
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

function main() {
    var opTypeArr = new Array();
    if (OP_TYPE.toUpperCase().indexOf("ALL") != -1 ) {
        opTypeArr.push("STATUS");
        opTypeArr.push("LSN");
        opTypeArr.push("LONGTRANS");
    } else {
        opTypeArr = OP_TYPE.split(",");
    }

    var sdb = undefined;
    try {
        logger("begin to check sequoiadb health");
        sdb = new Sdb(HOST, SVCNAME, SDBUSERNAME, SDBPASSWORD);
        var cursor = sdb.snapshot(SDB_SNAP_DATABASE,{RawData:true});
        
        //save node status to array
        var nodeStatusArr = new Array();
        while(cursor.next()) {
            var nodeStatusObj = cursor.current().toObj();
            nodeStatusArr.push(nodeStatusObj);
        }
        cursor.close();
        
        for(var i = 0; i < opTypeArr.length; i++) {
            if (opTypeArr[i].toUpperCase() == "STATUS") {
                checkNodeStatus(nodeStatusArr);
            } else if (opTypeArr[i].toUpperCase() == "LSN") {
                checkNodeLsn(nodeStatusArr);
            } else if (opTypeArr[i].toUpperCase() == "LONGTRANS") {
                checkNodeLongTrans(nodeStatusArr);
            }
        }
        logger("finish to check sequoiadb health");
    } catch(e) {
        logger("failed to check sequoiadb health, error:" + e + "(" + getLastErrMsg() + ")");
        throw e;
    } finally {
        if (sdb != undefined) {
            //close connection for sdb
            sdb.close();
        }
    }
}

main();
