import "../src/rooter.js";
import { RouteEvent } from "../src/rooter.js";

async function wait(ms = 0) {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, ms);
  });
}
/**@type {Animation} */
let view_animation;

/**@param {RouteEvent<"view-start">} e */
async function view_start_handler(e) {
  view_animation = document.body
    .querySelector("main")
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 500,
      fill: "forwards",
    });

  e.p = new Promise((res) => {
    view_animation.onfinish = () => res();
  });
}

/**@param {RouteEvent<"view-end">} e */
function view_end_handler(e) {
  document.body
    .querySelector("main")
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 500,
      fill: "forwards",
      direction: "reverse",
    });
}

window.addEventListener("route-view-start", view_start_handler);
window.addEventListener("route-view-end", view_end_handler);
