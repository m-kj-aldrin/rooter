import { fade_animation, slide_animation } from "./transitions.js";

const PERSIST_ATTR = "data-rooter-persist";
const ANIMATE_ATTR = "data-rooter-animate";

/**
 * @template {"fetching" | "view-start" | "view-end"} T
 */
export class RouteEvent extends Event {
  /**@type {Promise} */
  #p;

  /**
   * @param {T} type
   */
  constructor(type) {
    super(`route-${type}`);
  }

  get p() {
    return this.#p;
  }

  set p(promise) {
    this.#p = promise;
  }

  wait(ms = 0) {
    this.#p = new Promise((res) => {
      setTimeout(() => {
        res();
      }, ms);
    });
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

// TODO - Do we need to create a new script element to make the browser execute it when appended if its allready is a part of a document?

/**@param {HTMLHeadElement} new_head */
function dif_scripts(new_head) {
  let current_head = document.head;

  /**@type {NodeListOf<HTMLScriptElement>} */
  let current_scripts = current_head.querySelectorAll("script[src]");

  /**@type {NodeListOf<HTMLScriptElement>} */
  let new_scripts = new_head.querySelectorAll("script[src]");

  let bare_new_scripts = [
    ...new_head.querySelectorAll("script:not([src])"),
  ].map((script) => {
    let fresh_script = document.createElement("script");
    fresh_script.textContent = script.textContent;
    return fresh_script;
  });

  /**@type {HTMLScriptElement[]} */
  let new_scripts_dif = bare_new_scripts;

  for (let i = 0; i < new_scripts.length; i++) {
    const new_script = new_scripts[i];

    /**@type {HTMLScriptElement} */
    let match;
    for (let j = 0; j < current_scripts.length; j++) {
      const current_script = current_scripts[j];
      if (new_script.src == current_script.src) {
        match = new_script;
      }
    }

    if (!match) {
      let fresh_script = document.createElement("script");
      fresh_script.src = new_script.src;
      new_scripts_dif.push(fresh_script);
    }
  }

  return new_scripts_dif;
}

/**@param {HTMLHeadElement} new_head */
function dif_styles(new_head) {
  let new_styles = new_head.querySelectorAll("style");

  return new_styles;
}

/**@param {Document} new_document */
function dif_head(new_document) {
  let new_head = new_document.head;

  let new_scripts = dif_scripts(new_head);
  let new_styles = dif_styles(new_head);

  return {
    scripts: new_scripts,
    styles: new_styles,
  };
}

async function fetch_document(path) {
  let res = await fetch(path);
  let text = await res.text();
  let new_document = new DOMParser().parseFromString(text, "text/html");
  return new_document;
}

/**@param {HTMLScriptElement[]} scripts */
async function await_script_load(scripts) {
  return Promise.all(
    scripts
      .filter((script) => script.src)
      .map((script) => {
        return new Promise((res) => {
          script.onload = () => res();
        });
      })
  );
}

/**@param {Document} doc */
function get_persist_elements(doc) {
  return doc.querySelectorAll(`[${PERSIST_ATTR}]`);
}

async function route(pathname) {
  window.dispatchEvent(new RouteEvent("fetching"));

  let new_document = await fetch_document(pathname);

  let new_assets = dif_head(new_document);

  document.head.querySelectorAll("script:not([src])").forEach((script) => {
    script.remove();
  });

  let scripts_loaded = await_script_load(new_assets.scripts);
  document.head.append(...new_assets.scripts);

  await scripts_loaded;

  let start_event = new RouteEvent("view-start");
  window.dispatchEvent(start_event);

  await start_event.p;

  document.head.querySelectorAll("style").forEach((style) => style.remove());
  document.head.append(...new_assets.styles);

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

  document.body.replaceWith(new_document.body);

  window.dispatchEvent(new RouteEvent("view-end"));
}

document.addEventListener("click", (e) => {
  e.preventDefault();
  let anchor = get_anchor(e);
  if (anchor) {
    e.preventDefault();

    if (anchor.pathname == location.pathname) {
      return;
    }

    e.preventDefault();
    route(anchor.pathname);

    history.pushState(null, null, anchor.pathname);
  }
});

window.addEventListener("popstate", (e) => {
  route(location.pathname);
});

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
        animation.run(element, { direction }).onfinish = res;
      });
    });

  return animation_promises;
}

/**@param {RouteEvent<"view-start">} e */
async function view_start_handler(e) {
  let animation_promise = default_animation();
  animation_promise.push(...animate_elements(document));

  e.p = Promise.all(animation_promise);
}

/**@param {RouteEvent<"view-end">} e */
function view_end_handler(e) {
  /**@type {Promise[]} */
  let animation_promise = [];

  let animate = document.body.getAttribute(ANIMATE_ATTR);
  if (animate != "none") {
    animation_promise.push(
      new Promise(
        (res) =>
          (fade_animation.run(document.body, {
            direction: "reverse",
          }).onfinish = res)
      )
    );
  }

  animation_promise.push(...animate_elements(document, "reverse"));
  e.p = Promise.all(animation_promise);
}

window.addEventListener("route-view-start", view_start_handler);
window.addEventListener("route-view-end", view_end_handler);
