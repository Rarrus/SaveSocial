import { Server, ServerWebSocket } from "bun";
import { watch } from "chokidar";
import { existsSync, lstatSync } from "fs";

// Read the JavaScript and HTML files from the client directory
let buildFile;
let indexFile = await Bun.file("framework/client/index.html")
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
  indexFile
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





