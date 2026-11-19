const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement() {
    const listeners = new Map();
    return {
        disabled: false,
        hidden: false,
        value: "",
        classList: { toggle() {} },
        addEventListener(name, callback) { listeners.set(name, callback); },
        querySelector() { return createElement(); },
        replaceChildren() {},
        setAttribute() {},
        append() {},
        focus() {},
        reset() {},
        listeners
    };
}

test("EmailJS is loaded on contact submission and initialized only once", async () => {
    const elements = new Map();
    const scripts = [];
    const window = {
        localStorage: { getItem() { return null; }, setItem() {} },
        fetch: async () => {},
        WeatherUtils: {
            requestJson() {},
            buildGeocodingUrl() {},
            normalizeLocations() {},
            buildForecastUrl() {},
            createRequestCache() {
                return { get: async (url) => ({}) };
            }
        }
    };
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        createElement() {
            const script = createElement();
            script.addEventListener = (name, callback) => script.listeners.set(name, callback);
            return script;
        },
        head: {
            append(script) {
                scripts.push(script);
                window.emailjs = {
                    initCount: 0,
                    init() { this.initCount += 1; },
                    async sendForm() {}
                };
                queueMicrotask(() => script.listeners.get("load")());
            }
        }
    };
    const contactForm = document.getElementById("contact-form");
    const submit = createElement();
    contactForm.querySelector = () => submit;
    const context = vm.createContext({ window, document, navigator: {} });
    const source = fs.readFileSync(path.join(__dirname, "..", "AlterOfEgos_Webpage.script.js"), "utf8");

    vm.runInContext(source, context);
    assert.equal(scripts.length, 0);

    const submitHandler = contactForm.listeners.get("submit");
    const event = { preventDefault() {} };
    await submitHandler(event);
    await submitHandler(event);

    assert.equal(scripts.length, 1);
    assert.equal(window.emailjs.initCount, 1);
});
