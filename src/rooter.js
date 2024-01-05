/**@param {HTMLElement} element */
function is_anchor(element) {
  if (element instanceof HTMLAnchorElement) {
    return element;
  }
}

/**@param {Event} event */
function get_anchor(event) {
  for (const element of event.composedPath()) {
    let anchor = is_anchor(element);
    if (anchor) {
      return anchor;
    }
  }
  return false;
}

async function fetch_document(path) {
  let res = await fetch(path);
  let text = await res.text();
  let doc = new DOMParser().parseFromString(text, "text/html");
  return doc;
}

async function route(pathname) {
  let doc = await fetch_document(pathname);
  console.log(doc);
}

document.body.addEventListener("click", (e) => {
  let anchor = get_anchor(e);
  if (anchor) {
    e.preventDefault();
    route(anchor.pathname);
  }
});
