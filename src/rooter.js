import { fade_animation, slide_animation } from "./transitions.js";

const PERSIST_ATTR = "data-rooter-persist";
const ANIMATE_ATTR = "data-rooter-animate";

/**
 * @template {"fetching" | "fetched" | "view-start" | "view-end"} T
 */
export class RouteEvent extends Event {
  /**@type {Promise[]} */
  #promise = [];

  /**@param {T} type */
  constructor(type) {
    super(`route-${type}`);
  }

  get promise() {
    return Promise.all(this.#promise);
  }

  /**@param {Promise} promise */
  set promise(promise) {
    this.#promise.push(promise);
  }
}

/**@param {HTMLElement} element */
function is_anchor(element) {
  if (element instanceof HTMLAnchorElement) {
    return element;
  }
}

/**@param {Event} event */
function get_anchor(event) {
  for (const element of event.composedPath()) {
    let anchor = is_anchor(/**@type{HTMLElement}*/ (element));
    if (anchor) {
      return anchor;
    }
  }
  return false;
}

const SCRIPT_EXC_ATTR = "data-rooter-execute";

/**@param {Document} new_document */
function mark_incoming_scripts(new_document) {
  /**@type {NodeListOf<HTMLScriptElement>} */
  let scripts = new_document.querySelectorAll("script[src]");

  for (const script of scripts) {
    let src = script.getAttribute("src");
    let match = document.head.querySelector(`script[src='${src}']`);
    if (!match) {
      script.toggleAttribute(SCRIPT_EXC_ATTR);
    }
  }

  for (const script of new_document.querySelectorAll("script:not([src])")) {
    script.toggleAttribute(SCRIPT_EXC_ATTR);
  }
}

/**@param {HTMLScriptElement} source */
function build_fresh_script(source) {
  let script = document.createElement("script");
  script.innerHTML = source.innerHTML;
  for (const attr of source.attributes) {
    script.setAttribute(attr.name, attr.value);
  }
  script.removeAttribute(SCRIPT_EXC_ATTR);
  return script;
}

function run_marked_scripts() {
  /**@type {Promise[]} */
  let script_promise = [];
  for (const script of [...document.scripts]) {
    if (!script.hasAttribute(SCRIPT_EXC_ATTR)) continue;
    let fresh_script = build_fresh_script(script);
    script.replaceWith(fresh_script);

    script_promise.push(new Promise((res) => (fresh_script.onload = res)));
  }

  return script_promise;
}

/**@param {Document} new_document */
function preload_styles(new_document) {
  let style_links = new_document.head.querySelectorAll(
    "link[rel='stylesheet']"
  );

  /**@type {Promise[]} */
  let link_promises = [];

  for (const link of style_links) {
    const href = link.getAttribute("href");
    let match = document.head.querySelector(`link[href='${href}']`);
    if (!match) {
      let preload_link = document.createElement("link");
      preload_link.rel = "preload";
      preload_link.href = href;
      preload_link.as = "style";

      document.head.appendChild(preload_link);

      link_promises.push(
        new Promise(
          (res) =>
            (preload_link.onload = () => {
              // console.log(
              //   "link[rel=preload] loaded",
              //   link.getAttribute("href")
              // );
              preload_link.remove();
              res();
            })
        )
      );
    } else {
      //...
    }
  }

  return link_promises;
}

/**@param {Document} new_document */
function update_head(new_document) {
  for (const element of [...document.head.children]) {
    if (element.matches("link[rel=stylesheet]")) {
      const href = element.getAttribute("href");
      const exist_element = new_document.head.querySelector(
        `link[rel=stylesheet][href='${href}']`
      );

      // If element already in document remove incoming element
      // Else, it doesnt exist in the incoming document, remove it from head
      if (exist_element) {
        exist_element.remove();
      } else {
        element.remove();
      }
    } else if (element.matches("script[src]")) {
      let src = element.getAttribute("src");
      const exist_element = new_document.head.querySelector(
        `script[src='${src}']`
      );

      if (exist_element) {
        exist_element.remove();
      } else {
        element.remove();
      }
    } else if (!element.matches("link[rel=preload]")) {
      element.remove();
    }
  }

  // for (const link of /**@type {NodeListOf<HTMLLinkElement>} */ (
  //   new_document.querySelectorAll("link[rel=stylesheet]")
  // )) {
  //   link.onload = (e) => {
  //     console.log("link[rel=stylesheet] loaded", link.getAttribute("href"));
  //   };
  // }
}

async function fetch_document(path) {
  let res = await fetch(path);
  let text = await res.text();
  let new_document = new DOMParser().parseFromString(text, "text/html");
  return new_document;
}

/**@param {Document} doc */
function get_persist_elements(doc) {
  return doc.querySelectorAll(`[${PERSIST_ATTR}]`);
}

async function route(pathname) {
  window.dispatchEvent(new RouteEvent("fetching"));

  let new_document = await fetch_document(pathname);

  window.dispatchEvent(new RouteEvent("fetched"));

  // TODO - preload new scripts aswell
  mark_incoming_scripts(new_document);
  let style_promises = preload_styles(new_document);

  let start_event = new RouteEvent("view-start");
  window.dispatchEvent(start_event);

  await start_event.promise;

  update_head(new_document);
  document.head.append(...new_document.head.children);

  run_marked_scripts();

  let old_body = document.body;

  // Check new body and look for persist elements, find coresponding element in the old body and use it if exist
  get_persist_elements(new_document).forEach((el) => {
    let id = el.getAttribute(PERSIST_ATTR);
    let old_el = old_body.querySelector(`[${PERSIST_ATTR}=${id}]`);
    if (old_el) {
      el.replaceWith(old_el);
    } else {
      //...
    }
  });

  // Wait for
  await Promise.all(style_promises);
  document.body.replaceWith(new_document.body);

  window.dispatchEvent(new RouteEvent("view-end"));
}

document.addEventListener("click", (e) => {
  let anchor = get_anchor(e);
  if (anchor) {
    e.preventDefault();

    if (anchor.pathname == location.pathname) {
      return;
    }

    e.preventDefault();
    // TODO - build a guard against non trailing slash paths
    route(anchor.pathname);

    history.pushState(null, null, anchor.pathname);
  }
});

window.addEventListener("popstate", (e) => {
  route(location.pathname);
});

// + + + ANIMATION - - -

const animation_type_map = {
  slide: slide_animation,
  fade: fade_animation,
};

function default_animation() {
  let animate = document.body.getAttribute(ANIMATE_ATTR);
  if (animate != "none") {
    /**@type {keyof typeof animation_type_map} */
    let animation_type = document.body.getAttribute(ANIMATE_ATTR) ?? "fade";
    let animation = animation_type_map[animation_type];

    return [
      new Promise((res) => (animation.run(document.body).onfinish = res)),
    ];
  }
  return [];
}

/**
 * @param {Document} doc
 * @param {PlaybackDirection} direction
 *  */
function animate_elements(doc, direction = "normal") {
  /**@type {NodeListOf<HTMLElement>} */
  let elements = doc.querySelectorAll(`[${ANIMATE_ATTR}]`);

  let animation_promises = [...elements]
    .filter((el) => el.getAttribute(ANIMATE_ATTR) != "none")
    .map((element) => {
      /**@type {keyof typeof animation_type_map} */
      let animation_type = element.getAttribute(ANIMATE_ATTR);

      if (!(animation_type in animation_type_map)) return Promise.resolve();

      let animation = animation_type_map[animation_type];

      return new Promise((res) => {
        animation.run(element, { direction, duration: 100 }).onfinish = res;
      });
    });

  return animation_promises;
}

/**@param {RouteEvent<"view-start">} e */
async function view_start_handler(e) {
  let animation_promise = default_animation();
  animation_promise.push(...animate_elements(document));

  e.promise = Promise.all(animation_promise);
}

/**@param {RouteEvent<"view-end">} e */
function view_end_handler(e) {
  let animation_promise = default_animation();

  animation_promise.push(...animate_elements(document, "reverse"));
  e.promise = Promise.all(animation_promise);
}

/**@type {Animation} */
let documentElementAnimation;

/**@param {RouteEvent<"fetching">} e */
function fetching_animation(e) {
  documentElementAnimation = document.documentElement.animate(
    [{ opacity: 1 }, { opacity: 1, transform: "translateY(15px)" }],
    {
      duration: 3000,
      fill: "forwards",
    }
  );
}

/**@param {RouteEvent<"fetched">} e */
function fecthed_animation(e) {
  documentElementAnimation.pause();
  documentElementAnimation.updatePlaybackRate(4);
  documentElementAnimation.reverse();
}

window.addEventListener("route-fetching", fetching_animation);
window.addEventListener("route-fetched", fecthed_animation);

window.addEventListener("route-view-start", view_start_handler);
window.addEventListener("route-view-end", view_end_handler);
