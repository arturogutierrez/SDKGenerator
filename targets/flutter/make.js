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
        sdkVersion: sdkGlobals.sdkVersion
    };

    templatizeTree(locals, path.resolve(sourceDir, "source"), apiOutputDir);

    makeDatatypes(apis, sourceDir, apiOutputDir);
}

// generate.js looks for some specific exported functions (as defined in TOC.json) in make.js, like:
exports.makeServerAPI = function (apis, sourceDir, apiOutputDir) {
}

// generate.js looks for some specific exported functions (as defined in TOC.json) in make.js, like:
exports.makeCombinedAPI = function (apis, sourceDir, apiOutputDir) {
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
            generateApiSummary: generateApiSummary
        };
        return datatype.isenum ? enumTemplate(locals) : modelTemplate(locals);
    };

    for (var a = 0; a < apis.length; a++) {
        var locals = {
            api: apis[a],
            makeDatatype: makeDatatype
        };
        writeFile(path.resolve(apiOutputDir, "lib/models/playfab_" + apis[a].name.toLowerCase() + "_models.dart"), modelsTemplate(locals));
    }
}

function getModelPropertyDef(property, datatype) {
    var basicType = getPropertyDartType(property, datatype);
    if (property.collection && property.collection === "array")
        return "List<" + basicType + "> " + property.name;
    else if (property.collection && property.collection === "map")
        return "Map<String," + basicType + "> " + property.name;
    else if (property.collection)
        throw "Unknown collection type: " + property.collection + " for " + property.name + " in " + datatype.name;

    return getPropertyDartType(property, datatype) + " " + property.name;
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
        return "float" + optional;
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
        output = tabbing + "/** " + lines[0] + " */\n";
    } else if (lines.length > 1) {
        output = tabbing + "/**\n" + tabbing + " * " + lines.join("\n" + tabbing + " * ") + "\n" + tabbing + " */\n";
    } else {
        output = "";
    }

    // TODO: The deprecation attribute should be a separate GetDeprecationAttribute call like various other SDKS
    if (apiElement.hasOwnProperty("deprecation"))
        output += tabbing + "@Deprecated('')\n";

    return output;
}
