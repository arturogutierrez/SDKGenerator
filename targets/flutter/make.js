var path = require("path");

// Making resharper less noisy - These are defined in Generate.js
if (typeof (generateApiSummaryLines) === "undefined") generateApiSummaryLines = function () { };
if (typeof (getCompiledTemplate) === "undefined") getCompiledTemplate = function () { };
if (typeof (templatizeTree) === "undefined") templatizeTree = function () { };

// generate.js looks for some specific exported functions (as defined in TOC.json) in make.js, like:
exports.makeClientAPI2 = function (apis, sourceDir, apiOutputDir) {
    apiOutputDir = path.join(apiOutputDir, "playfabsdk");

    var authMechanisms = getAuthMechanisms(apis);
    var locals = {
        apiName: "Client",
        apiNameLc: "Client".toLowerCase(),
        buildIdentifier: sdkGlobals.buildIdentifier,
        errorList: apis[0].errorList,
        errors: apis[0].errors,
        hasClientOptions: authMechanisms.includes("SessionTicket"),
        hasServerOptions: authMechanisms.includes("SecretKey"),
        sdkVersion: sdkGlobals.sdkVersion,
        getVerticalNameDefault: getVerticalNameDefault
    };

    makeDatatypes(apis, sourceDir, apiOutputDir);
    for (var a = 0; a < apis.length; a++)
        makeApi(apis[a], sourceDir, apiOutputDir);

    templatizeTree(locals, path.resolve(sourceDir, "source"), apiOutputDir);
}

// generate.js looks for some specific exported functions (as defined in TOC.json) in make.js, like:
exports.makeServerAPI = function (apis, sourceDir, apiOutputDir) {
}

// generate.js looks for some specific exported functions (as defined in TOC.json) in make.js, like:
exports.makeCombinedAPI = function (apis, sourceDir, apiOutputDir) {
}

function makeApi(api, sourceDir, apiOutputDir) {
    var outFileName = path.resolve(apiOutputDir, "lib/api/" + api.name.toLowerCase() + "_api.dart");
    console.log("  - GenApi " + api.name + " to " + outFileName);

    var locals = {
        api: api,
        getAuthParams: getAuthParams,
        getRequestActions: getRequestActions,
        getResultActions: getResultActions,
        generateApiSummary: generateApiSummary,
        hasClientOptions: getAuthMechanisms([api]).includes("SessionTicket"),
    };

    var apiTemplate = getCompiledTemplate(path.resolve(sourceDir, "templates/API.dart.ejs"));
    writeFile(outFileName, apiTemplate(locals));
}

function makeDatatypes(apis, sourceDir, apiOutputDir) {
    var templateDir = path.resolve(sourceDir, "templates");
    var modelTemplate = getCompiledTemplate(path.resolve(templateDir, "Model.dart.ejs"));
    var modelsTemplate = getCompiledTemplate(path.resolve(templateDir, "Models.dart.ejs"));
    var enumTemplate = getCompiledTemplate(path.resolve(templateDir, "Enum.dart.ejs"));

    var makeDatatype = function (datatype, api) {
        var locals = {
            api: api,
            datatype: datatype,
            getPropertyDef: getModelPropertyDef,
            generateApiSummary: generateApiSummary,
            camelize: camelize
        };
        return datatype.isenum ? enumTemplate(locals) : modelTemplate(locals);
    };

    for (var a = 0; a < apis.length; a++) {
        var locals = {
            api: apis[a],
            makeDatatype: makeDatatype,
            camelize: camelize
        };
        writeFile(path.resolve(apiOutputDir, "lib/models/" + apis[a].name.toLowerCase() + "_models.dart"), modelsTemplate(locals));
    }
}

function camelize(str) {
    return str.substring(0, 1).toLowerCase() + str.substring(1);
}

function getVerticalNameDefault() {
    if (sdkGlobals.verticalName) {
        return "'" + sdkGlobals.verticalName + "'";
    }

    return "null";
}

function getModelPropertyDef(property, datatype) {
    var basicType = getPropertyDartType(property, datatype);
    if (property.collection && property.collection === "array")
        return "List<" + basicType + "> " + camelize(property.name);
    else if (property.collection && property.collection === "map")
        return "Map<String, " + basicType + "> " + camelize(property.name);
    else if (property.collection)
        throw "Unknown collection type: " + property.collection + " for " + property.name + " in " + datatype.name;

    return getPropertyDartType(property, datatype) + " " + camelize(property.name);
}

function getPropertyDartType(property, datatype) {
    var optional = "";

    if (property.actualtype === "String")
        return "String";
    else if (property.actualtype === "Boolean")
        return "bool" + optional;
    else if (property.actualtype === "int16")
        return "int" + optional;
    else if (property.actualtype === "uint16")
        return "int" + optional;
    else if (property.actualtype === "int32")
        return "int" + optional;
    else if (property.actualtype === "uint32")
        return "int" + optional;
    else if (property.actualtype === "int64")
        return "int" + optional;
    else if (property.actualtype === "uint64")
        return "int" + optional;
    else if (property.actualtype === "float")
        return "double" + optional;
    else if (property.actualtype === "double")
        return "double" + optional;
    else if (property.actualtype === "DateTime")
        return "DateTime" + optional;
    else if (property.isclass)
        return property.actualtype;
    else if (property.isenum)
        return property.actualtype + optional;
    else if (property.actualtype === "object")
        return "Object";
    throw "Unknown property type: " + property.actualtype + " for " + property.name + " in " + datatype.name;
}

