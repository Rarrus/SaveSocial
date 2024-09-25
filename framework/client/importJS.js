const socket = new WebSocket("ws://localhost:8080/ws");

let keyValue = {}
let attrListNode = {};




function modifyAttr(elem, key) {
    const attrList = elem.attributes;
    let tmp = keyValue[key];
    if (!attrListNode[key]) attrListNode[key] = {}
    for (let attr of attrList) {
        let nameAttr = attr.nodeName;
        let val = attr.nodeValue;
        attrListNode[key][nameAttr] = val;
    }
    let list = attrListNode[key]
    Object.entries(list).forEach(([k, v]) => {
        if (tmp.includes(k)) {
            tmp = tmp.replaceAll(k, v);
        }
    });
    if (tmp != undefined) {
        return tmp;
    }
    return keyValue[key];


}


function createCMP(key, value) {
    keyValue[key] = value;
    class component2 extends HTMLElement {


        static observedAttributes = ["data"];

        constructor() {
            super();
        }

        connectedCallback() {
            this.innerHTML = modifyAttr(this, key);
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name == "data" && newValue != "NaN") {
                keyValue[key] = newValue;
            }
            this.innerHTML = modifyAttr(this, key);
        }
    }
    customElements.define(key, component2)
}



function modifyPage(name, value, isCMP) {
    let elem = document.getElementsByTagName(name)

    for (let elm of elem) {
        elm.setAttribute("data", value)
        elm.setAttribute("data", "NaN")
    }
}



socket.addEventListener("message", event => {
    const json = JSON.parse(event.data)
    const entries = Object.entries(json)[0]
    let name = entries[0]
    let value = entries[1]
    const ext = name.split("-")[1]

    switch (ext) {
        case "js":
            eval(value);
            break;
        default:
            if (name == "head-pages") {
                let valueModified = ""
                Object.entries(value).forEach(([k, v]) => {
                    if (k == "title") {
                        document.title = v;
                    } else if (k == "another") {
                        for (let value of v) {
                            valueModified += value
                        }
                    }
                })
                value = valueModified;
            }
            if (customElements.get(name)) {
                modifyPage(name, value)
            }
            else {
                console.log(name)
                createCMP(name, value)
                if (name == "head-pages") {
                    const head = document.getElementsByTagName('head')[0]
                    head.appendChild(document.createElement("head-pages"))
                }
            }
            break;


    }
    const url = window.location.href;
})

socket.addEventListener("open", () => {
    socket.send(location.pathname);
});

