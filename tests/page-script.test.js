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
    assert.equal(scripts[0].src, "https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js");
    assert.equal(scripts[0].integrity, "sha384-SALc35EccAf6RzGw4iNsyj7kTPr33K7RoGzYu+7heZhT8s0GZouafRiCg1qy44AS");
    assert.equal(scripts[0].crossOrigin, "anonymous");
    assert.equal(window.emailjs.initCount, 1);
});

test("hero image is prioritized and has stable intrinsic dimensions", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

    assert.match(html, /<link rel="preload" as="image" href="assets\/profile\.webp"[^>]*fetchpriority="high"/);
    assert.match(html, /<img src="assets\/profile\.webp"[^>]*width="768"[^>]*height="1365"[^>]*loading="eager"[^>]*fetchpriority="high"/);
});

test("hero pointer movement batches style updates to animation frames", async () => {
    const elements = new Map();
    let scheduledFrame = null;
    const window = {
        localStorage: { getItem() { return null; }, setItem() {} },
        fetch: async () => {},
        matchMedia() { return { matches: true }; },
        requestAnimationFrame(callback) {
            scheduledFrame = callback;
            return 1;
        },
        WeatherUtils: {
            createRequestCache() {
                return { get: async () => ({}) };
            }
        }
    };
    const hero = createElement();
    hero.style = { setProperty(name, value) { this[name] = value; } };
    hero.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    const document = {
        getElementById(id) {
            if (id === "hero") return hero;
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        createElement,
        head: { append() {} }
    };
    const context = vm.createContext({ window, document, navigator: {} });
    const source = fs.readFileSync(path.join(__dirname, "..", "AlterOfEgos_Webpage.script.js"), "utf8");

    vm.runInContext(source, context);
    const pointerMove = hero.listeners.get("pointermove");
    pointerMove({ clientX: 20, clientY: 30 });
    pointerMove({ clientX: 80, clientY: 70 });

    assert.equal(typeof scheduledFrame, "function");
    scheduledFrame();
    assert.equal(hero.style["--pointer-x"], "3px");
    assert.equal(hero.style["--pointer-y"], "2px");
});
