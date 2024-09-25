import { Server, ServerWebSocket } from "bun";
import { watch } from "chokidar";
import { existsSync, lstatSync } from "fs";

// Read the JavaScript and HTML files from the client directory
const jsFile = await Bun.file("framework/client/importJS.js")
    .bytes();
const indexFile = await Bun.file("framework/client/index.html")
    .bytes();
let headJson = JSON.parse(await Bun.file("head.json").text());

// Initialize variables for managing WebSocket clients, content, pages, child components, and main pages
let client: { [keys: string]: ServerWebSocket } = {};
let childComponent: { [key: string]: { "path": string, "data": string } } = {};
let mainPage = "";

// Define a list of ignored files and directories for the watcher
const ignoredFiles = [
    /framework/,
    /\/\./,
    /node_modules/,
    /\.git/,
    /bun\.lockb/,
    /\package-lock\.json/,
    /package\.json/,
    /tsconfig\.json/,
    /icons/
];

// Initialize the file system watcher
const watcher = watch(".", {
    ignored: ignoredFiles,
    persistent: true,
});

// Function to replace double quotes with single quotes and remove newlines
const replaceFile = (str: string) => {
    return str.replaceAll('"', "'").replaceAll("\n", "").replaceAll("\\", "\\\\");
};

// Function to watch and process a component file
async function watchComponent(path: string): Promise<void> {
    const text: string = await Bun.file(path).text()
    let name = trueName(path)
    let textModified: string = replaceFile(text)
    const pathSplit = path.split("/")
    let ext = pathSplit[0];
    switch (ext) {
        case "css":
            textModified = "<style>" + textModified + "</style>"
            break;
        case "pages":
        case "index.html":
            textModified = "<body>" + textModified + "</body>"
            break;
        case "head.json":
            headJson = await JSON.parse(text);
            if (mainPage) sendData("head-pages", headJson[mainPage], true)
            return;
        case "js":
        case "cmp":
            break;
        default:
            return;
    }

    childComponent[name] = { "path": path, "data": textModified };
    if (name.includes("-pages")) name = "body-pages";
    sendData(name, textModified);
}

function basename(path: string): string {
    return path.substring(path.lastIndexOf('/') + 1);
};

// Function to send data via WebSocket
function sendData(nameCMP: string, data: string = "", json: boolean = false) {
    Object.values(client).forEach((_ws: ServerWebSocket<unknown>) => {
        if (json) _ws.send('{"' + nameCMP + '":' + JSON.stringify(data) + ' }');
        else _ws.send('{"' + nameCMP + '":"' + data + '"}');
    });
};


const trueName = (path: string): string => {
    let base: string = basename(path).split(".")[0];
    if (path.includes("/")) return base + "-" + path.split("/")[0];
    else return base + "-pages";
}

watcher
    .on('add', async (path) => {
        watchComponent(path);
    })
    .on('raw', async (event, path, details) => {
        const watch = details["watchedPath"];
        const fullPath: string = (watch == ".") ?
            path : watch + "/" + path;
        const name: string = trueName(fullPath);
        if (event == "change") {
            if (lstatSync(watch).isDirectory()) {

                if (childComponent[name]) {
                    const pathFile = childComponent[name]["path"];
                    watchComponent(pathFile);
                }
            };
        }
        else if (event == "rename") {
            if (existsSync(fullPath)) {
                watcher.add(fullPath);
                const text: string = await Bun.file(fullPath).text()

                childComponent[name] = { "path": fullPath, "data": text };
            } else {
                watcher.unwatch(fullPath);
            };
        };
    });

const responseStatic = (type: string, file: Uint8Array) => {
    return new Response(file, {
        headers: {
            "Content-Type": type, "Cache-Control": "max-age=604800"
        },
    })
};

const server: Server = Bun.serve({
    port: 8080,
    static: {
        "/importJS.js": responseStatic("text/js", jsFile),
        "/pages/importJS.js": Response.redirect("/importJS.js", 301),
        "/": responseStatic("text/html", indexFile),
    },
    async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === "/ws") {
            const success = server.upgrade(req);
            return success
                ? undefined
                : new Response("WebSocket upgrade error", { status: 400 });
        }
        if (path.includes("/pages")) return responseStatic("text/html", indexFile)
        if (path.includes("icons")) {
            const file = await Bun.file("." + path)
                .bytes();
            let type
            if (path.includes("svg")) type = "image/svg+xml"
            if (path.includes("jpeg")) type = "image/jpeg"
            if (path.includes("png")) type = "image/png"
            if (path.includes("gif")) type = "image/gif"
            return responseStatic(type, file)
        }
        return new Response("404!");
    },
    websocket: {
        open(ws: ServerWebSocket) {
            Object.entries(childComponent).forEach(([nameCMP, data]) => {
                if (!nameCMP.includes("-pages")) {
                    ws.send('{"' + nameCMP + '":"' + data["data"] + '"}');
                }
            });
        },
        message(ws, message) {
            message = String(message);
            client[ws["remoteAddress"]] = ws;
            if (message === "/") {
                mainPage = "index";
            } else if (message.includes("/pages/")) {
                mainPage = message.split(".")[0].split("/")[2];
            }
            sendData("head-pages", headJson[mainPage], true)
            sendData("body-pages", childComponent[mainPage + "-pages"]["data"]);
        },
        close(ws) {
            delete client[ws["remoteAddress"]];
        },
    },
});

console.log(`
    Listening on http://${server.hostname}:${server.port}`);





