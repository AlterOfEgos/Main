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
        addEventListener() {},
        scrollTo() {},
        scrollY: 0,
        navigator: {},
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
        documentElement: createElement(),
        querySelectorAll() { return []; },
        querySelector() { return null; },
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
    const context = vm.createContext({
        window,
        document,
        navigator: {},
        setInterval() {},
        setTimeout() {},
        IntersectionObserver: undefined,
        Date
    });
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

test("page includes ten customization hooks", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const script = fs.readFileSync(path.join(__dirname, "..", "AlterOfEgos_Webpage.script.js"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "..", "AlterOfEgos_Webpage_styles.css"), "utf8");

    assert.match(html, /class="site-nav"/);
    assert.match(html, /id="theme-toggle"/);
    assert.match(html, /id="hero-time"/);
    assert.match(html, /class="quick-locations"/);
    assert.match(html, /id="copy-weather"/);
    assert.match(html, /id="message-count"/);
    assert.match(html, /id="back-to-top"/);
    assert.match(html, /id="footer-year"/);
    assert.match(html, /class="nav-links"/);
    assert.match(html, /class="reveal-on-scroll"/);

    assert.match(script, /data-theme/);
    assert.match(script, /setInterval\(updateLocalTime/);
    assert.match(script, /\[data-city\]/);
    assert.match(script, /navigator\.clipboard\.writeText/);
    assert.match(script, /messageInput\?\.addEventListener\("input"/);
    assert.match(script, /backToTop\?\.addEventListener\("click"/);
    assert.match(script, /footerYear\.textContent/);
    assert.match(script, /navLinks\.forEach/);
    assert.match(script, /IntersectionObserver/);

    assert.match(css, /\[data-theme="light"\]/);
    assert.match(css, /\.site-nav/);
    assert.match(css, /\.hero-meta/);
    assert.match(css, /\.quick-locations/);
    assert.match(css, /\.copy-weather/);
    assert.match(css, /\.message-count/);
    assert.match(css, /\.back-to-top/);
    assert.match(css, /footer p/);
    assert.match(css, /\.nav-links/);
    assert.match(css, /\.reveal-on-scroll/);
});