function getAuthParams(apiCall) {
    if (apiCall.auth === "EntityToken")
        return "\"X-EntityToken\", PlayFabSettings.entityToken";
    if (apiCall.auth === "SecretKey")
        return "\"X-SecretKey\", _apiSettings.developerSecretKey";
    if (apiCall.auth === "SessionTicket")
        return "\"X-Authorization\", PlayFabSettings.clientSessionTicket";
    if (apiCall.url === "/Authentication/GetEntityToken")
        return "authKey, authValue";
    return "null, null";
}

function getRequestActions(tabbing, apiCall) {
    if (apiCall.result === "LoginResult" || apiCall.request === "RegisterPlayFabUserRequest")
        return tabbing + "request.titleId = _apiSettings.titleId ?? request.titleId;\n"
            + tabbing + "if (request.titleId == null) throw Exception(\"Must be have PlayFabApiSettings.titleId set to call this method\");\n";
    if (apiCall.url === "/Authentication/GetEntityToken")
        return tabbing + "String authKey;\n"
            + tabbing + "String authValue;\n\n"
            + tabbing + "if (PlayFabSettings.entityToken != null) {\n"
            + tabbing + "  authKey = 'X-Entity-Token';\n"
            + tabbing + "  authValue = PlayFabSettings.entityToken;\n"
            + tabbing + "} else if (PlayFabSettings.clientSessionTicket != null) {\n"
            + tabbing + "  authKey = 'X-Authorization';\n"
            + tabbing + "  authValue = PlayFabSettings.clientSessionTicket;\n"
            + tabbing + "} else if (_apiSettings.developerSecretKey != null) {\n"
            + tabbing + "  authKey = 'X-SecretKey';\n"
            + tabbing + "  authValue = _apiSettings.developerSecretKey;\n"
            + tabbing + "}\n";
    if (apiCall.auth === "SessionTicket")
        return tabbing + "if (PlayFabSettings.clientSessionTicket == null) throw Exception(\"Must be logged in to call this method\");\n";
    if (apiCall.auth === "SecretKey")
        return tabbing + "if (_apiSettings.developerSecretKey == null) throw Exception(\"Must have PlayFabSettings.DeveloperSecretKey set to call this method\");\n";
    if (apiCall.auth === "EntityToken")
        return tabbing + "if (PlayFabSettings.entityToken == null) throw Exception(\"Must call GetEntityToken before you can use the Entity API\");\n";
    return "";
}

function getResultActions(tabbing, apiCall) {
    if (apiCall.url === "/Authentication/GetEntityToken")
        return tabbing + "PlayFabSettings.entityToken = result.entityToken != null ? result.entityToken : PlayFabSettings.entityToken;\n";
    else if (apiCall.result === "LoginResult")
        return tabbing + "PlayFabSettings.clientSessionTicket = result.sessionTicket != null ? result.sessionTicket : PlayFabSettings.clientSessionTicket;\n"
            + tabbing + "if (result.entityToken != null) PlayFabSettings.entityToken = result.entityToken.entityToken != null ? result.entityToken.entityToken : PlayFabSettings.entityToken;\n"
            + tabbing + "MultiStepClientLogin(result.settingsForUser.needsAttribution);\n";
    else if (apiCall.result === "RegisterPlayFabUserResult")
        return tabbing + "PlayFabSettings.clientSessionTicket = result.sessionTicket != null ? result.sessionTicket : PlayFabSettings.clientSessionTicket;\n"
            + tabbing + "await MultiStepClientLogin(result.settingsForUser.needsAttribution);\n";
    else if (apiCall.result === "AttributeInstallResult")
        return tabbing + "// Modify AdvertisingIdType:  Prevents us from sending the id multiple times, and allows automated tests to determine id was sent successfully\n"
            + tabbing + "_apiSettings.advertisingIdType += \"_Successful\";\n";
    return "";
}

function generateApiSummary(tabbing, apiElement, summaryParam, extraLines) {
    var lines = generateApiSummaryLines(apiElement, summaryParam, extraLines, false, "@deprecated");

    // FILTERING: Java is very picky about the output
    if (lines) {
        for (var i = 0; i < lines.length; i++) {
            lines[i] = lines[i].replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
            if (lines[i].contains("*/"))
                lines[i] = null;
        }
    }

    var output;
    if (lines.length === 1 && lines[0]) {
        output = tabbing + "/// " + lines[0] + "\n";
    } else if (lines.length > 1) {
        output = tabbing + "/// " + lines.join("\n" + tabbing + "/// ") + "\n";
    } else {
        output = "";
    }

    // TODO: The deprecation attribute should be a separate GetDeprecationAttribute call like various other SDKS
    if (apiElement.hasOwnProperty("deprecation"))
        output += tabbing + "@Deprecated('')\n";

    return output;
}
