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
  //   return doc.querySelectorAll("[data-rooter-persist]");
  /**@type {Map<string,HTMLElement>} */
  let from_elements = new Map(
    [...document.querySelectorAll("[data-rooter-persist]")].map((el) => [
      el.getAttribute("data-rooter-persist"),
      el,
    ])
  );

  return from_elements;

  //   let to_elements = new_doc.querySelectorAll("[data-rooter-persist]");

  //   to_elements.forEach((el) => {
  //     from_elements.get(el.getAttribute("data-rooter-persist")).to = el;
  //   });

  //   return from_elements;
  //   console.log(...from_elements.values());
}

async function route(pathname) {
  window.dispatchEvent(new RouteEvent("fetching"));

  let doc = await fetch_document(pathname);

  let from_elements = get_persist_elements(doc);
  //   persist_elements.forEach((el) => {
  //     el.to.parentElement.insertBefore(el.from.cloneNode(true), el.to);
  //     el.to.remove();
  //   });

  let new_assets = dif_head(doc);

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
  // TODO - UPDATE Body, we should get elements that need to stay intact between views first
  document.body.innerHTML = doc.body.innerHTML;

  let to_elements = get_persist_elements(document);

  from_elements.forEach((el) => {
    let target_element = to_elements.get(
      el.getAttribute("data-rooter-persist")
    );

    target_element?.insertAdjacentElement("afterend", el);
    target_element?.remove();
  });

  window.dispatchEvent(new RouteEvent("view-end"));
}

document.body.addEventListener("click", (e) => {
  let anchor = get_anchor(e);
  if (anchor) {
    if (anchor.pathname == location.pathname) {
      return;
    }

    e.preventDefault();
    route(anchor.pathname);

    history.pushState(null, null, anchor.pathname);
  }
});
